import { useState, type FormEvent } from 'react';
import { Lock, X } from 'lucide-react';
import { api, setAuthToken } from '../api/client';

interface AdminAuthModalProps {
  open: boolean;
  adminClaimed: boolean;
  envPasscodeConfigured: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

export function AdminAuthModal({
  open,
  adminClaimed,
  envPasscodeConfigured,
  onClose,
  onAuthenticated,
}: AdminAuthModalProps) {
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const isClaimFlow = !adminClaimed && !envPasscodeConfigured;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (isClaimFlow) {
      if (passcode.trim().length < 4) {
        setErrorMsg('La clave inicial debe tener al menos 4 caracteres.');
        return;
      }
      if (passcode !== confirmPasscode) {
        setErrorMsg('Las claves ingresadas no coinciden.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = isClaimFlow
        ? await api.claimAdmin(passcode.trim())
        : await api.loginAdmin(passcode.trim());
      setAuthToken(res.token);
      setPasscode('');
      setConfirmPasscode('');
      onAuthenticated();
    } catch (err) {
      setErrorMsg((err as Error).message || 'No se pudo validar el acceso.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-auth-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 id="admin-auth-title" className="text-base font-display font-semibold text-slate-900">
                {isClaimFlow ? 'Configurar clave de Administrador' : 'Acceso Administrador'}
              </h2>
              <p className="text-xs text-slate-600">
                {isClaimFlow
                  ? 'Primer uso: defina la clave para operar altas, selecciones y pruebas.'
                  : 'Ingrese la clave para habilitar operaciones administrativas.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar diálogo"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-passcode" className="block text-xs font-medium text-slate-700 mb-1">
              {isClaimFlow ? 'Nueva clave de administrador' : 'Clave de administrador'}
            </label>
            <input
              id="admin-passcode"
              type="password"
              required
              autoFocus
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Mínimo 4 caracteres"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          {isClaimFlow && (
            <div>
              <label htmlFor="admin-passcode-confirm" className="block text-xs font-medium text-slate-700 mb-1">
                Confirmar clave
              </label>
              <input
                id="admin-passcode-confirm"
                type="password"
                required
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                placeholder="Repita la clave"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              Seguir como Consulta
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Verificando...' : isClaimFlow ? 'Guardar e ingresar' : 'Ingresar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
