import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import type {
  Candidato,
  DecisionLog,
  Empresa,
  Postulacion,
  PostulacionEstado,
  Vacante,
  VacanteEstado,
} from '../src/types';

export interface AdminAuthRecord {
  salt: string;
  hash: string;
  claimedAt: string;
}

export interface IntegrationsConfigRecord {
  githubRepo: string;
  renderServiceUrl: string;
}

interface LocalDatabase {
  seq: {
    empresas: number;
    vacantes: number;
    candidatos: number;
    postulaciones: number;
    logs: number;
  };
  adminAuth: AdminAuthRecord | null;
  integrationsConfig: IntegrationsConfigRecord;
  empresas: Empresa[];
  vacantes: Vacante[];
  candidatos: Candidato[];
  postulaciones: Postulacion[];
  decisionLogs: DecisionLog[];
}

export type DbEngine = 'postgres' | 'supabase' | 'local';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const META_FILE = path.join(DATA_DIR, 'meta.json');

const vacancyLocks = new Map<number, Promise<void>>();

export async function withVacancyLock<T>(vacanteId: number, fn: () => Promise<T>): Promise<T> {
  const prev = vacancyLocks.get(vacanteId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = prev.then(() => current);
  vacancyLocks.set(vacanteId, chained);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (vacancyLocks.get(vacanteId) === chained) {
      vacancyLocks.delete(vacanteId);
    }
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildSeedData(): LocalDatabase {
  const ts = '2026-11-20T08:00:00.000Z';
  return {
    seq: {
      empresas: 6,
      vacantes: 7,
      candidatos: 6,
      postulaciones: 6,
      logs: 3,
    },
    adminAuth: null,
    integrationsConfig: {
      githubRepo: process.env.GITHUB_REPO || '',
      renderServiceUrl: process.env.RENDER_SERVICE_URL || '',
    },
    empresas: [
      {
        id: 1,
        nombre: 'Guaraní Sistemas S.A.',
        rubro: 'Tecnología y Software',
        ciudad: 'Asunción',
        direccion: 'Av. España 1240, Villa Morra',
        latitud: -25.29182,
        longitud: -57.58064,
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 2,
        nombre: 'Itapúa Logística Integral',
        rubro: 'Logística y Transporte',
        ciudad: 'Asunción',
        direccion: 'Av. Artigas 1920, Trinidad',
        latitud: -25.26345,
        longitud: -57.59312,
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 3,
        nombre: 'Clínica Central Escalada',
        rubro: 'Salud y Laboratorio',
        ciudad: 'Asunción',
        direccion: 'Av. Colón 685, Centro',
        latitud: -25.28491,
        longitud: -57.64138,
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 4,
        nombre: 'Paraná Ingeniería Eléctrica',
        rubro: 'Hardware e Infraestructura',
        ciudad: 'San Lorenzo',
        direccion: 'Ruta Mariscal Estigarribia Km 10',
        latitud: -25.33971,
        longitud: -57.52341,
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 5,
        nombre: 'Banco del Este S.A.',
        rubro: 'Finanzas y Administración',
        ciudad: 'Asunción',
        direccion: 'Av. Aviadores del Chaco 2050, Carmelitas',
        latitud: -25.28279,
        longitud: -57.56411,
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 6,
        nombre: 'Agroindustria Ypacaraí',
        rubro: 'Producción e Industria',
        ciudad: 'Luque',
        direccion: 'Av. Gral. Aquino 840, Centro Luque',
        latitud: -25.26832,
        longitud: -57.48793,
        created_at: ts,
        updated_at: ts,
      },
    ],
    vacantes: [
      {
        id: 1,
        empresa_id: 1,
        cargo: 'Desarrollador Web Junior',
        descripcion: 'Mantenimiento de módulos React, APIs REST y consultas SQL en PostgreSQL.',
        cierre: '2026-12-30',
        cupos: 2,
        estado: 'abierta',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 2,
        empresa_id: 1,
        cargo: 'Soporte Técnico de Laboratorio',
        descripcion: 'Diagnóstico de hardware, redes LAN y configuración de estaciones de trabajo.',
        cierre: '2026-12-20',
        cupos: 1,
        estado: 'abierta',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 3,
        empresa_id: 2,
        cargo: 'Auxiliar de Control de Flota',
        descripcion: 'Seguimiento de rutas, registro de entregas y control documental.',
        cierre: '2026-12-18',
        cupos: 2,
        estado: 'abierta',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 4,
        empresa_id: 3,
        cargo: 'Recepcionista de Turno Mañana',
        descripcion: 'Atención al paciente, carga de órdenes de laboratorio y archivo.',
        cierre: '2026-12-28',
        cupos: 2,
        estado: 'abierta',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 5,
        empresa_id: 4,
        cargo: 'Técnico en Redes y Cableado',
        descripcion: 'Instalación de racks, puntos de red UTP/fibra y certificación de enlaces.',
        cierre: '2026-12-22',
        cupos: 1,
        estado: 'abierta',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 6,
        empresa_id: 5,
        cargo: 'Analista de Datos Jr.',
        descripcion: 'Vacante con fecha de cierre vencida para validar bloqueo de postulación tardía.',
        cierre: '2026-11-10',
        cupos: 2,
        estado: 'abierta',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 7,
        empresa_id: 6,
        cargo: 'Operador de Control de Calidad',
        descripcion: 'Inspección de lotes en planta y registro de conformidad (vacante cerrada).',
        cierre: '2026-12-15',
        cupos: 1,
        estado: 'cerrada',
        created_at: ts,
        updated_at: ts,
      },
    ],
    candidatos: [
      {
        id: 1,
        documento: '5124890',
        nombre: 'Lucas Benítez',
        email: 'lucas.benitez@ejemplo.py',
        telefono: '+595 981 210 340',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 2,
        documento: '5439120',
        nombre: 'Sofía Villalba',
        email: 'sofia.villalba@ejemplo.py',
        telefono: '+595 971 452 118',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 3,
        documento: '4982311',
        nombre: 'Mateo Coronel',
        email: 'mateo.coronel@ejemplo.py',
        telefono: '+595 982 664 092',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 4,
        documento: '5610442',
        nombre: 'Camila Duarte',
        email: 'camila.duarte@ejemplo.py',
        telefono: '+595 985 330 715',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 5,
        documento: '5290874',
        nombre: 'Thiago Giménez',
        email: 'thiago.gimenez@ejemplo.py',
        telefono: '+595 972 889 401',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 6,
        documento: '5341908',
        nombre: 'Valentina Acosta',
        email: 'valentina.acosta@ejemplo.py',
        telefono: '+595 984 512 630',
        created_at: ts,
        updated_at: ts,
      },
    ],
    postulaciones: [
      {
        id: 1,
        vacante_id: 1,
        candidato_id: 1,
        fecha: '2026-11-20T09:15:00.000Z',
        estado: 'seleccionado',
        motivo_decision: 'Seleccionado dentro del cupo (1/2) tras validación de perfil.',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 2,
        vacante_id: 1,
        candidato_id: 2,
        fecha: '2026-11-21T10:30:00.000Z',
        estado: 'pendiente',
        motivo_decision: 'Postulación aceptada dentro de fecha de cierre (2026-12-30).',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 3,
        vacante_id: 2,
        candidato_id: 3,
        fecha: '2026-11-21T14:00:00.000Z',
        estado: 'pendiente',
        motivo_decision: 'Postulación aceptada dentro de fecha de cierre (2026-12-20).',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 4,
        vacante_id: 2,
        candidato_id: 5,
        fecha: '2026-11-22T08:45:00.000Z',
        estado: 'pendiente',
        motivo_decision: 'Postulación aceptada dentro de fecha de cierre (2026-12-20).',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 5,
        vacante_id: 3,
        candidato_id: 4,
        fecha: '2026-11-22T11:20:00.000Z',
        estado: 'seleccionado',
        motivo_decision: 'Seleccionado dentro del cupo (1/2).',
        created_at: ts,
        updated_at: ts,
      },
      {
        id: 6,
        vacante_id: 4,
        candidato_id: 6,
        fecha: '2026-11-23T09:00:00.000Z',
        estado: 'pendiente',
        motivo_decision: 'Postulación aceptada dentro de fecha de cierre (2026-12-28).',
        created_at: ts,
        updated_at: ts,
      },
    ],
    decisionLogs: [
      {
        id: 1,
        timestamp: '2026-11-20T09:15:00.000Z',
        operacion: 'Seleccionar postulante',
        aceptado: true,
        codigo: 'SELECCIONADO',
        regla: 'Control de Cupos y Estado',
        motivo: 'Lucas Benítez seleccionado en Desarrollador Web Junior (1/2 cupos).',
        entidad: 'Postulación #1',
      },
      {
        id: 2,
        timestamp: '2026-11-22T11:20:00.000Z',
        operacion: 'Seleccionar postulante',
        aceptado: true,
        codigo: 'SELECCIONADO',
        regla: 'Control de Cupos y Estado',
        motivo: 'Camila Duarte seleccionada en Auxiliar de Control de Flota (1/2 cupos).',
        entidad: 'Postulación #5',
      },
    ],
  };
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLocalDb(): LocalDatabase {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const seed = buildSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw) as LocalDatabase;
}

function writeLocalDb(db: LocalDatabase): void {
  ensureDataDir();
  const tempFile = `${DB_FILE}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
}

interface MetaStore {
  adminAuth: AdminAuthRecord | null;
  integrationsConfig: IntegrationsConfigRecord;
  decisionLogs: DecisionLog[];
  logSeq: number;
}

function readMeta(): MetaStore {
  ensureDataDir();
  if (!fs.existsSync(META_FILE)) {
    const init: MetaStore = {
      adminAuth: null,
      integrationsConfig: {
        githubRepo: process.env.GITHUB_REPO || '',
        renderServiceUrl: process.env.RENDER_SERVICE_URL || '',
      },
      decisionLogs: [],
      logSeq: 0,
    };
    fs.writeFileSync(META_FILE, JSON.stringify(init, null, 2), 'utf-8');
    return init;
  }
  return JSON.parse(fs.readFileSync(META_FILE, 'utf-8')) as MetaStore;
}

function writeMeta(meta: MetaStore): void {
  ensureDataDir();
  const tempFile = `${META_FILE}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(meta, null, 2), 'utf-8');
  fs.renameSync(tempFile, META_FILE);
}

export class BusinessRuleError extends Error {
  status: number;
  code: string;
  rule: string;
  reason: string;

  constructor(status: number, code: string, rule: string, message: string, reason: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.rule = rule;
    this.reason = reason;
  }
}

export class DataStore {
  engine: DbEngine = 'local';
  private pool: Pool | null = null;
  private supabase: SupabaseClient | null = null;
  private dbConnected = true;

  async init(): Promise<void> {
    const databaseUrl = (process.env.DATABASE_URL || '').trim();
    const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
    const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (databaseUrl) {
      try {
        const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
        this.pool = new Pool({
          connectionString: databaseUrl,
          ssl: isLocalhost ? false : { rejectUnauthorized: false },
          max: 10,
          idleTimeoutMillis: 30000,
        });
        await this.pool.query('SELECT 1');
        this.engine = 'postgres';
        this.dbConnected = true;
        return;
      } catch (err) {
        console.warn('Postgres connection failed, falling back to next engine:', (err as Error).message);
        this.pool = null;
      }
    }

    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error } = await this.supabase.from('empresas').select('id').limit(1);
        if (!error) {
          this.engine = 'supabase';
          this.dbConnected = true;
          return;
        }
        console.warn('Supabase REST query failed, falling back to local store:', error.message);
        this.supabase = null;
      } catch (err) {
        console.warn('Supabase init failed, falling back to local store:', (err as Error).message);
        this.supabase = null;
      }
    }

    this.engine = 'local';
    this.dbConnected = true;
    readLocalDb();
  }

  isConnected(): boolean {
    return this.dbConnected;
  }

  getAdminAuth(): AdminAuthRecord | null {
    if (this.engine === 'local') {
      return readLocalDb().adminAuth;
    }
    return readMeta().adminAuth;
  }

  claimAdminAuth(record: AdminAuthRecord): boolean {
    if (this.engine === 'local') {
      const db = readLocalDb();
      if (db.adminAuth) return false;
      db.adminAuth = record;
      writeLocalDb(db);
      return true;
    }
    const meta = readMeta();
    if (meta.adminAuth) return false;
    meta.adminAuth = record;
    writeMeta(meta);
    return true;
  }

  getIntegrationsConfig(): IntegrationsConfigRecord {
    const stored =
      this.engine === 'local' ? readLocalDb().integrationsConfig : readMeta().integrationsConfig;
    return {
      githubRepo: stored.githubRepo || process.env.GITHUB_REPO || '',
      renderServiceUrl: stored.renderServiceUrl || process.env.RENDER_SERVICE_URL || '',
    };
  }

  saveIntegrationsConfig(config: IntegrationsConfigRecord): IntegrationsConfigRecord {
    if (this.engine === 'local') {
      const db = readLocalDb();
      db.integrationsConfig = config;
      writeLocalDb(db);
      return db.integrationsConfig;
    }
    const meta = readMeta();
    meta.integrationsConfig = config;
    writeMeta(meta);
    return meta.integrationsConfig;
  }

  async logDecision(entry: Omit<DecisionLog, 'id' | 'timestamp'>): Promise<DecisionLog> {
    const full: DecisionLog = {
      id: 0,
      timestamp: nowIso(),
      ...entry,
    };
    if (this.engine === 'local') {
      const db = readLocalDb();
      db.seq.logs += 1;
      full.id = db.seq.logs;
      db.decisionLogs.unshift(full);
      db.decisionLogs = db.decisionLogs.slice(0, 120);
      writeLocalDb(db);
      return full;
    }
    const meta = readMeta();
    meta.logSeq += 1;
    full.id = meta.logSeq;
    meta.decisionLogs.unshift(full);
    meta.decisionLogs = meta.decisionLogs.slice(0, 120);
    writeMeta(meta);
    return full;
  }

  async getDecisionLogs(limit = 30): Promise<DecisionLog[]> {
    if (this.engine === 'local') {
      return readLocalDb().decisionLogs.slice(0, limit);
    }
    return readMeta().decisionLogs.slice(0, limit);
  }

  // ---- EMPRESAS ----
  async listEmpresas(): Promise<Empresa[]> {
    if (this.engine === 'postgres' && this.pool) {
      const { rows } = await this.pool.query<Empresa>(
        'SELECT id, nombre, rubro, ciudad, direccion, latitud::float8 AS latitud, longitud::float8 AS longitud, created_at, updated_at FROM empresas ORDER BY id ASC'
      );
      return rows;
    }
    if (this.engine === 'supabase' && this.supabase) {
      const { data, error } = await this.supabase.from('empresas').select('*').order('id', { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []).map((r) => ({
        ...r,
        latitud: Number(r.latitud),
        longitud: Number(r.longitud),
      })) as Empresa[];
    }
    return [...readLocalDb().empresas].sort((a, b) => a.id - b.id);
  }

  async createEmpresa(input: {
    nombre: string;
    rubro: string;
    ciudad: string;
    direccion: string;
    latitud: number;
    longitud: number;
  }): Promise<Empresa> {
    const nombre = input.nombre.trim();
    const rubro = input.rubro.trim();
    const ciudad = input.ciudad.trim() || 'Asunción';
    const direccion = input.direccion.trim();

    if (!nombre || !rubro) {
      throw new BusinessRuleError(400, 'DATOS_INCOMPLETOS', 'Validación de Empresa', 'Nombre y rubro son obligatorios.', 'Complete el nombre y el rubro de la empresa.');
    }

    const existing = await this.listEmpresas();
    if (existing.some((e) => e.nombre.toLowerCase() === nombre.toLowerCase())) {
      throw new BusinessRuleError(
        409,
        'EMPRESA_DUPLICADA',
        'Prevención de Duplicados',
        `Ya existe una empresa registrada con el nombre "${nombre}".`,
        'La regla de unicidad prohíbe registrar empresas duplicadas.'
      );
    }

    if (this.engine === 'postgres' && this.pool) {
      const { rows } = await this.pool.query<Empresa>(
        `INSERT INTO empresas (nombre, rubro, ciudad, direccion, latitud, longitud)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, nombre, rubro, ciudad, direccion, latitud::float8 AS latitud, longitud::float8 AS longitud, created_at, updated_at`,
        [nombre, rubro, ciudad, direccion, input.latitud, input.longitud]
      );
      return rows[0];
    }

    if (this.engine === 'supabase' && this.supabase) {
      const { data, error } = await this.supabase
        .from('empresas')
        .insert({ nombre, rubro, ciudad, direccion, latitud: input.latitud, longitud: input.longitud })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return { ...data, latitud: Number(data.latitud), longitud: Number(data.longitud) } as Empresa;
    }

    const db = readLocalDb();
    db.seq.empresas += 1;
    const ts = nowIso();
    const empresa: Empresa = {
      id: db.seq.empresas,
      nombre,
      rubro,
      ciudad,
      direccion,
      latitud: input.latitud,
      longitud: input.longitud,
      created_at: ts,
      updated_at: ts,
    };
    db.empresas.push(empresa);
    writeLocalDb(db);
    return empresa;
  }

  async updateEmpresa(
    id: number,
    input: {
      nombre: string;
      rubro: string;
      ciudad: string;
      direccion: string;
      latitud: number;
      longitud: number;
    }
  ): Promise<Empresa> {
    const nombre = input.nombre.trim();
    const rubro = input.rubro.trim();
    const ciudad = input.ciudad.trim() || 'Asunción';
    const direccion = input.direccion.trim();

    const existing = await this.listEmpresas();
    const target = existing.find((e) => e.id === id);
    if (!target) {
      throw new BusinessRuleError(404, 'EMPRESA_NO_ENCONTRADA', 'Integridad', 'Empresa no encontrada.', `No existe la empresa #${id}.`);
    }
    if (existing.some((e) => e.id !== id && e.nombre.toLowerCase() === nombre.toLowerCase())) {
      throw new BusinessRuleError(
        409,
        'EMPRESA_DUPLICADA',
        'Prevención de Duplicados',
        `Ya existe otra empresa registrada como "${nombre}".`,
        'El nombre de empresa debe ser único.'
      );
    }

    if (this.engine === 'postgres' && this.pool) {
      const { rows } = await this.pool.query<Empresa>(
        `UPDATE empresas SET nombre = $1, rubro = $2, ciudad = $3, direccion = $4, latitud = $5, longitud = $6, updated_at = NOW()
         WHERE id = $7
         RETURNING id, nombre, rubro, ciudad, direccion, latitud::float8 AS latitud, longitud::float8 AS longitud, created_at, updated_at`,
        [nombre, rubro, ciudad, direccion, input.latitud, input.longitud, id]
      );
      return rows[0];
    }

    if (this.engine === 'supabase' && this.supabase) {
      const { data, error } = await this.supabase
        .from('empresas')
        .update({ nombre, rubro, ciudad, direccion, latitud: input.latitud, longitud: input.longitud, updated_at: nowIso() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return { ...data, latitud: Number(data.latitud), longitud: Number(data.longitud) } as Empresa;
    }

    const db = readLocalDb();
    const idx = db.empresas.findIndex((e) => e.id === id);
    db.empresas[idx] = {
      ...db.empresas[idx],
      nombre,
      rubro,
      ciudad,
      direccion,
      latitud: input.latitud,
      longitud: input.longitud,
      updated_at: nowIso(),
    };
    writeLocalDb(db);
    return db.empresas[idx];
  }

  async deleteEmpresa(id: number): Promise<void> {
    const vacantes = await this.listVacantesRaw();
    const linked = vacantes.filter((v) => v.empresa_id === id);
    if (linked.length > 0) {
      throw new BusinessRuleError(
        409,
        'EMPRESA_CON_VACANTES',
        'Integridad Referencial',
        `No se puede eliminar la empresa porque tiene ${linked.length} vacante(s) asociada(s).`,
        'Elimine o reasigne primero las vacantes vinculadas (ON DELETE RESTRICT).'
      );
    }

    if (this.engine === 'postgres' && this.pool) {
      const res = await this.pool.query('DELETE FROM empresas WHERE id = $1', [id]);
      if (res.rowCount === 0) {
        throw new BusinessRuleError(404, 'EMPRESA_NO_ENCONTRADA', 'Integridad', 'Empresa no encontrada.', `No existe empresa #${id}.`);
      }
      return;
    }

    if (this.engine === 'supabase' && this.supabase) {
      const { error } = await this.supabase.from('empresas').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }

    const db = readLocalDb();
    const idx = db.empresas.findIndex((e) => e.id === id);
    if (idx === -1) {
      throw new BusinessRuleError(404, 'EMPRESA_NO_ENCONTRADA', 'Integridad', 'Empresa no encontrada.', `No existe empresa #${id}.`);
    }
    db.empresas.splice(idx, 1);
    writeLocalDb(db);
  }

  // ---- VACANTES ----
  async listVacantesRaw(): Promise<Vacante[]> {
    if (this.engine === 'postgres' && this.pool) {
      const { rows } = await this.pool.query<Vacante>(
        `SELECT id, empresa_id, cargo, descripcion, to_char(cierre, 'YYYY-MM-DD') AS cierre, cupos, estado, created_at, updated_at
         FROM vacantes ORDER BY id ASC`
      );
      return rows;
    }
    if (this.engine === 'supabase' && this.supabase) {
      const { data, error } = await this.supabase.from('vacantes').select('*').order('id', { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []) as Vacante[];
    }
    return [...readLocalDb().vacantes].sort((a, b) => a.id - b.id);
  }

  async listVacantesEnriched(): Promise<Vacante[]> {
    const [empresas, vacantes, postulaciones] = await Promise.all([
      this.listEmpresas(),
      this.listVacantesRaw(),
      this.listPostulacionesRaw(),
    ]);
    const empresaMap = new Map(empresas.map((e) => [e.id, e]));
    return vacantes.map((v) => {
      const emp = empresaMap.get(v.empresa_id);
      const posts = postulaciones.filter((p) => p.vacante_id === v.id);
      const seleccionados = posts.filter((p) => p.estado === 'seleccionado').length;
      return {
        ...v,
        empresa_nombre: emp?.nombre || 'Empresa desconocida',
        empresa_rubro: emp?.rubro || 'Sin rubro',
        empresa_ciudad: emp?.ciudad || 'Asunción',
        empresa_direccion: emp?.direccion || '',
        empresa_latitud: emp?.latitud ?? -25.28646,
        empresa_longitud: emp?.longitud ?? -57.647,
        seleccionados_count: seleccionados,
        postulaciones_count: posts.length,
        cupos_disponibles: Math.max(0, v.cupos - seleccionados),
      };
    });
  }

  async createVacante(input: {
    empresa_id: number;
    cargo: string;
    descripcion: string;
    cierre: string;
    cupos: number;
    estado?: VacanteEstado;
  }): Promise<Vacante> {
    const empresas = await this.listEmpresas();
    const empresa = empresas.find((e) => e.id === input.empresa_id);
    if (!empresa) {
      throw new BusinessRuleError(404, 'EMPRESA_NO_ENCONTRADA', 'Integridad Referencial', 'La empresa indicada no existe.', 'Seleccione una empresa válida.');
    }
    const cargo = input.cargo.trim();
    if (!cargo || !input.cierre || !Number.isInteger(input.cupos) || input.cupos < 1) {
      throw new BusinessRuleError(400, 'DATOS_INVALIDOS', 'Validación de Vacante', 'Cargo, cierre válido y cupos (>= 1) son obligatorios.', 'Verifique los campos de la vacante.');
    }

    const existing = await this.listVacantesRaw();
    if (
      existing.some(
        (v) => v.empresa_id === input.empresa_id && v.cargo.toLowerCase() === cargo.toLowerCase() && v.cierre === input.cierre
      )
    ) {
      throw new BusinessRuleError(
        409,
        'VACANTE_DUPLICADA',
        'Prevención de Duplicados',
        `Ya existe la vacante "${cargo}" en ${empresa.nombre} con cierre ${input.cierre}.`,
        'No se permiten vacantes duplicadas para la misma empresa, cargo y fecha de cierre.'
      );
    }

    const estado: VacanteEstado = input.estado === 'cerrada' ? 'cerrada' : 'abierta';
    const descripcion = (input.descripcion || '').trim();

    if (this.engine === 'postgres' && this.pool) {
      const { rows } = await this.pool.query<Vacante>(
        `INSERT INTO vacantes (empresa_id, cargo, descripcion, cierre, cupos, estado)
         VALUES ($1, $2, $3, $4::date, $5, $6)
         RETURNING id, empresa_id, cargo, descripcion, to_char(cierre, 'YYYY-MM-DD') AS cierre, cupos, estado, created_at, updated_at`,
        [input.empresa_id, cargo, descripcion, input.cierre, input.cupos, estado]
      );
      return rows[0];
    }

    if (this.engine === 'supabase' && this.supabase) {
      const { data, error } = await this.supabase
        .from('vacantes')
        .insert({ empresa_id: input.empresa_id, cargo, descripcion, cierre: input.cierre, cupos: input.cupos, estado })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as Vacante;
    }

    const db = readLocalDb();
    db.seq.vacantes += 1;
    const ts = nowIso();
    const vacante: Vacante = {
      id: db.seq.vacantes,
      empresa_id: input.empresa_id,
      cargo,
      descripcion,
      cierre: input.cierre,
      cupos: input.cupos,
      estado,
      created_at: ts,
      updated_at: ts,
    };
    db.vacantes.push(vacante);
    writeLocalDb(db);
    return vacante;
  }

  async updateVacante(
    id: number,
    input: {
      empresa_id?: number;
      cargo?: string;
      descripcion?: string;
      cierre?: string;
      cupos?: number;
      estado?: VacanteEstado;
    }
  ): Promise<Vacante> {
    return withVacancyLock(id, async () => {
      const vacantes = await this.listVacantesRaw();
      const current = vacantes.find((v) => v.id === id);
      if (!current) {
        throw new BusinessRuleError(404, 'VACANTE_NO_ENCONTRADA', 'Integridad', 'Vacante no encontrada.', `No existe la vacante #${id}.`);
      }

      const nextEmpresaId = input.empresa_id ?? current.empresa_id;
      const nextCargo = (input.cargo ?? current.cargo).trim();
      const nextDesc = (input.descripcion ?? current.descripcion).trim();
      const nextCierre = input.cierre ?? current.cierre;
      const nextCupos = input.cupos ?? current.cupos;
      const nextEstado: VacanteEstado = input.estado ?? current.estado;

      if (!Number.isInteger(nextCupos) || nextCupos < 1) {
        throw new BusinessRuleError(400, 'CUPOS_INVALIDOS', 'Validación de Cupos', 'Los cupos deben ser un entero mayor o igual a 1.', 'Ingrese un número válido de cupos.');
      }

      const posts = (await this.listPostulacionesRaw()).filter((p) => p.vacante_id === id && p.estado === 'seleccionado');
      if (nextCupos < posts.length) {
        throw new BusinessRuleError(
          422,
          'CUPOS_MENOR_A_SELECCIONADOS',
          'Control de Cupos',
          `No puede reducir cupos a ${nextCupos} porque ya existen ${posts.length} candidato(s) seleccionado(s).`,
          'El número de cupos no puede ser inferior al total ya seleccionado.'
        );
      }

      if (this.engine === 'postgres' && this.pool) {
        const { rows } = await this.pool.query<Vacante>(
          `UPDATE vacantes SET empresa_id = $1, cargo = $2, descripcion = $3, cierre = $4::date, cupos = $5, estado = $6, updated_at = NOW()
           WHERE id = $7
           RETURNING id, empresa_id, cargo, descripcion, to_char(cierre, 'YYYY-MM-DD') AS cierre, cupos, estado, created_at, updated_at`,
          [nextEmpresaId, nextCargo, nextDesc, nextCierre, nextCupos, nextEstado, id]
        );
        return rows[0];
      }

      if (this.engine === 'supabase' && this.supabase) {
        const { data, error } = await this.supabase
          .from('vacantes')
          .update({
            empresa_id: nextEmpresaId,
            cargo: nextCargo,
            descripcion: nextDesc,
            cierre: nextCierre,
            cupos: nextCupos,
            estado: nextEstado,
            updated_at: nowIso(),
          })
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        return data as Vacante;
      }

      const db = readLocalDb();
      const idx = db.vacantes.findIndex((v) => v.id === id);
      db.vacantes[idx] = {
        ...db.vacantes[idx],
        empresa_id: nextEmpresaId,
        cargo: nextCargo,
        descripcion: nextDesc,
        cierre: nextCierre,
        cupos: nextCupos,
        estado: nextEstado,
        updated_at: nowIso(),
      };
      writeLocalDb(db);
      return db.vacantes[idx];
    });
  }

  async deleteVacante(id: number): Promise<void> {
    const posts = (await this.listPostulacionesRaw()).filter((p) => p.vacante_id === id);
    if (posts.length > 0) {
      throw new BusinessRuleError(
        409,
        'VACANTE_CON_POSTULACIONES',
        'Integridad Referencial',
        `No se puede eliminar la vacante porque registra ${posts.length} postulación(es).`,
        'Elimine primero las postulaciones asociadas o cierre la vacante.'
      );
    }

    if (this.engine === 'postgres' && this.pool) {
      const res = await this.pool.query('DELETE FROM vacantes WHERE id = $1', [id]);
      if (res.rowCount === 0) throw new BusinessRuleError(404, 'VACANTE_NO_ENCONTRADA', 'Integridad', 'Vacante no encontrada.', `No existe vacante #${id}.`);
      return;
    }

    if (this.engine === 'supabase' && this.supabase) {
      const { error } = await this.supabase.from('vacantes').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }

    const db = readLocalDb();
    const idx = db.vacantes.findIndex((v) => v.id === id);
    if (idx === -1) throw new BusinessRuleError(404, 'VACANTE_NO_ENCONTRADA', 'Integridad', 'Vacante no encontrada.', `No existe vacante #${id}.`);
    db.vacantes.splice(idx, 1);
    writeLocalDb(db);
  }

  // ---- CANDIDATOS ----
  async listCandidatos(): Promise<Candidato[]> {
    if (this.engine === 'postgres' && this.pool) {
      const { rows } = await this.pool.query<Candidato>(
        'SELECT id, documento, nombre, email, telefono, created_at, updated_at FROM candidatos ORDER BY id ASC'
      );
      return rows;
    }
    if (this.engine === 'supabase' && this.supabase) {
      const { data, error } = await this.supabase.from('candidatos').select('*').order('id', { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []) as Candidato[];
    }
    return [...readLocalDb().candidatos].sort((a, b) => a.id - b.id);
  }

  async createCandidato(input: {
    documento: string;
    nombre: string;
    email?: string;
    telefono?: string;
  }): Promise<Candidato> {
    const documento = input.documento.trim();
    const nombre = input.nombre.trim();
    const email = (input.email || '').trim();
    const telefono = (input.telefono || '').trim();

    if (!documento || !nombre) {
      throw new BusinessRuleError(400, 'DATOS_INCOMPLETOS', 'Validación de Candidato', 'Documento y nombre son obligatorios.', 'Complete los campos requeridos del candidato.');
    }

    const existing = await this.listCandidatos();
    if (existing.some((c) => c.documento.toLowerCase() === documento.toLowerCase())) {
      throw new BusinessRuleError(
        409,
        'CANDIDATO_DOCUMENTO_DUPLICADO',
        'Prevención de Duplicados',
        `Ya existe un candidato registrado con el documento "${documento}".`,
        'El número de documento debe ser único por candidato.'
      );
    }

    if (this.engine === 'postgres' && this.pool) {
      const { rows } = await this.pool.query<Candidato>(
        `INSERT INTO candidatos (documento, nombre, email, telefono)
         VALUES ($1, $2, $3, $4)
         RETURNING id, documento, nombre, email, telefono, created_at, updated_at`,
        [documento, nombre, email, telefono]
      );
      return rows[0];
    }

    if (this.engine === 'supabase' && this.supabase) {
      const { data, error } = await this.supabase
        .from('candidatos')
        .insert({ documento, nombre, email, telefono })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as Candidato;
    }

    const db = readLocalDb();
    db.seq.candidatos += 1;
    const ts = nowIso();
    const candidato: Candidato = {
      id: db.seq.candidatos,
      documento,
      nombre,
      email,
      telefono,
      created_at: ts,
      updated_at: ts,
    };
    db.candidatos.push(candidato);
    writeLocalDb(db);
    return candidato;
  }

  async updateCandidato(
    id: number,
    input: { documento: string; nombre: string; email?: string; telefono?: string }
  ): Promise<Candidato> {
    const documento = input.documento.trim();
    const nombre = input.nombre.trim();
    const email = (input.email || '').trim();
    const telefono = (input.telefono || '').trim();

    const existing = await this.listCandidatos();
    if (!existing.some((c) => c.id === id)) {
      throw new BusinessRuleError(404, 'CANDIDATO_NO_ENCONTRADO', 'Integridad', 'Candidato no encontrado.', `No existe candidato #${id}.`);
    }
    if (existing.some((c) => c.id !== id && c.documento.toLowerCase() === documento.toLowerCase())) {
      throw new BusinessRuleError(
        409,
        'CANDIDATO_DOCUMENTO_DUPLICADO',
        'Prevención de Duplicados',
        `El documento "${documento}" ya pertenece a otro candidato.`,
        'El documento debe ser único.'
      );
    }

    if (this.engine === 'postgres' && this.pool) {
      const { rows } = await this.pool.query<Candidato>(
        `UPDATE candidatos SET documento = $1, nombre = $2, email = $3, telefono = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING id, documento, nombre, email, telefono, created_at, updated_at`,
        [documento, nombre, email, telefono, id]
      );
      return rows[0];
    }

    if (this.engine === 'supabase' && this.supabase) {
      const { data, error } = await this.supabase
        .from('candidatos')
        .update({ documento, nombre, email, telefono, updated_at: nowIso() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data as Candidato;
    }

    const db = readLocalDb();
    const idx = db.candidatos.findIndex((c) => c.id === id);
    db.candidatos[idx] = {
      ...db.candidatos[idx],
      documento,
      nombre,
      email,
      telefono,
      updated_at: nowIso(),
    };
    writeLocalDb(db);
    return db.candidatos[idx];
  }

  async deleteCandidato(id: number): Promise<void> {
    const posts = (await this.listPostulacionesRaw()).filter((p) => p.candidato_id === id);
    if (posts.length > 0) {
      throw new BusinessRuleError(
        409,
        'CANDIDATO_CON_POSTULACIONES',
        'Integridad Referencial',
        `No se puede eliminar el candidato porque tiene ${posts.length} postulación(es) registrada(s).`,
        'Elimine primero las postulaciones asociadas.'
      );
    }

    if (this.engine === 'postgres' && this.pool) {
      const res = await this.pool.query('DELETE FROM candidatos WHERE id = $1', [id]);
      if (res.rowCount === 0) throw new BusinessRuleError(404, 'CANDIDATO_NO_ENCONTRADO', 'Integridad', 'Candidato no encontrado.', `No existe candidato #${id}.`);
      return;
    }

    if (this.engine === 'supabase' && this.supabase) {
      const { error } = await this.supabase.from('candidatos').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }

    const db = readLocalDb();
    const idx = db.candidatos.findIndex((c) => c.id === id);
    if (idx === -1) throw new BusinessRuleError(404, 'CANDIDATO_NO_ENCONTRADO', 'Integridad', 'Candidato no encontrado.', `No existe candidato #${id}.`);
    db.candidatos.splice(idx, 1);
    writeLocalDb(db);
  }

  // ---- POSTULACIONES ----
  async listPostulacionesRaw(): Promise<Postulacion[]> {
    if (this.engine === 'postgres' && this.pool) {
      const { rows } = await this.pool.query<Postulacion>(
        'SELECT id, vacante_id, candidato_id, fecha, estado, motivo_decision, created_at, updated_at FROM postulaciones ORDER BY id DESC'
      );
      return rows;
    }
    if (this.engine === 'supabase' && this.supabase) {
      const { data, error } = await this.supabase.from('postulaciones').select('*').order('id', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as Postulacion[];
    }
    return [...readLocalDb().postulaciones].sort((a, b) => b.id - a.id);
  }

  async listPostulacionesEnriched(): Promise<Postulacion[]> {
    const [empresas, vacantes, candidatos, postulaciones] = await Promise.all([
      this.listEmpresas(),
      this.listVacantesRaw(),
      this.listCandidatos(),
      this.listPostulacionesRaw(),
    ]);
    const empresaMap = new Map(empresas.map((e) => [e.id, e]));
    const vacanteMap = new Map(vacantes.map((v) => [v.id, v]));
    const candidatoMap = new Map(candidatos.map((c) => [c.id, c]));

    return postulaciones.map((p) => {
      const vac = vacanteMap.get(p.vacante_id);
      const emp = vac ? empresaMap.get(vac.empresa_id) : undefined;
      const cand = candidatoMap.get(p.candidato_id);
      return {
        ...p,
        vacante_cargo: vac?.cargo || 'Vacante eliminada',
        vacante_cierre: vac?.cierre || '',
        vacante_cupos: vac?.cupos || 0,
        vacante_estado: vac?.estado || 'cerrada',
        empresa_id: emp?.id,
        empresa_nombre: emp?.nombre || 'Empresa',
        empresa_rubro: emp?.rubro || '',
        candidato_nombre: cand?.nombre || 'Candidato',
        candidato_documento: cand?.documento || '',
      };
    });
  }

  async createPostulacion(input: {
    vacante_id: number;
    candidato_id: number;
    fecha?: string;
  }): Promise<{ postulacion: Postulacion; motivo: string }> {
    return withVacancyLock(input.vacante_id, async () => {
      const [vacantes, candidatos, postulaciones] = await Promise.all([
        this.listVacantesRaw(),
        this.listCandidatos(),
        this.listPostulacionesRaw(),
      ]);

      const vacante = vacantes.find((v) => v.id === input.vacante_id);
      if (!vacante) {
        throw new BusinessRuleError(404, 'VACANTE_NO_ENCONTRADA', 'Integridad Referencial', 'La vacante no existe.', `Vacante #${input.vacante_id} no encontrada.`);
      }

      const candidato = candidatos.find((c) => c.id === input.candidato_id);
      if (!candidato) {
        throw new BusinessRuleError(404, 'CANDIDATO_NO_ENCONTRADO', 'Integridad Referencial', 'El candidato no existe.', `Candidato #${input.candidato_id} no encontrado.`);
      }

      // Regla 1: Vacante cerrada bloquea nuevas postulaciones
      if (vacante.estado === 'cerrada') {
        throw new BusinessRuleError(
          422,
          'VACANTE_CERRADA',
          'Bloqueo por Vacante Cerrada',
          `Postulación rechazada: la vacante "${vacante.cargo}" se encuentra cerrada.`,
          'Cerrar una vacante bloquea inmediatamente el ingreso de nuevas postulaciones.'
        );
      }

      // Regla 2: Impedir postulación fuera de fecha de cierre
      const fechaIso = input.fecha ? new Date(input.fecha).toISOString() : nowIso();
      const fechaDia = fechaIso.slice(0, 10);
      if (fechaDia > vacante.cierre) {
        throw new BusinessRuleError(
          422,
          'POSTULACION_FUERA_DE_CIERRE',
          'Control de Fecha de Cierre',
          `Postulación tardía rechazada: fecha recibida (${fechaDia}) posterior al cierre (${vacante.cierre}).`,
          `La vacante "${vacante.cargo}" cerró el ${vacante.cierre}; no se admiten postulaciones fuera de plazo.`
        );
      }

      // Regla 3: Impedir duplicado (vacante_id + candidato_id)
      if (postulaciones.some((p) => p.vacante_id === input.vacante_id && p.candidato_id === input.candidato_id)) {
        throw new BusinessRuleError(
          409,
          'POSTULACION_DUPLICADA',
          'Prevención de Duplicados',
          `Postulación duplicada rechazada: ${candidato.nombre} ya se postuló a "${vacante.cargo}".`,
          'Un mismo candidato no puede postularse más de una vez a la misma vacante.'
        );
      }

      const motivo = `Aceptada: postulación registrada dentro del cierre (${vacante.cierre}) sin duplicados.`;

      if (this.engine === 'postgres' && this.pool) {
        const { rows } = await this.pool.query<Postulacion>(
          `INSERT INTO postulaciones (vacante_id, candidato_id, fecha, estado, motivo_decision)
           VALUES ($1, $2, $3::timestamptz, 'pendiente', $4)
           RETURNING id, vacante_id, candidato_id, fecha, estado, motivo_decision, created_at, updated_at`,
          [input.vacante_id, input.candidato_id, fechaIso, motivo]
        );
        return { postulacion: rows[0], motivo };
      }

      if (this.engine === 'supabase' && this.supabase) {
        const { data, error } = await this.supabase
          .from('postulaciones')
          .insert({
            vacante_id: input.vacante_id,
            candidato_id: input.candidato_id,
            fecha: fechaIso,
            estado: 'pendiente',
            motivo_decision: motivo,
          })
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        return { postulacion: data as Postulacion, motivo };
      }

      const db = readLocalDb();
      db.seq.postulaciones += 1;
      const ts = nowIso();
      const post: Postulacion = {
        id: db.seq.postulaciones,
        vacante_id: input.vacante_id,
        candidato_id: input.candidato_id,
        fecha: fechaIso,
        estado: 'pendiente',
        motivo_decision: motivo,
        created_at: ts,
        updated_at: ts,
      };
      db.postulaciones.push(post);
      writeLocalDb(db);
      return { postulacion: post, motivo };
    });
  }

  async changePostulacionEstado(
    postulacionId: number,
    nuevoEstado: PostulacionEstado
  ): Promise<{ postulacion: Postulacion; motivo: string; rule: string; code: string }> {
    const allPosts = await this.listPostulacionesRaw();
    const target = allPosts.find((p) => p.id === postulacionId);
    if (!target) {
      throw new BusinessRuleError(404, 'POSTULACION_NO_ENCONTRADA', 'Integridad', 'Postulación no encontrada.', `No existe la postulación #${postulacionId}.`);
    }

    // Bloqueo transaccional exclusivo por vacante_id para evitar condiciones de carrera por el último cupo
    return withVacancyLock(target.vacante_id, async () => {
      // Si es PostgreSQL, ejecutamos una transacción real con SELECT ... FOR UPDATE
      if (this.engine === 'postgres' && this.pool) {
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');
          const pRes = await client.query<Postulacion>(
            'SELECT id, vacante_id, candidato_id, fecha, estado, motivo_decision, created_at, updated_at FROM postulaciones WHERE id = $1 FOR UPDATE',
            [postulacionId]
          );
          if (pRes.rows.length === 0) {
            throw new BusinessRuleError(404, 'POSTULACION_NO_ENCONTRADA', 'Integridad', 'Postulación no encontrada.', `No existe #${postulacionId}.`);
          }
          const postRow = pRes.rows[0];
          const vRes = await client.query<Vacante>(
            `SELECT id, empresa_id, cargo, descripcion, to_char(cierre, 'YYYY-MM-DD') AS cierre, cupos, estado
             FROM vacantes WHERE id = $1 FOR UPDATE`,
            [postRow.vacante_id]
          );
          const vac = vRes.rows[0];

          if (nuevoEstado === 'seleccionado') {
            if (vac.estado === 'cerrada') {
              throw new BusinessRuleError(
                422,
                'VACANTE_CERRADA',
                'Bloqueo por Vacante Cerrada',
                `Selección rechazada: la vacante "${vac.cargo}" está cerrada.`,
                'No se pueden seleccionar candidatos en una vacante cerrada.'
              );
            }
            if (postRow.estado !== 'seleccionado') {
              const countRes = await client.query<{ cnt: string }>(
                "SELECT COUNT(*)::text AS cnt FROM postulaciones WHERE vacante_id = $1 AND estado = 'seleccionado'",
                [vac.id]
              );
              const seleccionados = Number(countRes.rows[0].cnt);
              if (seleccionados >= vac.cupos) {
                throw new BusinessRuleError(
                  409,
                  'CUPO_COMPLETO',
                  'Límite de Cupos y Concurrencia',
                  `Selección rechazada: cupos completos (${seleccionados}/${vac.cupos}) para "${vac.cargo}".`,
                  `La vacante admite máximo ${vac.cupos} seleccionado(s) y ya están cubiertos.`
                );
              }
              const motivo = `Seleccionado dentro del cupo (${seleccionados + 1}/${vac.cupos}).`;
              const upd = await client.query<Postulacion>(
                `UPDATE postulaciones SET estado = 'seleccionado', motivo_decision = $1, updated_at = NOW()
                 WHERE id = $2 RETURNING id, vacante_id, candidato_id, fecha, estado, motivo_decision, created_at, updated_at`,
                [motivo, postulacionId]
              );
              await client.query('COMMIT');
              return { postulacion: upd.rows[0], motivo, rule: 'Control de Cupos (FOR UPDATE)', code: 'SELECCIONADO' };
            }
          }

          const motivo =
            nuevoEstado === 'rechazado'
              ? 'Postulación marcada como rechazada por el administrador.'
              : nuevoEstado === 'pendiente'
                ? 'Postulación devuelta a estado pendiente.'
                : postRow.motivo_decision;

          const upd = await client.query<Postulacion>(
            `UPDATE postulaciones SET estado = $1, motivo_decision = $2, updated_at = NOW()
             WHERE id = $3 RETURNING id, vacante_id, candidato_id, fecha, estado, motivo_decision, created_at, updated_at`,
            [nuevoEstado, motivo, postulacionId]
          );
          await client.query('COMMIT');
          return { postulacion: upd.rows[0], motivo, rule: 'Actualización de Estado', code: 'ESTADO_ACTUALIZADO' };
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }

      // Modo Local / Supabase REST bajo withVacancyLock
      const [vacantes, postsNow] = await Promise.all([this.listVacantesRaw(), this.listPostulacionesRaw()]);
      const vac = vacantes.find((v) => v.id === target.vacante_id);
      const postNow = postsNow.find((p) => p.id === postulacionId);
      if (!vac || !postNow) {
        throw new BusinessRuleError(404, 'NO_ENCONTRADO', 'Integridad', 'Registro no encontrado.', 'Verifique vacante y postulación.');
      }

      let motivo = '';
      let rule = 'Actualización de Estado';
      let code = 'ESTADO_ACTUALIZADO';

      if (nuevoEstado === 'seleccionado') {
        if (vac.estado === 'cerrada') {
          throw new BusinessRuleError(
            422,
            'VACANTE_CERRADA',
            'Bloqueo por Vacante Cerrada',
            `Selección rechazada: la vacante "${vac.cargo}" se encuentra cerrada.`,
            'No se permiten nuevas selecciones cuando la vacante está cerrada.'
          );
        }
        const seleccionados = postsNow.filter(
          (p) => p.vacante_id === vac.id && p.estado === 'seleccionado' && p.id !== postulacionId
        ).length;

        if (seleccionados >= vac.cupos) {
          throw new BusinessRuleError(
            409,
            'CUPO_COMPLETO',
            'Límite de Cupos y Concurrencia',
            `Selección rechazada: cupos completos (${seleccionados}/${vac.cupos}) para "${vac.cargo}".`,
            `No se puede superar el límite de ${vac.cupos} cupo(s) disponible(s).`
          );
        }

        motivo = `Seleccionado dentro del cupo (${seleccionados + 1}/${vac.cupos}).`;
        rule = 'Control de Cupos y Concurrencia';
        code = 'SELECCIONADO';
      } else if (nuevoEstado === 'rechazado') {
        motivo = 'Postulación marcada como rechazada por el administrador.';
        code = 'RECHAZADO';
      } else {
        motivo = 'Postulación restablecida a estado pendiente.';
        code = 'PENDIENTE';
      }

      if (this.engine === 'supabase' && this.supabase) {
        const { data, error } = await this.supabase
          .from('postulaciones')
          .update({ estado: nuevoEstado, motivo_decision: motivo, updated_at: nowIso() })
          .eq('id', postulacionId)
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        return { postulacion: data as Postulacion, motivo, rule, code };
      }

      const db = readLocalDb();
      const idx = db.postulaciones.findIndex((p) => p.id === postulacionId);
      db.postulaciones[idx] = {
        ...db.postulaciones[idx],
        estado: nuevoEstado,
        motivo_decision: motivo,
        updated_at: nowIso(),
      };
      writeLocalDb(db);
      return { postulacion: db.postulaciones[idx], motivo, rule, code };
    });
  }

  async deletePostulacion(id: number): Promise<void> {
    if (this.engine === 'postgres' && this.pool) {
      const res = await this.pool.query('DELETE FROM postulaciones WHERE id = $1', [id]);
      if (res.rowCount === 0) throw new BusinessRuleError(404, 'POSTULACION_NO_ENCONTRADA', 'Integridad', 'Postulación no encontrada.', `No existe #${id}.`);
      return;
    }
    if (this.engine === 'supabase' && this.supabase) {
      const { error } = await this.supabase.from('postulaciones').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }
    const db = readLocalDb();
    const idx = db.postulaciones.findIndex((p) => p.id === id);
    if (idx === -1) throw new BusinessRuleError(404, 'POSTULACION_NO_ENCONTRADA', 'Integridad', 'Postulación no encontrada.', `No existe #${id}.`);
    db.postulaciones.splice(idx, 1);
    writeLocalDb(db);
  }
}

export const store = new DataStore();
