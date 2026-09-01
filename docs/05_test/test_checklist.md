---
title: Test Checklist (Manual)
category: test
owner: project_lead
created: 2026-09-01
updated: 2026-09-01
status: approved
version: 1.1.0
---

# Test Checklist (Manual)

> Bảng kiểm thử thủ công cho người dùng/QA test dự án IIoT Gateway webapp (v0.9.0).
> Mỗi mục có **Pass/Fail**, **ghi chú**, và **cách verify** cụ thể.
> Tổng cộng ~70 tiêu chí, chia thành 11 nhóm chức năng.

## 0. Chuẩn bị môi trường

```bash
# Terminal 1: khởi động stack
cd /mnt/newvolume/WorkSpace/Project/DENSOFactory
cp .env.example .env
# Sửa .env: ADMIN_BOOTSTRAP_PASSWORD_HASH (dùng make hash P=admin123)
make up
sleep 30
docker compose ps  # verify 5 services Up + healthy

# Terminal 2: bật simulator (3 device)
make start-simulator

# Terminal 3: bật backend2 (multi-instance, optional)
docker compose --profile multi-instance up -d backend2

# Mở browser
open http://localhost:5173
# Login: admin / admin123
```

## 1. Auth & Session (6 tiêu chí)

| # | Tiêu chí | Pass/Fail | Cách verify | Ghi chú |
|---|---|---|---|---|
| 1.1 | Login thành công với admin/admin123 | ☐ | Sau login, redirect về `/`, TopBar hiện `admin · admin` | |
| 1.2 | Login sai password → 401 + error message | ☐ | Nhập `admin/wrong`, click Sign in, thấy "invalid credentials" | |
| 1.3 | Cookie `at`/`rt`/`csrf` được set sau login | ☐ | DevTools → Application → Cookies → thấy 3 cookie với HttpOnly/SameSite | |
| 1.4 | CSRF block mutation không có header | ☐ | DevTools Network: PUT bất kỳ → 403 "CSRF token mismatch" | |
| 1.5 | Refresh access token sau 15 phút | ☐ | Đợi 16 phút rồi click bất kỳ → vẫn hoạt động (refresh tự động) | Hoặc giảm TTL bằng env ACCESS_TOKEN_TTL_MIN=1 |
| 1.6 | Logout xóa cookies + redirect `/login` | ☐ | Click Logout → redirect, refresh không vào lại được (vì cookie xoá) | |

## 2. Overview Page (5 tiêu chí)

| # | Tiêu chí | Pass/Fail | Cách verify | Ghi chú |
|---|---|---|---|---|
| 2.1 | Hiển thị 3 device từ simulator (SIM_LINE_A_01/02, SIM_LINE_B_01) | ☐ | Overview page hiện 3 card với state=online, source=[SIM] | |
| 2.2 | Source badge rõ ràng: SIM (dashed) vs REAL (solid) | ☐ | Visual check badge màu tím vs xanh dương, border style | |
| 2.3 | State dot pulse đỏ khi chuyển sang error | ☐ | Publish status với `state=error` cho 1 device, quan sát dot pulse 0.6s | Dùng script ở mục 9 |
| 2.4 | Source filter dropdown hoạt động | ☐ | Click filter `Sim` → chỉ thấy 3 SIM; click `Real` → trống; click `All` → 3 SIM | |
| 2.5 | Auto-refresh mỗi 30s (refetch interval) | ☐ | Đợi 30s, devices list tự update nếu backend thay đổi | |

## 3. Device Detail Page (10 tiêu chí)

| # | Tiêu chí | Pass/Fail | Cách verify | Ghi chú |
|---|---|---|---|---|
| 3.1 | Click vào SIM_LINE_A_01 card → navigate `/devices/SIM_LINE_A_01` | ☐ | URL đổi, page load | |
| 3.2 | 5 tabs: Telemetry/Status/Events/Diag/Info | ☐ | Đếm tabs trên đầu trang | |
| 3.3 | Tab Telemetry: register list + Gauge + history chart | ☐ | Click tab Telemetry, chọn register `hr_100` trong list, gauge hiện giá trị, chart vẽ line | |
| 3.4 | TimeRangePicker: chọn 5m/15m/1h/6h/24h/7d/Custom | ☐ | Click từng quick range, chart refresh; mở Custom, nhập datetime, Apply | |
| 3.5 | Tab Status: state/uptime_s/reason/last update | ☐ | Click Status, thấy kv grid với 4 fields | |
| 3.6 | Tab Events: list 100 event gần nhất | ☐ | Click Events, thấy bảng với time/severity/code/device/message | |
| 3.7 | Tab Diag: latest diag row từ Postgres | ☐ | Click Diag (nếu simulator publish diag — hiện chưa có, có thể trống) | Optional: skip nếu simulator không gửi diag |
| 3.8 | Tab Info: placeholder "Waiting for info publish" | ☐ | Click Info, thấy message này | |
| 3.9 | Gauge update real-time qua WebSocket | ☐ | Trong tab Telemetry, quan sát gauge value thay đổi mỗi 2s khi simulator publish | |
| 3.10 | Chart zoom (wheel) + pan (drag) | ☐ | Trong chart history, scroll chuột để zoom, kéo để pan | |

## 4. Events Page (8 tiêu chí)

| # | Tiêu chí | Pass/Fail | Cách verify | Ghi chú |
|---|---|---|---|---|
| 4.1 | Hiển thị event trong 24h gần nhất | ☐ | `/events` page, thấy bảng với events từ simulator | |
| 4.2 | Filter severity: All/Critical/Warning/Info | ☐ | Click từng button, bảng filter theo | |
| 4.3 | Filter code multi-select (13 codes) | ☐ | Click 1-2 chip code, bảng filter | |
| 4.4 | Filter device_id dropdown | ☐ | Dropdown list devices, chọn 1 device, bảng filter | |
| 4.5 | TimeRangePicker với 5m/15m/1h/6h/24h/7d | ☐ | Quick range thay đổi kết quả | |
| 4.6 | Pagination Prev/Next | ☐ | Click Next, trang 2 hiện ra | |
| 4.7 | Severity chip màu: critical=red, warning=orange, info=blue | ☐ | Visual check | |
| 4.8 | Auto-refetch mỗi 15s | ☐ | Background refetch, danh sách cập nhật | |

## 5. Diagnostics Page (4 tiêu chí)

| # | Tiêu chí | Pass/Fail | Cách verify | Ghi chú |
|---|---|---|---|---|
| 5.1 | Hiển thị bảng diag per-device | ☐ | `/diagnostics`, thấy bảng với columns Device/Last diag/Poll/TX ok/TX fail/Latency/Uptime | |
| 5.2 | Click row → history panel mở rộng | ☐ | Click 1 row, panel dưới hiển thị lịch sử diag | |
| 5.3 | Empty state khi chưa có diag data | ☐ | Nếu chưa có diag publish, thấy message "No diag data yet" | |
| 5.4 | Auto-refresh mỗi 60s | ☐ | Background refetch | |

## 6. Settings Page (12 tiêu chí)

| # | Tiêu chí | Pass/Fail | Cách verify | Ghi chú |
|---|---|---|---|---|
| 6.1 | Settings chỉ accessible bởi admin | ☐ | Login as viewer (nếu có) → `/settings` redirect về `/` | Hoặc đổi role admin→viewer trong DB, login, thử `/settings` |
| 6.2 | Panel Simulator Service: Start/Stop button | ☐ | Click Start → status RUNNING (xanh); click Stop → STOPPED (xám) | |
| 6.3 | Panel Source Mapping: list mappings | ☐ | Bảng hiển thị device_id/source/updated; empty nếu chưa có | |
| 6.4 | Add mapping mới | ☐ | Nhập DEVICE_ID, chọn source, click Add → bảng refresh | |
| 6.5 | Remove mapping | ☐ | Click Remove → row biến mất | |
| 6.6 | User Management: list users | ☐ | Bảng hiển thị admin (1 user) | |
| 6.7 | Create user mới | ☐ | Nhập username/password/role → Add → user mới trong bảng | |
| 6.8 | Change role inline (dropdown) | ☐ | Chọn role mới từ dropdown → tự động update | |
| 6.9 | Set password inline | ☐ | Click Set password → nhập new → Save | |
| 6.10 | Cannot demote/delete self | ☐ | Dropdown admin của mình bị disabled; không có nút Delete trên row của mình | |
| 6.11 | Export panel: 3 cards (telemetry/events/diag) | ☐ | Thấy 3 cards, mỗi card có nút Download CSV/XLSX | |
| 6.12 | Download file thực sự | ☐ | Click Download telemetry → file CSV tải về, mở được bằng Excel | |

## 7. Toast & Sound (4 tiêu chí)

| # | Tiêu chí | Pass/Fail | Cách verify | Ghi chú |
|---|---|---|---|---|
| 7.1 | Toast xuất hiện ở top-right khi critical event | ☐ | Publish event critical qua MQTT (xem mục 9), toast hiện ở góc phải trên | |
| 7.2 | Toast critical KHÔNG tự động dismiss | ☐ | Sau 10s, toast vẫn còn | Manual close bằng nút × |
| 7.3 | Group rule: cùng (device_id, code) → count++ | ☐ | Publish 3 lần cùng event → 1 toast với "×3" | |
| 7.4 | Sound toggle button (🔇/🔊) trong TopBar | ☐ | Click → icon đổi; persist localStorage | Sound chỉ chạy sau 1 user click đầu (browser autoplay policy) |

## 8. Dark/Light Mode (3 tiêu chí)

| # | Tiêu chí | Pass/Fail | Cách verify | Ghi chú |
|---|---|---|---|---|
| 8.1 | Toggle button trong TopBar (Dark/Light) | ☐ | Click, theme đổi tức thì | |
| 8.2 | Persist localStorage | ☐ | Reload trang, theme giữ nguyên | |
| 8.3 | Mọi component render đúng trong cả 2 mode | ☐ | Overview, DeviceDetail, Settings, Toasts — check contrast, readability | |

## 9. Pipeline MQTT end-to-end (5 tiêu chí)

```bash
# Script publish qua MQTT (chạy trong container backend)
docker compose exec backend python <<'PYEOF'
import paho.mqtt.client as mqtt
import json, time
c = mqtt.Client()
c.connect('emqx', 1883, 60)

# 9.1: status online
c.publish('devices/TEST_PIPE_01/status', json.dumps({
    'device_id':'TEST_PIPE_01','ts':int(time.time()),'type':'status',
    'state':'online','uptime_s':10
}), qos=1, retain=True)

# 9.2: telemetry
c.publish('devices/TEST_PIPE_01/telemetry', json.dumps({
    'device_id':'TEST_PIPE_01','ts':int(time.time()),'type':'telemetry',
    'seq':1,'registers':{'hr_100':352,'co_0':True}
}), qos=1)

# 9.3: event critical
c.publish('devices/TEST_PIPE_01/event', json.dumps({
    'device_id':'TEST_PIPE_01','ts':int(time.time()),'type':'event',
    'events':[{'code':'SLAVE_COMM_LOST','severity':'critical','message':'Slave 3 timeout','source':'slave:3'}]
}), qos=1)

c.disconnect()
print('published 3 messages')
PYEOF
```

| # | Tiêu chí | Pass/Fail | Cách verify | Ghi chú |
|---|---|---|---|---|
| 9.1 | Status update → device mới hiện trong Overview | ☐ | Sau publish, refresh `/`, thấy `TEST_PIPE_01` với state=online | |
| 9.2 | Telemetry → history chart có data point mới | ☐ | Mở `/devices/TEST_PIPE_01`, tab Telemetry, chọn hr_100, chart có point mới | |
| 9.3 | Event critical → toast xuất hiện | ☐ | Sau publish event, toast ở góc phải | |
| 9.4 | Event vào database | ☐ | `docker compose exec postgres psql -U iigw -d iigw -c "SELECT count(*) FROM device_event;"` (qua InfluxDB) | Hoặc check Events page |
| 9.5 | Telemetry vào InfluxDB | ☐ | `docker compose exec influxdb influx query 'from(bucket:"telemetry") |> range(start:-1m) |> filter(fn: (r) => r._measurement == "device_telemetry") |> count()'` | |

## 10. Multi-instance (M9) (3 tiêu chí)

| # | Tiêu chí | Pass/Fail | Cách verify | Ghi chú |
|---|---|---|---|---|
| 10.1 | Backend2 start qua profile | ☐ | `docker compose --profile multi-instance up -d backend2` → iigw-backend2-1 Up | |
| 10.2 | Cross-instance WS broadcast qua Redis | ☐ | Run script M9-TC2 trong test_report_m9.md; backend1 publish, backend2 WS nhận | |
| 10.3 | Rate limit shared (5/min/IP) | ☐ | Login sai 5 lần backend1 → 429; thử backend2 (cùng IP) → 429 | |

## 11. Negative tests (3 tiêu chí)

| # | Tiêu chí | Pass/Fail | Cách verify | Ghi chú |
|---|---|---|---|---|
| 11.1 | Payload sai key format (`temperature: 30`) bị drop | ☐ | Publish, check backend log: "schema validation failed ... drop" | |
| 11.2 | Payload `reason: null` bị drop | ☐ | Publish status với reason: null, log warning | |
| 11.3 | Code event ngoài enum (vd `FAKE_CODE`) bị drop | ☐ | Publish, log "schema validation failed" | |

---

## Cách chấm điểm

- **Tất cả 70+ tiêu chí Pass** = release ready.
- **1-5 tiêu chí Fail** = cần fix minor, OK để merge.
- **>5 tiêu chí Fail** = cần review + fix blocker trước khi release tiếp.

## Tự động hoá

```bash
# Chạy smoke test tự động (~30s, 15 checks)
bash scripts/quick_smoke.sh

# Chạy unit tests (25 tests, ~10s)
docker compose exec backend python -m pytest tests/
```

**Smoke test bao gồm:**
- 6 services Docker healthy (postgres, influxdb, emqx, redis, backend, webapp)
- Backend health (GET /healthz, /docs Swagger UI)
- Webapp serve (port 5173)
- Auth flow (login 200, /auth/me 200)
- Devices API (≥1 device từ simulator)
- 25/25 unit tests
- Negative payload (key sai) bị drop với log
- MQTT pipeline (status + telemetry publish → InfluxDB ghi)

## Báo cáo

Khi test xong, ghi kết quả vào `docs/05_test/test_run_<date>.md` với format:
- Tổng số Pass/Fail/Skip
- Danh sách Fail với root cause
- Decision: ship / fix / block

## Change history

- 2026-09-01: Test Checklist v1.0.0 — 70+ tiêu chí manual test cho v0.9.0.
- 2026-09-01: Bump v1.1.0 — link `scripts/quick_smoke.sh` (15 checks tự động).
