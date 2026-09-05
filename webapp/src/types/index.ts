// Types matching backend payload spec (payload_spec_v1.md) + API response shapes.
// Vocabulary: 'gateway' = STM32+W5500, 'plc' = Modbus slave.

export type Source = "simulated" | "real";

export type DeviceState = "online" | "offline" | "error" | "degraded";

export type Severity = "info" | "warning" | "critical";

export type EventCode =
  | "PLC_COMM_LOST"
  | "PLC_COMM_RESTORED"
  | "VALUE_OUT_OF_RANGE"
  | "SENSOR_FAULT"
  | "EMERGENCY_STOP"
  | "FIRMWARE_UPDATE_START"
  | "FIRMWARE_UPDATE_END"
  | "CONFIG_CHANGED"
  | "GATEWAY_REBOOT"
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
  type: "telemetry" | "status" | "event" | "diag";
  device_id: string;
  ts: number;
  [key: string]: unknown;
}

/* ====== Gateway / PLC (M10) ====== */

export type GatewayStatus = "online" | "offline" | "warning";
export type PLCStatus = "online" | "offline";
export type PLCMode = "normal" | "realtime";
export type OperatingStatus = "running" | "stopped";

export interface Gateway {
  gateway_id: string;
  name: string;
  status: GatewayStatus;
  location?: string;
  fw_version?: string;
  ip?: string;
  last_seen_ts?: number;
}

export interface PLCSnapshot {
  temperature?: number;
  rpm?: number;
  current_amp?: number;
  heartbeat?: number;
  ts?: number;
}

export interface PLC {
  plc_id: string;
  gateway_id: string;
  status: PLCStatus;
  operating_status?: OperatingStatus;
  name?: string;
  location?: string;
  model?: string;
  last_seen_ts?: number;
  latest_snapshot?: PLCSnapshot;
}

export interface Warning {
  id: string;
  target_type: "gateway" | "plc";
  target_id: string;
  code: string;
  severity: Severity;
  message?: string;
  cleared: boolean;
  ts: number;
}

export interface GatewayWithPLCs extends Gateway {
  plcs: PLC[];
}
