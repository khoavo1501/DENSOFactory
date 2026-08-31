import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { adminApi, devicesApi, exportsApi } from "@/api/endpoints";
import { useAuth } from "@/store";
import { SourceBadge } from "@/components/Indicators";
import { resolveRange } from "@/utils/timeRange";
import type { DeviceSource, Source, User } from "@/types";

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
      <UserManagementPanel />
      <ExportPanel />
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
      <div className="card settings-section">
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
      <div className="card settings-section">
        <div className="card-header">
          <span className="card-title">Source Mapping</span>
          <span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>
            Override pattern inference per device_id.
          </span>
        </div>

        <div className="user-form">
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="DEVICE_ID"
            style={{ fontFamily: "var(--font-mono)" }}
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

  function UserManagementPanel() {
    const { data: users } = useQuery({
      queryKey: ["admin-users"],
      queryFn: () => adminApi.listUsers(),
    });
    const createMut = useMutation({
      mutationFn: ({
        username,
        password,
        role,
      }: {
        username: string;
        password: string;
        role: "admin" | "viewer";
      }) => adminApi.createUser(username, password, role),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["admin-users"] });
        setNewUsername("");
        setNewPassword("");
      },
    });
    const roleMut = useMutation({
      mutationFn: ({ username, role }: { username: string; role: "admin" | "viewer" }) =>
        adminApi.setUserRole(username, role),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    });
    const passwordMut = useMutation({
      mutationFn: ({ username, password }: { username: string; password: string }) =>
        adminApi.setUserPassword(username, password),
      onSuccess: () => {
        setPwTarget(null);
        setNewPassword("");
      },
    });
    const deleteMut = useMutation({
      mutationFn: (username: string) => adminApi.deleteUser(username),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    });

    const [newUsername, setNewUsername] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
    const [pwTarget, setPwTarget] = useState<string | null>(null);

    return (
      <div className="card settings-section">
        <div className="card-header">
          <span className="card-title">User Management</span>
          <span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>
            {users?.length ?? 0} user{(users?.length ?? 0) === 1 ? "" : "s"}
          </span>
        </div>

        <div className="user-form">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="username"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="password (>=8 chars)"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")}
          >
            <option value="viewer">viewer</option>
            <option value="admin">admin</option>
          </select>
          <button
            className="btn btn-primary"
            disabled={
              !newUsername ||
              newPassword.length < 8 ||
              createMut.isPending
            }
            onClick={() =>
              createMut.mutate({
                username: newUsername,
                password: newPassword,
                role: newRole,
              })
            }
          >
            Add
          </button>
        </div>
        {createMut.error && (
          <div className="error-msg" style={{ marginBottom: 8 }}>
            {(createMut.error as Error).message}
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={th}>Username</th>
              <th style={th}>Role</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u: User) => (
              <tr key={u.username} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={td} className="mono">
                  {u.username}
                </td>
                <td style={td}>
                  <select
                    value={u.role}
                    disabled={u.username === user?.username}
                    onChange={(e) =>
                      roleMut.mutate({
                        username: u.username,
                        role: e.target.value as "admin" | "viewer",
                      })
                    }
                    style={{ height: 24, fontSize: 11 }}
                  >
                    <option value="viewer">viewer</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {pwTarget === u.username ? (
                    <>
                      <input
                        type="password"
                        placeholder="new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{
                          width: 140,
                          height: 24,
                          fontSize: 11,
                          marginRight: 4,
                        }}
                      />
                      <button
                        className="btn btn-primary"
                        disabled={
                          newPassword.length < 8 || passwordMut.isPending
                        }
                        onClick={() =>
                          passwordMut.mutate({
                            username: u.username,
                            password: newPassword,
                          })
                        }
                        style={{ height: 24, padding: "0 8px", fontSize: 11 }}
                      >
                        Save
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          setPwTarget(null);
                          setNewPassword("");
                        }}
                        style={{ height: 24, padding: "0 8px", fontSize: 11 }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setPwTarget(u.username)}
                        style={{ height: 24, padding: "0 8px", fontSize: 11 }}
                      >
                        Set password
                      </button>
                      {u.username !== user?.username && (
                        <button
                          className="btn btn-ghost"
                          onClick={() => {
                            if (
                              confirm(
                                `Delete user "${u.username}"? This cannot be undone.`
                              )
                            ) {
                              deleteMut.mutate(u.username);
                            }
                          }}
                          style={{
                            height: 24,
                            padding: "0 8px",
                            fontSize: 11,
                            color: "var(--severity-critical)",
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function ExportPanel() {
    const [deviceId, setDeviceId] = useState("SIM_LINE_A_01");
    const [register, setRegister] = useState("hr_100");
    const [format, setFormat] = useState<"csv" | "xlsx">("csv");
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const range = resolveRange("24h");

    const handle = async (kind: "telemetry" | "events" | "diag") => {
      setBusy(kind);
      setError(null);
      try {
        const params: Record<string, string | number> = { from: range.from, to: range.to };
        if (kind === "telemetry") {
          params.device_id = deviceId;
          params.register = register;
        } else if (kind === "diag") {
          params.device_id = deviceId;
        } else {
          // events: optional device filter
          params.device_id = deviceId;
        }
        const blob = await exportsApi.download(kind, params, format);
        const ext = format === "xlsx" ? "xlsx" : "csv";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${kind}_${deviceId}_${range.from}-${range.to}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    };

    return (
      <div className="card settings-section">
        <div className="card-header">
          <span className="card-title">Export</span>
          <span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>
            Last 24h · max 100,000 rows
          </span>
        </div>

        <div className="user-form" style={{ marginBottom: 8 }}>
          <input
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="device_id"
            style={{ fontFamily: "var(--font-mono)" }}
          />
          <input
            value={register}
            onChange={(e) => setRegister(e.target.value)}
            placeholder="register (telemetry only)"
            style={{ fontFamily: "var(--font-mono)" }}
          />
          <select value={format} onChange={(e) => setFormat(e.target.value as "csv" | "xlsx")}>
            <option value="csv">CSV</option>
            <option value="xlsx">XLSX</option>
          </select>
        </div>

        {error && <div className="error-msg" style={{ marginBottom: 8 }}>{error}</div>}

        <div className="export-grid">
          <div className="export-card">
            <h4>Telemetry</h4>
            <p>Register history for one device_id + register.</p>
            <button
              className="btn btn-primary"
              disabled={busy !== null || !deviceId || !register}
              onClick={() => handle("telemetry")}
            >
              {busy === "telemetry" ? "Downloading..." : "Download"}
            </button>
          </div>
          <div className="export-card">
            <h4>Events</h4>
            <p>Event feed filtered by device (last 24h).</p>
            <button
              className="btn btn-primary"
              disabled={busy !== null}
              onClick={() => handle("events")}
            >
              {busy === "events" ? "Downloading..." : "Download"}
            </button>
          </div>
          <div className="export-card">
            <h4>Diag</h4>
            <p>Diag history for one device_id (last 24h).</p>
            <button
              className="btn btn-primary"
              disabled={busy !== null || !deviceId}
              onClick={() => handle("diag")}
            >
              {busy === "diag" ? "Downloading..." : "Download"}
            </button>
          </div>
        </div>
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
