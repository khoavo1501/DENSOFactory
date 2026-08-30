---
title: API Reference
category: api
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 0.2.0
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

### GET `/api/events?device_id=&severity=critical,warning&code=SLAVE_COMM_LOST&from=&to=&page=1&page_size=50`
Filterable event feed.
- `severity`: comma-separated subset of `info|warning|critical`.
- `code`: comma-separated subset of [enum đóng](../../99_attachments/payload_spec_v1.md#4-event--devicesidevent).
- `from`, `to`: Unix seconds, required.
- `page_size`: 1–200, default 50.

**Response 200:** `[{ts, code, severity, message, device_id}]`

### GET `/api/events/summary?window=24h`
Count events grouped by `(severity, event_code)`.
- `window`: regex `\d+[mhd]`, default `24h`.

**Response 200:** `{"critical": {"SLAVE_COMM_LOST": 3}, "warning": {...}}`

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

## 6. WebSocket (`/ws`)

### WS `/ws/devices?device_id=<id1>,<id2>,...|*`
Subscribes to realtime broadcast hub. Each message is a JSON envelope matching payload spec categories (`telemetry`/`status`/`event`/`diag`). For telemetry, `registers` are pre-scaled by the existing backend pipeline.

**Auth:** not yet required for M1; future work.

## 7. Error codes

| Code | Meaning |
|---|---|
| 400 | Validation error (bad payload, enum out-of-range, etc.) |
| 401 | Missing/invalid token, bad credentials |
| 403 | Admin-only, CSRF mismatch |
| 404 | Resource not found |
| 409 | Conflict (e.g. simulator already running) |
| 413 | Export row count exceeds `EXPORT_MAX_ROWS` |

## 8. Tài liệu liên quan

- [Plan Webapp Architecture](../01_plan/plan_webapp_architecture.md)
- [Plan Data Pipeline](../01_plan/plan_data_pipeline.md)
- [ERD Postgres](../02_design/erd_postgres.md)
- [Runbook Local Dev](../04_runbook/runbook_local_dev.md)
- [Payload Spec v1](../99_attachments/payload_spec_v1.md)

## Change history

- 2026-08-30: Initial API reference cho M1 (v0.2.0).
