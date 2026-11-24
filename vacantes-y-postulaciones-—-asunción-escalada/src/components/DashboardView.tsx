import { ArrowUpRight, MapPin } from 'lucide-react';
import type { DashboardKPIs, DecisionLog, UserRole, Vacante } from '../types';
import type { ActiveTab } from './TopNav';

interface DashboardViewProps {
  kpis: DashboardKPIs | null;
  vacantes: Vacante[];
  decisionLogs: DecisionLog[];
  role: UserRole;
  loading: boolean;
  onNavigate: (tab: ActiveTab) => void;
  onSelectVacancyOnMap: (empresaId: number) => void;
}

export function DashboardView({
  kpis,
  vacantes,
  decisionLogs,
  role,
  loading,
  onNavigate,
  onSelectVacancyOnMap,
}: DashboardViewProps) {
  if (loading && !kpis) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-white border border-slate-200 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Institutional & Role Strip */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">
            Colegio Nacional EMD Asunción Escalada · Proyecto individual 22 · Software 8 pts · Hardware 8 pts · Laboratorio 8 pts
          </p>
          <h1 className="text-2xl font-display font-bold text-slate-900 text-balance">
            Panel de Control: Vacantes y Postulaciones
          </h1>
          <p className="text-sm text-slate-600">
            Santacruz Cubilla, Marcos Damian · Segundo curso · Tercera sección · Turno mañana
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700">
            Rol activo:{' '}
            <span className="font-semibold text-slate-900">
              {role === 'admin' ? 'Administrador (Operación completa)' : 'Usuario de Consulta (Solo lectura autorizada)'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('vacantes')}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            Explorar Vacantes
          </button>
        </div>
      </section>

      {/* Primary KPI Grid */}
      <section aria-label="Indicadores principales" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Vacantes abiertas</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-3xl font-display font-bold text-slate-900 tabular-nums">
              {kpis?.vacantesAbiertas ?? 0}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {kpis?.vacantesCerradas ?? 0} cerradas · {kpis?.totalVacantes ?? 0} totales
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Postulantes</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-3xl font-display font-bold text-slate-900 tabular-nums">
              {kpis?.totalPostulantes ?? 0}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {kpis?.totalPostulaciones ?? 0} postulaciones · {kpis?.empresasRegistradas ?? 0} empresas
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Cupos por cubrir</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-3xl font-display font-bold text-blue-700 tabular-nums">
              {kpis?.cuposPorCubrir ?? 0}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {kpis?.cuposCubiertosAbiertos ?? 0} cubiertos de {kpis?.cuposTotalesAbiertos ?? 0} en abiertas
            </span>
          </div>
        </div>
      </section>

      {/* Main Split: Vacancy Occupancy Table + Recent Rule Decisions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-display font-semibold text-slate-900">
                Estado de vacantes y ocupación de cupos
              </h2>
              <p className="text-xs text-slate-500">
                Seguimiento en tiempo real de cierres, postulaciones recibidas y cupos disponibles
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('vacantes')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              Ver todas
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-4">Cargo y empresa</th>
                  <th className="py-2.5 px-4">Cierre</th>
                  <th className="py-2.5 px-4 text-right">Seleccionados</th>
                  <th className="py-2.5 px-4 text-right">Postulaciones</th>
                  <th className="py-2.5 px-4">Estado</th>
                  <th className="py-2.5 px-4 text-right">Ubicación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {vacantes.slice(0, 7).map((v) => {
                  const sel = v.seleccionados_count || 0;
                  const expired = v.cierre < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{v.cargo}</div>
                        <div className="text-xs text-slate-500">
                          {v.empresa_nombre} · {v.empresa_rubro}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-700">
                        {v.cierre}
                        {expired && v.estado === 'abierta' && (
                          <span className="block text-amber-700 font-sans">Plazo vencido</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-800">
                        {sel} / {v.cupos}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-700">
                        {v.postulaciones_count || 0}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium">
                        {v.estado === 'abierta' ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700">
                            <span className="w-1.5 h-1.5 bg-emerald-600 inline-block" aria-hidden="true" />
                            Abierta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-red-700">
                            <span className="w-1.5 h-1.5 bg-red-600 inline-block" aria-hidden="true" />
                            Cerrada
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectVacancyOnMap(v.empresa_id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Ver mapa
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {vacantes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                      No hay vacantes registradas aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-display font-semibold text-slate-900">
              Registro de decisiones y reglas
            </h2>
            <p className="text-xs text-slate-500">
              Historial de por qué cada operación fue aceptada o rechazada
            </p>
          </div>

          <div className="divide-y divide-slate-200 overflow-y-auto max-h-[420px]">
            {decisionLogs.map((log) => (
              <div key={log.id} className="px-5 py-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`font-semibold ${log.aceptado ? 'text-emerald-700' : 'text-red-700'}`}>
                    {log.aceptado ? 'Aceptada' : 'Rechazada'} · {log.operacion}
                  </span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    {log.timestamp.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{log.motivo}</p>
                <p className="text-xs text-slate-500">
                  Regla: {log.regla} · <span className="font-mono">{log.codigo}</span>
                </p>
              </div>
            ))}
            {decisionLogs.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500">
                Las validaciones de operaciones aparecerán aquí.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
