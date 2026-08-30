import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { devicesApi } from "@/api/endpoints";
import type { DiagRow } from "@/types";

export function DiagnosticsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const now = Math.floor(Date.now() / 1000);
  const from = now - 30 * 24 * 3600;

  const { data: latestList, isLoading } = useQuery({
    queryKey: ["diag-latest"],
    queryFn: async () => {
      // Get devices list, then latest diag per device.
      const devs = (await devicesApi.list()) as { device_id: string }[];
      const results: DiagRow[] = [];
      for (const d of devs) {
        const r = (await devicesApi.diagLatest(d.device_id)) as DiagRow | null;
        if (r) results.push(r);
      }
      return results;
    },
    refetchInterval: 60_000,
  });

  return (
    <div>
      <h1 style={{ margin: "0 0 12px", fontSize: 16 }}>Diagnostics</h1>
      {isLoading && <div className="empty">Loading...</div>}

      <div className="card" style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={th}>Device</th>
              <th style={th}>Last diag</th>
              <th style={th}>Poll (ms)</th>
              <th style={th}>TX pkts</th>
              <th style={th}>TX fail</th>
              <th style={th}>Latency (ms)</th>
              <th style={th}>Uptime (s)</th>
            </tr>
          </thead>
          <tbody>
            {latestList?.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} style={{ padding: 16, textAlign: "center" }} className="muted">
                  No diag data yet. Diag is published every 5-15 minutes.
                </td>
              </tr>
            )}
            {latestList?.map((d) => (
              <tr
                key={d.device_id}
                style={{
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  background: selected === d.device_id ? "var(--bg-hover)" : undefined,
                }}
                onClick={() => setSelected(d.device_id)}
              >
                <td style={td} className="mono">
                  {d.device_id}
                </td>
                <td style={td} className="mono">
                  {new Date(d.ts * 1000).toLocaleString()}
                </td>
                <td style={td} className="numeric">
                  {d.poll_cycle_ms ?? "—"}
                </td>
                <td style={td} className="numeric">
                  {d.tx_packets ?? "—"}
                </td>
                <td style={td} className="numeric">
                  {d.tx_failures ?? "—"}
                </td>
                <td style={td} className="numeric">
                  {d.avg_latency_ms?.toFixed(2) ?? "—"}
                </td>
                <td style={td} className="numeric">
                  {d.uptime_s ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <DiagHistory deviceId={selected} from={from} to={now} />}
    </div>
  );
}

function DiagHistory({
  deviceId,
  from,
  to,
}: {
  deviceId: string;
  from: number;
  to: number;
}) {
  const { data } = useQuery({
    queryKey: ["diag-history", deviceId, from, to],
    queryFn: () => devicesApi.diagHistory(deviceId, from, to) as Promise<DiagRow[]>,
  });

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="card-header">
        <span className="card-title">Diag history — {deviceId}</span>
        <span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>
          {data?.length ?? 0} rows
        </span>
      </div>
      {data && data.length > 0 ? (
        <div style={{ maxHeight: 240, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={th}>Time</th>
                <th style={th}>Poll (ms)</th>
                <th style={th}>Latency (ms)</th>
                <th style={th}>TX ok/fail</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={td} className="mono">
                    {new Date(d.ts * 1000).toLocaleString()}
                  </td>
                  <td style={td} className="numeric">
                    {d.poll_cycle_ms ?? "—"}
                  </td>
                  <td style={td} className="numeric">
                    {d.avg_latency_ms?.toFixed(2) ?? "—"}
                  </td>
                  <td style={td} className="numeric">
                    {d.tx_packets ?? 0}/{d.tx_failures ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No history.</div>
      )}
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
