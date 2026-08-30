import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { eventsApi } from "@/api/endpoints";
import { SeverityChip } from "@/components/Indicators";
import type { EventItem, Severity, EventCode } from "@/types";

const SEVERITY_FILTERS: Array<"all" | Severity> = ["all", "critical", "warning", "info"];

export function EventsPage() {
  const [severity, setSeverity] = useState<"all" | Severity>("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const now = Math.floor(Date.now() / 1000);
  const from = now - 24 * 3600;

  const { data, isLoading } = useQuery<EventItem[]>({
    queryKey: ["events", severity, page],
    queryFn: () =>
      eventsApi.list({
        severity: severity === "all" ? undefined : severity,
        from,
        to: now,
        page,
        page_size: pageSize,
      }) as Promise<EventItem[]>,
    refetchInterval: 15_000,
  });

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
        <h1 style={{ margin: 0, fontSize: 16 }}>Events (last 24h)</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
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
                <td colSpan={5} style={{ padding: 16, textAlign: "center" }} className="muted">
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
                  {e.code as EventCode}
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
