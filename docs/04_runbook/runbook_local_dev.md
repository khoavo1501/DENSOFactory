---
title: Runbook Local Dev
category: runbook
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 0.1.0
---

# Runbook Local Dev

Hướng dẫn khởi động stack M1 trên máy dev bằng Docker Compose.

## Yêu cầu

- Docker Engine ≥ 24
- Docker Compose ≥ 2.20
- 4 GB RAM trống
- Cổng trống: 1883 (MQTT), 5432 (Postgres), 8000 (Backend), 8086 (InfluxDB), 18083 (EMQX dashboard)

## Khởi động nhanh

```bash
# 1. Tạo file .env ở root dự án (CHỈ LÀM 1 LẦN)
cp .env.example .env

# 2. Tạo bcrypt hash cho admin password
make hash P=admin123
# Hoặc: docker compose run --rm backend python -c "from passlib.context import CryptContext; c=CryptContext(schemes=['bcrypt'], deprecated='auto', bcrypt__rounds=12); print(c.hash('admin123'))"

# 3. Dán hash vào .env (escape $ bằng $$ nếu dùng compose v.v.)
# ADMIN_BOOTSTRAP_PASSWORD_HASH=$$2b$$12$$...

# 4. Khởi động stack
make up

# 5. (Tuỳ chọn) Bật simulator
make start-simulator
```

## Lệnh thường dùng

| Lệnh | Mục đích |
|---|---|
| `make up` | Khởi động core stack (postgres, influxdb, emqx, backend) |
| `make down` | Dừng tất cả (giữ volumes) |
| `make logs` | Xem log tất cả services |
| `make logs backend` | Xem log riêng backend |
| `make ps` | Trạng thái services |
| `make restart` | Restart backend |
| `make build` | Build images |
| `make rebuild` | Build lại từ đầu (no cache) |
| `make hash P=xxx` | Generate bcrypt hash cho password |
| `make start-simulator` | Bật simulator (profile `with-simulator`) |
| `make stop-simulator` | Tắt simulator |
| `make clean` | Xoá volumes (DESTROYS DATA) |

## Test nhanh bằng curl

```bash
# Health check
curl -sf http://localhost:8000/healthz

# Login
curl -s -c /tmp/cookies.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Lấy CSRF token từ cookies
CSRF=$(grep csrf /tmp/cookies.txt | awk '{print $7}')

# Me
curl -s -b /tmp/cookies.txt http://localhost:8000/api/auth/me

# Thêm source mapping
curl -s -b /tmp/cookies.txt -X PUT \
  http://localhost:8000/api/admin/devices-sources/SIM_LINE_A_01 \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"source":"simulated"}'

# List devices
curl -s -b /tmp/cookies.txt http://localhost:8000/api/devices

# Publish MQTT test (từ trong container backend)
docker compose exec backend python -c "
import paho.mqtt.client as mqtt
import json, time
c = mqtt.Client()
c.connect('emqx', 1883, 60)
c.publish('devices/GW_LINE_A_01/status', json.dumps({
    'device_id': 'GW_LINE_A_01',
    'ts': int(time.time()),
    'type': 'status',
    'state': 'online',
    'uptime_s': 100
}), qos=1, retain=True)
c.disconnect()
"
```

## Cổng & endpoints

| Service | Port | URL |
|---|---|---|
| Backend API | 8000 | http://localhost:8000 |
| Backend Swagger | 8000 | http://localhost:8000/docs |
| Backend OpenAPI JSON | 8000 | http://localhost:8000/openapi.json |
| Postgres | 5432 | `postgresql://iigw:iigw@localhost:5432/iigw` |
| InfluxDB | 8086 | http://localhost:8086 (token: `iigw-dev-token`) |
| EMQX Dashboard | 18083 | http://localhost:18083 (admin/public) |
| MQTT | 1883 | tcp://localhost:1883 |

## Troubleshooting

### Backend fail-fast về env

Lỗi: `ValidationError: JWT_SECRET ... Field required`.
**Fix:** đảm bảo `.env` ở root có đủ 3 biến: `JWT_SECRET`, `ADMIN_BOOTSTRAP_USER`, `ADMIN_BOOTSTRAP_PASSWORD_HASH`. Escape `$` thành `$$` nếu gặp warning "variable not set".

### Bcrypt hash bị sai

Lỗi: `invalid credentials` ngay cả khi password đúng.
**Nguyên nhân:** shell expand `$` trong `.env`. Khi dùng `env_file:` trong compose, **không cần escape**. Nếu paste trực tiếp vào `environment:`, escape `$$`.
**Verify:** `docker compose exec backend python -c "from app.core.security import verify_password; print(verify_password('admin123', '<hash>'))"` phải trả `True`.

### Migration fail

Lỗi: `alembic.util.exc.CommandError: ... Can't locate revision identified by '0001_initial'`.
**Fix:** volume Postgres đã có schema cũ. Chạy `make clean` (xoá volume) hoặc `docker compose down -v` rồi `make up` lại.

### Port đã bị chiếm

Lỗi: `bind: address already in use`.
**Fix:** đổi port mapping trong `docker-compose.yml`, hoặc kill process đang dùng port.

### InfluxDB query fail

Backend trả rỗng cho mọi telemetry/event. Check `docker compose logs backend` xem có `InfluxDB query 401/404` không.
**Nguyên nhân phổ biến:** token sai, bucket chưa tạo.
**Fix:** vào http://localhost:8086, tạo bucket `telemetry`, copy token vào `.env` (`INFLUXDB_TOKEN`).

## Env vars quan trọng

| Biến | Bắt buộc | Default | Mô tả |
|---|---|---|---|
| `JWT_SECRET` | ✅ | — | HS256 secret, ≥32 bytes |
| `ADMIN_BOOTSTRAP_USER` | ✅ | — | Username admin khởi tạo |
| `ADMIN_BOOTSTRAP_PASSWORD_HASH` | ✅ | — | Bcrypt hash (cost 12) |
| `DIAG_RETENTION_DAYS` | | 90 | Retention `device_diag` |
| `AUDIT_RETENTION_DAYS` | | 365 | Retention `audit_log` |
| `REVOKED_TOKEN_RETENTION_DAYS` | | 30 | Retention `revoked_refresh` |
| `ACCESS_TOKEN_TTL_MIN` | | 15 | TTL access token (phút) |
| `REFRESH_TOKEN_TTL_HOURS` | | 8 | TTL refresh token (giờ) |
| `CLEANUP_CRON_HOUR` | | 2 | Giờ chạy cleanup (0–23) |
| `EXPORT_MAX_ROWS` | | 100000 | Max rows / export |
| `COOKIE_SECURE` | | false | Bật khi chạy HTTPS |

## Tài liệu liên quan

- [Plan Webapp Architecture](../01_plan/plan_webapp_architecture.md)
- [API Reference](../03_api/api_reference.md)
- [ERD Postgres](../02_design/erd_postgres.md)
- [Payload Spec v1](../99_attachments/payload_spec_v1.md)
- [CHANGELOG_webapp](../06_changelog/CHANGELOG_webapp.md)

## Change history

- 2026-08-30: Tạo runbook local dev cho M1 (v0.1.0).
