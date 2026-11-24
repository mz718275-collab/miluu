import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDownUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  Candidato,
  Empresa,
  FilterQuery,
  OperationFeedback,
  PaginatedResult,
  Postulacion,
  PostulacionEstado,
  UserRole,
  Vacante,
} from '../types';

interface ApplicationsViewProps {
  role: UserRole;
  empresas: Empresa[];
  vacantes: Vacante[];
  candidatos: Candidato[];
  onFeedback: (fb: OperationFeedback) => void;
  onDataChanged: () => void;
}

const INITIAL_FILTERS: FilterQuery = {
  q: '',
  cargo: '',
  empresaId: '',
  rubro: '',
  estado: '',
  fechaDesde: '',
  fechaHasta: '',
  candidatoId: '',
  sortBy: 'fecha',
  sortDir: 'desc',
  page: 1,
  pageSize: 6,
};

export function ApplicationsView({
  role,
  empresas,
  vacantes,
  candidatos,
  onFeedback,
  onDataChanged,
}: ApplicationsViewProps) {
  const [subTab, setSubTab] = useState<'postulaciones' | 'candidatos'>('postulaciones');
  const [filters, setFilters] = useState<FilterQuery>(INITIAL_FILTERS);
  const [pageData, setPageData] = useState<PaginatedResult<Postulacion>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 6,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);

  // Nueva postulación modal
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postForm, setPostForm] = useState({
    vacante_id: vacantes[0]?.id || 1,
    candidato_id: candidatos[0]?.id || 1,
    fecha: new Date().toISOString().slice(0, 10),
  });

  // Candidato modal
  const [candModalOpen, setCandModalOpen] = useState(false);
  const [editingCand, setEditingCand] = useState<Candidato | null>(null);
  const [candForm, setCandForm] = useState({
    documento: '',
    nombre: '',
    email: '',
    telefono: '',
  });

  const rubros = useMemo(
    () => Array.from(new Set(empresas.map((e) => e.rubro).filter(Boolean))).sort(),
    [empresas]
  );

  async function loadPostulaciones(currentFilters = filters) {
    setLoading(true);
    try {
      const res = await api.listPostulaciones(currentFilters);
      setPageData(res);
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPostulaciones(filters);
  }, [filters]);

  function updateFilter<K extends keyof FilterQuery>(key: K, value: FilterQuery[K]) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? (value as number) : 1,
    }));
  }

  async function handleChangeEstado(p: Postulacion, estado: PostulacionEstado) {
    try {
      const res = await api.changePostulacionEstado(p.id, estado);
      onFeedback(res);
      await loadPostulaciones();
      onDataChanged();
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    }
  }

  async function handleDeletePostulacion(id: number) {
    try {
      const res = await api.deletePostulacion(id);
      onFeedback(res);
      await loadPostulaciones();
      onDataChanged();
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    }
  }

  async function handleCreatePostulacion(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await api.createPostulacion({
        vacante_id: Number(postForm.vacante_id),
        candidato_id: Number(postForm.candidato_id),
        fecha: `${postForm.fecha}T12:00:00.000Z`,
      });
      onFeedback(res);
      setPostModalOpen(false);
      await loadPostulaciones();
      onDataChanged();
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    }
  }

  function openNewCandidato() {
    setEditingCand(null);
    setCandForm({ documento: '', nombre: '', email: '', telefono: '' });
    setCandModalOpen(true);
  }

  function openEditCandidato(c: Candidato) {
    setEditingCand(c);
    setCandForm({
      documento: c.documento,
      nombre: c.nombre,
      email: c.email,
      telefono: c.telefono,
    });
    setCandModalOpen(true);
  }

  async function handleSaveCandidato(e: FormEvent) {
    e.preventDefault();
    try {
      const res = editingCand
        ? await api.updateCandidato(editingCand.id, candForm)
        : await api.createCandidato(candForm);
      onFeedback(res);
      setCandModalOpen(false);
      onDataChanged();
      await loadPostulaciones();
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    }
  }

  async function handleDeleteCandidato(id: number) {
    try {
      const res = await api.deleteCandidato(id);
      onFeedback(res);
      onDataChanged();
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubTab('postulaciones')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'postulaciones' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Postulaciones ({pageData.total})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('candidatos')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'candidatos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Candidatos ({candidatos.length})
          </button>
        </div>

        {role === 'admin' && (
          <div className="flex items-center gap-2.5">
            {subTab === 'postulaciones' ? (
              <button
                type="button"
                onClick={() => {
                  setPostForm({
                    vacante_id: vacantes[0]?.id || 1,
                    candidato_id: candidatos[0]?.id || 1,
                    fecha: new Date().toISOString().slice(0, 10),
                  });
                  setPostModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva Postulación
              </button>
            ) : (
              <button
                type="button"
                onClick={openNewCandidato}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Nuevo Candidato
              </button>
            )}
          </div>
        )}
      </div>

      {subTab === 'postulaciones' ? (
        <>
          {/* Combined Search + Filters */}
          <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={filters.q || ''}
                  onChange={(e) => updateFilter('q', e.target.value)}
                  placeholder="Buscar cargo, empresa o candidato..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <input
                type="text"
                value={filters.cargo || ''}
                onChange={(e) => updateFilter('cargo', e.target.value)}
                placeholder="Filtrar por cargo..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />

              <select
                aria-label="Filtrar por empresa"
                value={filters.empresaId || ''}
                onChange={(e) => updateFilter('empresaId', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="">Todas las empresas</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.nombre}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar por rubro"
                value={filters.rubro || ''}
                onChange={(e) => updateFilter('rubro', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="">Todos los rubros</option>
                {rubros.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
              <select
                aria-label="Filtrar por estado"
                value={filters.estado || ''}
                onChange={(e) => updateFilter('estado', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="seleccionado">Seleccionado</option>
                <option value="rechazado">Rechazado</option>
              </select>

              <select
                aria-label="Filtrar por candidato"
                value={filters.candidatoId || ''}
                onChange={(e) => updateFilter('candidatoId', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="">Todos los candidatos</option>
                {candidatos.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Fecha desde"
                  value={filters.fechaDesde || ''}
                  onChange={(e) => updateFilter('fechaDesde', e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md"
                />
                <input
                  type="date"
                  aria-label="Fecha hasta"
                  value={filters.fechaHasta || ''}
                  onChange={(e) => updateFilter('fechaHasta', e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Ordenar postulaciones"
                  value={filters.sortBy || 'fecha'}
                  onChange={(e) => updateFilter('sortBy', e.target.value as FilterQuery['sortBy'])}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="fecha">Orden: Fecha</option>
                  <option value="cargo">Orden: Cargo</option>
                  <option value="empresa">Orden: Empresa</option>
                  <option value="estado">Orden: Estado</option>
                </select>
                <button
                  type="button"
                  onClick={() => updateFilter('sortDir', filters.sortDir === 'asc' ? 'desc' : 'asc')}
                  className="p-2 border border-slate-300 rounded-md bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shrink-0"
                >
                  <ArrowDownUp className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setFilters(INITIAL_FILTERS)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpiar filtros
              </button>
            </div>
          </section>

          {/* Applications Table */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-600">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Candidato</th>
                    <th className="py-3 px-4">Vacante y empresa</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Estado y motivo</th>
                    {role === 'admin' && <th className="py-3 px-4 text-right">Operación</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {loading && pageData.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                        Cargando postulaciones...
                      </td>
                    </tr>
                  ) : pageData.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                        No hay postulaciones que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    pageData.items.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-500">#{p.id}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{p.candidato_nombre}</div>
                          <div className="text-xs font-mono text-slate-500 tabular-nums">
                            CI {p.candidato_documento}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{p.vacante_cargo}</div>
                          <div className="text-xs text-slate-500">
                            {p.empresa_nombre} · {p.empresa_rubro} · Cupos: {p.vacante_cupos}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600">
                          {p.fecha.slice(0, 10)}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="text-xs font-semibold">
                            {p.estado === 'seleccionado' && <span className="text-emerald-700">Seleccionado</span>}
                            {p.estado === 'pendiente' && <span className="text-amber-700">Pendiente</span>}
                            {p.estado === 'rechazado' && <span className="text-red-700">Rechazado</span>}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {p.motivo_decision}
                          </div>
                        </td>
                        {role === 'admin' && (
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleChangeEstado(p, 'seleccionado')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                              >
                                <Check className="w-3 h-3" />
                                Seleccionar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleChangeEstado(p, 'rechazado')}
                                className="px-2.5 py-1 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded hover:bg-red-100 cursor-pointer whitespace-nowrap"
                              >
                                Rechazar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePostulacion(p.id)}
                                title="Eliminar postulación"
                                className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
              <span className="tabular-nums">
                Total: {pageData.total} postulación(es) · Página {pageData.page} de {pageData.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pageData.page <= 1}
                  onClick={() => updateFilter('page', pageData.page - 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={pageData.page >= pageData.totalPages}
                  onClick={() => updateFilter('page', pageData.page + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  Siguiente
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* CANDIDATOS TABLE */
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 text-xs text-slate-600">
            {role === 'admin'
              ? 'Vista completa de Administrador: documentos y datos de contacto visibles.'
              : 'Vista de Usuario de Consulta: los documentos y datos personales están protegidos.'}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Nombre completo</th>
                  <th className="py-3 px-4">Correo</th>
                  <th className="py-3 px-4">Teléfono</th>
                  {role === 'admin' && <th className="py-3 px-4 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {candidatos.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-500">#{c.id}</td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-800">{c.documento}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{c.nombre}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{c.email || '—'}</td>
                    <td className="py-3 px-4 text-xs text-slate-600 font-mono tabular-nums">{c.telefono || '—'}</td>
                    {role === 'admin' && (
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditCandidato(c)}
                            title="Editar candidato"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCandidato(c.id)}
                            title="Eliminar candidato"
                            className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODAL NUEVA POSTULACIÓN */}
      {postModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-display font-semibold text-slate-900">Nueva postulación</h2>
              <button
                type="button"
                onClick={() => setPostModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePostulacion} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Vacante</label>
                <select
                  value={postForm.vacante_id}
                  onChange={(e) => setPostForm((f) => ({ ...f, vacante_id: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {vacantes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.cargo} — {v.empresa_nombre} ({v.estado}, cierre {v.cierre})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Candidato</label>
                <select
                  value={postForm.candidato_id}
                  onChange={(e) => setPostForm((f) => ({ ...f, candidato_id: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {candidatos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} (CI {c.documento})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fecha de postulación</label>
                <input
                  type="date"
                  required
                  value={postForm.fecha}
                  onChange={(e) => setPostForm((f) => ({ ...f, fecha: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPostModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 cursor-pointer"
                >
                  Registrar postulación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CANDIDATO */}
      {candModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-display font-semibold text-slate-900">
                {editingCand ? 'Editar candidato' : 'Nuevo candidato'}
              </h2>
              <button
                type="button"
                onClick={() => setCandModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCandidato} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Documento (CI)</label>
                <input
                  type="text"
                  required
                  value={candForm.documento}
                  onChange={(e) => setCandForm((f) => ({ ...f, documento: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={candForm.nombre}
                  onChange={(e) => setCandForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={candForm.email}
                  onChange={(e) => setCandForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={candForm.telefono}
                  onChange={(e) => setCandForm((f) => ({ ...f, telefono: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCandModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 cursor-pointer"
                >
                  Guardar candidato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
