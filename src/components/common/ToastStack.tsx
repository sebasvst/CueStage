import { CheckCircle2, CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: CircleAlert,
} as const;

export function ToastStack() {
  const toasts = useUiStore((state) => state.toasts);
  const dismiss = useUiStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone];
        return (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <Icon size={16} className="toast__icon" />
            <span>{toast.message}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => dismiss(toast.id)}
              aria-label="Descartar aviso"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
