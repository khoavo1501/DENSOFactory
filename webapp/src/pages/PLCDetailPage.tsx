import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Cpu,
  WifiOff,
  RefreshCw,
  Thermometer,
  Gauge,
  Zap,
  ArrowDown,
  ArrowUp,
  Minus as MinusIcon,
} from "lucide-react";
import { gatewaysApi, plcsApi } from "@/api/endpoints";
import { Breadcrumb, PageHeader } from "@/components/Breadcrumb";
import { StatusBadge } from "@/components/Indicators";
import { resolveRange } from "@/utils/timeRange";
import type { Gateway, PLC } from "@/types";

const REGISTERS = [
  {
    key: "temperature",
    label: "Temperature",
    unit: "°C",
    icon: Thermometer,
    color: "var(--severity-warning)",
  },
  {
    key: "rpm",
    label: "RPM",
    unit: "",
    icon: Gauge,
    color: "var(--accent)",
  },
  {
    key: "current_amp",
    label: "Current",
    unit: "A",
    icon: Zap,
    color: "var(--severity-info)",
  },
] as const;

export function PLCDetailPage() {
  const { gatewayId = "", plcId = "" } = useParams<{
    gatewayId: string;
    plcId: string;
  }>();
  const navigate = useNavigate();
  const [range, setRange] = useState(() => resolveRange("1h"));

  const gatewaysQ = useQuery({
    queryKey: ["gateways"],
    queryFn: () => gatewaysApi.list(),
  });
  const plcsQ = useQuery({
    queryKey: ["plcs"],
    queryFn: () => plcsApi.list(),
    refetchInterval: 5_000,
  });

  const gateways: Gateway[] = gatewaysQ.data ?? [];
  const plcs: PLC[] = plcsQ.data ?? [];
  const gateway = gateways.find((g) => g.gateway_id === gatewayId);
  const plc = plcs.find((p) => p.plc_id === plcId);

  const isLoading = gatewaysQ.isLoading || plcsQ.isLoading;

  // Per-register history queries — must be called unconditionally.
  const enabled = !!plc && plc.status === "online";

  const tempQ = useQuery({
    queryKey: ["plc-history", plcId, "temperature", range.from, range.to],
    queryFn: () => fetchHistory(plcId, "temperature", range.from, range.to),
    enabled,
    refetchInterval: 60_000,
  });
  const rpmQ = useQuery({
    queryKey: ["plc-history", plcId, "rpm", range.from, range.to],
    queryFn: () => fetchHistory(plcId, "rpm", range.from, range.to),
    enabled,
    refetchInterval: 60_000,
  });
  const ampQ = useQuery({
    queryKey: ["plc-history", plcId, "current_amp", range.from, range.to],
    queryFn: () => fetchHistory(plcId, "current_amp", range.from, range.to),
    enabled,
    refetchInterval: 60_000,
  });

  const historyQueries = [
    { register: REGISTERS[0], query: tempQ },
    { register: REGISTERS[1], query: rpmQ },
    { register: REGISTERS[2], query: ampQ },
  ];

  // Live value refresh hint
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!isLoading && !plc) {
    return (
      <div className="page">
        <Breadcrumb
          items={[
            { label: "Dashboard", to: "/" },
            { label: gateway?.name ?? gatewayId, to: `/gateways/${encodeURIComponent(gatewayId)}` },
            { label: "PLC not found" },
          ]}
        />
        <div className="empty-state">
          <div className="empty-icon" aria-hidden>
            <Cpu size={22} />
          </div>
          <h3>PLC not found</h3>
          <p>No PLC with id <code className="mono">{plcId}</code> on this gateway.</p>
          <div className="empty-actions">
            <button
              className="btn btn-sm"
              onClick={() =>
                navigate(`/gateways/${encodeURIComponent(gatewayId)}`)
              }
            >
              Back to gateway
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isOffline = plc?.status === "offline";

  return (
    <div className="page">
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/" },
          {
            label: gateway?.name ?? gatewayId,
            to: `/gateways/${encodeURIComponent(gatewayId)}`,
          },
          { label: plc?.plc_id ?? plcId },
        ]}
      />

      <PageHeader
        title={
          <span className="mono">{plc?.plc_id ?? plcId}</span>
        }
        subtitle={
          plc
            ? `${plc.model ?? "PLC"} · ${plc.location ?? "no location"}`
            : "loading…"
        }
        actions={
          <button
            className="btn btn-sm"
            onClick={() => {
              gatewaysQ.refetch();
              plcsQ.refetch();
              historyQueries.forEach((q) => q.query.refetch());
            }}
          >
            <RefreshCw size={12} aria-hidden /> Refresh
          </button>
        }
      />

      {/* Info header */}
      {plc && (
        <div className="plc-detail-header">
          <div className="plc-detail-name">
            <Cpu
              size={18}
              aria-hidden
              style={{ color: "var(--accent)" }}
            />
            <h2 className="mono">{plc.plc_id}</h2>
            <StatusBadge state={plc.status} />
            {plc.operating_status === "running" && (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--state-online)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span className="dot online" aria-hidden /> running
              </span>
            )}
          </div>

          <div className="plc-detail-info">
            <span className="info-label">temperature</span>
            <span className="info-value">
              {plc.latest_snapshot?.temperature != null
                ? `${plc.latest_snapshot.temperature.toFixed(1)}°C`
                : "—"}
            </span>
          </div>
          <div className="plc-detail-info">
            <span className="info-label">rpm</span>
            <span className="info-value">
              {plc.latest_snapshot?.rpm != null
                ? Math.round(plc.latest_snapshot.rpm)
                : "—"}
            </span>
          </div>
          <div className="plc-detail-info">
            <span className="info-label">current</span>
            <span className="info-value">
              {plc.latest_snapshot?.current_amp != null
                ? `${plc.latest_snapshot.current_amp.toFixed(2)}A`
                : "—"}
            </span>
          </div>
        </div>
      )}

      {/* Time range quick selector */}
      <div className="time-range-picker">
        <div className="filter-group" role="tablist" aria-label="Time range">
          {(["15m", "1h", "6h", "24h"] as const).map((r) => {
            const active =
              r === "1h"
                ? range.label === undefined
                : range.label === r;
            return (
              <button
                key={r}
                role="tab"
                aria-selected={active}
                className={`filter-chip${active ? " active" : ""}`}
                onClick={() => setRange(resolveRange(r))}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* Charts or offline state */}
      {isOffline ? (
        <div className="empty-state" style={{ padding: "48px 16px" }}>
          <div className="empty-icon" aria-hidden>
            <WifiOff size={22} />
          </div>
          <h3>PLC offline</h3>
          <p>
            Connection to <code className="mono">{plc?.plc_id ?? plcId}</code>{" "}
            was lost. Last seen{" "}
            {plc?.last_seen_ts
              ? new Date(plc.last_seen_ts * 1000).toLocaleString()
              : "never"}
            . History charts will resume once the device reconnects.
          </p>
          <div className="empty-actions">
            <button className="btn btn-sm" onClick={() => plcsQ.refetch()}>
              <RefreshCw size={12} aria-hidden /> Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="chart-grid stagger">
          {historyQueries.map(({ register, query }) => {
            const Icon = register.icon;
            const points = query.data ?? [];
            const latest = plc?.latest_snapshot?.[
              register.key as "temperature" | "rpm" | "current_amp"
            ];
            const values = points.map((p) => p.value);
            const min = values.length ? Math.min(...values) : null;
            const max = values.length ? Math.max(...values) : null;
            const first = values.length ? values[0] : null;
            const last = values.length ? values[values.length - 1] : null;
            const delta =
              first != null && last != null ? last - first : null;
            return (
              <div key={register.key} className="chart-card">
                <div className="chart-card-header">
                  <div className="chart-card-title">
                    <Icon
                      size={14}
                      aria-hidden
                      style={{ color: register.color }}
                    />
                    {register.label}
                  </div>
                  <span className="chart-card-value">
                    {latest != null
                      ? `${(latest as number).toFixed(2)}${register.unit}`
                      : "—"}
                  </span>
                </div>
                <div className="chart-card-meta">
                  <span>
                    {points.length} pts · {range.label ?? "1h"}
                  </span>
                  {delta != null && Math.abs(delta) > 0.0001 && (
                    <span
                      className={`stat-delta ${delta > 0 ? "up" : "down"}`}
                      style={{ marginLeft: "auto" }}
                    >
                      {delta > 0 ? (
                        <ArrowUp size={10} aria-hidden />
                      ) : (
                        <ArrowDown size={10} aria-hidden />
                      )}
                      {Math.abs(delta).toFixed(2)}
                      {register.unit}
                    </span>
                  )}
                  {delta != null && Math.abs(delta) <= 0.0001 && (
                    <span
                      className="stat-delta flat"
                      style={{ marginLeft: "auto" }}
                    >
                      <MinusIcon size={10} aria-hidden />
                      stable
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    fontSize: 10,
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    marginBottom: 4,
                  }}
                >
                  {min != null && (
                    <span>
                      min{" "}
                      <span style={{ color: "var(--text-secondary)" }}>
                        {min.toFixed(2)}
                        {register.unit}
                      </span>
                    </span>
                  )}
                  {max != null && (
                    <span>
                      max{" "}
                      <span style={{ color: "var(--text-secondary)" }}>
                        {max.toFixed(2)}
                        {register.unit}
                      </span>
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minHeight: 200 }}>
                  {query.isLoading && points.length === 0 ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: 200,
                        color: "var(--text-muted)",
                        fontSize: 12,
                      }}
                    >
                      loading history...
                    </div>
                  ) : points.length === 0 ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: 200,
                        color: "var(--text-muted)",
                        fontSize: 12,
                      }}
                    >
                      No data in this range.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart
                        data={points.map((p) => ({
                          t: p.ts * 1000,
                          v: p.value,
                        }))}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="2 4"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="t"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          tickFormatter={(t) =>
                            new Date(t).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          }
                          tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                          stroke="var(--border)"
                          minTickGap={48}
                        />
                        <YAxis
                          tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                          stroke="var(--border)"
                          width={48}
                          domain={["auto", "auto"]}
                          tickFormatter={(v) =>
                            `${typeof v === "number" ? v.toFixed(1) : v}${
                              register.unit
                            }`
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            background: "var(--bg-overlay)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            fontSize: 12,
                            fontFamily: "var(--font-mono)",
                          }}
                          labelStyle={{ color: "var(--text-muted)" }}
                          labelFormatter={(t) =>
                            new Date(t as number).toLocaleString()
                          }
                          formatter={(v) => [
                            `${(v as number).toFixed(2)}${register.unit}`,
                            register.label,
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke={register.color}
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer meta */}
      {plc && (
        <p className="page-footer">
          gateway <span className="mono">{plc.gateway_id}</span>
          <span className="sep-dot" aria-hidden />
          last seen{" "}
          <span className="mono">
            {plc.last_seen_ts
              ? new Date(plc.last_seen_ts * 1000).toLocaleString()
              : "never"}
          </span>
        </p>
      )}
    </div>
  );
}

function parseTime(s: string | undefined): number | null {
  if (!s) return null;
  try {
    const iso = s.endsWith("Z") ? s : s + "Z";
    return Math.floor(new Date(iso).getTime() / 1000);
  } catch {
    return null;
  }
}

async function fetchHistory(
  plcId: string,
  register: string,
  from: number,
  to: number
): Promise<Array<{ ts: number; value: number }>> {
  const rows = (await plcsApi.history(
    plcId,
    register,
    from,
    to
  )) as Array<Record<string, string>>;
  return rows
    .map((row) => {
      const ts = parseTime(row._time);
      const v = Number(row._value);
      if (ts == null || isNaN(v)) return null;
      return { ts, value: v };
    })
    .filter((p): p is { ts: number; value: number } => p !== null);
}
