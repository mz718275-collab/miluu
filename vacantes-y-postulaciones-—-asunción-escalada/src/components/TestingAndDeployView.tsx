import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Copy,
  Database,
  Download,
  ExternalLink,
  FlaskConical,
  GitBranch,
  Globe,
  Lock,
  Play,
  XCircle,
} from 'lucide-react';
import { api } from '../api/client';
import type { IntegrationsStatus, OperationFeedback, TestCaseResult, UserRole } from '../types';

interface TestingAndDeployViewProps {
  role: UserRole;
  onOpenAuth: () => void;
  onFeedback: (fb: OperationFeedback) => void;
}

export function TestingAndDeployView({
  role,
  onOpenAuth,
  onFeedback,
}: TestingAndDeployViewProps) {
  const [subTab, setSubTab] = useState<'qa' | 'integraciones' | 'esquema'>('qa');

  // QA Suite state
  const [runningSuite, setRunningSuite] = useState(false);
  const [suiteData, setSuiteData] = useState<{
    executedAt: string;
    engine: string;
    allPassed: boolean;
    results: TestCaseResult[];
  } | null>(null);

  // Integrations state
  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [githubRepo, setGithubRepo] = useState('');
  const [renderUrl, setRenderUrl] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const [githubInfo, setGithubInfo] = useState<{
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
  } | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [loadingGithub, setLoadingGithub] = useState(false);

  const [renderCheck, setRenderCheck] = useState<{
    ok: boolean;
    status: number;
    latencyMs: number;
    target: string;
    message?: string;
    preview?: string;
  } | null>(null);
  const [checkingRender, setCheckingRender] = useState(false);

  // Artifacts (SQL, render.yaml, defensa)
  const [artifacts, setArtifacts] = useState<{
    schemaSql: string;
    seedSql: string;
    renderYaml: string;
    defensaMd: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function loadIntegrations() {
    try {
      const [st, art] = await Promise.all([api.getIntegrationsStatus(), api.getArtifacts()]);
      setStatus(st);
      setGithubRepo(st.githubRepo || '');
      setRenderUrl(st.renderServiceUrl || '');
      setArtifacts(art);
    } catch {
      // ignore initial load errors
    }
  }

  useEffect(() => {
    void loadIntegrations();
  }, []);

  async function handleRunSuite() {
    setRunningSuite(true);
    try {
      const res = await api.runMandatoryTestSuite();
      setSuiteData(res);
      onFeedback({
        ok: res.allPassed,
        code: res.allPassed ? 'QA_APROBADO' : 'QA_CON_FALLOS',
        rule: 'Prueba Individual Obligatoria y Concurrencia',
        message: res.allPassed
          ? `Las ${res.results.length} pruebas obligatorias pasaron correctamente en motor "${res.engine}".`
          : 'Algunas pruebas fallaron; revise los detalles.',
        reason: 'Se validaron selección hasta el cupo, rechazo adicional, postulación tardía, vacante cerrada, duplicados y concurrencia simultánea.',
      });
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    } finally {
      setRunningSuite(false);
    }
  }

  function handleExportQaMarkdown() {
    if (!suiteData) return;
    const lines: string[] = [
      '# Evidencia de Prueba Individual Obligatoria — Proyecto 22',
      '',
      '- **Institución:** Colegio Nacional EMD Asunción Escalada',
      '- **Estudiante:** Santacruz Cubilla, Marcos Damian',
      `- **Fecha de ejecución:** ${suiteData.executedAt}`,
      `- **Motor de base de datos:** ${suiteData.engine}`,
      `- **Resultado global:** ${suiteData.allPassed ? 'APROBADO' : 'CON OBSERVACIONES'}`,
      '',
    ];
    suiteData.results.forEach((tc) => {
      lines.push(`## ${tc.id}: ${tc.titulo}`);
      lines.push(`- **Estado:** ${tc.aprobado ? 'APROBADO' : 'REPROBADO'} (${tc.duracionMs} ms)`);
      lines.push(`- **Objetivo:** ${tc.objetivo}`);
      lines.push(`- **Entradas:** \`${JSON.stringify(tc.entradas)}\``);
      lines.push(`- **Resultado esperado:** ${tc.resultadoEsperado}`);
      lines.push(`- **Resultado obtenido:** ${tc.resultadoObtenido}`);
      lines.push('- **Pasos ejecutados:**');
      tc.detalles.forEach((d) => {
        lines.push(`  - [${d.aceptado ? 'ACEPTADO' : 'RECHAZADO'} · HTTP ${d.httpStatus} · ${d.codigo}] ${d.paso}: ${d.motivo} (${d.timestamp})`);
      });
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'evidencia_pruebas_proyecto22.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveConfig(e: FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await api.saveIntegrationsConfig({ githubRepo, renderServiceUrl: renderUrl });
      onFeedback(res);
      await loadIntegrations();
    } catch (err) {
      const fb = (err as { feedback?: OperationFeedback }).feedback;
      if (fb) onFeedback(fb);
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleFetchGithub() {
    setLoadingGithub(true);
    setGithubError(null);
    try {
      const res = await api.fetchGithubRepo(githubRepo);
      setGithubInfo({ repo: res.repo, commits: res.commits });
    } catch (err) {
      setGithubInfo(null);
      setGithubError((err as Error).message || 'No se pudo consultar GitHub.');
    } finally {
      setLoadingGithub(false);
    }
  }

  async function handleCheckRender() {
    setCheckingRender(true);
    setRenderCheck(null);
    try {
      const res = await api.checkRenderHealth(renderUrl);
      setRenderCheck(res);
    } catch (err) {
      setRenderCheck({
        ok: false,
        status: 0,
        latencyMs: 0,
        target: renderUrl,
        message: (err as Error).message,
      });
    } finally {
      setCheckingRender(false);
    }
  }

  function handleCopyText(key: string, text: string) {
    void navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function handleDownloadFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubTab('qa')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'qa' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pruebas Obligatorias y Concurrencia
          </button>
          <button
            type="button"
            onClick={() => setSubTab('integraciones')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'integraciones' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Conexión Render · GitHub · Supabase
          </button>
          <button
            type="button"
            onClick={() => setSubTab('esquema')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              subTab === 'esquema' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            SQL Supabase, render.yaml y Defensa
          </button>
        </div>
      </div>

      {/* TAB 1: PRUEBAS OBLIGATORIAS */}
      {subTab === 'qa' && (
        <div className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl font-display font-bold text-slate-900">
                Laboratorio de Pruebas Obligatorias y Concurrencia
              </h1>
              <p className="text-sm text-slate-600">
                Ejecuta casos reales aislados sobre la base de datos: cupos máximos, postulación tardía, vacante cerrada, duplicados y carrera concurrente (<code className="font-mono text-xs">Promise.all</code>).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {suiteData && (
                <button
                  type="button"
                  onClick={handleExportQaMarkdown}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar evidencia (.md)
                </button>
              )}

              {role === 'admin' ? (
                <button
                  type="button"
                  disabled={runningSuite}
                  onClick={handleRunSuite}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  {runningSuite ? 'Ejecutando suite...' : 'Ejecutar las 4 pruebas'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Ingresar como Admin para ejecutar
                </button>
              )}
            </div>
          </section>

          {!suiteData ? (
            <section className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-2">
              <FlaskConical className="w-8 h-8 text-slate-400 mx-auto" />
              <h2 className="text-sm font-display font-semibold text-slate-900">
                Suite lista para ejecutarse
              </h2>
              <p className="text-xs text-slate-600 max-w-xl mx-auto">
                Al ejecutar las pruebas, el servidor crea datos temporales aislados, verifica las 4 reglas críticas incluyendo 2 solicitudes concurrentes por el último cupo, documenta entradas y resultados HTTP, y limpia los registros de prueba automáticamente.
              </p>
            </section>
          ) : (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 font-semibold">
                  {suiteData.allPassed ? (
                    <span className="text-emerald-700 inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Todas las pruebas aprobadas ({suiteData.results.length}/{suiteData.results.length})
                    </span>
                  ) : (
                    <span className="text-red-700 inline-flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" />
                      Se detectaron fallos
                    </span>
                  )}
                </div>
                <div className="text-slate-500 font-mono tabular-nums">
                  Motor: {suiteData.engine} · Ejecución: {suiteData.executedAt}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {suiteData.results.map((tc) => (
                  <article key={tc.id} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-xs text-slate-500">{tc.id}</span>
                        <h3 className="text-base font-display font-semibold text-slate-900">
                          {tc.titulo}
                        </h3>
                      </div>
                      <span
                        className={`text-xs font-semibold whitespace-nowrap ${
                          tc.aprobado ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {tc.aprobado ? 'Aprobado' : 'Fallido'} · {tc.duracionMs} ms
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">{tc.objetivo}</p>

                    <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5 text-xs">
                      <div>
                        <span className="font-semibold text-slate-700">Entradas: </span>
                        <code className="font-mono text-slate-800 break-all">{JSON.stringify(tc.entradas)}</code>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">Esperado: </span>
                        <span className="text-slate-700">{tc.resultadoEsperado}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">Obtenido: </span>
                        <span className="text-slate-900 font-medium">{tc.resultadoObtenido}</span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-200 border border-slate-200 rounded">
                      {tc.detalles.map((d, idx) => (
                        <div key={idx} className="px-3 py-2 text-xs flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-900">{d.paso}</span>
                            <span className={`font-mono font-semibold ${d.aceptado ? 'text-emerald-700' : 'text-red-700'}`}>
                              HTTP {d.httpStatus} · {d.codigo}
                            </span>
                          </div>
                          <span className="text-slate-600">{d.motivo}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONEXIÓN RENDER, GITHUB, SUPABASE */}
      {subTab === 'integraciones' && (
        <div className="space-y-5">
          {/* Supabase / PostgreSQL Card */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-display font-semibold text-slate-900">
                    Supabase / PostgreSQL
                  </h2>
                  <p className="text-xs text-slate-600">{status?.databaseLabel || 'Verificando motor...'}</p>
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
                Motor: {status?.databaseEngine || 'local'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200 rounded p-3.5">
              <div>
                <div className="font-semibold text-slate-800">Variables de servidor en Render / AI Studio Secrets</div>
                <p className="text-slate-600 mt-1">
                  Defina <code className="font-mono">DATABASE_URL</code> (o <code className="font-mono">SUPABASE_URL</code> + <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>) en las variables de entorno del servidor. Nunca exponga claves privadas en el navegador.
                </p>
              </div>
              <div className="space-y-1 font-mono text-slate-700">
                <div>POSTGRES_URL: {status?.postgresConfigured ? 'Configurado' : 'No configurado (usando respaldo local)'}</div>
                <div>SUPABASE_REST: {status?.supabaseConfigured ? 'Configurado' : 'No configurado'}</div>
              </div>
            </div>
          </section>

          {/* GitHub & Render Config Form */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h2 className="text-base font-display font-semibold text-slate-900">
              Vincular Repositorio GitHub y Servicio Render
            </h2>

            <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Repositorio GitHub (usuario/repositorio)
                </label>
                <input
                  type="text"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="ejemplo: usuario/vacantes-asuncion"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  URL pública en Render (https://*.onrender.com)
                </label>
                <input
                  type="url"
                  value={renderUrl}
                  onChange={(e) => setRenderUrl(e.target.value)}
                  placeholder="https://vacantes-escalada.onrender.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                {role === 'admin' ? (
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 cursor-pointer"
                  >
                    {savingConfig ? 'Guardando...' : 'Guardar enlaces de proyecto'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md cursor-pointer"
                  >
                    Inicie sesión Admin para guardar enlaces
                  </button>
                )}

                <button
                  type="button"
                  disabled={!githubRepo || loadingGithub}
                  onClick={handleFetchGithub}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  {loadingGithub ? 'Consultando GitHub...' : 'Verificar repositorio GitHub'}
                </button>

                {role === 'admin' && (
                  <button
                    type="button"
                    disabled={!renderUrl || checkingRender}
                    onClick={handleCheckRender}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {checkingRender ? 'Comprobando Render...' : 'Probar /api/health en Render'}
                  </button>
                )}
              </div>
            </form>

            {/* GitHub Live Output */}
            {githubError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3">
                {githubError}
              </div>
            )}

            {githubInfo && (
              <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <a
                      href={githubInfo.repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-display font-semibold text-blue-700 hover:underline inline-flex items-center gap-1"
                    >
                      {githubInfo.repo.full_name}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <p className="text-xs text-slate-600">{githubInfo.repo.description || 'Sin descripción'}</p>
                  </div>
                  <div className="text-xs font-mono text-slate-600">
                    Rama: {githubInfo.repo.default_branch} · {githubInfo.repo.language || 'TypeScript'}
                  </div>
                </div>

                {githubInfo.commits.length > 0 && (
                  <div className="divide-y divide-slate-200 border border-slate-200 bg-white rounded">
                    {githubInfo.commits.map((c) => (
                      <div key={c.sha} className="px-3 py-2 text-xs flex items-center justify-between gap-3">
                        <div className="min-w-0 truncate">
                          <span className="font-mono text-blue-700 mr-2">{c.sha}</span>
                          <span className="text-slate-900">{c.message}</span>
                        </div>
                        <span className="text-slate-500 shrink-0">{c.author}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Render Health Output */}
            {renderCheck && (
              <div
                className={`border rounded-lg p-3.5 text-xs ${
                  renderCheck.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="font-semibold">
                  {renderCheck.ok ? 'Servicio Render en línea' : 'No se pudo verificar Render'} · HTTP {renderCheck.status} · {renderCheck.latencyMs} ms
                </div>
                <div className="font-mono mt-1">{renderCheck.target}</div>
                {renderCheck.message && <div className="mt-1">{renderCheck.message}</div>}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: SQL SUPABASE, RENDER.YAML Y DEFENSA */}
      {subTab === 'esquema' && artifacts && (
        <div className="space-y-5">
          {[
            {
              key: 'schema',
              title: 'Esquema SQL para Supabase (supabase/schema.sql)',
              filename: 'schema.sql',
              content: artifacts.schemaSql,
            },
            {
              key: 'seed',
              title: 'Datos de Prueba para Supabase (supabase/seed.sql)',
              filename: 'seed.sql',
              content: artifacts.seedSql,
            },
            {
              key: 'render',
              title: 'Blueprint de Despliegue Render (render.yaml)',
              filename: 'render.yaml',
              content: artifacts.renderYaml,
            },
            {
              key: 'defensa',
              title: 'Guía de Defensa Oral y Evidencias (docs/DEFENSA_Y_EVIDENCIAS.md)',
              filename: 'DEFENSA_Y_EVIDENCIAS.md',
              content: artifacts.defensaMd,
            },
          ].map((doc) => (
            <section key={doc.key} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-display font-semibold text-slate-900">{doc.title}</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyText(doc.key, doc.content)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedKey === doc.key ? 'Copiado' : 'Copiar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(doc.filename, doc.content)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar
                  </button>
                </div>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-800 bg-slate-50/40 overflow-x-auto max-h-72 leading-relaxed">
                {doc.content}
              </pre>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
