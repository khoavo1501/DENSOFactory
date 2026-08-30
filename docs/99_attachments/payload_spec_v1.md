# SPEC PAYLOAD: Dữ liệu Master gửi lên Server (Protocol v1)

> Tài liệu tham chiếu chi tiết về **định dạng payload** mà master (STM32 + W5500) publish lên broker MQTT.
> Phạm vi: payload + quy tắc validate. Về kết nối MQTT, topic, QoS, boot sequence xem `docs/master_integration_spec.md`.
> Nguồn chân lý duy nhất về schema: `backend/master_protocol_v1.json` (JSON Schema draft 2020-12).
> Implementation mẫu đầy đủ: `simulator/simulator.py`.
> Đối tượng: lập trình viên firmware master và lập trình viên backend/server.

---

## Mục lục

1. [Quy ước chung](#1-quy-ước-chung)
2. [telemetry](#2-telemetry--devicesidtelemetry)
3. [status](#3-status--devicesidstatus)
4. [event](#4-event--devicesidevent)
5. [info](#5-info--devicesidinfo)
6. [diag](#6-diag--devicesiddiag)
7. [Validation & hành vi server](#7-validation--hành-vi-server)
8. [Giới hạn & ngân sách khuyến nghị](#8-giới-hạn--ngân-sách-khuyến-nghị)
9. [Tự test payload](#9-tự-test-payload)

---

## 1. Quy ước chung

- Payload là **một đối tượng JSON duy nhất**, mã hóa **UTF-8**, không nén. Khuyến nghị dạng compact (không xuống dòng/thụt lề) để tiết kiệm băng thông.
- Mọi message đều nằm trong **envelope chung** (xem 1.1). Các trường không định nghĩa trong schema sẽ bị backend **bỏ qua**, nhưng **không khuyến khích** gửi để giữ tương thích về sau.
- File schema được backend **đọc lại ở mỗi message** (`backend/app/mqtt_consumer.py:validate_payload`) → sửa `master_protocol_v1.json` (volume mount) có hiệu lực **ngay**, không cần restart backend.

### 1.1 Envelope (BẮT BUỘC trong mọi message)

| Trường | Kiểu | Bắt buộc | Ràng buộc | Mô tả |
|---|---|---|---|---|
| `device_id` | string | ✅ | regex `^[A-Za-z0-9_-]{1,64}$` | ID duy nhất của master. Phải **khớp chính xác** với phần `{device_id}` trong topic |
| `ts` | integer | ✅ | ≥ 0 | Unix timestamp **giây, UTC**. Sync bằng NTP/RTC. Chỉ chấp nhận `0` cho payload LWT (server tự thay bằng thời điểm nhận) |
| `type` | string | ✅ | enum: `telemetry` \| `status` \| `event` \| `info` \| `diag` | Phải **trùng với category trên topic** |

```json
{
  "device_id": "GW_LINE_A_01",
  "ts": 1692816000,
  "type": "telemetry"
}
```

### 1.2 Bảng tổng hợp publish (tham chiếu nhanh)

| Category | Topic | Khi nào | QoS | Retain |
|---|---|---|---|---|
| `info` | `devices/{id}/info` | 1 lần ngay sau connect | 1 | **true** |
| `status` | `devices/{id}/status` | Ngay sau connect + mỗi 30–60s | 1 | **true** |
| `telemetry` | `devices/{id}/telemetry` | Đều đặn 1–5s | 1 | false |
| `event` | `devices/{id}/event` | Ngay khi có sự kiện | 1 | false |
| `diag` | `devices/{id}/diag` | 5–15 phút | 0 | false |

---

## 2. telemetry → `devices/{id}/telemetry`

Dữ liệu cảm biến/tiến trình đọc từ các Modbus slave, publish đều đặn.

```json
{
  "device_id": "GW_LINE_A_01",
  "ts": 1692816000,
  "type": "telemetry",
  "seq": 12345,
  "fw": "1.0.3",
  "registers": {
    "hr_100": 352,
    "hr_101": 315,
    "hr_102": 1450,
    "ir_200": 1234,
    "co_0": true,
    "di_300": false
  }
}
```

### 2.1 Các trường

| Trường | Kiểu | Bắt buộc | Ràng buộc | Mô tả |
|---|---|---|---|---|
| `seq` | integer | ❌ | 0 – 4294967295 | Số thứ tự tăng đơn điệu +1 mỗi lần publish, **wrap về 0 tại 2^32−1**. Server dùng phát hiện mất gói |
| `fw` | string | ❌ | pattern `^[0-9]+\.[0-9]+\.[0-9]+` (prefix semver) | Phiên bản firmware, phục vụ debug |
| `registers` | object | ✅ | **1 – 200 key**, không được có key ngoài pattern | Map tên register → giá trị raw |

### 2.2 Key register

Key có dạng `{loại}_{địa_chỉ_decimal}`:

| Prefix | Ý nghĩa | Function Code | Kiểu giá trị |
|---|---|---|---|
| `hr_N` | Holding Register | FC03 (0x03) | integer `0 – 4294967295` **hoặc** boolean |
| `ir_N` | Input Register | FC04 (0x04) | integer `0 – 4294967295` **hoặc** boolean |
| `co_N` | Coil | FC01 (0x01) | boolean |
| `di_N` | Discrete Input | FC02 (0x02) | boolean |

Quy tắc giá trị:

1. **Chỉ đẩy giá trị raw** (chưa nhân scale). Ví dụ nhiệt độ 35.2°C với scale 0.1 → đẩy `352`. Việc nhân scale/unit theo `backend/profiles/devices.yaml` là việc của **server**.
2. Register **32-bit**: ghép từ 2 địa chỉ liên tiếp, **low-word first** (word thấp trước), đẩy thành 1 giá trị integer 0–4294967295.
3. Sai key format (vd. `"temperature": 30`) hoặc vượt 200 key → **toàn bộ message bị drop**.
4. `registers` rỗng (0 key) → drop.

### 2.3 Lỗi thường gặp

| Sai | Đúng |
|---|---|
| `"hr_100": 35.2` (float đã scale) | `"hr_100": 352` (raw, server nhân scale 0.1) |
| `"temp_1": 300` (key sai pattern) | `"hr_100": 300` |
| `"co_0": 1` (coil kiểu số) | `"co_0": true` |
| 250 key trong `registers` | Chia nhỏ, ≤200 key/message |

---

## 3. status → `devices/{id}/status`

Heartbeat + trạng thái master. Cũng là payload của **LWT**.

```json
{
  "device_id": "GW_LINE_A_01",
  "ts": 1692816000,
  "type": "status",
  "state": "online",
  "uptime_s": 3600
}
```

### 3.1 Các trường

| Trường | Kiểu | Bắt buộc | Ràng buộc | Mô tả |
|---|---|---|---|---|
| `state` | string | ✅ | enum: `online` \| `offline` \| `error` \| `degraded` | Trạng thái master |
| `uptime_s` | integer | ❌ | ≥ 0 | Số giây kể từ lần reset gần nhất. Thiếu → server coi là 0 |
| `reason` | string | ❌ | ≤ 256 ký tự | Lý do/mô tả thêm |

Ý nghĩa `state`:

| Giá trị | Ý nghĩa |
|---|---|
| `online` | Hoạt động bình thường |
| `degraded` | Chức năng một phần (ví dụ một số slave không reachable) |
| `error` | Master có lỗi |
| `offline` | **Chỉ dùng cho LWT hoặc shutdown có kiểm soát** |

### 3.2 Payload LWT (đặc biệt)

Đăng ký lúc connect, broker tự publish khi master mất kết nối đột ngột:

```json
{
  "device_id": "GW_LINE_A_01",
  "ts": 0,
  "type": "status",
  "state": "offline",
  "reason": "unexpected_disconnect"
}
```

- `ts = 0` là **hợp lệ riêng cho LWT** — server thay bằng thời điểm nhận.
- QoS 1, retain=true.

### 3.3 Lưu ý quan trọng

> ⚠️ **Không gửi `"reason": null`.** Schema yêu cầu `reason` là string; giá trị `null` sẽ fail validation và toàn bộ message bị drop. Nếu không có lý do → **omit hẳn trường này**.

Khi tắt đúng cách (shutdown có kiểm soát): publish `status offline` (kèm `reason` mô tả, vd. `"planned_shutdown"`) trước khi disconnect.

---

## 4. event → `devices/{id}/event`

Thông báo theo sự kiện (cảnh báo, lỗi, thay đổi trạng thái). Publish **ngay khi phát hiện**, gộp tối đa 50 sự kiện/message.

```json
{
  "device_id": "GW_LINE_A_01",
  "ts": 1692816000,
  "type": "event",
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

### 4.1 Cấu trúc

| Trường | Kiểu | Bắt buộc | Ràng buộc | Mô tả |
|---|---|---|---|---|
| `events` | array | ✅ | **1 – 50 phần tử** | Danh sách sự kiện |

Mỗi phần tử trong `events[]`:

| Trường | Kiểu | Bắt buộc | Ràng buộc | Mô tả |
|---|---|---|---|---|
| `code` | string | ✅ | **enum đóng** — xem bảng 4.2 | Mã sự kiện |
| `severity` | string | ✅ | enum: `info` \| `warning` \| `critical` | Mức độ |
| `message` | string | ❌ | ≤ 256 ký tự | Mô tả dễ đọc cho người |
| `source` | string | ❌ | ≤ 64 ký tự | Nguồn gốc, vd. `slave:3`, `sensor:temperature` |
| `context` | object | ❌ | object tự do key-value | Thông tin bổ sung, vd. `{"value": 95.2}` |

> ⚠️ **Không gửi `"context": null`.** Nếu không có dữ liệu bổ sung → **omit** trường này (`null` fail validation, drop cả message).

### 4.2 Bảng mã sự kiện (enum v1 — tập đóng)

Trong v1, `code` là **enum đóng**: code ngoài danh sách dưới đây → message bị drop. Muốn thêm code mới phải cập nhật `backend/master_protocol_v1.json` trước khi firmware đưa vào dùng.

| Code | Severity khuyến nghị | Ý nghĩa |
|---|---|---|
| `SLAVE_COMM_LOST` | critical | Mất giao tiếp với một slave |
| `SLAVE_COMM_RESTORED` | info | Khôi phục giao tiếp với slave |
| `VALUE_OUT_OF_RANGE` | warning | Giá trị vượt ngưỡng cấu hình |
| `SENSOR_FAULT` | warning | Cảm báo bất thường/không phản hồi |
| `EMERGENCY_STOP` | critical | Nhấn nút dừng khẩn |
| `FIRMWARE_UPDATE_START` | info | Bắt đầu cập nhật firmware |
| `FIRMWARE_UPDATE_END` | info | Kết thúc cập nhật firmware |
| `CONFIG_CHANGED` | info | Cấu hình master thay đổi |
| `MASTER_REBOOT` | warning | Master tự reboot |
| `BUFFER_OVERFLOW` | warning | Buffer offline đầy, dữ liệu bị drop |
| `WATCHDOG_RESET` | critical | Reset bởi watchdog |
| `POWER_ON` | info | just powered on |
| `W5500_LINK_DOWN` | critical | Mất link Ethernet vật lý |
| `W5500_LINK_UP` | info | Có lại link Ethernet |
| `MQTT_DISCONNECTED` | warning | Mất kết nối broker |
| `MQTT_RECONNECTED` | info | Kết nối lại broker thành công |

Server **lưu** `code`, `severity`, `message` vào InfluxDB; `source`, `context` chỉ dùng broadcast WebSocket thời gian thực.

---

## 5. info → `devices/{id}/info`

Danh tính & năng lực của master. Publish **1 lần ngay sau connect**, retain=true. Server chỉ **ghi log**, không lưu DB.

```json
{
  "device_id": "GW_LINE_A_01",
  "ts": 1692816000,
  "type": "info",
  "master": {
    "fw_version": "1.0.3",
    "hw_version": "STM32F103C8",
    "ip": "10.0.0.55",
    "mac": "AA:BB:CC:DD:EE:FF",
    "free_heap": 18432,
    "cpu_temp": 42.5,
    "reset_reason": "POWER_ON",
    "slaves": [
      { "id": 1, "addr": 1, "name": "PLC_line_A" }
    ]
  }
}
```

### 5.1 Object `master`

| Trường | Kiểu | Bắt buộc | Ràng buộc | Mô tả |
|---|---|---|---|---|
| `fw_version` | string | ✅ | semver chặt: `X.Y.Z` (+ prerelease/build tuỳ chọn), vd. `1.0.3-beta.2` | Phiên bản firmware |
| `hw_version` | string | ✅ | ≤ 32 ký tự | Phiên bản phần cứng, vd. `PCB_v2` |
| `ip` | string | ❌ | IPv4 | Địa chỉ IP hiện tại (DHCP/static) |
| `mac` | string | ❌ | pattern `AA:BB:CC:DD:EE:FF` | MAC của W5500 |
| `rssi` | integer | ❌ | −120 – 0 (dBm) | WiFi RSSI; bỏ qua nếu chỉ dùng Ethernet |
| `free_heap` | integer | ❌ | ≥ 0 | RAM còn trống (bytes) |
| `cpu_temp` | number | ❌ | −40 – 125 (°C) | Nhiệt độ MCU |
| `reset_reason` | string | ❌ | enum: `POWER_ON` \| `WATCHDOG` \| `SOFT` \| `HARDWARE` \| `BROWN_OUT` \| `UNKNOWN` | Lý do reset gần nhất |
| `slaves` | array | ❌ | — | Danh sách slave đang được poll (tham khảo, server không phụ thuộc để parse telemetry) |

Phần tử `slaves[]`: `id` (integer 1–247, bắt buộc), `addr` (integer 1–247, bắt buộc), `name` (string, tuỳ chọn).

---

## 6. diag → `devices/{id}/diag`

Thống kê vận hành định kỳ (5–15 phút/lần). Optional nhưng **nên có** để giám sát sức khoẻ master. QoS 0. Server chỉ **ghi log**, không lưu DB.

```json
{
  "device_id": "GW_LINE_A_01",
  "ts": 1692816000,
  "type": "diag",
  "stats": {
    "poll_cycle_ms": 120,
    "uptime_s": 86400,
    "slaves": [
      { "id": 1, "addr": 1, "ok": 5000, "fail": 2, "last_ok_ts": 1692815900, "avg_latency_ms": 12.5 }
    ],
    "tx_packets": 43200,
    "tx_failures": 3,
    "mqtt_reconnect": 1,
    "avg_latency_ms": 10.2
  }
}
```

### 6.1 Object `stats`

| Trường | Kiểu | Bắt buộc | Ràng buộc | Mô tả |
|---|---|---|---|---|
| `poll_cycle_ms` | integer | ✅ | ≥ 0 | Thời gian hoàn thành 1 vòng poll tất cả slave (ms) |
| `uptime_s` | integer | ❌ | ≥ 0 | Uptime |
| `slaves` | array | ✅ | — | Thống kê theo từng slave |
| `tx_packets` | integer | ❌ | ≥ 0 | Tổng packet MQTT gửi thành công từ boot |
| `tx_failures` | integer | ❌ | ≥ 0 | Tổng lần gửi thất bại từ boot |
| `mqtt_reconnect` | integer | ❌ | ≥ 0 | Số lần reconnect MQTT từ boot |
| `avg_latency_ms` | number | ❌ | ≥ 0 | Latency trung bình round-trip tới broker (ms) |

Phần tử `slaves[]`:

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | integer 1–247 | ✅ | Slave ID |
| `addr` | integer 1–247 | ✅ | Địa chỉ Modbus |
| `ok` | integer ≥ 0 | ✅ | Số lần poll thành công từ boot |
| `fail` | integer ≥ 0 | ✅ | Số lần poll thất bại từ boot |
| `last_ok_ts` | integer ≥ 0 | ❌ | Lần poll thành công cuối (Unix s) |
| `avg_latency_ms` | number ≥ 0 | ❌ | Latency poll trung bình |

---

## 7. Validation & hành vi server

### 7.1 Pipeline xử lý một message (`backend/app/mqtt_consumer.py`)

```
Nhận message → parse topic (devices/{device_id}/{category})
            → parse JSON
            → validate schema (master_protocol_v1.json)
            → dispatch theo CATEGORY TRÊN TOPIC
```

Bảng lỗi → kết quả (server **DROP im lặng**, chỉ log):

| # | Lỗi | Kết quả |
|---|---|---|
| 1 | Topic sai mẫu `devices/{device_id}/{category}` | Bỏ qua |
| 2 | JSON không parse được | Drop + log error |
| 3 | Fail schema (thiếu envelope, sai enum, sai pattern, vượt min/max…) | Drop + log warning |
| 4 | `type` ≠ category trên topic | ⚠️ Schema vẫn pass (validate chung oneOf) nhưng backend xử lý theo **category của topic** → dữ liệu rơi vào nhầm chỗ hoặc bị bỏ qua. **Luôn đảm bảo `type` khớp topic** |

Xem log backend: `docker compose logs -f backend`.

### 7.2 Server làm gì với từng category

| Category | InfluxDB measurement | Tags | Fields | WebSocket |
|---|---|---|---|---|
| `telemetry` | `device_telemetry` (mỗi register 1 point) | `device_id`, `register` | `value` (bool giữ bool, số → float; kiểu khác bị bỏ qua) | Broadcast kèm giá trị semantic (đã scale theo `profiles/devices.yaml`) |
| `status` | `device_status` | `device_id`, `state` | `uptime_s` | Broadcast |
| `event` | `device_event` (mỗi event 1 point) | `device_id`, `event_code`, `severity` | `message` | Broadcast (gồm `source`, `context`) |
| `info` | — (chỉ log `fw_version`) | — | — | — |
| `diag` | — (chỉ log) | — | — | — |

---

## 8. Giới hạn & ngân sách khuyến nghị

Giá trị cứng theo schema in đậm; còn lại là khuyến nghị vận hành:

| Hạng mục | Giới hạn |
|---|---|
| Số key `registers`/message | **1 – 200** (cứng) |
| Số `events`/message | **1 – 50** (cứng) |
| `device_id` | **≤ 64 ký tự, `[A-Za-z0-9_-]`** (cứng) |
| `message` event, `reason` status | **≤ 256 ký tự** (cứng) |
| Kích thước 1 message telemetry | ≤ ~8 KB (200 key × ~25 byte ≈ 5 KB) |
| Tần suất telemetry | 1–5 s (demo: 1–2 s) |
| Heartbeat `status` | 30–60 s |
| `diag` | 5–15 phút |
| Max packet MQTT (EMQX default) | 1 MB — không bao giờ nên chạm tới |

---

## 9. Tự test payload

```bash
# 1. Publish thử telemetry thay cho firmware
docker run --rm --network mvp_default eclipse-mosquitto \
  mosquitto_pub -h emqx -p 1883 -t "devices/TEST_01/telemetry" \
  -m '{"device_id":"TEST_01","ts":'"$(date +%s)"',"type":"telemetry","seq":1,"registers":{"hr_100":352}}'

# 2. Publish thử event
docker run --rm --network mvp_default eclipse-mosquitto \
  mosquitto_pub -h emqx -p 1883 -t "devices/TEST_01/event" \
  -m '{"device_id":"TEST_01","ts":'"$(date +%s)"',"type":"event","events":[{"code":"POWER_ON","severity":"info"}]}'

# 3. Publish thử status (CHÚ Ý: không có "reason":null)
docker run --rm --network mvp_default eclipse-mosquitto \
  mosquitto_pub -h emqx -p 1883 -t "devices/TEST_01/status" \
  -m '{"device_id":"TEST_01","ts":'"$(date +%s)"',"type":"status","state":"online","uptime_s":0}'

# 4. Kiểm tra dữ liệu đã vào chưa
curl http://localhost:8000/api/devices
curl http://localhost:8000/api/devices/TEST_01/latest

# 5. Negative test — key register sai format, phải thấy log drop ở backend
docker run --rm --network mvp_default eclipse-mosquitto \
  mosquitto_pub -h emqx -p 1883 -t "devices/TEST_02/telemetry" \
  -m '{"device_id":"TEST_02","ts":'"$(date +%s)"',"type":"telemetry","registers":{"temperature":30}}'
docker compose logs -f backend   # tìm dòng "Schema validation failed"
```

Device xuất hiện ở API/dashboard trong vài giây = payload hợp lệ.

---

*Phiên bản protocol: v1.0 — thay đổi format cần đồng bộ cả hai bên (firmware ↔ server) trước khi deploy.*
*Nguồn tham chiếu: `backend/master_protocol_v1.json` (schema), `simulator/simulator.py` (implementation mẫu), `docs/master_integration_spec.md` (kết nối & boot sequence).*
