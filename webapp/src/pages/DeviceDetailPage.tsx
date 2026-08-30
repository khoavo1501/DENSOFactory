import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { devicesApi, eventsApi } from "@/api/endpoints";
import { ReconnectingWs } from "@/api/ws";
import { StateDot, SourceBadge } from "@/components/Indicators";
import { Tabs, type TabItem } from "@/components/Tabs";
import { TimeSeriesChart } from "@/components/TimeSeriesChart";
import { Gauge } from "@/components/Gauge";
import { TimeRangePicker } from "@/components/TimeRangePicker";
import { SeverityChip } from "@/components/Indicators";
import { resolveRange } from "@/utils/timeRange";
import type {
  WsMessage,
  StatusPayload,
  DeviceState,
  EventItem,
  DiagRow,
} from "@/types";

type RegisterValue = number | boolean;
interface LiveRegister {
  value: RegisterValue;
  ts: number;
  unit?: string;
}

const MAX_REGISTERS = 200;

export function DeviceDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [range, setRange] = useState(() => resolveRange("1h"));
  const [tablet, setTablet] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    const onChange = () => setTablet(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const { data: latest } = useQuery({
    queryKey: ["device-latest", id],
    queryFn: () => devicesApi.latest(id),
    refetchInterval: 30_000,
  });

  const [liveStatus, setLiveStatus] = useState<StatusPayload | null>(null);
  const [liveRegisters, setLiveRegisters] = useState<
    Record<string, LiveRegister>
  >({});
  const [selectedRegister, setSelectedRegister] = useState<string | null>(null);

  useEffect(() => {
    const ws = new ReconnectingWs(id);
    const off = ws.onMessage((raw) => {
      const m = raw as WsMessage;
      if (m.device_id !== id) return;
      if (m.type === "status") {
        setLiveStatus({
          state: m.state as DeviceState,
          uptime_s: m.uptime_s as number | undefined,
          reason: m.reason as string | undefined,
          ts: m.ts as number,
        });
      } else if (m.type === "telemetry") {
        const regs = m.registers as
          | Record<string, { value?: unknown; unit?: string }>
          | undefined;
        if (regs) {
          setLiveRegisters((prev) => {
            const next = { ...prev };
            for (const [reg, v] of Object.entries(regs)) {
              if (v && "value" in v) {
                next[reg] = {
                  value: v.value as RegisterValue,
                  unit: v.unit as string | undefined,
                  ts: m.ts as number,
                };
              }
            }
            return next;
          });
        }
      }
    });
    ws.start();
    return () => {
      off();
      ws.stop();
    };
  }, [id]);

  // Auto-select first numeric register
  useEffect(() => {
    if (selectedRegister) return;
    const first = Object.entries(liveRegisters).find(
      ([, v]) => typeof v.value === "number"
    );
    if (first) setSelectedRegister(first[0]);
  }, [liveRegisters, selectedRegister]);

  const liveSnapshot = latest as { source?: string } | undefined;
  const source = (liveSnapshot?.source as "simulated" | "real" | undefined) ?? "real";
  const state = liveStatus?.state ?? null;
  const registerEntries = Object.entries(liveRegisters).slice(0, MAX_REGISTERS);

  // Telemetry tab
  const telemetryTab: TabItem = {
    id: "telemetry",
    label: "Telemetry",
    content: (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <TimeRangePicker
            from={range.from}
            to={range.to}
            onChange={(r) => setRange({ from: r.from, to: r.to })}
          />
        </div>
        <div className="telemetry-grid">
          <div className="register-list">
            {registerEntries.length === 0 && (
              <div className="empty">No live registers.</div>
            )}
            {registerEntries.map(([reg, v]) => (
              <div
                key={reg}
                className={`register-item ${
                  selectedRegister === reg ? "active" : ""
                }`}
                onClick={() => setSelectedRegister(reg)}
              >
                <span>{reg}</span>
                <span
                  className={`value ${
                    typeof v.value === "boolean" ? "bool" : ""
                  }`}
                >
                  {typeof v.value === "boolean"
                    ? v.value
                      ? "true"
                      : "false"
                    : typeof v.value === "number"
                    ? v.value.toFixed(2)
                    : String(v.value)}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selectedRegister ? (
              <>
                <Gauge
                  value={
                    typeof liveRegisters[selectedRegister]?.value === "number"
                      ? (liveRegisters[selectedRegister].value as number)
                      : 0
                  }
                  unit={liveRegisters[selectedRegister]?.unit ?? ""}
                  name={selectedRegister}
                  height={tablet ? 160 : 200}
                  tablet={tablet}
                />
                <HistoryChart
                  deviceId={id}
                  register={selectedRegister}
                  from={range.from}
                  to={range.to}
                  unit={liveRegisters[selectedRegister]?.unit}
                  tablet={tablet}
                />
              </>
            ) : (
              <div className="empty">Select a register from the list.</div>
            )}
          </div>
        </div>
      </div>
    ),
  };

  // Status tab
  const statusTab: TabItem = {
    id: "status",
    label: "Status",
    content: (
      <div className="card">
        <div className="kv">
          <div className="k">state</div>
          <div className="v">
            <StateDot state={state} /> {state ?? "—"}
          </div>
          <div className="k">uptime_s</div>
          <div className="v">{liveStatus?.uptime_s ?? "—"}</div>
          <div className="k">reason</div>
          <div className="v">{liveStatus?.reason ?? "—"}</div>
          <div className="k">last update</div>
          <div className="v">
            {liveStatus
              ? new Date(liveStatus.ts * 1000).toLocaleString()
              : "—"}
          </div>
        </div>
      </div>
    ),
  };

  // Events tab
  const eventsTab: TabItem = {
    id: "events",
    label: "Events",
    content: <DeviceEventsTab deviceId={id} />,
  };

  // Diag tab
  const diagTab: TabItem = {
    id: "diag",
    label: "Diag",
    content: <DeviceDiagTab deviceId={id} />,
  };

  // Info tab (M4: master metadata từ info payload)
  const infoTab: TabItem = {
    id: "info",
    label: "Info",
    content: <DeviceInfoTab deviceId={id} />,
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Link to="/" className="btn btn-ghost">
          ← Back
        </Link>
        <h1 className="mono" style={{ margin: 0, fontSize: 16 }}>
          {id}
        </h1>
        <SourceBadge source={source} />
        <StateDot state={state} />
        <span className="muted">
          {state ?? "—"}
          {liveStatus?.uptime_s != null && ` · uptime ${liveStatus.uptime_s}s`}
        </span>
      </div>

      <Tabs tabs={[telemetryTab, statusTab, eventsTab, diagTab, infoTab]} />
    </div>
  );
}

function HistoryChart({
  deviceId,
  register,
  from,
  to,
  unit,
  tablet,
}: {
  deviceId: string;
  register: string;
  from: number;
  to: number;
  unit?: string;
  tablet: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["telemetry-history", deviceId, register, from, to],
    queryFn: () => devicesApi.history(deviceId, register, from, to, "1m") as Promise<
      Array<Record<string, string>>
    >,
    refetchInterval: 60_000,
  });

  const points = (data ?? [])
    .map((row) => {
      const ts = parseTime(row._time);
      const val = parseFloat(row._value);
      if (ts == null || isNaN(val)) return null;
      return { ts, value: val };
    })
    .filter((p): p is { ts: number; value: number } => p !== null);

  return (
    <div className={`chart-wrap${tablet ? " tablet" : ""}`}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <span className="card-subtitle">{register}</span>
        <span className="muted" style={{ fontSize: 11 }}>
          {points.length} points
        </span>
      </div>
      {isLoading && points.length === 0 ? (
        <div className="chart-empty">Loading...</div>
      ) : (
        <TimeSeriesChart
          data={points}
          unit={unit ?? ""}
          height={tablet ? 180 : 220}
          title={register}
        />
      )}
    </div>
  );
}

function DeviceEventsTab({ deviceId }: { deviceId: string }) {
  const { data, isLoading } = useQuery<EventItem[]>({
    queryKey: ["device-events", deviceId],
    queryFn: () => {
      const now = Math.floor(Date.now() / 1000);
      return eventsApi.list({
        device_id: deviceId,
        from: now - 24 * 3600,
        to: now,
        page_size: 100,
      }) as Promise<EventItem[]>;
    },
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className="empty">Loading...</div>;
  if (!data?.length) return <div className="empty">No events in last 24h.</div>;

  return (
    <div className="card" style={{ padding: 0 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th style={th}>Time</th>
            <th style={th}>Severity</th>
            <th style={th}>Code</th>
            <th style={th}>Message</th>
          </tr>
        </thead>
        <tbody>
          {data.map((e, i) => (
            <tr
              key={`${e.ts}-${e.code}-${i}`}
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <td style={td} className="mono">
                {new Date(e.ts * 1000).toLocaleString()}
              </td>
              <td style={td}>
                <SeverityChip severity={e.severity} />
              </td>
              <td style={td} className="mono">
                {e.code}
              </td>
              <td style={td}>{e.message ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeviceDiagTab({ deviceId }: { deviceId: string }) {
  const { data, isLoading } = useQuery<DiagRow | null>({
    queryKey: ["device-diag-latest", deviceId],
    queryFn: () => devicesApi.diagLatest(deviceId) as Promise<DiagRow | null>,
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="empty">Loading...</div>;
  if (!data) return <div className="empty">No diag data yet.</div>;

  return (
    <div className="card">
      <div className="kv">
        <div className="k">last diag</div>
        <div className="v">
          {new Date(data.ts * 1000).toLocaleString()}
        </div>
        <div className="k">poll_cycle_ms</div>
        <div className="v">{data.poll_cycle_ms ?? "—"}</div>
        <div className="k">uptime_s</div>
        <div className="v">{data.uptime_s ?? "—"}</div>
        <div className="k">tx_packets</div>
        <div className="v">{data.tx_packets ?? "—"}</div>
        <div className="k">tx_failures</div>
        <div className="v">{data.tx_failures ?? "—"}</div>
        <div className="k">mqtt_reconnect</div>
        <div className="v">{data.mqtt_reconnect ?? "—"}</div>
        <div className="k">avg_latency_ms</div>
        <div className="v">{data.avg_latency_ms?.toFixed(2) ?? "—"}</div>
      </div>
    </div>
  );
}

function DeviceInfoTab({ deviceId: _deviceId }: { deviceId: string }) {
  // M4: info is broadcast by MQTT consumer but not stored in DB (per spec mục 7.2).
  // Surface hint that this tab is wired to live info publish, not historical.
  return (
    <div className="card">
      <p className="muted" style={{ marginTop: 0 }}>
        Master identity &amp; capability metadata. Published once at connect
        (QoS 1, retain true). Live only — not stored historically.
      </p>
      <div className="empty">Waiting for info publish from master.</div>
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

function parseFloat(s: string | undefined): number {
  if (!s) return NaN;
  return Number(s);
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "var(--text-muted)",
};

const td: React.CSSProperties = {
  padding: "6px 8px",
  verticalAlign: "middle",
};
