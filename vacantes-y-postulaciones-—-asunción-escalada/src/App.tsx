import { useCallback, useEffect, useState } from 'react';
import { api, setAuthToken } from './api/client';
import { AdminAuthModal } from './components/AdminAuthModal';
import { ApplicationsView } from './components/ApplicationsView';
import { DashboardView } from './components/DashboardView';
import { FeedbackBanner } from './components/FeedbackBanner';
import { OpenStreetMapView } from './components/OpenStreetMapView';
import { TestingAndDeployView } from './components/TestingAndDeployView';
import { TopNav, type ActiveTab } from './components/TopNav';
import { VacanciesView } from './components/VacanciesView';
import type {
  Candidato,
  DashboardKPIs,
  DecisionLog,
  Empresa,
  OperationFeedback,
  UserRole,
  Vacante,
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [role, setRole] = useState<UserRole>('consulta');
  const [adminClaimed, setAdminClaimed] = useState(false);
  const [envPasscodeConfigured, setEnvPasscodeConfigured] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [vacantes, setVacantes] = useState<Vacante[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [decisionLogs, setDecisionLogs] = useState<DecisionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [feedback, setFeedback] = useState<OperationFeedback | null>(null);
  const [mapFocusEmpresaId, setMapFocusEmpresaId] = useState<number | null>(null);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [authSt, dash, empRes, candRes] = await Promise.all([
        api.authStatus(),
        api.getDashboard(),
        api.listEmpresas(),
        api.listCandidatos(),
      ]);
      setRole(authSt.role);
      setAdminClaimed(authSt.adminClaimed);
      setEnvPasscodeConfigured(authSt.envPasscodeConfigured);
      setKpis(dash.kpis);
      setVacantes(dash.vacantes);
      setDecisionLogs(dash.decisionLogs);
      setEmpresas(empRes.items);
      setCandidatos(candRes.items);
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  function handleAuthenticated() {
    setAuthModalOpen(false);
    setFeedback({
      ok: true,
      code: 'SESION_ADMIN',
      rule: 'Control de Acceso por Rol',
      message: 'Sesión de Administrador iniciada correctamente.',
      reason: 'Ahora puede operar altas, modificaciones, bajas, selecciones y pruebas de concurrencia.',
    });
    void refreshAll();
  }

  function handleLogoutAdmin() {
    setAuthToken(null);
    setRole('consulta');
    setFeedback({
      ok: true,
      code: 'MODO_CONSULTA',
      rule: 'Control de Acceso por Rol',
      message: 'Cambió a modo Usuario de Consulta.',
      reason: 'Los datos personales sensibles quedan protegidos y las mutaciones deshabilitadas.',
    });
    void refreshAll();
  }

  function handleViewOnMap(empresaId: number) {
    setMapFocusEmpresaId(empresaId);
    setActiveTab('mapa');
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        role={role}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogoutAdmin={handleLogoutAdmin}
      />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

        {activeTab === 'dashboard' && (
          <DashboardView
            kpis={kpis}
            vacantes={vacantes}
            decisionLogs={decisionLogs}
            role={role}
            loading={loading}
            onNavigate={setActiveTab}
            onSelectVacancyOnMap={handleViewOnMap}
          />
        )}

        {activeTab === 'vacantes' && (
          <VacanciesView
            role={role}
            empresas={empresas}
            candidatos={candidatos}
            onFeedback={setFeedback}
            onDataChanged={() => void refreshAll()}
            onViewOnMap={handleViewOnMap}
          />
        )}

        {activeTab === 'postulaciones' && (
          <ApplicationsView
            role={role}
            empresas={empresas}
            vacantes={vacantes}
            candidatos={candidatos}
            onFeedback={setFeedback}
            onDataChanged={() => void refreshAll()}
          />
        )}

        {activeTab === 'mapa' && (
          <OpenStreetMapView
            empresas={empresas}
            vacantes={vacantes}
            initialEmpresaId={mapFocusEmpresaId}
          />
        )}

        {activeTab === 'pruebas' && (
          <TestingAndDeployView
            role={role}
            onOpenAuth={() => setAuthModalOpen(true)}
            onFeedback={setFeedback}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>
            Colegio Nacional EMD Asunción Escalada · Proyecto individual 22: Vacantes y postulaciones
          </span>
          <span>
            Santacruz Cubilla, Marcos Damian · 2° Curso · 3ª Sección · Turno Mañana
          </span>
        </div>
      </footer>

      <AdminAuthModal
        open={authModalOpen}
        adminClaimed={adminClaimed}
        envPasscodeConfigured={envPasscodeConfigured}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
}
