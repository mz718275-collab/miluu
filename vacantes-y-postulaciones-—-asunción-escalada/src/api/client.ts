import type {
  Candidato,
  DashboardKPIs,
  DecisionLog,
  Empresa,
  FilterQuery,
  IntegrationsStatus,
  OperationFeedback,
  PaginatedResult,
  Postulacion,
  PostulacionEstado,
  TestCaseResult,
  UserRole,
  Vacante,
  VacanteEstado,
} from '../types';

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (inMemoryToken) {
    headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  const resp = await fetch(url, { ...options, headers });
  const data = (await resp.json()) as T & { ok?: boolean; message?: string; reason?: string; code?: string; rule?: string };
  if (!resp.ok) {
    const err = new Error(data.message || `Error HTTP ${resp.status}`) as Error & {
      feedback?: OperationFeedback;
      status?: number;
    };
    err.status = resp.status;
    err.feedback = {
      ok: false,
      code: data.code || `HTTP_${resp.status}`,
      rule: data.rule || 'Validación',
      message: data.message || `Error HTTP ${resp.status}`,
      reason: data.reason || data.message || 'Operación rechazada.',
    };
    throw err;
  }
  return data;
}

function buildFilterParams(filters: FilterQuery): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      params.set(k, String(v));
    }
  });
  return params.toString();
}

export const api = {
  authStatus: () =>
    request<{ role: UserRole; adminClaimed: boolean; envPasscodeConfigured: boolean }>('/api/auth/status'),

  claimAdmin: (passcode: string) =>
    request<{ ok: boolean; role: UserRole; token: string; message: string }>('/api/auth/claim-admin', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),

  loginAdmin: (passcode: string) =>
    request<{ ok: boolean; role: UserRole; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),

  getDashboard: () =>
    request<{ kpis: DashboardKPIs; vacantes: Vacante[]; decisionLogs: DecisionLog[] }>('/api/dashboard'),

  listEmpresas: () => request<{ items: Empresa[] }>('/api/empresas'),

  createEmpresa: (payload: {
    nombre: string;
    rubro: string;
    ciudad: string;
    direccion: string;
    latitud: number;
    longitud: number;
  }) =>
    request<OperationFeedback<Empresa>>('/api/empresas', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateEmpresa: (
    id: number,
    payload: {
      nombre: string;
      rubro: string;
      ciudad: string;
      direccion: string;
      latitud: number;
      longitud: number;
    }
  ) =>
    request<OperationFeedback<Empresa>>(`/api/empresas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteEmpresa: (id: number) =>
    request<OperationFeedback>(`/api/empresas/${id}`, { method: 'DELETE' }),

  listVacantes: (filters: FilterQuery) => {
    const qs = buildFilterParams(filters);
    return request<PaginatedResult<Vacante> & { facets: { rubros: string[] } }>(
      `/api/vacantes${qs ? `?${qs}` : ''}`
    );
  },

  createVacante: (payload: {
    empresa_id: number;
    cargo: string;
    descripcion: string;
    cierre: string;
    cupos: number;
    estado: VacanteEstado;
  }) =>
    request<OperationFeedback<Vacante>>('/api/vacantes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateVacante: (
    id: number,
    payload: Partial<{
      empresa_id: number;
      cargo: string;
      descripcion: string;
      cierre: string;
      cupos: number;
      estado: VacanteEstado;
    }>
  ) =>
    request<OperationFeedback<Vacante>>(`/api/vacantes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteVacante: (id: number) =>
    request<OperationFeedback>(`/api/vacantes/${id}`, { method: 'DELETE' }),

  listCandidatos: () => request<{ items: Candidato[] }>('/api/candidatos'),

  createCandidato: (payload: { documento: string; nombre: string; email: string; telefono: string }) =>
    request<OperationFeedback<Candidato>>('/api/candidatos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCandidato: (
    id: number,
    payload: { documento: string; nombre: string; email: string; telefono: string }
  ) =>
    request<OperationFeedback<Candidato>>(`/api/candidatos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteCandidato: (id: number) =>
    request<OperationFeedback>(`/api/candidatos/${id}`, { method: 'DELETE' }),

  listPostulaciones: (filters: FilterQuery) => {
    const qs = buildFilterParams(filters);
    return request<PaginatedResult<Postulacion>>(`/api/postulaciones${qs ? `?${qs}` : ''}`);
  },

  createPostulacion: (payload: { vacante_id: number; candidato_id: number; fecha?: string }) =>
    request<OperationFeedback<Postulacion>>('/api/postulaciones', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  changePostulacionEstado: (id: number, estado: PostulacionEstado) =>
    request<OperationFeedback<Postulacion>>(`/api/postulaciones/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    }),

  deletePostulacion: (id: number) =>
    request<OperationFeedback>(`/api/postulaciones/${id}`, { method: 'DELETE' }),

  runMandatoryTestSuite: () =>
    request<{
      ok: boolean;
      executedAt: string;
      engine: string;
      allPassed: boolean;
      results: TestCaseResult[];
    }>('/api/tests/run-suite', { method: 'POST' }),

  getIntegrationsStatus: () => request<IntegrationsStatus>('/api/integrations/status'),

  saveIntegrationsConfig: (payload: { githubRepo: string; renderServiceUrl: string }) =>
    request<OperationFeedback<{ githubRepo: string; renderServiceUrl: string }>>('/api/integrations/config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  fetchGithubRepo: (repo?: string) =>
    request<{
      ok: boolean;
      repo: {
        full_name: string;
        description: string | null;
        html_url: string;
        default_branch: string;
        stargazers_count: number;
        updated_at: string;
        language: string | null;
      };
      commits: Array<{ sha: string; message: string; author: string; date: string; html_url: string }>;
    }>(`/api/integrations/github${repo ? `?repo=${encodeURIComponent(repo)}` : ''}`),

  checkRenderHealth: (url?: string) =>
    request<{
      ok: boolean;
      status: number;
      latencyMs: number;
      target: string;
      preview?: string;
      message?: string;
    }>('/api/integrations/check-render', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  getArtifacts: () =>
    request<{ schemaSql: string; seedSql: string; renderYaml: string; defensaMd: string }>(
      '/api/integrations/artifacts'
    ),
};
