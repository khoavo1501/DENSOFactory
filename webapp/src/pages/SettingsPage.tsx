import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { adminApi, devicesApi } from "@/api/endpoints";
import { useAuth } from "@/store";
import { SourceBadge } from "@/components/Indicators";
import type { DeviceSource, Source } from "@/types";

export function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <h1 style={{ margin: "0 0 12px", fontSize: 16 }}>Settings</h1>

      <SimulatorPanel />
      <SourceMappingPanel />
    </div>
  );

  function SimulatorPanel() {
    const { data } = useQuery({
      queryKey: ["simulator-status"],
      queryFn: () => adminApi.simulatorStatus(),
      refetchInterval: 5_000,
    });
    const startMut = useMutation({
      mutationFn: () => adminApi.simulatorStart([]),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["simulator-status"] }),
    });
    const stopMut = useMutation({
      mutationFn: () => adminApi.simulatorStop(),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["simulator-status"] }),
    });

    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <span className="card-title">Simulator Service</span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: data?.running ? "var(--state-online)" : "var(--text-muted)",
            }}
          >
            {data?.running ? "RUNNING" : "STOPPED"}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "4px 0 8px" }}>
          Toggle the simulator container. Real data flow is unaffected.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={() => startMut.mutate()}
            disabled={data?.running || startMut.isPending}
          >
            Start
          </button>
          <button
            className="btn btn-danger"
            onClick={() => stopMut.mutate()}
            disabled={!data?.running || stopMut.isPending}
          >
            Stop
          </button>
        </div>
      </div>
    );
  }

  function SourceMappingPanel() {
    const { data } = useQuery({
      queryKey: ["device-sources"],
      queryFn: () => adminApi.listSources(),
    });
    const upsertMut = useMutation({
      mutationFn: ({ id, source }: { id: string; source: Source }) =>
        adminApi.upsertSource(id, source),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["device-sources"] }),
    });
    const deleteMut = useMutation({
      mutationFn: (id: string) => adminApi.deleteSource(id),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["device-sources"] }),
    });

    const [newId, setNewId] = useState("");
    const [newSource, setNewSource] = useState<Source>("simulated");

    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">Source Mapping</span>
          <span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>
            Override pattern inference per device_id.
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="DEVICE_ID"
            style={{ flex: 1, fontFamily: "var(--font-mono)" }}
          />
          <select
            value={newSource}
            onChange={(e) => setNewSource(e.target.value as Source)}
          >
            <option value="simulated">simulated</option>
            <option value="real">real</option>
          </select>
          <button
            className="btn btn-primary"
            disabled={!newId || upsertMut.isPending}
            onClick={() => {
              upsertMut.mutate(
                { id: newId, source: newSource },
                { onSuccess: () => setNewId("") }
              );
            }}
          >
            Add
          </button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={th}>Device ID</th>
              <th style={th}>Source</th>
              <th style={th}>Updated</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {data?.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 12, textAlign: "center" }} className="muted">
                  No explicit mappings. Pattern inference applies.
                </td>
              </tr>
            )}
            {data?.map((s: DeviceSource) => (
              <tr key={s.device_id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={td} className="mono">{s.device_id}</td>
                <td style={td}>
                  <SourceBadge source={s.source} />
                </td>
                <td style={td} className="mono">
                  {new Date(s.updated_at).toLocaleString()}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => deleteMut.mutate(s.device_id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
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
