import { api, ApiError } from "./client";
import type {
  Device,
  DeviceSource,
  DiagRow,
  EventItem,
  User,
} from "@/types";

export const authApi = {
  me: () => api<User>("/auth/me"),
  login: (username: string, password: string) =>
    api<User>("/auth/login", { method: "POST", body: { username, password } }),
  logout: () => api<void>("/auth/logout", { method: "POST" }),
};

export const devicesApi = {
  list: (source?: "simulated" | "real") =>
    api<Device[]>(`/devices${source ? `?source=${source}` : ""}`),
  latest: (id: string) => api<unknown>(`/devices/${id}/latest`),
  snapshot: (id: string) => api<unknown>(`/devices/${id}/telemetry/snapshot`),
  history: (id: string, register: string, from: number, to: number, agg = "raw") =>
    api<unknown[]>(
      `/devices/${id}/telemetry/history?register=${encodeURIComponent(
        register
      )}&from=${from}&to=${to}&agg=${agg}`
    ),
  diagLatest: (id: string) => api<DiagRow | null>(`/devices/${id}/diag/latest`),
  diagHistory: (id: string, from: number, to: number) =>
    api<DiagRow[]>(
      `/devices/${id}/diag/history?from=${from}&to=${to}`
    ),
};

export const eventsApi = {
  list: (params: {
    device_id?: string;
    severity?: string;
    code?: string;
    from: number;
    to: number;
    page?: number;
    page_size?: number;
  }) => {
    const qs = new URLSearchParams();
    qs.set("from", String(params.from));
    qs.set("to", String(params.to));
    if (params.device_id) qs.set("device_id", params.device_id);
    if (params.severity) qs.set("severity", params.severity);
    if (params.code) qs.set("code", params.code);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 50));
    return api<EventItem[]>(`/events?${qs.toString()}`);
  },
  summary: (window = "24h") =>
    api<Record<string, Record<string, number>>>(`/events/summary?window=${window}`),
};

export const adminApi = {
  listSources: () => api<DeviceSource[]>("/admin/devices-sources"),
  upsertSource: (device_id: string, source: "simulated" | "real") =>
    api<DeviceSource>(`/admin/devices-sources/${encodeURIComponent(device_id)}`, {
      method: "PUT",
      body: { source },
    }),
  deleteSource: (device_id: string) =>
    api<void>(`/admin/devices-sources/${encodeURIComponent(device_id)}`, {
      method: "DELETE",
    }),
  simulatorStatus: () =>
    api<{ running: boolean; device_ids: string[] }>("/admin/simulator/status"),
  simulatorStart: (device_ids: string[] = []) =>
    api<{ running: boolean; device_ids: string[] }>("/admin/simulator/start", {
      method: "POST",
      body: { device_ids },
    }),
  simulatorStop: () =>
    api<{ running: boolean; device_ids: string[] }>("/admin/simulator/stop", {
      method: "POST",
    }),
  // User management (M5)
  listUsers: () => api<User[]>("/admin/users"),
  createUser: (username: string, password: string, role: "admin" | "viewer") =>
    api<User>("/admin/users", {
      method: "POST",
      body: { username, password, role },
    }),
  setUserRole: (username: string, role: "admin" | "viewer") =>
    api<User>(`/admin/users/${encodeURIComponent(username)}/role`, {
      method: "PATCH",
      body: { role },
    }),
  setUserPassword: (username: string, password: string) =>
    api<void>(`/admin/users/${encodeURIComponent(username)}/password`, {
      method: "PATCH",
      body: { password },
    }),
  deleteUser: (username: string) =>
    api<void>(`/admin/users/${encodeURIComponent(username)}`, {
      method: "DELETE",
    }),
};

// Export endpoints (M5) — returns Blob, not JSON.
export const exportsApi = {
  async download(
    kind: "telemetry" | "events" | "diag",
    params: Record<string, string | number>,
    format: "csv" | "xlsx" = "csv"
  ): Promise<Blob> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
    qs.set("format", format);
    const csrf = getCookie("csrf");
    const headers: Record<string, string> = {};
    if (csrf) headers["X-CSRF-Token"] = csrf;
    const r = await fetch(`/api/exports/${kind}?${qs.toString()}`, {
      method: "GET",
      credentials: "include",
      headers,
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new ApiError(txt || `HTTP ${r.status}`, r.status, txt);
    }
    return r.blob();
  },
};

function getCookie(name: string): string | null {
  const m = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
  );
  return m ? decodeURIComponent(m[1]) : null;
}

// ====== M10: Gateway & PLC API ======
import type { Gateway, PLC, PLCSnapshot, PLCAssignment, Warning, GatewayWithPLCs } from "@/types";

export const gatewaysApi = {
  list: () => api<Gateway[]>(`/gateways`),
  get: (masterId: string) => api<GatewayWithPLCs>(`/gateways/${encodeURIComponent(masterId)}`),
  remove: (masterId: string) =>
    api<void>(`/gateways/${encodeURIComponent(masterId)}`, { method: "DELETE" }),
};

export const plcsApi = {
  list: (gatewayId?: string) =>
    api<PLC[]>(`/plcs${gatewayId ? `?gateway_id=${encodeURIComponent(gatewayId)}` : ""}`),
  get: (plcId: string) => api<PLC>(`/plcs/${encodeURIComponent(plcId)}`),
  /**
   * Snapshot endpoint. mode=normal returns latest 1-min snapshot.
   * mode=realtime forces a live read (used when warning active).
   */
  snapshot: (plcId: string, mode: "normal" | "realtime" = "normal") =>
    api<PLCSnapshot>(
      `/plcs/${encodeURIComponent(plcId)}/snapshot?mode=${mode}`
    ),
};

export const unpairedApi = {
  list: () => api<PLC[]>(`/unpaired`),
  pair: (plcId: string, gatewayId: string) =>
    api<PLCAssignment>(`/unpaired/${encodeURIComponent(plcId)}/pair`, {
      method: "POST",
      body: { gateway_id: gatewayId },
    }),
  unpair: (plcId: string) =>
    api<void>(`/unpaired/${encodeURIComponent(plcId)}/pair`, {
      method: "DELETE",
    }),
};

export const warningsApi = {
  list: (params?: { target_type?: "plc" | "gateway"; since?: number }) => {
    const qs = new URLSearchParams();
    if (params?.target_type) qs.set("target_type", params.target_type);
    if (params?.since) qs.set("since", String(params.since));
    const q = qs.toString();
    return api<Warning[]>(`/warnings${q ? `?${q}` : ""}`);
  },
};
