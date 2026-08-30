import { api } from "./client";
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
};
