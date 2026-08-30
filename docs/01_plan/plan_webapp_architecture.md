---
title: Plan Webapp Architecture
category: plan
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 0.1.0
---

# Plan Webapp Architecture

## 1. Công nghệ

### 1.1 Frontend

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Framework | React 18 + TypeScript + Vite | Hệ sinh thái rộng, build nhanh, SPA gọn cho dashboard |
| Routing | React Router v6 | Chuẩn, đủ dùng |
| State | Zustand (chung) + TanStack Query (server) | Nhẹ, không boilerplate |
| Chart | uPlot (line realtime) + ECharts (gauge) | uPlot tối ưu time-series, ECharts cho gauge/heatmap |
| Table | TanStack Table | Sort/filter cho event feed |
| UI | shadcn/ui (Radix + Tailwind) | Không vendor-lock |
| Style | TailwindCSS | Phù hợp dashboard, dễ dark/light |
| WebSocket | Native + reconnecting-websocket | Đơn giản, đủ dùng |
| Form | Zod + react-hook-form | Validate form mapping source |
| Build | Docker (nginx static) | Triển khai cùng compose stack |

### 1.2 Backend (bổ sung cho webapp)

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Framework | FastAPI | Async, OpenAPI tự sinh, phù hợp WS |
| ORM | SQLAlchemy + Alembic | Migration quản lý schema |
| DB | Postgres + InfluxDB | Influx cho time-series, Postgres cho diag/users/audit |
| Auth | JWT cookie (access 15m + refresh 8h) | Bảo mật + UX khớp ca làm việc |
| Export | pandas + openpyxl | CSV/XLSX |
| Cleanup | APScheduler | Cron nightly, config-driven retention |

## 2. Cấu trúc trang

| Path | Màn hình | Chức năng chính |
|---|---|---|
| `/login` | Login | Form admin/viewer |
| `/` | Overview | Grid DeviceCard (4 cột desktop / 2 tablet); source filter; gauge + sparkline |
| `/devices/:id` | Device Detail | Tabs: Telemetry / Status / Events / Diag / Info |
| `/events` | Event/Alarm Log | Bảng + filter (severity/code/device/time); Toasts realtime |
| `/diagnostics` | Diagnostics | Bảng tổng hợp diag; per-slave stats drawer |
| `/settings` | Settings/Admin | 3 panel: Simulator Service / Source Mapping / Export |

## 3. API endpoints (M1)

### 3.1 Devices
| Method & Path | Mô tả |
|---|---|
| `GET /api/devices` | List devices + `source`, `state`, `last_seen_ts` |
| `GET /api/devices/{id}` | Metadata device |
| `GET /api/devices/{id}/latest` | Snapshot mới nhất |
| `GET /api/devices/{id}/telemetry/snapshot` | Toàn bộ register mới nhất |
| `GET /api/devices/{id}/telemetry/history?register=&from=&to=&agg=` | Lịch sử 1 register |
| `GET /api/devices/{id}/diag/latest` | Diag gần nhất |
| `GET /api/devices/{id}/diag/history?from=&to=` | Chuỗi diag (Postgres) |

### 3.2 Events
| Method & Path | Mô tả |
|---|---|
| `GET /api/events?device_id=&severity=&code=&from=&to=&page=&page_size=` | List event phân trang |
| `GET /api/events/summary?window=24h` | Đếm theo severity/code |
| `GET /api/events/{id}` | Chi tiết event |

### 3.3 Admin
| Method & Path | Mô tả |
|---|---|
| `GET /api/admin/devices-sources` | List mapping |
| `PUT /api/admin/devices-sources/{device_id}` | Update source |
| `POST /api/admin/simulator/start` | Khởi động simulator |
| `POST /api/admin/simulator/stop` | Dừng simulator |
| `GET /api/admin/simulator/status` | Trạng thái simulator |

### 3.4 Auth
| Method & Path | Mô tả |
|---|---|
| `POST /api/auth/login` | Set cookie `at` + `rt`, trả `{user, role}` |
| `POST /api/auth/refresh` | Cấp access token mới, rotate `csrf` |
| `POST /api/auth/logout` | Xoá cookie, blacklist `rt` |
| `GET /api/auth/me` | Trả user hiện tại |

### 3.5 Export
| Method & Path | Mô tả |
|---|---|
| `GET /api/exports/telemetry?device_id=&register=&from=&to=&format=` | CSV/XLSX |
| `GET /api/exports/events?device_id=&severity=&code=&from=&to=&format=` | CSV/XLSX |
| `GET /api/exports/diag?device_id=&from=&to=&format=` | CSV/XLSX (Postgres) |

- Giới hạn: tối đa **100k dòng/export**. Vượt → `413 Payload Too Large`, yêu cầu thu hẹp range.
- Mọi export ghi `audit_log` với metadata (user, ts, device_id, range, row_count, format).

## 4. ERD Postgres (M1)

```sql
-- Mapping device_id <-> source
CREATE TABLE device_sources (
  device_id   TEXT PRIMARY KEY,
  source      TEXT NOT NULL CHECK (source IN ('simulated','real')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT
);

-- Diag history (spec không lưu; lưu Postgres theo quyết định)
CREATE TABLE device_diag (
  device_id    TEXT NOT NULL,
  ts           BIGINT NOT NULL,
  poll_cycle_ms INTEGER,
  uptime_s     BIGINT,
  tx_packets   BIGINT,
  tx_failures  BIGINT,
  mqtt_reconnect BIGINT,
  avg_latency_ms DOUBLE PRECISION,
  payload      JSONB NOT NULL,
  PRIMARY KEY (device_id, ts)
);
CREATE INDEX idx_diag_ts ON device_diag (ts DESC);
CREATE INDEX idx_diag_device_ts ON device_diag (device_id, ts DESC);

-- Users
CREATE TABLE users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_name TEXT,
  action TEXT NOT NULL,
  target TEXT,
  detail JSONB
);
CREATE INDEX idx_audit_ts ON audit_log (ts DESC);

-- Revoked refresh tokens (logout)
CREATE TABLE revoked_refresh (
  jti         TEXT PRIMARY KEY,
  user_name   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_revoked_expires ON revoked_refresh (expires_at);
```

## 5. Token & cookie matrix

| Cookie | httpOnly | Secure | SameSite | Path | Max-Age | Rotate |
|---|---|---|---|---|---|---|
| `at` (access) | ✅ | ✅ | Strict | `/` | `ACCESS_TOKEN_TTL_MIN` × 60 (default 900s = 15m) | Mỗi refresh |
| `rt` (refresh) | ✅ | ✅ | Strict | `/` | `REFRESH_TOKEN_TTL_HOURS` × 3600 (default 28800s = 8h) | Không (trừ logout) |
| `csrf` (token) | ❌ | ✅ | Strict | `/` | Khớp `at` (15m) | Mỗi refresh access |

**CSRF**: double-submit cookie. Frontend đọc `csrf` từ `document.cookie`, gửi header `X-CSRF-Token` cho mọi `POST/PUT/DELETE`. Backend middleware so sánh header vs cookie, lệch → 403.

## 6. Env vars

**Bắt buộc (fail-fast):**

| Tên | Mô tả |
|---|---|
| `JWT_SECRET` | Secret HS256, ≥32 bytes |
| `ADMIN_BOOTSTRAP_USER` | Username admin khởi tạo |
| `ADMIN_BOOTSTRAP_PASSWORD_HASH` | Bcrypt hash password (cost ≥12) |

**Optional (có default):**

| Tên | Default | Mô tả |
|---|---|---|
| `DIAG_RETENTION_DAYS` | 90 | Retention `device_diag` |
| `AUDIT_RETENTION_DAYS` | 365 | Retention `audit_log` |
| `REVOKED_TOKEN_RETENTION_DAYS` | 30 | Retention `revoked_refresh` |
| `ACCESS_TOKEN_TTL_MIN` | 15 | TTL access token (phút) |
| `REFRESH_TOKEN_TTL_HOURS` | 8 | TTL refresh token (giờ) |
| `CLEANUP_CRON_HOUR` | 2 | Giờ chạy cleanup job (0–23) |

**Nguyên tắc**: KHÔNG hard-code con số retention/TTL trong code. Đọc từ config. Lý do: khi chuyển POC → production, audit có thể cần giữ 2–3 năm (compliance) — chỉ cần đổi env, không sửa code.

## 7. Realtime

- WebSocket: `ws://<host>/ws/devices?device_id=<id1>,<id2>,...` hoặc `*`.
- Reconnect: exponential backoff (1s → 30s cap).
- Heartbeat: server ping mỗi 30s.
- Subscribe per device: chỉ subscribe WS cho device đang mở + buffer nhỏ cho Overview.

## 8. Performance

- **Realtime end-to-end**: ≤ 2s (publish → DOM render).
- **Chart 24h load**: ≤ 3s (dùng `agg=5m` → 288 điểm).
- **Grid 15 device × 200 register × 1Hz**: client subscribe có filter, ring buffer 1000 điểm/register.

## 9. Tài liệu liên quan

- [Plan Overview](./plan_overview.md)
- [Plan Data Pipeline](./plan_data_pipeline.md)
- [Plan UI/UX Concept](./plan_uiux_concept.md)
- [Payload Spec v1](../99_attachments/payload_spec_v1.md)

## Change history

- 2026-08-30: Tạo plan_webapp_architecture.md (M0).
