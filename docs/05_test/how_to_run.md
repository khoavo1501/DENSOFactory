---
title: How to Run the Project
category: test
owner: project_lead
created: 2026-09-01
updated: 2026-09-01
status: approved
version: 1.0.0
---

# How to Run the Project

> Hướng dẫn chạy dự án IIoT Gateway webapp v0.9.0 từ A-Z.
> Dành cho: developer mới onboard, QA test, demo khách hàng, DevOps triển khai.

## TL;DR — 5 phút chạy được

```bash
git clone <repo-url> iigw
cd iigw
cp .env.example .env
make hash P=admin123       # copy bcrypt hash vào .env
make up
# Mở http://localhost:5173
# Login: admin / admin123
```

**5 phút là có webapp chạy được với admin user.** Xem chi tiết bên dưới.

---

## 1. Yêu cầu hệ thống

| Hạng mục | Yêu cầu tối thiểu | Khuyến nghị |
|---|---|---|
| OS | Linux (Ubuntu 22.04+) / macOS / WSL2 | Ubuntu 22.04 LTS |
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disk | 10 GB trống | 20 GB SSD |
| Docker | Engine ≥ 24 + Compose ≥ 2.20 | latest stable |
| Network | Cổng 1883, 5432, 6379, 8000, 8086, 18083, 5173 mở (dev) | Firewall rule tùy môi trường |
| Browser | Chrome/Edge/Firefox/Safari ≥ 2023 | Chrome 120+ |

Verify môi trường:
```bash
docker --version          # >= 24.0
docker compose version    # >= 2.20
docker info | grep "Server Version"
```

## 2. Chuẩn bị (1 lần)

### 2.1. Clone project
```bash
cd /opt
sudo git clone <repo-url> iigw
sudo chown -R $USER:$USER iigw
cd iigw
```

### 2.2. Tạo file `.env`
```bash
cp .env.example .env
chmod 600 .env
```

### 2.3. Generate bcrypt hash cho admin password

Có 2 cách:

**Cách A: dùng Makefile**
```bash
make hash P=admin123
# Output: $2b$12$...
```

**Cách B: dùng docker trực tiếp**
```bash
docker compose run --rm backend python -c \
  "from passlib.context import CryptContext; \
   c=CryptContext(schemes=['bcrypt'], deprecated='auto', bcrypt__rounds=12); \
   print(c.hash('admin123'))"
```

Sau khi có hash, sửa `.env`:
```bash
ADMIN_BOOTSTRAP_USER=admin
ADMIN_BOOTSTRAP_PASSWORD_HASH='$2b$12$...'
# Escape $ thành $$ nếu paste trực tiếp vào docker-compose.yml
```

## 3. Chạy stack core (development)

### 3.1. Khởi động
```bash
make up
```

Lệnh này chạy `docker compose up -d postgres influxdb emqx redis backend webapp` — 6 services.

Verify:
```bash
docker compose ps
# Output mong đợi:
# SERVICE    STATUS
# backend    Up X minutes
# emqx       Up X minutes (healthy)
# influxdb   Up X minutes (healthy)
# postgres   Up X minutes (healthy)
# redis      Up X minutes (healthy)
# webapp     Up X minutes

curl -sf http://localhost:8000/healthz
# {"status":"ok"}

curl -sI http://localhost:5173/ | head -1
# HTTP/1.1 200 OK
```

Nếu lỗi port conflict (đã từng xảy ra với project `plc-management` chạy port 1883/5432/8000):
```bash
# Xem port nào bị chiếm
ss -tlnp | grep -E "1883|5432|8000"
# Stop project khác: docker compose -p <other-project> down
# Hoặc đổi port iigw (sửa docker-compose.yml + .env)
```

### 3.2. (Optional) Bật simulator
```bash
make start-simulator
```

Lệnh này start container `simulator` (profile `with-simulator`) với 3 devices:
- `SIM_LINE_A_01`
- `SIM_LINE_A_02`
- `SIM_LINE_B_01`

Mỗi device publish status mỗi 30s, telemetry mỗi 2s (50 registers, random).

### 3.3. (Optional) Bật backend2 (multi-instance)
```bash
docker compose --profile multi-instance up -d backend2
```

Lệnh này start backend thứ 2 trên port 8001, dùng chung Postgres + Redis. Dùng để test cross-instance WS broadcast.

### 3.4. Mở webapp
```
http://localhost:5173
```

Login với:
- Username: `admin`
- Password: `admin123`

## 4. Tương tác cơ bản

### 4.1. Overview (`/`)
Sau login, Overview page hiện:
- **TopBar**: brand, theme toggle, user menu (Logout)
- **Left rail**: icon 60px (hover mở rộng 200px)
- **Main**: grid DeviceCard 4 cột (auto-fill responsive)
- **Source filter**: All / Simulated / Real
- **Refresh button**: refetch `/api/devices`

Mỗi card hiển thị:
- State dot (green=online, red=error, gray=offline)
- Tên device (mono font)
- Source badge: `[SIM]` dashed tím / `[REAL]` solid xanh
- Live value (gauge, từ WebSocket)
- State + last_seen timestamp

### 4.2. Device Detail (`/devices/:id`)
Click vào 1 card → navigate đến device detail với 5 tabs:

| Tab | Nội dung |
|---|---|
| **Telemetry** | Register list (left) + Gauge + History chart (uPlot) + TimeRangePicker |
| **Status** | kv grid: state, uptime_s, reason, last update |
| **Events** | 100 events gần nhất với severity chip |
| **Diag** | Latest diag row từ Postgres (poll_cycle_ms, tx_packets, ...) |
| **Info** | Master metadata từ `info` payload (placeholder nếu chưa có) |

### 4.3. Events (`/events`)
Bảng event feed với filter:
- Severity: All / Critical / Warning / Info
- Codes: multi-select chips (13 codes phổ biến)
- Device: dropdown
- Time range: 5m/15m/1h/6h/24h/7d + Custom

Pagination Prev/Next.

### 4.4. Diagnostics (`/diagnostics`)
Bảng diag per-device (last diag, poll, TX ok/fail, latency, uptime). Click row → history panel.

### 4.5. Settings (`/settings`) — admin only
4 panels:
1. **Simulator Service**: Start/Stop button
2. **Source Mapping**: CRUD mapping
3. **User Management**: create user, change role inline, set password
4. **Export**: download CSV/XLSX telemetry/events/diag

## 5. Test

### 5.1. Smoke test tự động (~30s, 15 checks)
```bash
bash scripts/quick_smoke.sh
```

Output mẫu:
```
=== IIoT Gateway Quick Smoke Test ===
--- 1. Stack health ---        [PASS] 6 services healthy
--- 2. Backend health ---      [PASS] /healthz, /docs
--- 3. Webapp ---              [PASS] 5173
--- 4. Auth flow ---           [PASS] login, /auth/me
--- 5. Devices ---            [PASS] 9 devices
--- 6. Unit tests ---          [PASS] 25/25
--- 7. Negative test ---       [PASS] bad payload dropped
--- 8. MQTT pipeline ---      [PASS] state=online
✓ Smoke test PASSED
```

### 5.2. Unit tests (25 tests, ~10s)
```bash
docker compose exec backend python -m pytest tests/
```

### 5.3. Manual test (~30-60 phút)
Xem `docs/05_test/test_checklist.md` — 70+ tiêu chí trong 11 nhóm.

### 5.4. Publish MQTT test
```bash
docker compose exec backend python -c "
import paho.mqtt.client as mqtt, json, time
c = mqtt.Client()
c.connect('emqx', 1883, 60)
c.publish('devices/TEST/status', json.dumps({
    'device_id':'TEST','ts':int(time.time()),'type':'status',
    'state':'online','uptime_s':10
}), qos=1, retain=True)
c.disconnect()
print('published')
"
# Mở http://localhost:5173 — thấy device "TEST" với state=online
```

## 6. Lệnh Makefile thường dùng

| Lệnh | Mục đích |
|---|---|
| `make up` | Start core stack (postgres, influxdb, emqx, redis, backend, webapp) |
| `make down` | Stop tất cả (giữ volumes) |
| `make logs` | Tail log tất cả services |
| `make ps` | List running services |
| `make build` | Build Docker images |
| `make rebuild` | Build lại từ đầu (no cache) |
| `make hash P=xxx` | Generate bcrypt hash cho password |
| `make start-simulator` | Bật simulator (3 SIM devices) |
| `make stop-simulator` | Tắt simulator |
| `make clean` | Xoá volumes (DESTROYS DATA) |

## 7. Lệnh Docker Compose trực tiếp

```bash
# Xem logs 1 service
docker compose logs -f backend

# Restart 1 service
docker compose restart webapp

# Exec vào container
docker compose exec backend bash
docker compose exec postgres psql -U iigw -d iigw
docker compose exec influxdb influx query '...'

# Xem resource usage
docker stats

# Cleanup
docker compose down              # stop + remove containers
docker compose down -v           # stop + remove containers + volumes
```

## 8. Test multi-instance (M9)

```bash
# Start backend 2
docker compose --profile multi-instance up -d backend2

# Login trên backend1 (port 8000)
curl -c /tmp/c1.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Subscribe WS trên backend2 (port 8001)
# wscat -c ws://localhost:8001/ws/devices?device_id=SIM_LINE_A_01

# Đổi source mapping trên backend1, observe WS message trên backend2
# → Cross-instance broadcast hoạt động qua Redis pub/sub
```

## 9. Troubleshooting

### 9.1. Backend không start (port conflict)
```bash
# Check
ss -tlnp | grep -E "1883|5432|8000|6379|8086|5173"
docker ps -a | grep -E "1883|5432|8000"
```

Fix: stop project khác (`docker compose -p <other> down`) hoặc đổi port trong `docker-compose.yml`.

### 9.2. Backend crash vì thiếu env var
```bash
docker compose logs backend | tail -20
```

Lỗi thường gặp:
- `JWT_SECRET` thiếu hoặc < 32 bytes → fail-fast ở startup
- `ADMIN_BOOTSTRAP_*` thiếu → không tạo admin
- `DATABASE_URL` sai → không kết nối Postgres

Fix: sửa `.env`, restart `docker compose up -d backend`.

### 9.3. Frontend không load
```bash
curl -sI http://localhost:5173/
docker compose logs webapp
```

Lỗi thường gặp:
- 502 Bad Gateway: nginx không start, check `docker compose logs webapp`
- Trắng trang: JS bundle lỗi, mở DevTools Console

### 9.4. WebSocket không nhận message
```bash
# Test WS endpoint trực tiếp
docker compose exec backend python -c "
import asyncio, websockets, json
async def test():
    async with websockets.connect('ws://localhost:8000/ws/devices?device_id=*') as ws:
        msg = await asyncio.wait_for(ws.recv(), timeout=5)
        print(msg)
asyncio.run(test())
"
```

Nếu fail: check `docker compose logs backend | grep -E "hub|ws"`.

### 9.5. Login sai liên tục (rate limit)
Sau 5 lần login sai trong 60s, account bị block 60s. Đợi hoặc restart backend.

### 9.6. Reset toàn bộ
```bash
make clean         # xoá volumes (DESTROYS DATA)
make up            # restart
make start-simulator
```

## 10. Production deployment

Xem chi tiết ở `docs/04_runbook/runbook_deploy.md`. Tóm tắt:

```bash
# VPS Ubuntu 22.04
sudo useradd -m -s /bin/bash iigw
sudo mkdir -p /opt/iigw && sudo chown iigw:iigw /opt/iigw
cd /opt/iigw
git clone <repo-url> app
cd app
cp .env.example .env
# Sửa .env với giá trị production
# (openssl rand -hex 32 cho JWT_SECRET, bcrypt hash cho admin, domain thật cho CORS, COOKIE_SECURE=true)
make up

# Thêm HTTPS reverse proxy (Caddy/Traefik/nginx)
# Setup backup tự động
# Setup monitoring (Prometheus + Grafana)
```

## 11. Nơi xem thêm

| Tài liệu | Mô tả |
|---|---|
| `README.md` (root) | Project overview + quickstart |
| `docs/README.md` | Mục lục docs (24 files) |
| `docs/DECISIONS.md` | 65 quyết định kiến trúc (D-01..D-65) |
| `docs/01_plan/` | 4 plan files (overview, pipeline, webapp, UI/UX) |
| `docs/02_design/` | 4 design files (ERD, webapp, design system, wireframes) |
| `docs/03_api/api_reference.md` | REST + WebSocket API reference |
| `docs/04_runbook/` | 3 runbooks (local, deploy, git) |
| `docs/05_test/test_checklist.md` | 70+ tiêu chí manual test |
| `docs/05_test/test_acceptance_criteria.md` | 50+ AC cho release gate |
| `docs/05_test/operation_flow.md` | Luồng hoạt động end-to-end |
| `docs/06_changelog/RELEASE_v0.9.0.md` | Release notes v0.9.0 |
| `scripts/quick_smoke.sh` | Auto smoke test (15 checks) |

## 12. Quick reference — 1 lệnh phổ biến

| Tôi muốn... | Lệnh |
|---|---|
| Chạy dự án | `make up` |
| Login | Mở `http://localhost:5173`, `admin/admin123` |
| Xem dữ liệu telemetry | Click device card → tab Telemetry |
| Publish test MQTT | `docker compose exec backend python -c "..."` (xem mục 5.4) |
| Xem logs | `make logs` hoặc `docker compose logs -f <service>` |
| Chạy smoke test | `bash scripts/quick_smoke.sh` |
| Chạy unit tests | `docker compose exec backend python -m pytest tests/` |
| Stop stack | `make down` |
| Reset toàn bộ | `make clean && make up` |
| Xem resource | `docker stats` |
| Vào Postgres | `docker compose exec postgres psql -U iigw -d iigw` |
| Vào InfluxDB | `docker compose exec influxdb influx query '...'` |

## Change history

- 2026-09-01: How to Run v1.0.0 — A-Z guide cho v0.9.0.
