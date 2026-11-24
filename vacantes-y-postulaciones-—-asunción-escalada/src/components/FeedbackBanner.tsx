import { CheckCircle2, X, AlertTriangle } from 'lucide-react';
import type { OperationFeedback } from '../types';

interface FeedbackBannerProps {
  feedback: OperationFeedback | null;
  onDismiss: () => void;
}

export function FeedbackBanner({ feedback, onDismiss }: FeedbackBannerProps) {
  if (!feedback) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg border px-4 py-3 flex items-start justify-between gap-4 ${
        feedback.ok
          ? 'bg-emerald-50/70 border-emerald-200 text-slate-900'
          : 'bg-red-50/70 border-red-200 text-slate-900'
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {feedback.ok ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold">
            <span className={feedback.ok ? 'text-emerald-800' : 'text-red-800'}>
              {feedback.ok ? 'Operación aceptada' : 'Operación rechazada'}
            </span>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span className="text-slate-700">{feedback.rule}</span>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span className="font-mono text-xs text-slate-600">{feedback.code}</span>
          </div>
          <p className="text-sm text-slate-800 mt-0.5">{feedback.message}</p>
          {feedback.reason && feedback.reason !== feedback.message && (
            <p className="text-xs text-slate-600 mt-0.5">Motivo: {feedback.reason}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-white/70 transition-colors shrink-0 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
