import { useEffect } from "react";
import { useToasts } from "@/store/toasts";
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  X,
} from "lucide-react";
import type { Severity } from "@/types";

const ICONS: Record<Severity, typeof CircleAlert> = {
  critical: CircleAlert,
  warning: CircleAlert,
  info: CircleCheck,
};

const AUTO_DISMISS_MS: Record<Severity, number | null> = {
  info: 8000,
  warning: 8000,
  critical: null,
};

export function ToastContainer() {
  const toasts = useToasts((s) => s.toasts);
  const remove = useToasts((s) => s.remove);

  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ReturnType<typeof useToasts.getState>["toasts"][number];
  onDismiss: () => void;
}) {
  const Icon = ICONS[toast.severity] ?? CircleDashed;
  const autoMs = AUTO_DISMISS_MS[toast.severity];

  useEffect(() => {
    if (autoMs == null) return;
    const t = setTimeout(onDismiss, autoMs);
    return () => clearTimeout(t);
  }, [autoMs, onDismiss, toast.ts, toast.count]);

  const time = new Date(toast.ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      className={`toast severity-${toast.severity}`}
      role={toast.severity === "critical" ? "alert" : "status"}
    >
      <span className="toast-icon" aria-hidden>
        <Icon size={14} />
      </span>
      <div className="toast-body">
        <div className="toast-title">
          <span className="mono" style={{ textTransform: "uppercase" }}>
            {toast.code.toLowerCase().replace(/_/g, " ")}
          </span>
          {toast.count > 1 && (
            <span className="toast-count">×{toast.count}</span>
          )}
        </div>
        {toast.message && <div className="toast-message">{toast.message}</div>}
        <div className="toast-meta">
          {toast.device_id} · {time}
        </div>
      </div>
      <button
        className="toast-close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}