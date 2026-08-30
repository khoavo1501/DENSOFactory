import clsx from "clsx";
import type { Source, DeviceState } from "@/types";

export function StateDot({ state }: { state: DeviceState | null | undefined }) {
  return <span className={clsx("dot", state ?? "offline")} title={state ?? "unknown"} />;
}

export function SourceBadge({ source }: { source: Source }) {
  return (
    <span className={clsx("badge", source)} title={`Source: ${source}`}>
      {source === "simulated" ? "SIM" : "REAL"}
    </span>
  );
}

export function SeverityChip({
  severity,
  className,
}: {
  severity: "info" | "warning" | "critical";
  className?: string;
}) {
  return (
    <span className={clsx("badge", `sev-${severity}`, className)}>
      {severity}
    </span>
  );
}
