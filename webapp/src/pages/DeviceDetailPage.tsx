import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { devicesApi } from "@/api/endpoints";
import { ReconnectingWs } from "@/api/ws";
import { StateDot, SourceBadge } from "@/components/Indicators";
import { useState } from "react";
import type { WsMessage, StatusPayload, DeviceState } from "@/types";

export function DeviceDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [liveStatus, setLiveStatus] = useState<StatusPayload | null>(null);
  const [liveRegisters, setLiveRegisters] = useState<
    Record<string, { value: unknown; ts: number }>
  >({});

  const { data: latest, isLoading } = useQuery({
    queryKey: ["device-latest", id],
    queryFn: () => devicesApi.latest(id),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const ws = new ReconnectingWs(id);
    const off = ws.onMessage((raw) => {
      const m = raw as WsMessage;
      if (m.device_id !== id) return;
      if (m.type === "status") {
        setLiveStatus({
          state: m.state as DeviceState,
          uptime_s: m.uptime_s as number | undefined,
          reason: m.reason as string | undefined,
          ts: m.ts as number,
        });
      } else if (m.type === "telemetry") {
        const regs = m.registers as
          | Record<string, { value?: unknown }>
          | undefined;
        if (regs) {
          setLiveRegisters((prev) => {
            const next = { ...prev };
            for (const [reg, v] of Object.entries(regs)) {
              if (v && "value" in v) {
                next[reg] = { value: v.value, ts: m.ts as number };
              }
            }
            return next;
          });
        }
      }
    });
    ws.start();
    return () => {
      off();
      ws.stop();
    };
  }, [id]);

  const liveSnapshot = (latest as { source?: string } | undefined) ?? {};
  const source = liveSnapshot.source;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Link to="/" className="btn btn-ghost">
          ← Back
        </Link>
        <h1 className="mono" style={{ margin: 0, fontSize: 16 }}>
          {id}
        </h1>
        <SourceBadge source={(source as "simulated" | "real") ?? "real"} />
        <StateDot state={liveStatus?.state ?? null} />
        <span className="muted">
          {liveStatus?.state ?? "—"}
          {liveStatus?.uptime_s != null && ` · uptime ${liveStatus.uptime_s}s`}
        </span>
      </div>

      {isLoading && <div className="empty">Loading...</div>}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Telemetry (live)</span>
        </div>
        {Object.keys(liveRegisters).length === 0 ? (
          <div className="empty">No live data yet.</div>
        ) : (
          <div className="kv">
            {Object.entries(liveRegisters).map(([reg, v]) => (
              <div key={reg} style={{ display: "contents" }}>
                <div className="k mono">{reg}</div>
                <div className="v mono">
                  {String(v.value)}{" "}
                  <span className="muted" style={{ fontSize: 10 }}>
                    @ {new Date(v.ts * 1000).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
