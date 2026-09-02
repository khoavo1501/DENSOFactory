import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { devicesApi } from "@/api/endpoints";
import { DeviceCard } from "@/components/DeviceCard";
import { ReconnectingWs } from "@/api/ws";
import { useAuth } from "@/store";
import { useToasts } from "@/store/toasts";
import type { Device, WsMessage, EventCode, Severity, DeviceState } from "@/types";

const SOURCE_FILTERS: Array<"all" | "simulated" | "real"> = [
  "all",
  "simulated",
  "real",
];

export function OverviewPage() {
  const { user } = useAuth();
  const [sourceFilter, setSourceFilter] = useState<"all" | "simulated" | "real">(
    "all"
  );
  const [liveValues, setLiveValues] = useState<Record<string, string>>({});
  const pushToast = useToasts((s) => s.push);
  const lastStateRef = useRef<Record<string, DeviceState | undefined>>({});

  const { data, isLoading, error, refetch } = useQuery<Device[]>({
    queryKey: ["devices", sourceFilter],
    queryFn: () =>
      devicesApi.list(
        sourceFilter === "all" ? undefined : sourceFilter
      ) as Promise<Device[]>,
    refetchInterval: 30_000,
  });

  // WebSocket: subscribe to all devices, update live values + push toasts
  // for critical events and error state transitions.
  useEffect(() => {
    const ws = new ReconnectingWs("*");
    const off = ws.onMessage((raw) => {
      const m = raw as WsMessage;
      if (!m.device_id) return;

      if (m.type === "telemetry") {
        const regs = m.registers as Record<string, { value?: unknown }> | undefined;
        if (regs) {
          const first = Object.entries(regs).find(([, v]) => v && "value" in v);
          if (first) {
            const [reg, v] = first;
            setLiveValues((prev) => ({
              ...prev,
              [m.device_id as string]: `${reg}=${formatValue((v as { value: unknown }).value)}`,
            }));
          }
        }
      } else if (m.type === "status") {
        const newState = m.state as DeviceState | undefined;
        const prevState = lastStateRef.current[m.device_id];
        if (newState && newState !== prevState) {
          if (newState === "error") {
            pushToast({
              severity: "critical" as Severity,
              code: "WATCHDOG_RESET",
              device_id: m.device_id,
              message: `Device entered ERROR state${
                m.reason ? `: ${m.reason}` : ""
              }`,
            });
          } else if (prevState === "error" && newState === "online") {
            pushToast({
              severity: "info" as Severity,
              code: "POWER_ON",
              device_id: m.device_id,
              message: "Device recovered: online",
            });
          }
          lastStateRef.current[m.device_id] = newState;
        }
      } else if (m.type === "event") {
        const events = (m as { events?: { code: EventCode; severity: Severity; message?: string }[] }).events;
        if (events) {
          for (const e of events) {
            if (e.severity === "critical" || e.severity === "warning") {
              pushToast({
                severity: e.severity,
                code: e.code,
                device_id: m.device_id,
                message: e.message,
              });
            }
          }
        }
      }
    });
    ws.start();
    return () => {
      off();
      ws.stop();
    };
  }, [pushToast]);

  const devices = useMemo(() => data ?? [], [data]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 16 }}>Overview</h1>
        <span className="muted" style={{ fontSize: 12 }}>
          {devices.length} device{devices.length === 1 ? "" : "s"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f}
              className={"btn" + (sourceFilter === f ? " btn-primary" : "")}
              onClick={() => setSourceFilter(f)}
            >
              {f}
            </button>
          ))}
          <button className="btn" onClick={() => refetch()}>
            Refresh
          </button>
        </div>
      </div>

      {isLoading && <div className="empty">Loading...</div>}
      {error && <div className="error-msg">Failed to load devices.</div>}

      {devices.length === 0 && !isLoading && (
        <div className="empty">
          No devices yet. Start the simulator or wait for master devices to publish.
        </div>
      )}

      <div className="grid grid-cards">
        {devices.map((d) => (
          <DeviceCard
            key={d.device_id}
            device={d}
            liveValue={liveValues[d.device_id]}
          />
        ))}
      </div>

      {user?.role === "admin" && (
        <p className="muted" style={{ marginTop: 16, fontSize: 11 }}>
          Logged in as admin. Use Settings to toggle Simulator / change source
          mapping.
        </p>
      )}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(2);
  }
  return String(v);
}
