import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, RefreshCw, Search, Inbox } from "lucide-react";
import { devicesApi, eventsApi } from "@/api/endpoints";
import { PageHeader } from "@/components/Breadcrumb";
import { TimeRangePicker } from "@/components/TimeRangePicker";
import { SeverityChip } from "@/components/Indicators";
import { resolveRange } from "@/utils/timeRange";
import type { EventItem, Severity, EventCode, Device } from "@/types";

const SEVERITY_FILTERS: Array<"all" | Severity> = [
  "all",
  "critical",
  "warning",
  "info",
];

const COMMON_CODES: EventCode[] = [
  "PLC_COMM_LOST",
  "PLC_COMM_RESTORED",
  "VALUE_OUT_OF_RANGE",
  "SENSOR_FAULT",
  "EMERGENCY_STOP",
  "GATEWAY_REBOOT",
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

  const { data, isLoading, isError } = useQuery<EventItem[]>({
    queryKey: [
      "events",
      severityParam,
      codeParam,
      deviceParam,
      range,
      page,
    ],
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
    <div className="page">
      <PageHeader
        title="Events"
        subtitle={
          isLoading
            ? "loading…"
            : data
              ? `${data.length} on this page · last ${range.label ?? "24h"}`
              : `last ${range.label ?? "24h"}`
        }
        actions={
          <TimeRangePicker
            from={range.from}
            to={range.to}
            onChange={(r) => {
              setRange({ from: r.from, to: r.to });
              setPage(1);
            }}
          />
        }
      />

      <div className="card">
        <div className="events-filters">
          <div className="events-filter-group">
            <div className="eyebrow">Severity</div>
            <div className="filter-group" role="tablist">
              {SEVERITY_FILTERS.map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={severity === s}
                  className={`filter-chip${severity === s ? " active" : ""}`}
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
          <div className="events-filter-group">
            <div className="eyebrow">Device</div>
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
          <div className="events-filter-group events-filter-codes">
            <div className="eyebrow">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                Codes
                {codes.size > 0 && (
                  <span className="tab-count">{codes.size}</span>
                )}
              </span>
            </div>
            <div className="events-code-list">
              {COMMON_CODES.map((c) => (
                <button
                  key={c}
                  className={`filter-chip${codes.has(c) ? " active" : ""}`}
                  onClick={() => toggleCode(c)}
                >
                  {c.toLowerCase()}
                </button>
              ))}
              {codes.size > 0 && (
                <button
                  className="filter-chip"
                  onClick={() => setCodes(new Set())}
                  style={{ color: "var(--severity-critical)" }}
                >
                  clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isError && (
        <div className="card">
          <div className="empty-large" role="alert">
            <span className="empty-icon" aria-hidden>
              !
            </span>
            <h3>Could not load events</h3>
            <p>Check the connection to the API and try again.</p>
          </div>
        </div>
      )}

      {!isError && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Severity</th>
                  <th>Code</th>
                  <th>Device</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr className="table-empty">
                    <td colSpan={5}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          padding: 8,
                        }}
                      >
                        <span className="skeleton" style={{ width: 14, height: 14 }}>
                          &nbsp;
                        </span>
                        loading events…
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading && data?.length === 0 && (
                  <tr className="table-empty">
                    <td colSpan={5}>
                      <div className="empty-large">
                        <span className="empty-icon" aria-hidden>
                          <Inbox size={18} />
                        </span>
                        <h3>No events match the current filters</h3>
                        <p>
                          Try widening the time range, picking a different
                          severity, or clearing the code selection.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {(data ?? []).map((e: EventItem, i: number) => (
                  <tr key={`${e.ts}-${e.code}-${i}`}>
                    <td className="mono">
                      {new Date(e.ts * 1000).toLocaleString()}
                    </td>
                    <td>
                      <SeverityChip severity={e.severity} />
                    </td>
                    <td className="mono">{e.code.toLowerCase().replace(/_/g, " ")}</td>
                    <td className="mono">{e.device_id}</td>
                    <td>{e.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="events-pagination">
        <span className="muted mono" style={{ fontSize: 11 }}>
          Page {page}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            className="btn btn-sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={(data?.length ?? 0) < pageSize}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
