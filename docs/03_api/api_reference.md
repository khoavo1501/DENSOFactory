---
title: API Reference
category: api
owner: project_lead
created: 2026-08-30
updated: 2026-09-05
status: approved
version: 0.3.0
---

# API Reference

Base URL: `http://localhost:8000` (dev) / `https://<host>` (prod).

All mutating endpoints (`POST`, `PUT`, `DELETE`) require:
- Valid `at` (access token) cookie OR `Authorization: Bearer <token>`.
- `X-CSRF-Token` header matching the `csrf` cookie (exempt: `auth/login`, `auth/refresh`).

OpenAPI / Swagger: `GET /docs` (FastAPI auto-generated).
OpenAPI JSON: `GET /openapi.json`.

## 1. Auth (`/api/auth`)

### POST `/api/auth/login`
Login with username + password. Sets 3 cookies: `at` (15m), `rt` (8h), `csrf` (15m).
**Request:**
```json
{ "username": "admin", "password": "admin123" }
```
**Response 200:**
```json
{ "username": "admin", "role": "admin" }
```
**Errors:** `401 invalid credentials` (also written to `audit_log`).

### POST `/api/auth/refresh`
Exchange `rt` for fresh `at`+`rt`+`csrf`. CSRF exempt.
**Response 200:** same as login.

### POST `/api/auth/logout`
Blacklists the current `rt` in `revoked_refresh`, deletes all cookies.
Writes `auth.logout` to `audit_log`.
**Response:** `204 No Content`.

### GET `/api/auth/me`
**Response 200:**
```json
{ "username": "admin", "role": "admin" }
```

## 2. Devices (`/api/devices`)

### GET `/api/devices?source=simulated|real`
List all known devices with current state.
**Response 200:** `[{device_id, source, state, last_seen_ts, fw_version?}]`

### GET `/api/devices/{id}/latest`
Snapshot: latest status + telemetry map.
**Response 200:**
```json
{
  "device_id": "GW_LINE_A_01",
  "source": "real",
  "status": {"state":"online","uptime_s":3600,"ts":1692816000},
  "telemetry": {"hr_100":{"value":35.2,"ts":1692816000}}
}
```

### GET `/api/devices/{id}/telemetry/snapshot`
Just the telemetry map.

### GET `/api/devices/{id}/telemetry/history?register=hr_100&from=<unix_s>&to=<unix_s>&agg=raw|1m|5m|1h`
Time-series of one register.
- `register`: required, 1–64 chars.
- `from`, `to`: required, Unix seconds.
- `agg`: default `raw`; `1m`/`5m`/`1h` aggregate via Flux `mean`.

**Response 200:** array of CSV-style rows from InfluxDB.

### GET `/api/devices/{id}/diag/latest`
Latest `device_diag` row (Postgres). Fields: `poll_cycle_ms, uptime_s, tx_packets, tx_failures, mqtt_reconnect, avg_latency_ms`.

### GET `/api/devices/{id}/diag/history?from=<unix_s>&to=<unix_s>&limit=500`
Chronological diag series, max 5000 rows.

## 3. Events (`/api/events`)

### GET `/api/events?device_id=&severity=critical,warning&code=PLC_COMM_LOST&from=&to=&page=1&page_size=50`
Filterable event feed.
- `severity`: comma-separated subset of `info|warning|critical`.
- `code`: comma-separated subset of [enum đóng](../../99_attachments/payload_spec_v1.md#4-event--devicesidevent).
- `from`, `to`: Unix seconds, required.
- `page_size`: 1–200, default 50.

**Response 200:** `[{ts, code, severity, message, device_id}]`

### GET `/api/events/summary?window=24h`
Count events grouped by `(severity, event_code)`.
- `window`: regex `\d+[mhd]`, default `24h`.

**Response 200:** `{"critical": {"PLC_COMM_LOST": 3}, "warning": {...}}`

### GET `/api/events/{event_id}`
Detail (M1: returns synthetic stub; real composite key impl in next iteration).

## 4. Admin (`/api/admin`)

All require role `admin`.

### GET `/api/admin/devices-sources`
List explicit `device_id ↔ source` mappings.
**Response 200:** `[{device_id, source, updated_at, updated_by}]`

### PUT `/api/admin/devices-sources/{device_id}`
Upsert mapping. Body: `{"source":"simulated"|"real"}`. Writes `admin.sources.upsert` to `audit_log`.

### DELETE `/api/admin/devices-sources/{device_id}`
Remove explicit mapping (device_id falls back to pattern inference). Writes `admin.sources.delete` to `audit_log`.
**Response:** `204 No Content`.

### GET `/api/admin/simulator/status`
**Response 200:** `{"running": bool, "device_ids": [...]}`

### POST `/api/admin/simulator/start`
Body (optional): `{"device_ids": ["SIM_LINE_A_01", ...]}`. Writes `admin.simulator.start`.

### POST `/api/admin/simulator/stop`
Writes `admin.simulator.stop`.

## 5. Exports (`/api/exports`)

All return a `text/csv` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` stream. Max rows enforced by `EXPORT_MAX_ROWS` env (default 100,000); over -> `413 Payload Too Large`. Every export writes metadata to `audit_log`.

### GET `/api/exports/telemetry?device_id=&register=&from=&to=&format=csv|xlsx`
### GET `/api/exports/events?device_id=&severity=&code=&from=&to=&format=csv|xlsx`
### GET `/api/exports/diag?device_id=&from=&to=&format=csv|xlsx`

## 6. Gateways & PLCs (M10) (`/api/gateways`, `/api/plcs`)

The M10 endpoints expose the gateway/PLC hierarchy and the live telemetry
snapshots table (`plc_snapshots`). Snapshots are written by the MQTT
consumer each time a device publishes telemetry; the API reads the most
recent one and joins it into the response.

`/api/warnings` is also part of M10 and is documented in this section.

### GET `/api/gateways`

List all gateways ordered by name.

**Response 200:**
```json
[
  {
    "gateway_id": "SIM_LINE_A_01",
    "name": "SIM_LINE_A_01",
    "status": "online",
    "fw_version": "1.0.0",
    "ip": null,
    "last_seen_ts": 1788546065,
    "location": null
  }
]
```

Fields:
- `status`: one of `online`, `offline`, `error` (CHECK constraint).
- `fw_version`, `ip`, `location`: nullable metadata; populated by future
  `info` publishes from real gateways.
- `last_seen_ts`: Unix seconds, refreshed by every telemetry/status
  message from the device.

### GET `/api/gateways/{gateway_id}`

Gateway detail with its PLCs and each PLC's latest snapshot.

**Response 200:**
```json
{
  "gateway_id": "SIM_LINE_A_01",
  "name": "SIM_LINE_A_01",
  "status": "online",
  "fw_version": "1.0.0",
  "ip": null,
  "last_seen_ts": 1788546065,
  "plcs": [
    {
      "plc_id": "SIM_LINE_A_01",
      "gateway_id": "SIM_LINE_A_01",
      "name": "SIM_LINE_A_01",
      "operating_status": "running",
      "status": "online",
      "last_seen_ts": 1788546065,
      "latest_snapshot": {
        "temperature": 79.7,
        "rpm": 304.0,
        "current_amp": 0.0,
        "heartbeat": 1,
        "operating_status": "running",
        "status": "online",
        "mode": "normal",
        "ts": 1788546065
      }
    }
  ]
}
```

**Errors:** `404 gateway not found`.

### GET `/api/plcs`

List all PLCs (every device the consumer has seen) ordered by
`gateway_id, plc_id`. Each row carries its `latest_snapshot` from
`plc_snapshots`.

**Response 200:** same shape as the `plcs` array in the gateway detail.

### GET `/api/plcs/unpaired`

PLCs that have no row in `plc_assignments`. Today the simulator
self-pairs each device (1 gateway == 1 PLC) so this list is empty; the
endpoint is wired for the real deployment where a gateway
publishes on behalf of N PLCs that need operator assignment.

**Response 200:** `[PLCOut]`.

### GET `/api/plcs/{plc_id}`

Single PLC detail with `latest_snapshot`. `404 plc not found` if the
id has never published.

### GET `/api/plcs/{plc_id}/history?register=temperature|rpm|current_amp|heartbeat&from=<unix_s>&to=<unix_s>&limit=2000`

Time-series of a single semantic register, served from the
`plc_snapshots` Postgres table. Same `_time` / `_value` row shape as
the InfluxDB-backed `/api/devices/{id}/telemetry/history` so the
webapp can reuse its parser.

- `register`: required; one of `temperature`, `rpm`, `current_amp`,
  `heartbeat`. Other values return `400 unknown register`.
- `from`, `to`: required Unix seconds; `from > to` returns `400`.
- `limit`: 1–10000, default 2000.

**Response 200:** `[{_time, _value}, ...]`

**Errors:** `400 unknown register / from > to`, `404 plc not found`.

### POST `/api/plcs/{plc_id}/pair`

Re-assign a PLC to a different gateway. Body:

```json
{ "gateway_id": "GW_LINE_A_01" }
```

Writes the new `plc_assignments` row (or updates the existing one) and
sets `plcs.gateway_id` accordingly. Both the new gateway and the PLC
must exist (`404 gateway not found` / `404 plc not found`).

**Response 200:**
```json
{ "ok": true, "plc_id": "SIM_LINE_A_01", "gateway_id": "GW_LINE_A_01" }
```

### GET `/api/warnings?since=<unix_s>&target_type=gateway|plc&target_id=&include_cleared=false&limit=200`

Active warnings from the `warnings` table (default `cleared=0`).
The MQTT consumer inserts a row each time it sees a `warning` or
`critical` event. An LWT with `state=offline` from a retained status
message also produces a `GATEWAY_OFFLINE` warning on first sight.

- `since`: optional Unix seconds (default: no lower bound).
- `target_type`: optional filter on `gateway` / `plc`.
- `target_id`: optional filter on the specific id.
- `include_cleared`: when `true`, returns both active and cleared rows
  (cleared rows have `cleared != 0`).
- `limit`: 1–2000, default 200.

**Response 200:**
```json
[
  {
    "id": 1,
    "target_type": "plc",
    "target_id": "SIM_LINE_A_01",
    "code": "PLC_COMM_LOST",
    "severity": "warning",
    "message": "PLC 1 timeout",
    "cleared": 0,
    "ts": 1788546065
  }
]
```

## 7. WebSocket (`/ws`)

### WS `/ws/devices?device_id=<id1>,<id2>,...|*`
Subscribes to realtime broadcast hub. Each message is a JSON envelope matching payload spec categories (`telemetry`/`status`/`event`/`diag`). For telemetry, `registers` are pre-scaled by the existing backend pipeline.

**Auth:** not yet required for M1; future work.

## 8. Error codes

| Code | Meaning |
|---|---|
| 400 | Validation error (bad payload, enum out-of-range, etc.) |
| 401 | Missing/invalid token, bad credentials |
| 403 | Admin-only, CSRF mismatch |
| 404 | Resource not found |
| 409 | Conflict (e.g. simulator already running) |
| 413 | Export row count exceeds `EXPORT_MAX_ROWS` |

## 9. Tài liệu liên quan

- [Plan Webapp Architecture](../01_plan/plan_webapp_architecture.md)
- [Plan Data Pipeline](../01_plan/plan_data_pipeline.md)
- [ERD Postgres](../02_design/erd_postgres.md)
- [Runbook Local Dev](../04_runbook/runbook_local_dev.md)
- [Payload Spec v1](../99_attachments/payload_spec_v1.md)

## Change history

- 2026-09-05: Thêm M10 endpoints (`/api/gateways`, `/api/plcs`,
  `/api/plcs/{id}/pair`, `/api/plcs/{id}/history`, `/api/warnings`)
  vào v0.3.0.
- 2026-08-30: Initial API reference cho M1 (v0.2.0).
