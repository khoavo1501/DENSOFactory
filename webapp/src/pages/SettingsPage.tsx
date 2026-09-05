import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import {
  Activity,
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Users,
  Download,
} from "lucide-react";
import { adminApi, exportsApi } from "@/api/endpoints";
import { useAuth } from "@/store";
import { PageHeader } from "@/components/Breadcrumb";
import { SourceBadge } from "@/components/Indicators";
import { resolveRange } from "@/utils/timeRange";
import type { DeviceSource, Source } from "@/types";

export function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        subtitle="admin · simulator · source mapping · exports"
      />
      <SimulatorPanel qc={qc} />
      <SourceMappingPanel qc={qc} />
      <UserManagementPanel qc={qc} />
      <ExportPanel />
    </div>
  );
}

function SimulatorPanel({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
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

  const isRunning = !!data?.running;
  return (
    <div className="card settings-section">
      <div className="card-header">
        <Activity size={16} aria-hidden style={{ color: "var(--accent)" }} />
        <span className="card-title">Simulator service</span>
        <span className={`status-pill${isRunning ? " running" : " stopped"}`}>
          <span className="pill-dot" aria-hidden />
          {isRunning ? "running" : "stopped"}
        </span>
      </div>
      <p className="settings-help">
        Toggle the simulator container. Real data flow is unaffected.
      </p>
      <div className="settings-actions">
        <button
          className="btn btn-primary"
          onClick={() => startMut.mutate()}
          disabled={isRunning || startMut.isPending}
        >
          <Power size={12} aria-hidden /> Start
        </button>
        <button
          className="btn btn-danger"
          onClick={() => stopMut.mutate()}
          disabled={!isRunning || stopMut.isPending}
        >
          <PowerOff size={12} aria-hidden /> Stop
        </button>
      </div>
    </div>
  );
}

function SourceMappingPanel({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
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
        <SettingsIcon size={16} aria-hidden style={{ color: "var(--accent)" }} />
        <span className="card-title">Source mapping</span>
        <span
          className="eyebrow"
          style={{ marginLeft: "auto" }}
        >
          Override pattern inference per device_id
        </span>
      </div>

      <div className="user-form">
        <input
          value={newId}
          onChange={(e) => setNewId(e.target.value.toUpperCase())}
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
          <Plus size={12} aria-hidden /> Add
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Device ID</th>
              <th>Source</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.length === 0 && (
              <tr className="table-empty">
                <td colSpan={4}>
                  <div className="empty">
                    No explicit mappings. Pattern inference applies
                    automatically.
                  </div>
                </td>
              </tr>
            )}
            {data?.map((s: DeviceSource) => (
              <tr key={s.device_id}>
                <td className="mono">{s.device_id}</td>
                <td>
                  <SourceBadge source={s.source} />
                </td>
                <td className="mono">
                  {new Date(s.updated_at).toLocaleString()}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => deleteMut.mutate(s.device_id)}
                    aria-label={`Remove mapping for ${s.device_id}`}
                    style={{ color: "var(--severity-critical)" }}
                  >
                    <Trash2 size={12} aria-hidden /> Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserManagementPanel({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { user } = useAuth();
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
    mutationFn: ({
      username,
      role,
    }: {
      username: string;
      role: "admin" | "viewer";
    }) => adminApi.setUserRole(username, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const passwordMut = useMutation({
    mutationFn: ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) => adminApi.setUserPassword(username, password),
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
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  return (
    <div className="card settings-section">
      <div className="card-header">
        <Users size={16} aria-hidden style={{ color: "var(--accent)" }} />
        <span className="card-title">User management</span>
        <span
          className="eyebrow"
          style={{ marginLeft: "auto" }}
        >
          {users?.length ?? 0} user
          {(users?.length ?? 0) === 1 ? "" : "s"}
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
          placeholder="password (≥ 8 chars)"
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
          <Plus size={12} aria-hidden /> Add
        </button>
      </div>
      {createMut.error && (
        <div className="error-msg" style={{ marginBottom: 8 }}>
          {(createMut.error as Error).message}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.username}>
                <td className="mono">{u.username}</td>
                <td>
                  {u.username === user?.username ? (
                    <span
                      className={`role-pill role-${u.role}`}
                      title="your account — role locked"
                    >
                      {u.role}
                    </span>
                  ) : (
                    <select
                      value={u.role}
                      onChange={(e) =>
                        roleMut.mutate({
                          username: u.username,
                          role: e.target.value as "admin" | "viewer",
                        })
                      }
                    >
                      <option value="viewer">viewer</option>
                      <option value="admin">admin</option>
                    </select>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  {pwTarget === u.username ? (
                    <div className="user-row-actions">
                      <input
                        type="password"
                        placeholder="new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{ width: 140 }}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={
                          newPassword.length < 8 || passwordMut.isPending
                        }
                        onClick={() =>
                          passwordMut.mutate({
                            username: u.username,
                            password: newPassword,
                          })
                        }
                      >
                        Save
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setPwTarget(null);
                          setNewPassword("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="user-row-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setPwTarget(u.username)}
                      >
                        Set password
                      </button>
                      {u.username !== user?.username &&
                        (pendingDelete === u.username ? (
                          <>
                            <span className="muted" style={{ fontSize: 12 }}>
                              Delete {u.username}?
                            </span>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                deleteMut.mutate(u.username);
                                setPendingDelete(null);
                              }}
                            >
                              Confirm
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setPendingDelete(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPendingDelete(u.username)}
                            style={{ color: "var(--severity-critical)" }}
                          >
                            <Trash2 size={12} aria-hidden /> Delete
                          </button>
                        ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      const params: Record<string, string | number> = {
        from: range.from,
        to: range.to,
      };
      params.device_id = deviceId;
      if (kind === "telemetry") {
        params.register = register;
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
        <Download size={16} aria-hidden style={{ color: "var(--accent)" }} />
        <span className="card-title">Export</span>
        <span
          className="eyebrow"
          style={{ marginLeft: "auto" }}
        >
          Last 24h · max 100,000 rows
        </span>
      </div>

      <div className="user-form" style={{ marginBottom: 12 }}>
        <input
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
          placeholder="device_id"
          style={{ fontFamily: "var(--font-mono)" }}
        />
        <input
          value={register}
          onChange={(e) => setRegister(e.target.value.toLowerCase())}
          placeholder="register (telemetry only)"
          style={{ fontFamily: "var(--font-mono)" }}
        />
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as "csv" | "xlsx")}
        >
          <option value="csv">CSV</option>
          <option value="xlsx">XLSX</option>
        </select>
      </div>

      {error && (
        <div className="error-msg" style={{ marginBottom: 8 }} role="alert">
          {error}
        </div>
      )}

      <div className="export-grid">
        <div className="export-card">
          <h4>Telemetry</h4>
          <p>Register history for one device_id and register.</p>
          <button
            className="btn btn-primary"
            disabled={busy !== null || !deviceId || !register}
            onClick={() => handle("telemetry")}
          >
            {busy === "telemetry" ? "Downloading…" : "Download"}
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
            {busy === "events" ? "Downloading…" : "Download"}
          </button>
        </div>
        <div className="export-card">
          <h4>Diag</h4>
          <p>Diagnostic history for one device_id (last 24h).</p>
          <button
            className="btn btn-primary"
            disabled={busy !== null || !deviceId}
            onClick={() => handle("diag")}
          >
            {busy === "diag" ? "Downloading…" : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
