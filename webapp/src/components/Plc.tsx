import { useState } from "react";
import clsx from "clsx";
import type { Gateway, PLC, PLCSnapshot, Warning, GatewayWithPLCs } from "@/types";

interface GatewayCardProps {
  gateway: Gateway;
  plcs: PLC[];
  onPair?: (plcId: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  warnings: Warning[];
}

export function GatewayCard({
  gateway,
  plcs,
  onPair: _onPair,
  expanded,
  onToggleExpand,
  warnings,
}: GatewayCardProps) {
  const hasCritical = warnings.some(
    (w) => w.target_id === gateway.master_id && w.severity === "critical" && !w.cleared
  );
  const hasWarning = warnings.some(
    (w) => w.target_id === gateway.master_id && w.severity !== "info" && !w.cleared
  );

  return (
    <div
      className={clsx(
        "gateway-card",
        hasCritical && "gateway-error",
        hasWarning && !hasCritical && "has-warning"
      )}
    >
      <div className={clsx("gateway-icon", gateway.status)}>
        <span>{gateway.status === "online" ? "▣" : "▢"}</span>
      </div>
      <div>
        <div className="gateway-name">{gateway.name}</div>
        <div className="gateway-meta">
          <span>master_id: {gateway.master_id}</span>
          {gateway.fw_version && <span>fw: {gateway.fw_version}</span>}
          {gateway.ip && <span>ip: {gateway.ip}</span>}
          {gateway.last_seen_ts && (
            <span>
              seen: {new Date(gateway.last_seen_ts * 1000).toLocaleTimeString()}
            </span>
          )}
          {hasCritical && (
            <span style={{ color: "var(--severity-critical)", fontWeight: 600 }}>
              ⚠ CRITICAL
            </span>
          )}
          {hasWarning && !hasCritical && (
            <span style={{ color: "var(--severity-warning)" }}>⚠ warning</span>
          )}
        </div>
      </div>
      <div className="gateway-actions">
        <button
          className="btn btn-ghost"
          onClick={onToggleExpand}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <span
            className="chevron"
            style={{
              display: "inline-block",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 150ms",
            }}
          >
            ▶
          </span>
          {plcs.length} PLC{plcs.length === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

interface PLCCardProps {
  plc: PLC;
  mode: "normal" | "realtime";
  warnings: Warning[];
  onClick?: () => void;
}

export function PLCCard({ plc, mode, warnings, onClick }: PLCCardProps) {
  const activeWarnings = warnings.filter(
    (w) => w.target_id === plc.plc_id && !w.cleared
  );
  const highestSeverity = activeWarnings.reduce<"info" | "warning" | "critical" | null>(
    (acc, w) => {
      if (w.severity === "critical") return "critical";
      if (w.severity === "warning" && acc !== "critical") return "warning";
      if (w.severity === "info" && !acc) return "info";
      return acc;
    },
    null
  );

  const isCritical = highestSeverity === "critical";
  const isWarning = highestSeverity === "warning";
  const isOffline = plc.status === "offline";

  return (
    <div
      className={clsx(
        "plc-card",
        isCritical && "has-warning-critical",
        isWarning && !isCritical && "has-warning-warning",
        isOffline && "offline"
      )}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div
        className={clsx(
          "plc-state-icon",
          plc.operating_status === "running" ? "running" : "stopped"
        )}
      >
        {plc.operating_status === "running" ? "▶" : "■"}
      </div>
      <div className="plc-card-body">
        <div className="plc-name">{plc.plc_id}</div>
        <div className="plc-stats">
          <span className="plc-stat">
            <span className="stat-label">temp</span>
            <span
              className={clsx(
                "stat-value",
                plc.latest_snapshot?.temperature == null && "muted"
              )}
            >
              {plc.latest_snapshot?.temperature != null
                ? `${plc.latest_snapshot.temperature.toFixed(1)}°C`
                : "—"}
            </span>
          </span>
          <span className="plc-stat">
            <span className="stat-label">rpm</span>
            <span
              className={clsx(
                "stat-value",
                plc.latest_snapshot?.rpm == null && "muted"
              )}
            >
              {plc.latest_snapshot?.rpm != null
                ? Math.round(plc.latest_snapshot.rpm)
                : "—"}
            </span>
          </span>
          <span className="plc-stat">
            <span className="stat-label">amp</span>
            <span
              className={clsx(
                "stat-value",
                plc.latest_snapshot?.current_amp == null && "muted"
              )}
            >
              {plc.latest_snapshot?.current_amp != null
                ? `${plc.latest_snapshot.current_amp.toFixed(2)}A`
                : "—"}
            </span>
          </span>
          <span className="plc-stat">
            <span className="stat-label">hb</span>
            <span
              className={clsx(
                "stat-value",
                plc.latest_snapshot?.heartbeat == null && "muted"
              )}
            >
              {plc.latest_snapshot?.heartbeat != null
                ? `#${plc.latest_snapshot.heartbeat}`
                : "—"}
            </span>
          </span>
        </div>
        {activeWarnings.length > 0 && (
          <div className="plc-warnings">
            <div className="plc-warnings-header">
              ⚠ {activeWarnings.length} warning
              {activeWarnings.length === 1 ? "" : "s"}
            </div>
            {activeWarnings.slice(0, 2).map((w) => (
              <div key={w.id} style={{ fontSize: 10, color: "var(--text-muted)" }}>
                <span style={{ fontFamily: "var(--font-mono)" }}>{w.code}</span>{" "}
                {w.message && <span>— {w.message}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="plc-badges">
        <span className={clsx("plc-mode-badge", mode === "realtime" && "realtime")}>
          {mode}
        </span>
      </div>
    </div>
  );
}

interface UnpairedSectionProps {
  plcs: PLC[];
  gateways: Gateway[];
  onPair: (plcId: string, gatewayId: string) => void;
}

export function UnpairedSection({
  plcs,
  gateways,
  onPair,
}: UnpairedSectionProps) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  if (plcs.length === 0) return null;
  return (
    <div className="unpaired-section">
      <div className="unpaired-header">
        <span>⛓</span>
        <span>Unpaired devices ({plcs.length})</span>
      </div>
      {plcs.map((plc) => (
        <div key={plc.plc_id} className="unpaired-item">
          <div className="info">
            <span className="name">{plc.plc_id}</span>
            <span className="last-seen">
              master: {plc.master_id}
              {plc.last_seen_ts &&
                ` · last seen ${new Date(plc.last_seen_ts * 1000).toLocaleTimeString()}`}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <select
              value={selected[plc.plc_id] || gateways[0]?.master_id || ""}
              onChange={(e) =>
                setSelected((prev) => ({
                  ...prev,
                  [plc.plc_id]: e.target.value,
                }))
              }
              style={{ height: 24, fontSize: 11 }}
            >
              {gateways.map((g) => (
                <option key={g.master_id} value={g.master_id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              style={{ height: 24, padding: "0 8px", fontSize: 11 }}
              onClick={() => {
                const gw = selected[plc.plc_id] || gateways[0]?.master_id;
                if (gw) onPair(plc.plc_id, gw);
              }}
            >
              Pair
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
