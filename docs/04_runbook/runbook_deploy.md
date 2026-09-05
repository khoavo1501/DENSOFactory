---
title: Runbook Deploy
category: runbook
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 1.0.0
---

# Runbook Deploy (Production)

Hướng dẫn triển khai IIoT Gateway webapp lên môi trường production. Mục tiêu: 1h stability demo với 15 device, đảm bảo audit + retention hoạt động.

## 1. Yêu cầu hạ tầng

- **OS**: Linux (Ubuntu 22.04+ / RHEL 9+ / Debian 12+).
- **CPU**: 4 cores minimum.
- **RAM**: 8 GB minimum (chủ yếu cho InfluxDB + Postgres).
- **Disk**: 50 GB SSD (chừa headroom cho InfluxDB time-series).
- **Network**: Port 1883 (MQTT), 5432 (Postgres), 8000 (backend), 5173 (webapp) cần mở.
- **Docker**: Engine ≥ 24, Compose ≥ 2.20.

## 2. Chuẩn bị

### 2.1. Tạo user + dirs
```bash
sudo useradd -m -s /bin/bash iigw
sudo mkdir -p /opt/iigw
sudo chown iigw:iigw /opt/iigw
```

### 2.2. Clone project
```bash
cd /opt/iigw
git clone <repo-url> app
cd app
git checkout main   # hoặc tag cụ thể
```

### 2.3. Tạo `.env` (KHÔNG commit)
```bash
cp .env.example .env
chmod 600 .env
```

Sửa các giá trị production:

| Biến | Dev | Production |
|---|---|---|
| `JWT_SECRET` | `dev-secret-...` | `openssl rand -hex 32` (≥32 bytes) |
| `ADMIN_BOOTSTRAP_PASSWORD_HASH` | example | `make hash P=...` (cost 12) |
| `CORS_ORIGINS` | `localhost:5173` | domain thật,vd `https://iigw.example.com` |
| `COOKIE_SECURE` | `false` | `true` (HTTPS) |
| `DIAG_RETENTION_DAYS` | 90 | 90 (default) hoặc lớn hơn cho compliance |
| `AUDIT_RETENTION_DAYS` | 365 | 365 (default) — bump lên 1095 nếu cần 3 năm |
| `INFLUXDB_TOKEN` | `iigw-dev-token` | tự sinh trong InfluxDB UI |
| `EXPORTS_MAX_ROWS` | 100000 | tuỳ nhu cầu, hiện tại 100K OK |

### 2.4. Bcrypt hash cho admin
```bash
make hash P='YourStrongPassword!'
# Output: $2b$12$... — copy vào ADMIN_BOOTSTRAP_PASSWORD_HASH
```

> Escape ký tự `$` thành `$$` nếu paste trực tiếp vào `docker-compose.yml`.

## 3. Khởi động

```bash
# Khởi động core stack (không simulator)
docker compose up -d postgres influxdb emqx backend webapp

# Verify health
curl -sf http://localhost:8000/healthz   # backend
curl -sI http://localhost:5173/         # webapp
```

## 4. Đăng nhập lần đầu

1. Mở `http://<host>:5173`.
2. Login với `admin` + password đã hash.
3. Vào **Settings** → **User Management** → tạo thêm user với role `viewer` cho operator.
4. (Tuỳ chọn) Đổi password admin.
5. (Tuỳ chọn) Disable account admin nếu dùng SSO/IAM.

## 5. Bảo mật

- **HTTPS**: bắt buộc ở production. Set `COOKIE_SECURE=true`. Dùng nginx (không phải container nginx trong compose) terminate SSL hoặc thêm reverse proxy (Caddy/Traefik).
- **Network isolation**: Postgres + InfluxDB chỉ listen trên internal Docker network. EMQX 1883 expose qua firewall (chỉ mở cho gateway IP).
- **CORS**: chỉ allow frontend domain,vd `CORS_ORIGINS=https://iigw.example.com`.
- **Rate limit**: login/refresh đã có sẵn (5/min và 30/min per IP, D-44).
- **CSRF**: double-submit cookie đã bật (D-16).
- **Audit log**: 1 năm retention, có thể bump lên 3 năm (D-30).

## 6. Monitoring

### 6.1. Health check từ bên ngoài

```bash
# Backend
curl -sf http://<host>:8000/healthz
# Webapp (qua reverse proxy)
curl -sfI https://<host>/

# Database
docker compose exec postgres pg_isready -U iigw
# MQTT
docker compose exec emqx /opt/emqx/bin/emqx ping
```

### 6.2. Logs

```bash
# Tail tất cả
make logs

# Tail 1 service
docker compose logs -f --tail=200 backend

# Audit log qua DB
docker compose exec postgres psql -U iigw -d iigw \
  -c "SELECT ts, user_name, action, target FROM audit_log ORDER BY ts DESC LIMIT 50;"
```

### 6.3. InfluxDB queries hữu ích

```bash
# Số điểm telemetry trong 24h qua
docker compose exec influxdb influx query '
from(bucket:"telemetry")
  |> range(start:-24h)
  |> filter(fn: (r) => r._measurement == "device_telemetry")
  |> count()
' -o iigw -t iigw-dev-token

# Top 10 device theo event count
docker compose exec influxdb influx query '
from(bucket:"telemetry")
  |> range(start:-24h)
  |> filter(fn: (r) => r._measurement == "device_event")
  |> group(columns: ["device_id"])
  |> count()
  |> sort(columns: ["_value"], desc: true)
  |> limit(n: 10)
' -o iigw -t iigw-dev-token
```

## 7. Backup

### 7.1. Postgres
```bash
# Daily cron: 02:00 UTC
0 2 * * * docker compose exec -T postgres pg_dump -U iigw -d iigw | \
  gzip > /backup/iigw-$(date +\%Y\%m\%d).sql.gz
```

Restore:
```bash
gunzip < iigw-20260830.sql.gz | docker compose exec -T postgres psql -U iigw -d iigw
```

### 7.2. InfluxDB
```bash
docker compose exec influxdb influx backup /tmp/backup
docker cp iigw-influxdb-1:/tmp/backup /backup/influx-$(date +%Y%m%d)
```

### 7.3. Volumes
```bash
# Stop stack trước khi backup volumes
docker compose down
sudo tar czf /backup/iigw-volumes-$(date +%Y%m%d).tgz \
  /var/lib/docker/volumes/iigw_pgdata \
  /var/lib/docker/volumes/iigw_influxdata
```

## 8. Upgrade

```bash
cd /opt/iigw/app
git pull
docker compose pull   # nếu dùng image registry
# Hoặc: docker compose build backend webapp
docker compose up -d
```

Database migration tự chạy lúc backend start (alembic upgrade head).
Nếu có breaking change, xem `docs/06_changelog/CHANGELOG_webapp.md` và `docs/DECISIONS.md`.

## 9. Scale

Mặc định stack chạy 1 instance mỗi service. Khi vượt 15-30 device:

- **Postgres**: tăng shared_buffers, connection pool. Có thể switch sang managed (RDS).
- **InfluxDB**: tăng retention hoặc shard theo device_id.
- **EMQX**: cluster mode (3+ nodes).
- **Backend**: scale horizontal — dùng Gunicorn + Uvicorn workers. **Lưu ý**: WebSocket hub hiện tại in-memory (D-19 future) — multi-instance cần Redis pub/sub. Cho POC, 1 instance đủ.
- **Webapp**: nginx scale horizontal, behind load balancer.

## 10. Disaster recovery

| Sự cố | Triệu chứng | Phục hồi |
|---|---|---|
| Backend down | API 5xx, WS disconnect | `docker compose restart backend`; check logs |
| Postgres corrupt | DB connection fail | Restore từ backup (mục 7.1) |
| InfluxDB OOM | Container restart loop | Tăng memory limit, giảm retention |
| MQTT broker down | No new telemetry | `docker compose restart emqx`; check gateway |
| Disk full | Container write fail | Clean old chunks (`influx delete`), check logrotate |

## 11. Quick reference

| Service | Port | Endpoint |
|---|---|---|
| Webapp (nginx + SPA) | 5173 (or behind reverse proxy) | `/` |
| Backend (FastAPI) | 8000 | `/healthz`, `/docs` (Swagger), `/api/...` |
| MQTT (EMQX) | 1883 | `devices/+/+` topic |
| MQTT Dashboard | 18083 | `/` (admin/public) |
| Postgres | 5432 | `iigw` db |
| InfluxDB | 8086 | `/` (token auth) |

## 12. Liên hệ

Vấn đề nghiêm trọng: mở issue trong repo + ping team lead.

## Change history

- 2026-08-30: Runbook Deploy v1.0.0 — production setup cho M7.
