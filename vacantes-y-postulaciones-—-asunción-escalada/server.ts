import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { BusinessRuleError, store } from './server/db';
import type {
  DashboardKPIs,
  PaginatedResult,
  Postulacion,
  PostulacionEstado,
  TestCaseResult,
  UserRole,
  Vacante,
} from './src/types';

dotenv.config();

const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

interface AuthRequest extends Request {
  userRole: UserRole;
}

function sha256(val: string): Buffer {
  return crypto.createHash('sha256').update(val, 'utf-8').digest();
}

function verifyPasscodeTimingSafe(input: string, expected: string): boolean {
  const a = sha256(input);
  const b = sha256(expected);
  return crypto.timingSafeEqual(a, b);
}

function hashPasswordScrypt(password: string, salt?: string): { salt: string; hash: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, s, 64).toString('hex');
  return { salt: s, hash: derived };
}

function verifyPasswordScrypt(password: string, salt: string, expectedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function signAdminToken(): string {
  const payload = JSON.stringify({
    role: 'admin',
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(8).toString('hex'),
  });
  const encoded = Buffer.from(payload, 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyAdminToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const a = Buffer.from(sig, 'utf-8');
  const b = Buffer.from(expectedSig, 'utf-8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as {
      role?: string;
      exp?: number;
    };
    return parsed.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function attachRole(req: Request, _res: Response, next: NextFunction): void {
  const authReq = req as AuthRequest;
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (verifyAdminToken(token)) {
      authReq.userRole = 'admin';
      next();
      return;
    }
  }
  authReq.userRole = 'consulta';
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthRequest;
  if (authReq.userRole !== 'admin') {
    res.status(401).json({
      ok: false,
      code: 'NO_AUTORIZADO',
      rule: 'Control de Acceso por Rol (RBAC)',
      message: 'Operación restringida al Administrador.',
      reason: 'El usuario de consulta solo puede revisar información autorizada. Inicie sesión como Administrador.',
    });
    return;
  }
  next();
}

function maskDocument(doc: string): string {
  if (!doc) return '***';
  if (doc.length <= 3) return '***';
  return `${'*'.repeat(Math.max(3, doc.length - 3))}${doc.slice(-3)}`;
}

function paginate<T>(items: T[], pageRaw: unknown, pageSizeRaw: unknown): PaginatedResult<T> {
  const pageSize = Math.min(50, Math.max(1, Number(pageSizeRaw) || 6));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number(pageRaw) || 1));
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}

function sendRuleError(res: Response, err: unknown, operationName?: string): void {
  if (err instanceof BusinessRuleError) {
    if (operationName) {
      void store.logDecision({
        operacion: operationName,
        aceptado: false,
        codigo: err.code,
        regla: err.rule,
        motivo: err.message,
        entidad: err.reason,
      });
    }
    res.status(err.status).json({
      ok: false,
      code: err.code,
      rule: err.rule,
      message: err.message,
      reason: err.reason,
    });
    return;
  }
  console.error('Unexpected server error:', err);
  res.status(500).json({
    ok: false,
    code: 'ERROR_INTERNO',
    rule: 'Sistema',
    message: 'Error interno procesando la solicitud.',
    reason: (err as Error)?.message || 'Error inesperado',
  });
}

function isValidGithubRepoSlug(slug: string): boolean {
  return /^[a-zA-Z0-9_.-]{1,100}\/[a-zA-Z0-9_.-]{1,100}$/.test(slug);
}

function isSafeRenderUrl(rawUrl: string): { valid: boolean; url?: URL; reason?: string } {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') {
      return { valid: false, reason: 'La URL de Render debe usar protocolo HTTPS.' };
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.') ||
      host === '169.254.169.254'
    ) {
      return { valid: false, reason: 'Dirección privada o local no permitida.' };
    }
    if (!host.endsWith('.onrender.com')) {
      return { valid: false, reason: 'Solo se permiten dominios públicos de Render (*.onrender.com).' };
    }
    return { valid: true, url: parsed };
  } catch {
    return { valid: false, reason: 'Formato de URL inválido.' };
  }
}

async function startServer(): Promise<void> {
  await store.init();

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(attachRole);

  // ---- HEALTH ----
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      engine: store.engine,
      connected: store.isConnected(),
      timestamp: new Date().toISOString(),
    });
  });

  // ---- AUTH ----
  app.get('/api/auth/status', (req, res) => {
    const authReq = req as AuthRequest;
    const envPasscodeConfigured = Boolean((process.env.ADMIN_PASSCODE || '').trim());
    const adminClaimed = envPasscodeConfigured || Boolean(store.getAdminAuth());
    res.json({
      role: authReq.userRole,
      adminClaimed,
      envPasscodeConfigured,
    });
  });

  app.post('/api/auth/claim-admin', (req, res) => {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    if (envPasscode) {
      res.status(409).json({
        ok: false,
        code: 'PASSCODE_POR_ENTORNO',
        rule: 'Seguridad',
        message: 'La clave de administrador ya está configurada por variable de entorno.',
        reason: 'Use el acceso normal con la clave ADMIN_PASSCODE configurada en Secrets.',
      });
      return;
    }
    if (store.getAdminAuth()) {
      res.status(409).json({
        ok: false,
        code: 'ADMIN_YA_RECLAMADO',
        rule: 'Seguridad',
        message: 'La clave de administrador ya fue configurada.',
        reason: 'Inicie sesión con su clave de administrador.',
      });
      return;
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (passcode.length < 4 || passcode.length > 64) {
      res.status(400).json({
        ok: false,
        code: 'PASSCODE_INVALIDO',
        rule: 'Seguridad',
        message: 'La clave debe tener entre 4 y 64 caracteres.',
        reason: 'Defina una clave segura para proteger las operaciones del administrador.',
      });
      return;
    }

    const { salt, hash } = hashPasswordScrypt(passcode);
    const claimed = store.claimAdminAuth({ salt, hash, claimedAt: new Date().toISOString() });
    if (!claimed) {
      res.status(409).json({
        ok: false,
        code: 'ADMIN_YA_RECLAMADO',
        rule: 'Seguridad',
        message: 'La clave de administrador ya fue reclamada.',
        reason: 'Inicie sesión con la clave existente.',
      });
      return;
    }

    const token = signAdminToken();
    res.json({
      ok: true,
      role: 'admin',
      token,
      message: 'Acceso Administrador configurado e iniciado correctamente.',
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();

    if (envPasscode) {
      if (!passcode || !verifyPasscodeTimingSafe(passcode, envPasscode)) {
        res.status(401).json({
          ok: false,
          code: 'CREDENCIALES_INVALIDAS',
          rule: 'Autenticación',
          message: 'Clave de administrador incorrecta.',
          reason: 'Verifique la clave configurada en ADMIN_PASSCODE.',
        });
        return;
      }
      res.json({ ok: true, role: 'admin', token: signAdminToken() });
      return;
    }

    const saved = store.getAdminAuth();
    if (!saved) {
      res.status(400).json({
        ok: false,
        code: 'SIN_ADMIN_CONFIGURADO',
        rule: 'Autenticación',
        message: 'Aún no se ha definido la clave inicial de administrador.',
        reason: 'Complete el formulario de configuración inicial de clave.',
      });
      return;
    }

    if (!passcode || !verifyPasswordScrypt(passcode, saved.salt, saved.hash)) {
      res.status(401).json({
        ok: false,
        code: 'CREDENCIALES_INVALIDAS',
        rule: 'Autenticación',
        message: 'Clave de administrador incorrecta.',
        reason: 'Verifique la clave ingresada.',
      });
      return;
    }

    res.json({ ok: true, role: 'admin', token: signAdminToken() });
  });

  // ---- DASHBOARD ----
  app.get('/api/dashboard', async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const [empresas, vacantes, candidatos, postulaciones, logs] = await Promise.all([
        store.listEmpresas(),
        store.listVacantesEnriched(),
        store.listCandidatos(),
        store.listPostulacionesEnriched(),
        store.getDecisionLogs(20),
      ]);

      const abiertas = vacantes.filter((v) => v.estado === 'abierta');
      const cerradas = vacantes.filter((v) => v.estado === 'cerrada');
      const cuposTotalesAbiertos = abiertas.reduce((acc, v) => acc + v.cupos, 0);
      const cuposCubiertosAbiertos = abiertas.reduce((acc, v) => acc + (v.seleccionados_count || 0), 0);
      const cuposPorCubrir = abiertas.reduce((acc, v) => acc + (v.cupos_disponibles || 0), 0);

      const kpis: DashboardKPIs = {
        vacantesAbiertas: abiertas.length,
        vacantesCerradas: cerradas.length,
        totalVacantes: vacantes.length,
        totalPostulantes: candidatos.length,
        totalPostulaciones: postulaciones.length,
        cuposTotalesAbiertos,
        cuposCubiertosAbiertos,
        cuposPorCubrir,
        empresasRegistradas: empresas.length,
      };

      res.json({
        kpis,
        vacantes,
        decisionLogs: authReq.userRole === 'admin' ? logs : logs.slice(0, 8).map((l) => ({ ...l, entidad: 'Autorizado' })),
      });
    } catch (err) {
      sendRuleError(res, err);
    }
  });

  // ---- EMPRESAS ----
  app.get('/api/empresas', async (_req, res) => {
    try {
      const empresas = await store.listEmpresas();
      res.json({ items: empresas });
    } catch (err) {
      sendRuleError(res, err);
    }
  });

  app.post('/api/empresas', requireAdmin, async (req, res) => {
    try {
      const { nombre, rubro, ciudad, direccion, latitud, longitud } = req.body || {};
      const lat = Number(latitud);
      const lng = Number(longitud);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        throw new BusinessRuleError(
          400,
          'COORDENADAS_INVALIDAS',
          'Geolocalización',
          'Latitud o longitud fuera de rango válido.',
          'Seleccione una ubicación válida en el mapa OpenStreetMap.'
        );
      }
      const created = await store.createEmpresa({
        nombre: String(nombre || ''),
        rubro: String(rubro || ''),
        ciudad: String(ciudad || 'Asunción'),
        direccion: String(direccion || ''),
        latitud: lat,
        longitud: lng,
      });
      const motivo = `Empresa "${created.nombre}" (${created.rubro}) registrada con coordenadas (${created.latitud.toFixed(5)}, ${created.longitud.toFixed(5)}).`;
      await store.logDecision({
        operacion: 'Alta de Empresa',
        aceptado: true,
        codigo: 'EMPRESA_CREADA',
        regla: 'Unicidad y Geolocalización',
        motivo,
        entidad: `Empresa #${created.id}`,
      });
      res.status(201).json({
        ok: true,
        code: 'EMPRESA_CREADA',
        rule: 'Unicidad y Geolocalización',
        message: `Empresa "${created.nombre}" registrada correctamente.`,
        reason: motivo,
        data: created,
      });
    } catch (err) {
      sendRuleError(res, err, 'Alta de Empresa');
    }
  });

  app.put('/api/empresas/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { nombre, rubro, ciudad, direccion, latitud, longitud } = req.body || {};
      const lat = Number(latitud);
      const lng = Number(longitud);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new BusinessRuleError(400, 'COORDENADAS_INVALIDAS', 'Geolocalización', 'Coordenadas inválidas.', 'Indique latitud y longitud numéricas.');
      }
      const updated = await store.updateEmpresa(id, {
        nombre: String(nombre || ''),
        rubro: String(rubro || ''),
        ciudad: String(ciudad || 'Asunción'),
        direccion: String(direccion || ''),
        latitud: lat,
        longitud: lng,
      });
      const motivo = `Empresa "${updated.nombre}" actualizada correctamente.`;
      await store.logDecision({
        operacion: 'Modificación de Empresa',
        aceptado: true,
        codigo: 'EMPRESA_ACTUALIZADA',
        regla: 'Unicidad de Empresa',
        motivo,
        entidad: `Empresa #${updated.id}`,
      });
      res.json({
        ok: true,
        code: 'EMPRESA_ACTUALIZADA',
        rule: 'Unicidad de Empresa',
        message: motivo,
        reason: motivo,
        data: updated,
      });
    } catch (err) {
      sendRuleError(res, err, 'Modificación de Empresa');
    }
  });

  app.delete('/api/empresas/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await store.deleteEmpresa(id);
      const motivo = `Empresa #${id} eliminada al no poseer vacantes vinculadas.`;
      await store.logDecision({
        operacion: 'Baja de Empresa',
        aceptado: true,
        codigo: 'EMPRESA_ELIMINADA',
        regla: 'Integridad Referencial',
        motivo,
        entidad: `Empresa #${id}`,
      });
      res.json({
        ok: true,
        code: 'EMPRESA_ELIMINADA',
        rule: 'Integridad Referencial',
        message: 'Empresa eliminada correctamente.',
        reason: motivo,
      });
    } catch (err) {
      sendRuleError(res, err, 'Baja de Empresa');
    }
  });

  // ---- VACANTES (Búsqueda + Filtros Combinados + Orden + Paginación) ----
  app.get('/api/vacantes', async (req, res) => {
    try {
      const [vacantes, postulaciones] = await Promise.all([
        store.listVacantesEnriched(),
        store.listPostulacionesRaw(),
      ]);

      const q = String(req.query.q || '').trim().toLowerCase();
      const cargo = String(req.query.cargo || '').trim().toLowerCase();
      const empresaId = String(req.query.empresaId || '').trim();
      const rubro = String(req.query.rubro || '').trim().toLowerCase();
      const estado = String(req.query.estado || '').trim().toLowerCase();
      const fechaDesde = String(req.query.fechaDesde || '').trim();
      const fechaHasta = String(req.query.fechaHasta || '').trim();
      const candidatoId = String(req.query.candidatoId || '').trim();

      const filtered = vacantes.filter((v) => {
        if (q) {
          const hay =
            v.cargo.toLowerCase().includes(q) ||
            v.descripcion.toLowerCase().includes(q) ||
            (v.empresa_nombre || '').toLowerCase().includes(q) ||
            (v.empresa_rubro || '').toLowerCase().includes(q);
          if (!hay) return false;
        }
        if (cargo && !v.cargo.toLowerCase().includes(cargo)) return false;
        if (empresaId && String(v.empresa_id) !== empresaId) return false;
        if (rubro && (v.empresa_rubro || '').toLowerCase() !== rubro) return false;
        if (estado && v.estado.toLowerCase() !== estado) return false;
        if (fechaDesde && v.cierre < fechaDesde) return false;
        if (fechaHasta && v.cierre > fechaHasta) return false;
        if (candidatoId) {
          const cid = Number(candidatoId);
          const hasCand = postulaciones.some((p) => p.vacante_id === v.id && p.candidato_id === cid);
          if (!hasCand) return false;
        }
        return true;
      });

      const sortBy = String(req.query.sortBy || 'cierre');
      const sortDir = String(req.query.sortDir || 'asc') === 'desc' ? -1 : 1;

      filtered.sort((a: Vacante, b: Vacante) => {
        let cmp = 0;
        if (sortBy === 'cargo') cmp = a.cargo.localeCompare(b.cargo, 'es');
        else if (sortBy === 'empresa') cmp = (a.empresa_nombre || '').localeCompare(b.empresa_nombre || '', 'es');
        else if (sortBy === 'cupos') cmp = (a.cupos_disponibles || 0) - (b.cupos_disponibles || 0);
        else if (sortBy === 'estado') cmp = a.estado.localeCompare(b.estado, 'es');
        else cmp = a.cierre.localeCompare(b.cierre);
        return cmp * sortDir;
      });

      const paginated = paginate(filtered, req.query.page, req.query.pageSize);
      const rubros = Array.from(new Set(vacantes.map((v) => v.empresa_rubro || '').filter(Boolean))).sort();

      res.json({
        ...paginated,
        facets: { rubros },
      });
    } catch (err) {
      sendRuleError(res, err);
    }
  });

  app.post('/api/vacantes', requireAdmin, async (req, res) => {
    try {
      const { empresa_id, cargo, descripcion, cierre, cupos, estado } = req.body || {};
      const created = await store.createVacante({
        empresa_id: Number(empresa_id),
        cargo: String(cargo || ''),
        descripcion: String(descripcion || ''),
        cierre: String(cierre || ''),
        cupos: Number(cupos),
        estado: estado === 'cerrada' ? 'cerrada' : 'abierta',
      });
      const motivo = `Vacante "${created.cargo}" creada con ${created.cupos} cupo(s) y cierre ${created.cierre}.`;
      await store.logDecision({
        operacion: 'Alta de Vacante',
        aceptado: true,
        codigo: 'VACANTE_CREADA',
        regla: 'Validación de Vacante',
        motivo,
        entidad: `Vacante #${created.id}`,
      });
      res.status(201).json({
        ok: true,
        code: 'VACANTE_CREADA',
        rule: 'Validación de Vacante',
        message: `Vacante "${created.cargo}" publicada.`,
        reason: motivo,
        data: created,
      });
    } catch (err) {
      sendRuleError(res, err, 'Alta de Vacante');
    }
  });

  app.put('/api/vacantes/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { empresa_id, cargo, descripcion, cierre, cupos, estado } = req.body || {};
      const updated = await store.updateVacante(id, {
        empresa_id: empresa_id !== undefined ? Number(empresa_id) : undefined,
        cargo: cargo !== undefined ? String(cargo) : undefined,
        descripcion: descripcion !== undefined ? String(descripcion) : undefined,
        cierre: cierre !== undefined ? String(cierre) : undefined,
        cupos: cupos !== undefined ? Number(cupos) : undefined,
        estado: estado === 'cerrada' ? 'cerrada' : estado === 'abierta' ? 'abierta' : undefined,
      });
      const motivo =
        updated.estado === 'cerrada'
          ? `Vacante "${updated.cargo}" cerrada: nuevas postulaciones y selecciones quedan bloqueadas.`
          : `Vacante "${updated.cargo}" actualizada (${updated.cupos} cupos, cierre ${updated.cierre}).`;
      await store.logDecision({
        operacion: 'Modificación de Vacante',
        aceptado: true,
        codigo: 'VACANTE_ACTUALIZADA',
        regla: updated.estado === 'cerrada' ? 'Cierre de Vacante' : 'Control de Cupos',
        motivo,
        entidad: `Vacante #${updated.id}`,
      });
      res.json({
        ok: true,
        code: 'VACANTE_ACTUALIZADA',
        rule: updated.estado === 'cerrada' ? 'Cierre de Vacante' : 'Control de Cupos',
        message: `Vacante "${updated.cargo}" actualizada.`,
        reason: motivo,
        data: updated,
      });
    } catch (err) {
      sendRuleError(res, err, 'Modificación de Vacante');
    }
  });

  app.delete('/api/vacantes/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await store.deleteVacante(id);
      const motivo = `Vacante #${id} eliminada sin postulaciones asociadas.`;
      await store.logDecision({
        operacion: 'Baja de Vacante',
        aceptado: true,
        codigo: 'VACANTE_ELIMINADA',
        regla: 'Integridad Referencial',
        motivo,
        entidad: `Vacante #${id}`,
      });
      res.json({
        ok: true,
        code: 'VACANTE_ELIMINADA',
        rule: 'Integridad Referencial',
        message: 'Vacante eliminada correctamente.',
        reason: motivo,
      });
    } catch (err) {
      sendRuleError(res, err, 'Baja de Vacante');
    }
  });

  // ---- CANDIDATOS ----
  app.get('/api/candidatos', async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const list = await store.listCandidatos();
      const sanitized =
        authReq.userRole === 'admin'
          ? list
          : list.map((c) => ({
              ...c,
              documento: maskDocument(c.documento),
              email: 'Protegido (Solo Admin)',
              telefono: 'Protegido',
            }));
      res.json({ items: sanitized });
    } catch (err) {
      sendRuleError(res, err);
    }
  });

  app.post('/api/candidatos', requireAdmin, async (req, res) => {
    try {
      const { documento, nombre, email, telefono } = req.body || {};
      const created = await store.createCandidato({
        documento: String(documento || ''),
        nombre: String(nombre || ''),
        email: String(email || ''),
        telefono: String(telefono || ''),
      });
      const motivo = `Candidato "${created.nombre}" (CI ${created.documento}) registrado sin duplicados.`;
      await store.logDecision({
        operacion: 'Alta de Candidato',
        aceptado: true,
        codigo: 'CANDIDATO_CREADO',
        regla: 'Documento Único',
        motivo,
        entidad: `Candidato #${created.id}`,
      });
      res.status(201).json({
        ok: true,
        code: 'CANDIDATO_CREADO',
        rule: 'Documento Único',
        message: `Candidato "${created.nombre}" registrado.`,
        reason: motivo,
        data: created,
      });
    } catch (err) {
      sendRuleError(res, err, 'Alta de Candidato');
    }
  });

  app.put('/api/candidatos/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { documento, nombre, email, telefono } = req.body || {};
      const updated = await store.updateCandidato(id, {
        documento: String(documento || ''),
        nombre: String(nombre || ''),
        email: String(email || ''),
        telefono: String(telefono || ''),
      });
      const motivo = `Candidato "${updated.nombre}" actualizado.`;
      await store.logDecision({
        operacion: 'Modificación de Candidato',
        aceptado: true,
        codigo: 'CANDIDATO_ACTUALIZADO',
        regla: 'Documento Único',
        motivo,
        entidad: `Candidato #${updated.id}`,
      });
      res.json({
        ok: true,
        code: 'CANDIDATO_ACTUALIZADO',
        rule: 'Documento Único',
        message: motivo,
        reason: motivo,
        data: updated,
      });
    } catch (err) {
      sendRuleError(res, err, 'Modificación de Candidato');
    }
  });

  app.delete('/api/candidatos/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await store.deleteCandidato(id);
      const motivo = `Candidato #${id} eliminado sin postulaciones vinculadas.`;
      await store.logDecision({
        operacion: 'Baja de Candidato',
        aceptado: true,
        codigo: 'CANDIDATO_ELIMINADO',
        regla: 'Integridad Referencial',
        motivo,
        entidad: `Candidato #${id}`,
      });
      res.json({
        ok: true,
        code: 'CANDIDATO_ELIMINADO',
        rule: 'Integridad Referencial',
        message: 'Candidato eliminado.',
        reason: motivo,
      });
    } catch (err) {
      sendRuleError(res, err, 'Baja de Candidato');
    }
  });

  // ---- POSTULACIONES (Búsqueda + Filtros Combinados + Orden + Paginación) ----
  app.get('/api/postulaciones', async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const list = await store.listPostulacionesEnriched();

      const q = String(req.query.q || '').trim().toLowerCase();
      const cargo = String(req.query.cargo || '').trim().toLowerCase();
      const empresaId = String(req.query.empresaId || '').trim();
      const rubro = String(req.query.rubro || '').trim().toLowerCase();
      const estado = String(req.query.estado || '').trim().toLowerCase();
      const fechaDesde = String(req.query.fechaDesde || '').trim();
      const fechaHasta = String(req.query.fechaHasta || '').trim();
      const candidatoId = String(req.query.candidatoId || '').trim();

      const filtered = list.filter((p) => {
        if (q) {
          const hay =
            (p.vacante_cargo || '').toLowerCase().includes(q) ||
            (p.empresa_nombre || '').toLowerCase().includes(q) ||
            (p.empresa_rubro || '').toLowerCase().includes(q) ||
            (p.candidato_nombre || '').toLowerCase().includes(q) ||
            (authReq.userRole === 'admin' && (p.candidato_documento || '').toLowerCase().includes(q));
          if (!hay) return false;
        }
        if (cargo && !(p.vacante_cargo || '').toLowerCase().includes(cargo)) return false;
        if (empresaId && String(p.empresa_id || '') !== empresaId) return false;
        if (rubro && (p.empresa_rubro || '').toLowerCase() !== rubro) return false;
        if (estado && p.estado.toLowerCase() !== estado) return false;
        const postDay = p.fecha.slice(0, 10);
        if (fechaDesde && postDay < fechaDesde) return false;
        if (fechaHasta && postDay > fechaHasta) return false;
        if (candidatoId && String(p.candidato_id) !== candidatoId) return false;
        return true;
      });

      const sortBy = String(req.query.sortBy || 'fecha');
      const sortDir = String(req.query.sortDir || 'desc') === 'asc' ? 1 : -1;

      filtered.sort((a: Postulacion, b: Postulacion) => {
        let cmp = 0;
        if (sortBy === 'cargo') cmp = (a.vacante_cargo || '').localeCompare(b.vacante_cargo || '', 'es');
        else if (sortBy === 'empresa') cmp = (a.empresa_nombre || '').localeCompare(b.empresa_nombre || '', 'es');
        else if (sortBy === 'estado') cmp = a.estado.localeCompare(b.estado, 'es');
        else cmp = a.fecha.localeCompare(b.fecha);
        return cmp * sortDir;
      });

      const sanitized =
        authReq.userRole === 'admin'
          ? filtered
          : filtered.map((p) => ({
              ...p,
              candidato_documento: maskDocument(p.candidato_documento || ''),
            }));

      const paginated = paginate(sanitized, req.query.page, req.query.pageSize);
      res.json(paginated);
    } catch (err) {
      sendRuleError(res, err);
    }
  });

  app.post('/api/postulaciones', requireAdmin, async (req, res) => {
    try {
      const { vacante_id, candidato_id, fecha } = req.body || {};
      const result = await store.createPostulacion({
        vacante_id: Number(vacante_id),
        candidato_id: Number(candidato_id),
        fecha: fecha ? String(fecha) : undefined,
      });
      await store.logDecision({
        operacion: 'Registrar Postulación',
        aceptado: true,
        codigo: 'POSTULACION_ACEPTADA',
        regla: 'Plazo de Cierre y Unicidad',
        motivo: result.motivo,
        entidad: `Postulación #${result.postulacion.id}`,
      });
      res.status(201).json({
        ok: true,
        code: 'POSTULACION_ACEPTADA',
        rule: 'Plazo de Cierre y Unicidad',
        message: 'Postulación registrada correctamente.',
        reason: result.motivo,
        data: result.postulacion,
      });
    } catch (err) {
      sendRuleError(res, err, 'Registrar Postulación');
    }
  });

  app.patch('/api/postulaciones/:id/estado', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const estado = req.body?.estado as PostulacionEstado;
      if (!['pendiente', 'seleccionado', 'rechazado'].includes(estado)) {
        throw new BusinessRuleError(400, 'ESTADO_INVALIDO', 'Validación', 'Estado de postulación inválido.', 'Use pendiente, seleccionado o rechazado.');
      }
      const result = await store.changePostulacionEstado(id, estado);
      await store.logDecision({
        operacion: `Cambiar estado a ${estado}`,
        aceptado: true,
        codigo: result.code,
        regla: result.rule,
        motivo: result.motivo,
        entidad: `Postulación #${id}`,
      });
      res.json({
        ok: true,
        code: result.code,
        rule: result.rule,
        message: result.motivo,
        reason: result.motivo,
        data: result.postulacion,
      });
    } catch (err) {
      sendRuleError(res, err, 'Evaluar Postulación');
    }
  });

  app.delete('/api/postulaciones/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await store.deletePostulacion(id);
      const motivo = `Postulación #${id} eliminada correctamente.`;
      await store.logDecision({
        operacion: 'Baja de Postulación',
        aceptado: true,
        codigo: 'POSTULACION_ELIMINADA',
        regla: 'Gestión Administrativa',
        motivo,
        entidad: `Postulación #${id}`,
      });
      res.json({
        ok: true,
        code: 'POSTULACION_ELIMINADA',
        rule: 'Gestión Administrativa',
        message: 'Postulación eliminada.',
        reason: motivo,
      });
    } catch (err) {
      sendRuleError(res, err, 'Baja de Postulación');
    }
  });

  // ---- PRUEBA INDIVIDUAL OBLIGATORIA & CONCURRENCIA ----
  app.post('/api/tests/run-suite', requireAdmin, async (_req, res) => {
    const suiteResults: TestCaseResult[] = [];
    const suffix = Date.now().toString().slice(-6);

    let qaEmpresaId: number | null = null;
    const qaVacIds: number[] = [];
    const qaCandIds: number[] = [];
    const qaPostIds: number[] = [];

    try {
      const emp = await store.createEmpresa({
        nombre: `__QA_Empresa_${suffix}`,
        rubro: 'Laboratorio de Pruebas',
        ciudad: 'Asunción',
        direccion: 'Calle Prueba QA 100',
        latitud: -25.286,
        longitud: -57.647,
      });
      qaEmpresaId = emp.id;

      const c1 = await store.createCandidato({ documento: `QA-${suffix}-1`, nombre: 'QA Postulante Uno' });
      const c2 = await store.createCandidato({ documento: `QA-${suffix}-2`, nombre: 'QA Postulante Dos' });
      const c3 = await store.createCandidato({ documento: `QA-${suffix}-3`, nombre: 'QA Postulante Tres' });
      qaCandIds.push(c1.id, c2.id, c3.id);

      // TEST 1: Seleccionar hasta el cupo y rechazar selección adicional
      const t1Start = Date.now();
      const v1 = await store.createVacante({
        empresa_id: emp.id,
        cargo: `QA Cargo Cupos ${suffix}`,
        descripcion: 'Prueba de cupo máximo = 2',
        cierre: '2026-12-31',
        cupos: 2,
        estado: 'abierta',
      });
      qaVacIds.push(v1.id);

      const p1a = (await store.createPostulacion({ vacante_id: v1.id, candidato_id: c1.id })).postulacion;
      const p1b = (await store.createPostulacion({ vacante_id: v1.id, candidato_id: c2.id })).postulacion;
      const p1c = (await store.createPostulacion({ vacante_id: v1.id, candidato_id: c3.id })).postulacion;
      qaPostIds.push(p1a.id, p1b.id, p1c.id);

      const t1Details: TestCaseResult['detalles'] = [];
      const r1 = await store.changePostulacionEstado(p1a.id, 'seleccionado');
      t1Details.push({
        paso: 'Selección #1 (Cupo 1/2)',
        aceptado: true,
        httpStatus: 200,
        codigo: r1.code,
        motivo: r1.motivo,
        timestamp: new Date().toISOString(),
      });

      const r2 = await store.changePostulacionEstado(p1b.id, 'seleccionado');
      t1Details.push({
        paso: 'Selección #2 (Cupo 2/2)',
        aceptado: true,
        httpStatus: 200,
        codigo: r2.code,
        motivo: r2.motivo,
        timestamp: new Date().toISOString(),
      });

      let t1ThirdRejected = false;
      try {
        await store.changePostulacionEstado(p1c.id, 'seleccionado');
      } catch (err) {
        if (err instanceof BusinessRuleError && err.code === 'CUPO_COMPLETO') {
          t1ThirdRejected = true;
          t1Details.push({
            paso: 'Selección #3 adicional (Cupo excedido)',
            aceptado: false,
            httpStatus: err.status,
            codigo: err.code,
            motivo: err.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      suiteResults.push({
        id: 'TEST-1',
        titulo: 'Selección hasta el cupo y rechazo de selección adicional',
        objetivo: 'Demostrar que una vacante con 2 cupos acepta exactamente 2 seleccionados y rechaza al 3°.',
        entradas: { vacante: v1.cargo, cupos: 2, candidatos: [c1.nombre, c2.nombre, c3.nombre] },
        resultadoEsperado: '2 selecciones aceptadas (HTTP 200) y 1 selección adicional rechazada (HTTP 409 CUPO_COMPLETO).',
        resultadoObtenido: t1ThirdRejected
          ? 'Se aceptaron 2 selecciones y se rechazó la 3ª por cupos completos.'
          : 'Fallo: se permitió exceder el cupo.',
        detalles: t1Details,
        aprobado: t1ThirdRejected,
        duracionMs: Date.now() - t1Start,
      });

      // TEST 2: Rechazo de postulación tardía (fuera de fecha de cierre)
      const t2Start = Date.now();
      const v2 = await store.createVacante({
        empresa_id: emp.id,
        cargo: `QA Cargo Vencido ${suffix}`,
        descripcion: 'Prueba de cierre expirado',
        cierre: '2026-10-15',
        cupos: 1,
        estado: 'abierta',
      });
      qaVacIds.push(v2.id);

      const t2Details: TestCaseResult['detalles'] = [];
      let t2Rejected = false;
      const fechaTardia = '2026-11-24T12:00:00.000Z';
      try {
        await store.createPostulacion({ vacante_id: v2.id, candidato_id: c1.id, fecha: fechaTardia });
      } catch (err) {
        if (err instanceof BusinessRuleError && err.code === 'POSTULACION_FUERA_DE_CIERRE') {
          t2Rejected = true;
          t2Details.push({
            paso: 'Postulación con fecha posterior al cierre (2026-10-15)',
            aceptado: false,
            httpStatus: err.status,
            codigo: err.code,
            motivo: err.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      suiteResults.push({
        id: 'TEST-2',
        titulo: 'Rechazo de postulación tardía (fuera de cierre)',
        objetivo: 'Verificar que ninguna postulación con fecha posterior al cierre de la vacante sea admitida.',
        entradas: { vacante: v2.cargo, cierre: '2026-10-15', fechaPostulacion: '2026-11-24', candidato: c1.nombre },
        resultadoEsperado: 'Rechazo automático HTTP 422 POSTULACION_FUERA_DE_CIERRE.',
        resultadoObtenido: t2Rejected
          ? 'Postulación tardía bloqueada correctamente con motivo explícito.'
          : 'Fallo: se admitió postulación fuera de plazo.',
        detalles: t2Details,
        aprobado: t2Rejected,
        duracionMs: Date.now() - t2Start,
      });

      // TEST 3: Cierre bloquea nuevas postulaciones + Prevención de duplicados
      const t3Start = Date.now();
      const v3 = await store.createVacante({
        empresa_id: emp.id,
        cargo: `QA Cargo Cerrado ${suffix}`,
        descripcion: 'Prueba de vacante cerrada y duplicados',
        cierre: '2026-12-31',
        cupos: 2,
        estado: 'cerrada',
      });
      qaVacIds.push(v3.id);

      const t3Details: TestCaseResult['detalles'] = [];
      let closedBlocked = false;
      try {
        await store.createPostulacion({ vacante_id: v3.id, candidato_id: c1.id });
      } catch (err) {
        if (err instanceof BusinessRuleError && err.code === 'VACANTE_CERRADA') {
          closedBlocked = true;
          t3Details.push({
            paso: 'Intento de postular a vacante cerrada',
            aceptado: false,
            httpStatus: err.status,
            codigo: err.code,
            motivo: err.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      let duplicateBlocked = false;
      try {
        await store.createPostulacion({ vacante_id: v1.id, candidato_id: c1.id });
      } catch (err) {
        if (err instanceof BusinessRuleError && err.code === 'POSTULACION_DUPLICADA') {
          duplicateBlocked = true;
          t3Details.push({
            paso: 'Intento de postulación duplicada (mismo candidato y vacante)',
            aceptado: false,
            httpStatus: err.status,
            codigo: err.code,
            motivo: err.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      suiteResults.push({
        id: 'TEST-3',
        titulo: 'Bloqueo por vacante cerrada y rechazo de duplicados',
        objetivo: 'Validar que cerrar una vacante bloquea nuevas postulaciones y que no se permiten duplicados.',
        entradas: { vacanteCerrada: v3.cargo, vacanteDuplicada: v1.cargo, candidato: c1.nombre },
        resultadoEsperado: 'Ambos intentos rechazados (422 VACANTE_CERRADA y 409 POSTULACION_DUPLICADA).',
        resultadoObtenido:
          closedBlocked && duplicateBlocked
            ? 'Vacante cerrada bloqueada y postulación duplicada rechazada.'
            : 'Fallo en alguna de las validaciones.',
        detalles: t3Details,
        aprobado: closedBlocked && duplicateBlocked,
        duracionMs: Date.now() - t3Start,
      });

      // TEST 4: Concurrencia real por el último cupo (Promise.all paralelo)
      const t4Start = Date.now();
      const v4 = await store.createVacante({
        empresa_id: emp.id,
        cargo: `QA Concurrencia Ultimo Cupo ${suffix}`,
        descripcion: 'Prueba de carrera concurrente por 1 único cupo',
        cierre: '2026-12-31',
        cupos: 1,
        estado: 'abierta',
      });
      qaVacIds.push(v4.id);

      const p4a = (await store.createPostulacion({ vacante_id: v4.id, candidato_id: c1.id })).postulacion;
      const p4b = (await store.createPostulacion({ vacante_id: v4.id, candidato_id: c2.id })).postulacion;
      qaPostIds.push(p4a.id, p4b.id);

      // Lanzar DOS solicitudes simultáneas en paralelo compitiendo por el único cupo
      const settled = await Promise.allSettled([
        store.changePostulacionEstado(p4a.id, 'seleccionado'),
        store.changePostulacionEstado(p4b.id, 'seleccionado'),
      ]);

      const t4Details: TestCaseResult['detalles'] = settled.map((item, idx) => {
        if (item.status === 'fulfilled') {
          return {
            paso: `Solicitud concurrente #${idx + 1} (${idx === 0 ? c1.nombre : c2.nombre})`,
            aceptado: true,
            httpStatus: 200,
            codigo: item.value.code,
            motivo: item.value.motivo,
            timestamp: new Date().toISOString(),
          };
        }
        const err = item.reason;
        return {
          paso: `Solicitud concurrente #${idx + 1} (${idx === 0 ? c1.nombre : c2.nombre})`,
          aceptado: false,
          httpStatus: err instanceof BusinessRuleError ? err.status : 500,
          codigo: err instanceof BusinessRuleError ? err.code : 'ERROR',
          motivo: err instanceof Error ? err.message : 'Error',
          timestamp: new Date().toISOString(),
        };
      });

      const acceptedCount = settled.filter((s) => s.status === 'fulfilled').length;
      const rejectedCount = settled.filter((s) => s.status === 'rejected').length;
      const passedConcurrency = acceptedCount === 1 && rejectedCount === 1;

      suiteResults.push({
        id: 'TEST-4',
        titulo: 'Concurrencia simultánea por último cupo disponible',
        objetivo: 'Demostrar mediante Promise.all + Mutex/FOR UPDATE que dos selecciones simultáneas no superan cupos = 1.',
        entradas: { vacante: v4.cargo, cuposDisponibles: 1, solicitudesSimultaneas: 2 },
        resultadoEsperado: 'Exactamente 1 solicitud ACEPTADA (200) y 1 solicitud RECHAZADA (409 CUPO_COMPLETO).',
        resultadoObtenido: `Aceptadas: ${acceptedCount}, Rechazadas: ${rejectedCount}. Integridad de cupo preservada.`,
        detalles: t4Details,
        aprobado: passedConcurrency,
        duracionMs: Date.now() - t4Start,
      });

      await store.logDecision({
        operacion: 'Suite de Pruebas Obligatoria',
        aceptado: suiteResults.every((r) => r.aprobado),
        codigo: 'QA_SUITE_COMPLETADA',
        regla: 'Verificación de Cupos, Cierre y Concurrencia',
        motivo: `${suiteResults.filter((r) => r.aprobado).length}/${suiteResults.length} pruebas aprobadas.`,
        entidad: 'Laboratorio QA',
      });

      res.json({
        ok: true,
        executedAt: new Date().toISOString(),
        engine: store.engine,
        allPassed: suiteResults.every((r) => r.aprobado),
        results: suiteResults,
      });
    } catch (err) {
      sendRuleError(res, err, 'Suite de Pruebas');
    } finally {
      // Limpieza ordenada por integridad referencial (postulaciones -> vacantes -> candidatos -> empresa)
      for (const pid of qaPostIds) {
        try {
          await store.deletePostulacion(pid);
        } catch {
          // ignore cleanup
        }
      }
      for (const vid of qaVacIds) {
        try {
          await store.deleteVacante(vid);
        } catch {
          // ignore cleanup
        }
      }
      for (const cid of qaCandIds) {
        try {
          await store.deleteCandidato(cid);
        } catch {
          // ignore cleanup
        }
      }
      if (qaEmpresaId !== null) {
        try {
          await store.deleteEmpresa(qaEmpresaId);
        } catch {
          // ignore cleanup
        }
      }
    }
  });

  // ---- INTEGRACIONES: RENDER, GITHUB, SUPABASE ----
  app.get('/api/integrations/status', (_req, res) => {
    const cfg = store.getIntegrationsConfig();
    res.json({
      databaseEngine: store.engine,
      databaseConnected: store.isConnected(),
      databaseLabel:
        store.engine === 'postgres'
          ? 'PostgreSQL Conectado (Supabase / Render)'
          : store.engine === 'supabase'
            ? 'Supabase REST API Conectado'
            : 'Almacenamiento Local Transaccional (Listo para conectar PostgreSQL/Supabase)',
      supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      postgresConfigured: Boolean(process.env.DATABASE_URL),
      githubRepo: cfg.githubRepo,
      renderServiceUrl: cfg.renderServiceUrl,
      appUrl: process.env.APP_URL || '',
    });
  });

  app.put('/api/integrations/config', requireAdmin, (req, res) => {
    const githubRepo = typeof req.body?.githubRepo === 'string' ? req.body.githubRepo.trim() : '';
    const renderServiceUrl = typeof req.body?.renderServiceUrl === 'string' ? req.body.renderServiceUrl.trim() : '';

    if (githubRepo && !isValidGithubRepoSlug(githubRepo)) {
      res.status(400).json({
        ok: false,
        code: 'GITHUB_SLUG_INVALIDO',
        rule: 'Integración GitHub',
        message: 'Formato de repositorio inválido.',
        reason: 'Use el formato usuario/repositorio (ejemplo: marcos-santacruz/vacantes-escalada).',
      });
      return;
    }

    if (renderServiceUrl) {
      const check = isSafeRenderUrl(renderServiceUrl);
      if (!check.valid) {
        res.status(400).json({
          ok: false,
          code: 'RENDER_URL_INVALIDA',
          rule: 'Integración Render',
          message: check.reason || 'URL de Render inválida.',
          reason: 'Ingrese una URL HTTPS pública válida de *.onrender.com.',
        });
        return;
      }
    }

    const saved = store.saveIntegrationsConfig({ githubRepo, renderServiceUrl });
    res.json({
      ok: true,
      code: 'CONFIG_GUARDADA',
      rule: 'Integraciones',
      message: 'Referencias de GitHub y Render actualizadas.',
      reason: 'Configuración guardada correctamente.',
      data: saved,
    });
  });

  app.get('/api/integrations/github', async (req, res) => {
    const rawRepo = typeof req.query.repo === 'string' ? req.query.repo.trim() : store.getIntegrationsConfig().githubRepo;
    if (!rawRepo) {
      res.status(400).json({
        ok: false,
        code: 'REPO_REQUERIDO',
        message: 'Indique el repositorio en formato usuario/repositorio.',
      });
      return;
    }
    if (!isValidGithubRepoSlug(rawRepo)) {
      res.status(400).json({
        ok: false,
        code: 'GITHUB_SLUG_INVALIDO',
        message: 'Formato de repositorio inválido. Use usuario/repositorio.',
      });
      return;
    }

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Vacantes-Asuncion-Escalada/1.0',
      };
      const [repoResp, commitsResp] = await Promise.all([
        fetch(`https://api.github.com/repos/${rawRepo}`, { headers }),
        fetch(`https://api.github.com/repos/${rawRepo}/commits?per_page=5`, { headers }),
      ]);

      if (!repoResp.ok) {
        res.status(repoResp.status).json({
          ok: false,
          code: 'GITHUB_NO_DISPONIBLE',
          message: `GitHub respondió HTTP ${repoResp.status}. Verifique que el repositorio público "${rawRepo}" exista.`,
        });
        return;
      }

      const repoJson = (await repoResp.json()) as Record<string, unknown>;
      const commitsJson = commitsResp.ok ? ((await commitsResp.json()) as Array<Record<string, unknown>>) : [];

      res.json({
        ok: true,
        repo: {
          full_name: repoJson.full_name,
          description: repoJson.description,
          html_url: repoJson.html_url,
          default_branch: repoJson.default_branch,
          stargazers_count: repoJson.stargazers_count,
          updated_at: repoJson.updated_at,
          language: repoJson.language,
        },
        commits: commitsJson.map((c) => {
          const commitObj = (c.commit || {}) as Record<string, unknown>;
          const authorObj = (commitObj.author || {}) as Record<string, unknown>;
          return {
            sha: String(c.sha || '').slice(0, 7),
            message: String(commitObj.message || '').split('\n')[0],
            author: String(authorObj.name || 'Autor'),
            date: String(authorObj.date || ''),
            html_url: String(c.html_url || ''),
          };
        }),
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        code: 'GITHUB_ERROR_RED',
        message: 'No se pudo consultar la API de GitHub.',
        reason: (err as Error).message,
      });
    }
  });

  app.post('/api/integrations/check-render', requireAdmin, async (req, res) => {
    const rawUrl =
      typeof req.body?.url === 'string' && req.body.url.trim()
        ? req.body.url.trim()
        : store.getIntegrationsConfig().renderServiceUrl;

    const check = isSafeRenderUrl(rawUrl);
    if (!check.valid || !check.url) {
      res.status(400).json({
        ok: false,
        code: 'RENDER_URL_INVALIDA',
        message: check.reason || 'URL inválida.',
      });
      return;
    }

    const healthTarget = `${check.url.origin}/api/health`;
    const started = Date.now();
    try {
      const resp = await fetch(healthTarget, { method: 'GET', signal: AbortSignal.timeout(8000) });
      const latencyMs = Date.now() - started;
      const text = await resp.text();
      res.json({
        ok: resp.ok,
        status: resp.status,
        latencyMs,
        target: healthTarget,
        preview: text.slice(0, 220),
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        status: 0,
        latencyMs: Date.now() - started,
        target: healthTarget,
        message: `No se pudo alcanzar ${healthTarget}: ${(err as Error).message}`,
      });
    }
  });

  app.get('/api/integrations/artifacts', (_req, res) => {
    const root = process.cwd();
    const safeRead = (rel: string): string => {
      const resolved = path.resolve(root, rel);
      if (!resolved.startsWith(root + path.sep) || !fs.existsSync(resolved)) return '';
      return fs.readFileSync(resolved, 'utf-8');
    };
    res.json({
      schemaSql: safeRead('supabase/schema.sql'),
      seedSql: safeRead('supabase/seed.sql'),
      renderYaml: safeRead('render.yaml'),
      defensaMd: safeRead('docs/DEFENSA_Y_EVIDENCIAS.md'),
    });
  });

  // ---- VITE DEV / PRODUCTION STATIC ----
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Vacantes y Postulaciones escuchando en http://0.0.0.0:${PORT} (motor: ${store.engine})`);
  });
}

startServer().catch((err) => {
  console.error('Error iniciando el servidor:', err);
  process.exit(1);
});
