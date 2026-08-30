import clsx from "clsx";
import { Link } from "react-router-dom";
import { StateDot, SourceBadge } from "./Indicators";
import type { Device } from "@/types";

interface DeviceCardProps {
  device: Device;
  liveValue?: string;
}

export function DeviceCard({ device, liveValue }: DeviceCardProps) {
  const lastSeen = device.last_seen_ts
    ? new Date(device.last_seen_ts * 1000).toLocaleTimeString()
    : "—";

  return (
    <Link
      to={`/devices/${encodeURIComponent(device.device_id)}`}
      className="card"
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div className="card-header">
        <StateDot state={device.state} />
        <span className="card-title mono">{device.device_id}</span>
        <span style={{ marginLeft: "auto" }}>
          <SourceBadge source={device.source} />
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          className={clsx("numeric")}
          style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)" }}
        >
          {liveValue ?? "—"}
        </span>
      </div>
      <div
        className="muted"
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 11,
        }}
      >
        <span>state: {device.state ?? "unknown"}</span>
        <span title={`last_seen ${device.last_seen_ts ?? ""}`}>{lastSeen}</span>
      </div>
    </Link>
  );
}
