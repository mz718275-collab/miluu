import type { UserRole } from '../types';

export type ActiveTab = 'dashboard' | 'vacantes' | 'postulaciones' | 'mapa' | 'pruebas';

interface TopNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  role: UserRole;
  onOpenAuth: () => void;
  onLogoutAdmin: () => void;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'dashboard', label: 'Panel' },
  { id: 'vacantes', label: 'Vacantes' },
  { id: 'postulaciones', label: 'Postulaciones' },
  { id: 'mapa', label: 'Mapa OSM' },
  { id: 'pruebas', label: 'Pruebas y Deploy' },
];

export function TopNav({
  activeTab,
  onSelectTab,
  role,
  onOpenAuth,
  onLogoutAdmin,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className="text-lg font-display font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm"
        >
          Asunción Talentos
        </button>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 h-full" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`h-full inline-flex items-center text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  active
                    ? 'border-blue-700 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="shrink-0">
          {role === 'admin' ? (
            <button
              type="button"
              onClick={onLogoutAdmin}
              className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cambiar a Consulta
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Acceso Administrador
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation strip */}
      <nav
        className="md:hidden border-t border-slate-200 px-4 flex items-center gap-4 overflow-x-auto"
        aria-label="Navegación móvil"
      >
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-2.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 ${
                active ? 'border-blue-700 text-slate-900' : 'border-transparent text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
