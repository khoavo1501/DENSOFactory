import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { devicesApi, eventsApi } from "@/api/endpoints";
import { SeverityChip } from "@/components/Indicators";
import { TimeRangePicker } from "@/components/TimeRangePicker";
import { resolveRange } from "@/utils/timeRange";
import type { EventItem, Severity, EventCode, Device } from "@/types";

const SEVERITY_FILTERS: Array<"all" | Severity> = [
  "all",
  "critical",
  "warning",
  "info",
];

// Top event codes for quick filter (rest available via API code param).
const COMMON_CODES: EventCode[] = [
  "SLAVE_COMM_LOST",
  "SLAVE_COMM_RESTORED",
  "VALUE_OUT_OF_RANGE",
  "SENSOR_FAULT",
  "EMERGENCY_STOP",
  "MASTER_REBOOT",
  "BUFFER_OVERFLOW",
  "WATCHDOG_RESET",
  "POWER_ON",
  "W5500_LINK_DOWN",
  "W5500_LINK_UP",
  "MQTT_DISCONNECTED",
  "MQTT_RECONNECTED",
];

export function EventsPage() {
  const [severity, setSeverity] = useState<"all" | Severity>("all");
  const [codes, setCodes] = useState<Set<EventCode>>(new Set());
  const [deviceId, setDeviceId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [range, setRange] = useState(() => resolveRange("24h"));
  const pageSize = 50;

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["devices-list"],
    queryFn: () => devicesApi.list() as Promise<Device[]>,
    refetchInterval: 30_000,
  });

  const codeParam = codes.size > 0 ? Array.from(codes).join(",") : undefined;
  const severityParam = severity === "all" ? undefined : severity;
  const deviceParam = deviceId || undefined;

  const { data, isLoading } = useQuery<EventItem[]>({
    queryKey: ["events", severityParam, codeParam, deviceParam, range, page],
    queryFn: () =>
      eventsApi.list({
        severity: severityParam,
        code: codeParam,
        device_id: deviceParam,
        from: range.from,
        to: range.to,
        page,
        page_size: pageSize,
      }) as Promise<EventItem[]>,
    refetchInterval: 15_000,
  });

  const toggleCode = (c: EventCode) => {
    setCodes((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
    setPage(1);
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
        <h1 style={{ margin: 0, fontSize: 16 }}>Events</h1>
        <span className="muted" style={{ fontSize: 12 }}>
          {data?.length ?? 0} on this page
        </span>
        <div style={{ marginLeft: "auto" }}>
          <TimeRangePicker
            from={range.from}
            to={range.to}
            onChange={(r) => {
              setRange({ from: r.from, to: r.to });
              setPage(1);
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="card-subtitle" style={{ marginBottom: 4 }}>
            Severity
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {SEVERITY_FILTERS.map((s) => (
              <button
                key={s}
                className={"btn" + (severity === s ? " btn-primary" : "")}
                onClick={() => {
                  setSeverity(s);
                  setPage(1);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="card-subtitle" style={{ marginBottom: 4 }}>
            Device
          </div>
          <select
            value={deviceId}
            onChange={(e) => {
              setDeviceId(e.target.value);
              setPage(1);
            }}
            style={{ minWidth: 200 }}
          >
            <option value="">All devices</option>
            {devices?.map((d) => (
              <option key={d.device_id} value={d.device_id}>
                {d.device_id}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 320 }}>
          <div className="card-subtitle" style={{ marginBottom: 4 }}>
            Codes ({codes.size} selected)
          </div>
          <div
            style={{
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
              maxHeight: 80,
              overflow: "auto",
            }}
          >
            {COMMON_CODES.map((c) => (
              <button
                key={c}
                className={"btn" + (codes.has(c) ? " btn-primary" : "")}
                onClick={() => toggleCode(c)}
                style={{ fontSize: 11, padding: "2px 6px", height: 24 }}
              >
                {c}
              </button>
            ))}
            {codes.size > 0 && (
              <button
                className="btn btn-ghost"
                onClick={() => setCodes(new Set())}
                style={{ fontSize: 11, height: 24 }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={th}>Time</th>
              <th style={th}>Severity</th>
              <th style={th}>Code</th>
              <th style={th}>Device</th>
              <th style={th}>Message</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} style={{ padding: 16, textAlign: "center" }}>
                  Loading...
                </td>
              </tr>
            )}
            {data?.length === 0 && !isLoading && (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: 16, textAlign: "center" }}
                  className="muted"
                >
                  No events.
                </td>
              </tr>
            )}
            {(data ?? []).map((e, i) => (
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
                <td style={td} className="mono">
                  {e.device_id}
                </td>
                <td style={td}>{e.message ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          className="btn"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Prev
        </button>
        <span className="muted" style={{ alignSelf: "center" }}>
          Page {page}
        </span>
        <button
          className="btn"
          onClick={() => setPage((p) => p + 1)}
          disabled={(data?.length ?? 0) < pageSize}
        >
          Next
        </button>
      </div>
    </div>
  );
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
