import { Link } from "react-router-dom";
import { ChevronRight, MapPin, Cpu, Activity } from "lucide-react";
import clsx from "clsx";
import { StatusBadge } from "./Indicators";
import type { Gateway, PLC } from "@/types";

interface GatewayCardProps {
  gateway: Gateway;
  plcs: PLC[];
}

export function GatewayCard({ gateway, plcs }: GatewayCardProps) {
  const total = plcs.length;
  const online = plcs.filter((p) => p.status === "online").length;
  const lastSeen = gateway.last_seen_ts
    ? new Date(gateway.last_seen_ts * 1000).toLocaleTimeString()
    : "never";

  const state =
    gateway.status === "online" && online < total
      ? "warning"
      : gateway.status === "online"
        ? "online"
        : "offline";

  // Mini sparkline: derive a 12-point series from online ratio history approximation.
  // (We don't keep historical ratios in client; use deterministic placeholder for visual)
  const spark = deterministicSpark(gateway.gateway_id, total, online);

  return (
    <Link
      to={`/gateways/${encodeURIComponent(gateway.gateway_id)}`}
      className="gateway-card"
    >
      <div className="gateway-card-header">
        <div style={{ minWidth: 0 }}>
          <div className="gateway-card-name">{gateway.name}</div>
          {gateway.location && (
            <div className="gateway-card-location">
              <MapPin
                size={10}
                aria-hidden
                style={{
                  display: "inline",
                  verticalAlign: "-1px",
                  marginRight: 4,
                }}
              />
              {gateway.location}
            </div>
          )}
        </div>
        <StatusBadge state={state} />
      </div>

      <svg
        className="spark"
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polyline
          className="spark-line"
          points={spark}
          fill="none"
          strokeWidth={1.5}
        />
      </svg>

      <div className="gateway-card-meta">
        <div className="meta-item">
          <span className="meta-label">plc online</span>
          <span
            className={clsx(
              "meta-value",
              online === 0 && total > 0 && "muted",
            )}
          >
            {online}
            <span className="muted"> / {total}</span>
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">firmware</span>
          <span className="meta-value">{gateway.fw_version ?? "—"}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">last sync</span>
          <span className="meta-value mono">{lastSeen}</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          color: "var(--text-muted)",
          marginTop: "auto",
        }}
      >
        <Cpu size={12} aria-hidden />
        <span
          className="mono"
          title={`gateway id: ${gateway.gateway_id}`}
        >
          {gateway.gateway_id}
        </span>
        <span style={{ marginLeft: "auto" }} aria-hidden>
          <ChevronRight size={14} />
        </span>
      </div>
    </Link>
  );
}

function deterministicSpark(seed: string, total: number, online: number): string {
  const n = 24;
  const ratio = total > 0 ? online / total : 0.5;
  const points: string[] = [];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < n; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const r = (h & 0xffff) / 0xffff - 0.5; // -0.5..0.5
    const v = ratio + r * 0.3;
    const x = (i / (n - 1)) * 100;
    const y = 28 - Math.max(0, Math.min(1, v)) * 24;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(" ");
}

export function StatCard({
  label,
  value,
  hint,
  state,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  state?: "online" | "warning" | "offline" | "neutral";
  icon?: typeof Activity;
}) {
  return (
    <div className={clsx("stat-card", state && state !== "neutral" && state)}>
      {Icon && (
        <div className="stat-icon" aria-hidden>
          <Icon size={16} />
        </div>
      )}
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-trend">{hint}</span>}
    </div>
  );
}
