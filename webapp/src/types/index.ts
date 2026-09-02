// Types matching backend payload spec (payload_spec_v1.md) + API response shapes.

export type Source = "simulated" | "real";

export type DeviceState = "online" | "offline" | "error" | "degraded";

export type Severity = "info" | "warning" | "critical";

export type EventCode =
  | "SLAVE_COMM_LOST"
  | "SLAVE_COMM_RESTORED"
  | "VALUE_OUT_OF_RANGE"
  | "SENSOR_FAULT"
  | "EMERGENCY_STOP"
  | "FIRMWARE_UPDATE_START"
  | "FIRMWARE_UPDATE_END"
  | "CONFIG_CHANGED"
  | "MASTER_REBOOT"
  | "BUFFER_OVERFLOW"
  | "WATCHDOG_RESET"
  | "POWER_ON"
  | "W5500_LINK_DOWN"
  | "W5500_LINK_UP"
  | "MQTT_DISCONNECTED"
  | "MQTT_RECONNECTED";

export interface User {
  username: string;
  role: "admin" | "viewer";
}

export interface Device {
  device_id: string;
  source: Source;
  state: DeviceState | null;
  last_seen_ts: number | null;
  fw_version?: string;
}

export interface TelemetryPoint {
  register: string;
  value: number | boolean;
  ts: number;
}

export interface StatusPayload {
  state: DeviceState;
  uptime_s?: number;
  reason?: string;
  ts: number;
}

export interface EventItem {
  ts: number;
  code: EventCode;
  severity: Severity;
  message?: string;
  source?: string;
  context?: Record<string, unknown>;
  device_id: string;
}

export interface DiagRow {
  device_id: string;
  ts: number;
  poll_cycle_ms?: number;
  uptime_s?: number;
  tx_packets?: number;
  tx_failures?: number;
  mqtt_reconnect?: number;
  avg_latency_ms?: number;
}

export interface DeviceSource {
  device_id: string;
  source: Source;
  updated_at: string;
  updated_by?: string;
}

export interface WsMessage {
  type: "telemetry" | "status" | "event" | "diag" | "plc_update" | "source_changed";
  device_id?: string;
  ts: number;
  // M10 plc_update fields
  master_id?: string;
  plc_id?: string;
  category?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

// ====== M10: Gateway & PLC types ======
export type GatewayStatus = "online" | "offline" | "error";
export type PLCStatus = "online" | "offline" | "error";
export type OperatingStatus = "running" | "stopped";
export type WarningSeverity = "info" | "warning" | "critical";
export type TargetType = "plc" | "gateway";
export type SnapshotMode = "normal" | "realtime";

export interface Gateway {
  master_id: string;
  name: string;
  status: GatewayStatus;
  fw_version?: string;
  ip?: string;
  last_seen_ts?: number;
}

export interface PLC {
  plc_id: string;
  master_id: string;
  name?: string;
  operating_status: OperatingStatus;
  status: PLCStatus;
  last_seen_ts?: number;
  // resolved at query time from latest snapshot + warning state
  latest_snapshot?: PLCSnapshot | null;
  has_warning?: boolean;
  highest_severity?: WarningSeverity;
}

export interface PLCSnapshot {
  id?: number;
  plc_id: string;
  master_id: string;
  ts: number;
  temperature?: number;
  rpm?: number;
  current_amp?: number;
  heartbeat?: number;
  operating_status?: OperatingStatus;
  status?: PLCStatus;
  mode?: SnapshotMode;
}

export interface PLCAssignment {
  id: number;
  plc_id: string;
  gateway_id: string;
  created_at: string;
}

export interface Warning {
  id: number;
  target_type: TargetType;
  target_id: string;
  severity: WarningSeverity;
  code: string;
  message?: string;
  ts: number;
  cleared: number;
}

export interface GatewayWithPLCs extends Gateway {
  plcs: PLC[];
  has_warning?: boolean;
}
