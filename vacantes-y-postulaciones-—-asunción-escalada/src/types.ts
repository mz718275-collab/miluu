export type UserRole = 'admin' | 'consulta';

export interface Empresa {
  id: number;
  nombre: string;
  rubro: string;
  ciudad: string;
  direccion: string;
  latitud: number;
  longitud: number;
  created_at: string;
  updated_at: string;
}

export type VacanteEstado = 'abierta' | 'cerrada';

export interface Vacante {
  id: number;
  empresa_id: number;
  cargo: string;
  descripcion: string;
  cierre: string; // YYYY-MM-DD
  cupos: number;
  estado: VacanteEstado;
  created_at: string;
  updated_at: string;
  // Enriched fields returned by API
  empresa_nombre?: string;
  empresa_rubro?: string;
  empresa_ciudad?: string;
  empresa_direccion?: string;
  empresa_latitud?: number;
  empresa_longitud?: number;
  seleccionados_count?: number;
  postulaciones_count?: number;
  cupos_disponibles?: number;
}

export interface Candidato {
  id: number;
  documento: string;
  nombre: string;
  email: string;
  telefono: string;
  created_at: string;
  updated_at: string;
}

export type PostulacionEstado = 'pendiente' | 'seleccionado' | 'rechazado';

export interface Postulacion {
  id: number;
  vacante_id: number;
  candidato_id: number;
  fecha: string; // ISO datetime
  estado: PostulacionEstado;
  motivo_decision: string;
  created_at: string;
  updated_at: string;
  // Enriched fields
  vacante_cargo?: string;
  vacante_cierre?: string;
  vacante_cupos?: number;
  vacante_estado?: VacanteEstado;
  empresa_id?: number;
  empresa_nombre?: string;
  empresa_rubro?: string;
  candidato_nombre?: string;
  candidato_documento?: string;
}

export interface DecisionLog {
  id: number;
  timestamp: string;
  operacion: string;
  aceptado: boolean;
  codigo: string;
  regla: string;
  motivo: string;
  entidad: string;
}

export interface DashboardKPIs {
  vacantesAbiertas: number;
  vacantesCerradas: number;
  totalVacantes: number;
  totalPostulantes: number;
  totalPostulaciones: number;
  cuposTotalesAbiertos: number;
  cuposCubiertosAbiertos: number;
  cuposPorCubrir: number;
  empresasRegistradas: number;
}

export interface OperationFeedback<T = unknown> {
  ok: boolean;
  code: string;
  rule: string;
  message: string;
  reason: string;
  data?: T;
}

export interface FilterQuery {
  q?: string;
  cargo?: string;
  empresaId?: string;
  rubro?: string;
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  candidatoId?: string;
  sortBy?: 'fecha' | 'cierre' | 'cargo' | 'empresa' | 'cupos' | 'estado';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TestCaseResult {
  id: string;
  titulo: string;
  objetivo: string;
  entradas: Record<string, unknown>;
  resultadoEsperado: string;
  resultadoObtenido: string;
  detalles: Array<{
    paso: string;
    aceptado: boolean;
    httpStatus: number;
    codigo: string;
    motivo: string;
    timestamp: string;
  }>;
  aprobado: boolean;
  duracionMs: number;
}

export interface IntegrationsStatus {
  databaseEngine: 'postgres' | 'supabase' | 'local';
  databaseConnected: boolean;
  databaseLabel: string;
  supabaseConfigured: boolean;
  postgresConfigured: boolean;
  githubRepo: string;
  renderServiceUrl: string;
  appUrl: string;
}
