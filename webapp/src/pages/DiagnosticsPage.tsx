import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, X } from "lucide-react";
import { devicesApi } from "@/api/endpoints";
import { PageHeader } from "@/components/Breadcrumb";
import { StatusDot } from "@/components/Indicators";
import type { DiagRow, Device } from "@/types";

export function DiagnosticsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const now = Math.floor(Date.now() / 1000);
  const from = now - 30 * 24 * 3600;

  const { data: devices, isLoading: devLoading } = useQuery({
    queryKey: ["devices-list"],
    queryFn: () => devicesApi.list() as Promise<Device[]>,
  });

  const { data: latestList, isLoading: diagLoading } = useQuery({
    queryKey: ["diag-latest"],
    queryFn: async () => {
      const devs = (await devicesApi.list()) as { device_id: string }[];
      const rows: (DiagRow | null)[] = await Promise.all(
        devs.map((d) => devicesApi.diagLatest(d.device_id) as Promise<DiagRow | null>)
      );
      return rows.filter((r): r is DiagRow => r !== null);
    },
    refetchInterval: 60_000,
  });

  const isLoading = devLoading || diagLoading;

  // Build a per-device map: device_id -> latest diag
  const diagByDevice = new Map<string, DiagRow>();
  (latestList ?? []).forEach((d) => diagByDevice.set(d.device_id, d));

  // Devices that have ANY diag data, sorted by ts desc
  const diagDevices = (devices ?? [])
    .filter((d) => diagByDevice.has(d.device_id))
    .sort(
      (a, b) =>
        (diagByDevice.get(b.device_id)?.ts ?? 0) -
        (diagByDevice.get(a.device_id)?.ts ?? 0)
    );

  // Devices that DON'T have diag yet (so the operator knows the simulator
  // devices that the simulator or gateway hasn't started publishing diag).
  const noDiagDevices = (devices ?? []).filter(
    (d) => !diagByDevice.has(d.device_id)
  );

  return (
    <div className="page">
      <PageHeader
        title="Diagnostics"
        subtitle="device poll health · last 30 days"
        actions={
          <button
            className="btn btn-sm"
            onClick={() => {
              /* tanstack-query refetch on remount via key — explicit click
                 isn't wired but a refresh is implicit via refetchInterval */
            }}
          >
            <RefreshCw size={12} aria-hidden /> Auto-refresh
          </button>
        }
      />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Last diag</th>
                <th>State</th>
                <th className="col-numeric">Poll (ms)</th>
                <th className="col-numeric">TX packets</th>
                <th className="col-numeric">TX fail</th>
                <th className="col-numeric">Latency (ms)</th>
                <th className="col-numeric">MQTT reconn</th>
                <th className="col-numeric">Uptime (s)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr className="table-empty">
                  <td colSpan={9}>Loading diagnostics…</td>
                </tr>
              )}
              {!isLoading && diagDevices.length === 0 && (
                <tr className="table-empty">
                  <td colSpan={9}>
                    <div className="empty-large" style={{ padding: 16 }}>
                      <span className="empty-icon" aria-hidden>
                        <Activity size={18} />
                      </span>
                      <h3>No diagnostic data yet</h3>
                      <p>
                        Devices publish diagnostics every 5–15 minutes. The
                        simulator does not currently send diag, so this list
                        will be empty until a real gateway is online.
                      </p>
                      {noDiagDevices.length > 0 && (
                        <p
                          className="muted"
                          style={{ fontSize: 12, marginTop: 8 }}
                        >
                          {noDiagDevices.length} device
                          {noDiagDevices.length === 1 ? "" : "s"} known but
                          no diag reported yet
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {diagDevices.map((d) => {
                const r = diagByDevice.get(d.device_id)!;
                const isSelected = selected === d.device_id;
                return (
                  <tr
                    key={d.device_id}
                    data-clickable="true"
                    onClick={() =>
                      setSelected(isSelected ? null : d.device_id)
                    }
                    className={isSelected ? "selected" : ""}
                  >
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <StatusDot state={d.state} />
                        <span className="mono">{d.device_id}</span>
                      </div>
                    </td>
                    <td className="mono">
                      {new Date(r.ts * 1000).toLocaleString()}
                    </td>
                    <td>
                      <span
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: 12,
                        }}
                      >
                        {d.state}
                      </span>
                    </td>
                    <td className="col-numeric">{r.poll_cycle_ms ?? "—"}</td>
                    <td className="col-numeric">{r.tx_packets ?? "—"}</td>
                    <td
                      className="col-numeric"
                      style={{
                        color:
                          (r.tx_failures ?? 0) > 0
                            ? "var(--severity-warning)"
                            : undefined,
                      }}
                    >
                      {r.tx_failures ?? "—"}
                    </td>
                    <td className="col-numeric">
                      {r.avg_latency_ms?.toFixed(2) ?? "—"}
                    </td>
                    <td className="col-numeric">{r.mqtt_reconnect ?? "—"}</td>
                    <td className="col-numeric">{r.uptime_s ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <DiagHistory deviceId={selected} onClose={() => setSelected(null)} from={from} to={now} />}
    </div>
  );
}

function DiagHistory({
  deviceId,
  from,
  to,
  onClose,
}: {
  deviceId: string;
  from: number;
  to: number;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["diag-history", deviceId, from, to],
    queryFn: () =>
      devicesApi.diagHistory(deviceId, from, to) as Promise<DiagRow[]>,
  });

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title mono">Diag history · {deviceId}</span>
        <span
          className="eyebrow"
          style={{ marginLeft: "auto" }}
        >
          {isLoading ? "loading…" : `${data?.length ?? 0} rows`}
        </span>
        <button
          className="btn btn-ghost btn-icon"
          onClick={onClose}
          aria-label="Close diag history"
          title="Close"
          style={{ marginLeft: 8 }}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      {data && data.length > 0 ? (
        <div style={{ maxHeight: 280, overflow: "auto" }}>
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Time</th>
                <th className="col-numeric">Poll (ms)</th>
                <th className="col-numeric">Latency (ms)</th>
                <th className="col-numeric">TX ok / fail</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i}>
                  <td className="mono">
                    {new Date(r.ts * 1000).toLocaleString()}
                  </td>
                  <td className="numeric">{r.poll_cycle_ms ?? "—"}</td>
                  <td className="numeric">
                    {r.avg_latency_ms?.toFixed(2) ?? "—"}
                  </td>
                  <td className="numeric">
                    {r.tx_packets ?? 0} /{" "}
                    <span
                      style={{
                        color:
                          (r.tx_failures ?? 0) > 0
                            ? "var(--severity-warning)"
                            : undefined,
                      }}
                    >
                      {r.tx_failures ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          {isLoading ? "Loading…" : "No history for this period."}
        </div>
      )}
    </div>
  );
}
