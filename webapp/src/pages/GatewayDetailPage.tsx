import { useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Network,
  RefreshCw,
  Cpu,
  ChevronRight,
  CircleAlert,
  ArrowUpRight,
  Clock,
  Hash,
  Wifi,
} from "lucide-react";
import { gatewaysApi, plcsApi, warningsApi } from "@/api/endpoints";
import { Breadcrumb, PageHeader } from "@/components/Breadcrumb";
import { StatusBadge, StatusDot } from "@/components/Indicators";
import type { Gateway, PLC, Warning } from "@/types";

function GatewayIcon({
  status,
  warning,
}: {
  status: "online" | "offline" | "warning";
  warning?: boolean;
}) {
  const cls: "online" | "offline" | "warning" = warning
    ? "warning"
    : status;
  return (
    <div className={`gateway-detail-icon ${cls}`}>
      <Network aria-hidden size={22} />
    </div>
  );
}

export function GatewayDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const gatewaysQ = useQuery({
    queryKey: ["gateways"],
    queryFn: () => gatewaysApi.list(),
  });
  const plcsQ = useQuery({
    queryKey: ["plcs"],
    queryFn: () => plcsApi.list(),
    refetchInterval: 10_000,
  });
  const warningsQ = useQuery({
    queryKey: ["warnings"],
    queryFn: () => warningsApi.list(),
    refetchInterval: 15_000,
  });

  const gateways: Gateway[] = gatewaysQ.data ?? [];
  const plcs: PLC[] = plcsQ.data ?? [];
  const warnings: Warning[] = (warningsQ.data ?? []).filter(
    (w) => !w.cleared,
  );

  const gateway = gateways.find((g) => g.gateway_id === id);
  const gatewayPlcs = useMemo(
    () => plcs.filter((p) => p.gateway_id === id),
    [plcs, id],
  );
  const gatewayWarnings = useMemo(
    () =>
      warnings.filter(
        (w) =>
          w.target_id === id ||
          gatewayPlcs.some((p) => p.plc_id === w.target_id),
      ),
    [warnings, id, gatewayPlcs],
  );

  const isLoading = gatewaysQ.isLoading || plcsQ.isLoading;

  if (!isLoading && !gateway) {
    return (
      <div className="page">
        <Breadcrumb
          items={[{ label: "Dashboard", to: "/" }, { label: "Gateway not found" }]}
        />
        <div className="empty-state">
          <div className="empty-icon" aria-hidden>
            <Network size={22} />
          </div>
          <h3>Gateway not found</h3>
          <p>
            No gateway with id <code className="mono">{id}</code>.
          </p>
          <div className="empty-actions">
            <button className="btn btn-sm" onClick={() => navigate("/")}>
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const onlineCount = gatewayPlcs.filter((p) => p.status === "online").length;
  const offlineCount = gatewayPlcs.length - onlineCount;
  const hasWarning = gatewayWarnings.length > 0;
  const criticalCount = gatewayWarnings.filter(
    (w) => w.severity === "critical",
  ).length;

  const headerState: "online" | "warning" | "offline" =
    gateway?.status === "offline"
      ? "offline"
      : hasWarning
        ? "warning"
        : "online";

  return (
    <div className="page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/" },
          { label: gateway?.name ?? id },
        ]}
      />

      <PageHeader
        title={gateway?.name ?? id}
        subtitle={
          gateway
            ? `${onlineCount} of ${gatewayPlcs.length} PLCs online`
            : "loading…"
        }
        actions={
          <button
            className="btn btn-sm"
            onClick={() => {
              gatewaysQ.refetch();
              plcsQ.refetch();
              warningsQ.refetch();
            }}
          >
            <RefreshCw size={12} aria-hidden /> Refresh
          </button>
        }
      />

      {/* Status header */}
      {gateway && (
        <div className="gateway-detail-header">
          <GatewayIcon status={gateway.status} warning={hasWarning} />
          <div>
            <h2 className="gateway-detail-name">{gateway.name}</h2>
            <div className="gateway-detail-meta">
              <span>
                <Hash size={11} aria-hidden className="meta-key" />
                <span className="meta-key">gateway</span>
                {gateway.gateway_id}
              </span>
              {gateway.fw_version && (
                <span>
                  <span className="meta-key">fw</span>
                  {gateway.fw_version}
                </span>
              )}
              {gateway.ip && (
                <span>
                  <Wifi size={11} aria-hidden className="meta-key" />
                  {gateway.ip}
                </span>
              )}
              {gateway.location && (
                <span>
                  <span className="meta-key">loc</span>
                  {gateway.location}
                </span>
              )}
              {gateway.last_seen_ts && (
                <span>
                  <Clock size={11} aria-hidden className="meta-key" />
                  {new Date(gateway.last_seen_ts * 1000).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <StatusBadge state={headerState} />
        </div>
      )}

      {/* KPI strip */}
      {gateway && (
          <div className="kpi-strip">
            <div
              className={`kpi-tile ${
                gateway.status === "offline"
                  ? "offline"
                  : gateway.status === "online"
                    ? "online"
                    : ""
              }`}
            >
              <span className="kpi-label">Gateway</span>
              <span className="kpi-value">{gateway.status}</span>
            </div>
            <div
              className={`kpi-tile ${
                offlineCount === 0
                  ? "online"
                  : offlineCount === gatewayPlcs.length
                    ? "offline"
                    : "warning"
              }`}
            >
              <span className="kpi-label">PLCs online</span>
              <span className="kpi-value">
                {onlineCount}
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "var(--text-md)",
                    marginLeft: 4,
                  }}
                >
                  / {gatewayPlcs.length}
                </span>
              </span>
            </div>
            <div
              className={`kpi-tile ${
                criticalCount > 0
                  ? "offline"
                  : hasWarning
                    ? "warning"
                    : "online"
              }`}
            >
              <span className="kpi-label">Active warnings</span>
              <span className="kpi-value">{gatewayWarnings.length}</span>
            </div>
            <div className="kpi-tile accent">
              <span className="kpi-label">Last sync</span>
              <span
                className="kpi-value"
                style={{ fontSize: "var(--text-lg)" }}
              >
                {gateway.last_seen_ts
                  ? new Date(gateway.last_seen_ts * 1000).toLocaleTimeString()
                  : "never"}
              </span>
            </div>
          </div>
        )}

      {/* PLC table */}
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>PLC</th>
              <th>Status</th>
              <th>Mode</th>
              <th className="col-numeric">Temp</th>
              <th className="col-numeric">RPM</th>
              <th className="col-numeric">Amps</th>
              <th className="col-numeric">Heartbeat</th>
              <th>Last seen</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr className="table-empty">
                <td colSpan={9}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <span className="skeleton" style={{ width: 14, height: 14 }}>
                      &nbsp;
                    </span>
                    loading PLCs…
                  </div>
                </td>
              </tr>
            )}
            {!isLoading && gatewayPlcs.length === 0 && (
              <tr className="table-empty">
                <td colSpan={9}>
                  <div className="empty-large" style={{ padding: 16 }}>
                    <span className="empty-icon" aria-hidden>
                      <Cpu size={16} />
                    </span>
                    <h3>No PLCs assigned</h3>
                    <p>
                      Pair a PLC in Settings or wait for one to publish on this
                      gateway.
                    </p>
                  </div>
                </td>
              </tr>
            )}
            {gatewayPlcs.map((plc) => (
              <tr
                key={plc.plc_id}
                data-clickable="true"
                onClick={() =>
                  navigate(
                    `/gateways/${encodeURIComponent(id)}/plc/${encodeURIComponent(plc.plc_id)}`,
                  )
                }
              >
                <td>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Cpu
                      size={14}
                      aria-hidden
                      style={{ color: "var(--text-muted)" }}
                    />
                    <span className="mono" style={{ fontWeight: 500 }}>
                      {plc.plc_id}
                    </span>
                  </div>
                </td>
                <td>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <StatusDot state={plc.status} />
                    <span style={{ fontSize: 12 }}>{plc.status}</span>
                  </span>
                </td>
                <td>
                  {plc.operating_status === "running" ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        color: "var(--state-online)",
                        fontSize: 12,
                      }}
                    >
                      <span className="dot online" aria-hidden />
                      running
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        color: "var(--text-muted)",
                        fontSize: 12,
                      }}
                    >
                      <span
                        className="dot"
                        aria-hidden
                        style={{
                          background: "var(--text-muted)",
                        }}
                      />
                      stopped
                    </span>
                  )}
                </td>
                <td className="col-numeric">
                  {plc.latest_snapshot?.temperature != null
                    ? `${plc.latest_snapshot.temperature.toFixed(1)}°C`
                    : "—"}
                </td>
                <td className="col-numeric">
                  {plc.latest_snapshot?.rpm != null
                    ? Math.round(plc.latest_snapshot.rpm)
                    : "—"}
                </td>
                <td className="col-numeric">
                  {plc.latest_snapshot?.current_amp != null
                    ? `${plc.latest_snapshot.current_amp.toFixed(2)}A`
                    : "—"}
                </td>
                <td className="col-numeric">
                  {plc.latest_snapshot?.heartbeat != null
                    ? `#${plc.latest_snapshot.heartbeat}`
                    : "—"}
                </td>
                <td
                  className="mono"
                  style={{ color: "var(--text-muted)", fontSize: 12 }}
                >
                  {plc.last_seen_ts
                    ? new Date(plc.last_seen_ts * 1000).toLocaleTimeString()
                    : "—"}
                </td>
                <td aria-hidden style={{ width: 24, color: "var(--text-muted)" }}>
                  <ChevronRight size={14} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Active warnings */}
      {gatewayWarnings.length > 0 && (
        <div
          className="card"
          style={{ borderColor: "var(--severity-warning)" }}
        >
          <div className="card-header">
            <CircleAlert
              size={16}
              aria-hidden
              style={{ color: "var(--severity-warning)" }}
            />
            <span className="card-title">
              {gatewayWarnings.length} active warning
              {gatewayWarnings.length === 1 ? "" : "s"}
            </span>
            <span style={{ marginLeft: "auto" }} className="eyebrow">
              {criticalCount > 0 ? `${criticalCount} critical` : "non-critical"}
            </span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {gatewayWarnings.slice(0, 5).map((w) => (
              <li
                key={w.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 13,
                }}
              >
                <span
                  className="mono"
                  style={{
                    color:
                      w.severity === "critical"
                        ? "var(--severity-critical)"
                        : "var(--severity-warning)",
                    fontSize: 11,
                    letterSpacing: "0.04em",
                  }}
                >
                  {w.code.toLowerCase().replace(/_/g, " ")}
                </span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {w.message ?? "—"}
                </span>
                <span
                  className="muted mono"
                  style={{ fontSize: 11 }}
                >
                  {new Date(w.ts * 1000).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 12 }}>
            <Link to="/events" className="btn btn-sm btn-ghost">
              View all events
              <ArrowUpRight size={12} aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}