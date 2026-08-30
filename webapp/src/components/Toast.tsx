import { useEffect, useRef } from "react";
import clsx from "clsx";
import { useToasts, type ToastItem } from "@/store/toasts";
import { SeverityChip } from "./Indicators";

const AUTO_DISMISS_MS = 8000;

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const remove = useToasts((s) => s.remove);
  const isCritical = toast.severity === "critical";
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isCritical) return; // critical: manual dismiss only
    timerRef.current = window.setTimeout(() => remove(toast.id), AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [isCritical, remove, toast.id]);

  return (
    <div
      className={clsx("toast", `sev-${toast.severity}`)}
      role={isCritical ? "alert" : "status"}
      aria-live={isCritical ? "assertive" : "polite"}
    >
      <div className="toast-header">
        <SeverityChip severity={toast.severity} />
        <span className="toast-title mono">{toast.code}</span>
        <button
          className="toast-close"
          onClick={() => remove(toast.id)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      {toast.message && <div className="toast-message">{toast.message}</div>}
      <div className="toast-meta muted">
        <span>{toast.device_id}</span>
        <span>·</span>
        <span>{relativeTime(toast.ts)}</span>
        {toast.count > 1 && (
          <>
            <span>·</span>
            <span className="toast-count">×{toast.count}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function ToastStack() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="toast-stack" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}
