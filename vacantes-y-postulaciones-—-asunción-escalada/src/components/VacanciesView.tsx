import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowDownUp,
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  Candidato,
  Empresa,
  FilterQuery,
  OperationFeedback,
  PaginatedResult,
  UserRole,
  Vacante,
  VacanteEstado,
} from '../types';
import { OsmCoordinatePicker } from './OsmCoordinatePicker';

interface VacanciesViewProps {
  role: UserRole;
  empresas: Empresa[];
  candidatos: Candidato[];
  onFeedback: (fb: OperationFeedback) => void;
  onDataChanged: () => void;
  onViewOnMap: (empresaId: number) => void;
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
  sortBy: 'cierre',
  sortDir: 'asc',
  page: 1,
  pageSize: 6,
};

export function VacanciesView({
  role,
  empresas,
  candidatos,
  onFeedback,
  onDataChanged,
  onViewOnMap,
}: VacanciesViewProps) {
  const [subTab, setSubTab] = useState<'vacantes' | 'empresas'>('vacantes');
  const [filters, setFilters] = useState<FilterQuery>(INITIAL_FILTERS);
  const [vacantesPage, setVacantesPage] = useState<PaginatedResult<Vacante>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 6,
    totalPages: 1,
  });
  const [rubros, setRubros] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Vacante Modal State
  const [vacModalOpen, setVacModalOpen] = useState(false);
  const [editingVacante, setEditingVacante] = useState<Vacante | null>(null);
  const [vacForm, setVacForm] = useState({
    empresa_id: empresas[0]?.id || 1,
    cargo: '',
    descripcion: '',
    cierre: '2026-12-30',
    cupos: 1,
    estado: 'abierta' as VacanteEstado,
  });

  // Empresa Modal State
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [empForm, setEmpForm] = useState({
    nombre: '',
    rubro: '',
    ciudad: 'Asunción',
    direccion: '',
    latitud: -25.28646,
    longitud: -57.635,
  });

  // Quick Apply Modal State
  const [applyVacante, setApplyVacante] = useState<Vacante | null>(null);
  const [applyForm, setApplyForm] = useState({
    candidato_id: candidatos[0]?.id || 1,
    fecha: new Date().toISOString().slice(0, 10),
  });

  async function loadVacantes(currentFilters = filters) {
    setLoading(true);
    try {
      const res = await api.listVacantes(currentFilters);
      setVacantesPage({
        items: res.items,
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
        totalPages: res.totalPages,
      });
      setRubros(res.facets.rubros);
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadVacantes(filters);
  }, [filters]);

  function updateFilter<K extends keyof FilterQuery>(key: K, value: FilterQuery[K]) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? (value as number) : 1,
    }));
  }

  function handleClearFilters() {
    setFilters(INITIAL_FILTERS);
  }

  function openNewVacante() {
    setEditingVacante(null);
    setVacForm({
      empresa_id: empresas[0]?.id || 1,
      cargo: '',
      descripcion: '',
      cierre: '2026-12-30',
      cupos: 1,
      estado: 'abierta',
    });
    setVacModalOpen(true);
  }

  function openEditVacante(v: Vacante) {
    setEditingVacante(v);
    setVacForm({
      empresa_id: v.empresa_id,
      cargo: v.cargo,
      descripcion: v.descripcion,
      cierre: v.cierre,
      cupos: v.cupos,
      estado: v.estado,
    });
    setVacModalOpen(true);
  }

  async function handleSaveVacante(e: FormEvent) {
    e.preventDefault();
    try {
      const res = editingVacante
        ? await api.updateVacante(editingVacante.id, vacForm)
        : await api.createVacante(vacForm);
      onFeedback(res);
      setVacModalOpen(false);
      await loadVacantes();
      onDataChanged();
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    }
  }

  async function handleToggleVacanteEstado(v: Vacante) {
    const nextEstado: VacanteEstado = v.estado === 'abierta' ? 'cerrada' : 'abierta';
    try {
      const res = await api.updateVacante(v.id, { estado: nextEstado });
      onFeedback(res);
      await loadVacantes();
      onDataChanged();
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    }
  }

  async function handleDeleteVacante(v: Vacante) {
    try {
      const res = await api.deleteVacante(v.id);
      onFeedback(res);
      await loadVacantes();
      onDataChanged();
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    }
  }

  function openNewEmpresa() {
    setEditingEmpresa(null);
    setEmpForm({
      nombre: '',
      rubro: '',
      ciudad: 'Asunción',
      direccion: '',
      latitud: -25.28646,
      longitud: -57.635,
    });
    setEmpModalOpen(true);
  }

  function openEditEmpresa(emp: Empresa) {
    setEditingEmpresa(emp);
    setEmpForm({
      nombre: emp.nombre,
      rubro: emp.rubro,
      ciudad: emp.ciudad,
      direccion: emp.direccion,
      latitud: emp.latitud,
      longitud: emp.longitud,
    });
    setEmpModalOpen(true);
  }

  async function handleSaveEmpresa(e: FormEvent) {
    e.preventDefault();
    try {
      const res = editingEmpresa
        ? await api.updateEmpresa(editingEmpresa.id, empForm)
        : await api.createEmpresa(empForm);
      onFeedback(res);
      setEmpModalOpen(false);
      onDataChanged();
      await loadVacantes();
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    }
  }

  async function handleDeleteEmpresa(emp: Empresa) {
    try {
      const res = await api.deleteEmpresa(emp.id);
      onFeedback(res);
      onDataChanged();
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    }
  }

  function openApplyModal(v: Vacante) {
    setApplyVacante(v);
    setApplyForm({
      candidato_id: candidatos[0]?.id || 1,
      fecha: new Date().toISOString().slice(0, 10),
    });
  }

  async function handleSubmitApplication(e: FormEvent) {
    e.preventDefault();
    if (!applyVacante) return;
    try {
      const res = await api.createPostulacion({
        vacante_id: applyVacante.id,
        candidato_id: Number(applyForm.candidato_id),
        fecha: `${applyForm.fecha}T12:00:00.000Z`,
      });
      onFeedback(res);
      setApplyVacante(null);
      await loadVacantes();
      onDataChanged();
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubTab('vacantes')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'vacantes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vacantes ({vacantesPage.total})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('empresas')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'empresas' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Empresas ({empresas.length})
          </button>
        </div>

        {role === 'admin' && (
          <div className="flex items-center gap-2.5">
            {subTab === 'vacantes' ? (
              <button
                type="button"
                onClick={openNewVacante}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva Vacante
              </button>
            ) : (
              <button
                type="button"
                onClick={openNewEmpresa}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 cursor-pointer whitespace-nowrap"
              >
                <Building2 className="w-3.5 h-3.5" />
                Nueva Empresa
              </button>
            )}
          </div>
        )}
      </div>

      {subTab === 'vacantes' ? (
        <>
          {/* Combined Search + 6 Filters Toolbar */}
          <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={filters.q || ''}
                  onChange={(e) => updateFilter('q', e.target.value)}
                  placeholder="Buscar por cargo, empresa o descripción..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <input
                type="text"
                value={filters.cargo || ''}
                onChange={(e) => updateFilter('cargo', e.target.value)}
                placeholder="Filtrar por cargo específico..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />

              <select
                aria-label="Filtrar por empresa"
                value={filters.empresaId || ''}
                onChange={(e) => updateFilter('empresaId', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Todos los estados</option>
                <option value="abierta">Abierta</option>
                <option value="cerrada">Cerrada</option>
              </select>

              <select
                aria-label="Filtrar por candidato postulado"
                value={filters.candidatoId || ''}
                onChange={(e) => updateFilter('candidatoId', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Cualquier candidato</option>
                {candidatos.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Cierre desde"
                  value={filters.fechaDesde || ''}
                  onChange={(e) => updateFilter('fechaDesde', e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <input
                  type="date"
                  aria-label="Cierre hasta"
                  value={filters.fechaHasta || ''}
                  onChange={(e) => updateFilter('fechaHasta', e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Ordenar por"
                  value={filters.sortBy || 'cierre'}
                  onChange={(e) => updateFilter('sortBy', e.target.value as FilterQuery['sortBy'])}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="cierre">Orden: Cierre</option>
                  <option value="cargo">Orden: Cargo</option>
                  <option value="empresa">Orden: Empresa</option>
                  <option value="cupos">Orden: Cupos disp.</option>
                  <option value="estado">Orden: Estado</option>
                </select>
                <button
                  type="button"
                  onClick={() => updateFilter('sortDir', filters.sortDir === 'asc' ? 'desc' : 'asc')}
                  title="Cambiar dirección de orden"
                  className="p-2 border border-slate-300 rounded-md bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shrink-0"
                >
                  <ArrowDownUp className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpiar filtros
              </button>
            </div>
          </section>

          {/* Vacancies Data Table */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-600">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Cargo y descripción</th>
                    <th className="py-3 px-4">Empresa y rubro</th>
                    <th className="py-3 px-4">Cierre</th>
                    <th className="py-3 px-4 text-right">Cupos</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {loading && vacantesPage.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                        Cargando vacantes...
                      </td>
                    </tr>
                  ) : vacantesPage.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                        No se encontraron vacantes con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    vacantesPage.items.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-500">
                          #{v.id}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-semibold text-slate-900">{v.cargo}</div>
                          <div className="text-xs text-slate-500 line-clamp-1">{v.descripcion}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{v.empresa_nombre}</div>
                          <div className="text-xs text-slate-500">
                            {v.empresa_rubro} · {v.empresa_ciudad}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-700">
                          {v.cierre}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                          <span className="font-semibold text-slate-900">{v.seleccionados_count || 0}</span>
                          <span className="text-slate-500"> / {v.cupos}</span>
                          <span className="block text-[11px] text-slate-500">
                            {v.cupos_disponibles} disp.
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium">
                          {v.estado === 'abierta' ? (
                            <span className="text-emerald-700">Abierta</span>
                          ) : (
                            <span className="text-red-700">Cerrada</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onViewOnMap(v.empresa_id)}
                              title="Ver empresa en OpenStreetMap"
                              className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                            >
                              <MapPin className="w-4 h-4" />
                            </button>

                            {role === 'admin' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openApplyModal(v)}
                                  className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 cursor-pointer whitespace-nowrap"
                                >
                                  Postular
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleVacanteEstado(v)}
                                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                                >
                                  {v.estado === 'abierta' ? 'Cerrar' : 'Reabrir'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditVacante(v)}
                                  title="Editar vacante"
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVacante(v)}
                                  title="Eliminar vacante"
                                  className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
              <span className="tabular-nums">
                Total: {vacantesPage.total} vacante(s) · Página {vacantesPage.page} de {vacantesPage.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={vacantesPage.page <= 1}
                  onClick={() => updateFilter('page', vacantesPage.page - 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={vacantesPage.page >= vacantesPage.totalPages}
                  onClick={() => updateFilter('page', vacantesPage.page + 1)}
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
        /* EMPRESAS TABLE */
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Rubro</th>
                  <th className="py-3 px-4">Dirección y ciudad</th>
                  <th className="py-3 px-4">Coordenadas OSM</th>
                  <th className="py-3 px-4 text-right">Mapas y acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {empresas.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-500">#{emp.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{emp.nombre}</td>
                    <td className="py-3 px-4 text-xs text-slate-700">{emp.rubro}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {emp.direccion} · {emp.ciudad}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600">
                      {emp.latitud.toFixed(5)}, {emp.longitud.toFixed(5)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onViewOnMap(emp.id)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                        >
                          Ver en OSM
                        </button>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${emp.latitud},${emp.longitud}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Google Maps
                        </a>
                        {role === 'admin' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditEmpresa(emp)}
                              title="Editar empresa"
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEmpresa(emp)}
                              title="Eliminar empresa"
                              className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODAL VACANTE */}
      {vacModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-display font-semibold text-slate-900">
                {editingVacante ? 'Modificar vacante' : 'Nueva vacante laboral'}
              </h2>
              <button
                type="button"
                onClick={() => setVacModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveVacante} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Empresa</label>
                <select
                  value={vacForm.empresa_id}
                  onChange={(e) => setVacForm((f) => ({ ...f, empresa_id: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombre} ({emp.rubro})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cargo</label>
                <input
                  type="text"
                  required
                  value={vacForm.cargo}
                  onChange={(e) => setVacForm((f) => ({ ...f, cargo: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={vacForm.descripcion}
                  onChange={(e) => setVacForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Cierre</label>
                  <input
                    type="date"
                    required
                    value={vacForm.cierre}
                    onChange={(e) => setVacForm((f) => ({ ...f, cierre: e.target.value }))}
                    className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Cupos</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={vacForm.cupos}
                    onChange={(e) => setVacForm((f) => ({ ...f, cupos: Number(e.target.value) }))}
                    className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-md tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Estado</label>
                  <select
                    value={vacForm.estado}
                    onChange={(e) => setVacForm((f) => ({ ...f, estado: e.target.value as VacanteEstado }))}
                    className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="abierta">Abierta</option>
                    <option value="cerrada">Cerrada</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setVacModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 cursor-pointer"
                >
                  Guardar vacante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EMPRESA CON PICKER OPENSTREETMAP */}
      {empModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-display font-semibold text-slate-900">
                {editingEmpresa ? 'Modificar empresa' : 'Registrar nueva empresa'}
              </h2>
              <button
                type="button"
                onClick={() => setEmpModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEmpresa} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={empForm.nombre}
                    onChange={(e) => setEmpForm((f) => ({ ...f, nombre: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Rubro</label>
                  <input
                    type="text"
                    required
                    value={empForm.rubro}
                    onChange={(e) => setEmpForm((f) => ({ ...f, rubro: e.target.value }))}
                    placeholder="Ej: Tecnología y Software"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={empForm.ciudad}
                    onChange={(e) => setEmpForm((f) => ({ ...f, ciudad: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={empForm.direccion}
                    onChange={(e) => setEmpForm((f) => ({ ...f, direccion: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <OsmCoordinatePicker
                latitud={empForm.latitud}
                longitud={empForm.longitud}
                onChange={(lat, lng) => setEmpForm((f) => ({ ...f, latitud: lat, longitud: lng }))}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Latitud</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={empForm.latitud}
                    onChange={(e) => setEmpForm((f) => ({ ...f, latitud: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Longitud</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={empForm.longitud}
                    onChange={(e) => setEmpForm((f) => ({ ...f, longitud: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md tabular-nums"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${empForm.latitud},${empForm.longitud}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Previsualizar en Google Maps
                </a>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEmpModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 cursor-pointer"
                  >
                    Guardar empresa
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL POSTULAR CANDIDATO */}
      {applyVacante && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-display font-semibold text-slate-900">
                Registrar postulación
              </h2>
              <button
                type="button"
                onClick={() => setApplyVacante(null)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Vacante: <strong className="text-slate-900">{applyVacante.cargo}</strong> · Cierre:{' '}
              <span className="font-mono">{applyVacante.cierre}</span> · Estado:{' '}
              <strong>{applyVacante.estado}</strong>
            </p>
            <form onSubmit={handleSubmitApplication} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Candidato</label>
                <select
                  value={applyForm.candidato_id}
                  onChange={(e) => setApplyForm((f) => ({ ...f, candidato_id: Number(e.target.value) }))}
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
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Fecha de postulación (permite probar fechas tardías)
                </label>
                <input
                  type="date"
                  required
                  value={applyForm.fecha}
                  onChange={(e) => setApplyForm((f) => ({ ...f, fecha: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setApplyVacante(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 cursor-pointer"
                >
                  Enviar postulación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
