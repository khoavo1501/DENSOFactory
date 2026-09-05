import {
  CircleCheck,
  CircleAlert,
  CircleX,
  CircleDashed,
} from "lucide-react";
import clsx from "clsx";
import type { DeviceState } from "@/types";

const ICONS = {
  online: CircleCheck,
  warning: CircleAlert,
  offline: CircleX,
  unknown: CircleDashed,
} as const;

export function StatusBadge({
  state,
  label,
}: {
  state:
    | "online"
    | "warning"
    | "offline"
    | "unknown"
    | "degraded"
    | "error"
    | null
    | undefined;
  label?: string;
}) {
  const cls: "online" | "warning" | "offline" | "unknown" =
    state === "online"
      ? "online"
      : state === "degraded" || state === "warning"
      ? "warning"
      : state === "offline" || state === "error"
      ? "offline"
      : "unknown";
  const text =
    label ??
    (state === "online"
      ? "online"
      : state === "degraded" || state === "warning"
      ? "warning"
      : state === "offline"
      ? "offline"
      : state === "error"
      ? "error"
      : "unknown");
  return (
    <span className={clsx("status-badge", cls)}>
      <span className="badge-dot" aria-hidden />
      {text}
    </span>
  );
}

export function StatusDot({
  state,
}: {
  state: DeviceState | null | undefined;
}) {
  const cls =
    state === "online"
      ? "online"
      : state === "degraded"
      ? "warning"
      : state === "offline" || state === "error"
      ? "offline"
      : "";
  return (
    <span
      className={clsx("dot", cls)}
      title={state ?? "unknown"}
      aria-label={`state: ${state ?? "unknown"}`}
    />
  );
}

export function SourceBadge({
  source,
}: {
  source: "simulated" | "real";
}) {
  return (
    <span className={`source-badge ${source}`}>
      {source === "simulated" ? "sim" : "real"}
    </span>
  );
}

export function SeverityChip({
  severity,
}: {
  severity: "info" | "warning" | "critical";
}) {
  return <span className={`status-badge ${severity}`}>{severity}</span>;
}

export function SeverityBadge({
  severity,
}: {
  severity: "info" | "warning" | "critical";
}) {
  return <span className={`status-badge ${severity}`}>{severity}</span>;
}

export {
  ICONS as STATUS_ICONS,
  CircleCheck,
  CircleAlert,
  CircleX,
  CircleDashed,
};
