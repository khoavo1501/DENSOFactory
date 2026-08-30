---
title: Plan Data Pipeline
category: plan
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 0.1.0
---

# Plan Data Pipeline

## 1. Sơ đồ luồng dữ liệu

```
┌──────────────────────┐         ┌──────────────────────┐
│  Source: SIMULATION  │         │   Source: REAL/PROD  │
│  simulator.py        │         │  STM32 + W5500       │
│  (Docker container)  │         │  (field device)      │
└──────────┬───────────┘         └──────────┬───────────┘
           │ publish per payload spec       │ publish devices/{id}/...
           ▼                                ▼
 ┌──────────────────────────────────────────────────┐
 │        MQTT Broker (EMQX)                         │
 │   topic: devices/{device_id}/{category}            │
 └─────────────────────┬────────────────────────────┘
                       │
                       ▼
 ┌──────────────────────────────────────────────────┐
 │ backend/app/mqtt_consumer.py                      │
 │  - parse topic                                     │
 │  - validate per master_protocol_v1.json            │
 │  - dispatch by TOPIC category                      │
 └─────────────────────┬────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  InfluxDB    │ │ Postgres     │ │  Log only    │
│ device_tele  │ │ device_diag  │ │  info/diag   │
│ device_status│ │ device_sources│ │  (info)     │
│ device_event │ │ users        │ │              │
│              │ │ audit_log    │ │              │
│              │ │ revoked_rt   │ │              │
└──────┬───────┘ └──────┬───────┘ └──────────────┘
       │                │
       ▼                ▼
   ┌────────────────────────────────────────────┐
   │ Webapp (SPA)                               │
   │   REST API + WebSocket                     │
   │   Source Mapping Service                   │
   │   device_id ↔ {real | simulated}           │
   └────────────────────────────────────────────┘
```

## 2. Nguyên tắc schema

- **Không sửa payload gốc.** [Payload Spec v1](../99_attachments/payload_spec_v1.md) định nghĩa envelope `{device_id, ts, type}` và KHÔNG có trường `source`.
- Nguồn dữ liệu được xác định **phía backend/webapp** từ mapping `device_id ↔ source`, không nằm trong payload.

## 3. Cơ chế Switch nguồn — Phương án C (chốt)

### 3.1 Thành phần
- **Bảng `device_sources` (Postgres)**: mapping `device_id → source` (override pattern).
- **Pattern inference (fallback)**:
  - `real`: `^[A-Z]+_[A-Z]+_[0-9]+$` (vd. `GW_LINE_A_01`)
  - `simulated`: `^SIM_[A-Za-z0-9_-]{1,58}$` (vd. `SIM_LINE_A_01`)
- **API toggle Simulator Service**: `POST /api/admin/simulator/{start|stop|status}`.
- **WebSocket broadcast `source_changed`**: khi admin đổi mapping, các client subscribe để cập nhật badge tức thì.

### 3.2 Thứ tự ưu tiên xác định nguồn
1. Có entry trong `device_sources` → lấy theo mapping (đè pattern).
2. Không có → suy ra từ pattern.
3. Không match → mặc định `real`, kèm log warning.

### 3.3 Validation
- Nếu `device_id` thuộc source khác với mapping → **reject + log warning + drop** (tránh trộn dữ liệu).

## 4. Mapping rules chi tiết

| Field | Type | Source | Notes |
|---|---|---|---|
| `device_id` | string | `device_id` trong payload | regex `^[A-Za-z0-9_-]{1,64}$` |
| `source` | enum | derived | `"simulated"` \| `"real"` |
| `state` | enum | `status.state` | `online` \| `offline` \| `error` \| `degraded` |
| `severity` | enum | `event.severity` | `info` \| `warning` \| `critical` |
| `code` | enum | `event.code` | theo spec mục 4.2 |
| `ts` | integer (Unix s) | `ts` trong payload | LWT dùng `ts=0`, server thay bằng thời điểm nhận |

## 5. WebSocket message format

### 5.1 Telemetry
```json
{
  "type": "telemetry",
  "device_id": "GW_LINE_A_01",
  "ts": 1692816000,
  "seq": 12345,
  "registers": {
    "hr_100": { "raw": 352, "value": 35.2, "unit": "°C" },
    "co_0":   { "raw": true, "value": true, "unit": null }
  }
}
```
*Backend đã scale theo `profiles/devices.yaml`.*

### 5.2 Status
```json
{
  "type": "status",
  "device_id": "GW_LINE_A_01",
  "ts": 1692816000,
  "state": "online",
  "uptime_s": 3600,
  "reason": "planned_shutdown"
}
```

### 5.3 Event
```json
{
  "type": "event",
  "device_id": "GW_LINE_A_01",
  "ts": 1692816000,
  "events": [
    {
      "code": "SLAVE_COMM_LOST",
      "severity": "critical",
      "message": "Slave 3 timeout after 3 retries",
      "source": "slave:3",
      "context": { "last_seen_ts": 1692815900, "retries": 3 }
    }
  ]
}
```

## 6. Channel & topic

- WebSocket endpoint: `ws://<host>/ws/devices?device_id=<id1>,<id2>,...` (hoặc `*` để subscribe tất cả).
- MQTT topic pattern (theo spec mục 1.2):
  - `info`: `devices/{id}/info`, QoS 1, retain true
  - `status`: `devices/{id}/status`, QoS 1, retain true
  - `telemetry`: `devices/{id}/telemetry`, QoS 1, retain false
  - `event`: `devices/{id}/event`, QoS 1, retain false
  - `diag`: `devices/{id}/diag`, QoS 0, retain false

## 7. Tài liệu liên quan

- [Plan Overview](./plan_overview.md)
- [Plan Webapp Architecture](./plan_webapp_architecture.md)
- [Payload Spec v1](../99_attachments/payload_spec_v1.md)

## Change history

- 2026-08-30: Tạo plan_data_pipeline.md (M0).
