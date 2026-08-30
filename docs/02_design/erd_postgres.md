---
title: ERD Postgres
category: design
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 0.1.0
---

# ERD Postgres

Postgres là DB chính cho: device_sources mapping, device_diag history, users, audit_log, revoked_refresh.
Time-series (telemetry / status / event) vẫn ở InfluxDB — xem [Payload Spec v1](../99_attachments/payload_spec_v1.md) mục 7.2.

## Sơ đồ

```
                  ┌──────────────────────┐
                  │      device_sources  │
                  │──────────────────────│
                  │ PK device_id (TEXT)  │
                  │    source (TEXT)     │
                  │    updated_at (TZ)   │
                  │    updated_by (TEXT) │
                  └──────────┬───────────┘
                             │
                             │  (override pattern)
                             ▼
   ┌─────────────────┐   ┌──────────────────────┐
   │      users      │   │     device_diag      │
   │─────────────────│   │──────────────────────│
   │ PK username     │   │ PK (device_id, ts)   │
   │    password_hash│   │    poll_cycle_ms     │
   │    role         │   │    uptime_s          │
   │    created_at   │   │    tx_packets        │
   └────────┬────────┘   │    tx_failures       │
            │            │    mqtt_reconnect    │
            │            │    avg_latency_ms    │
            │            │    payload (JSONB)   │
            │            └──────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐    ┌────────────────────────┐
   │           audit_log              │    │     revoked_refresh    │
   │──────────────────────────────────│    │────────────────────────│
   │ PK id (BIGSERIAL)                │    │ PK jti (TEXT)          │
   │    ts (TZ)                       │    │    user_name (TEXT)    │
   │    user_name (TEXT, nullable)    │◄───│    expires_at (TZ)     │
   │    action (TEXT)                 │    │    revoked_at (TZ)     │
   │    target (TEXT, nullable)       │    └────────────────────────┘
   │    detail (JSONB, nullable)      │
   └──────────────────────────────────┘
```

## Bảng chi tiết

### device_sources
Ánh xạ `device_id ↔ source` (override pattern inference).
- `device_id` PK, regex `^[A-Za-z0-9_-]{1,64}$` (validate ở service layer).
- `source` CHECK IN `('simulated','real')`.
- `updated_at` default `now()`.
- `updated_by` lưu username admin (nullable cho bootstrap).

### device_diag
Lưu lịch sử diag (spec mục 7.2 chỉ log; ta lưu Postgres để query).
- PK `(device_id, ts)` — composite, hỗ trợ upsert theo `merge`.
- `payload` JSONB chứa nguyên `stats` object (giữ mọi field theo schema, không mất info).
- Index: `idx_diag_device_ts (device_id, ts)`.
- Retention: `DIAG_RETENTION_DAYS` (config-driven, default 90).

### users
Tài khoản admin / viewer.
- `password_hash` bcrypt cost 12.
- `role` CHECK IN `('admin','viewer')`.
- Bootstrap admin từ `ADMIN_BOOTSTRAP_USER` / `ADMIN_BOOTSTRAP_PASSWORD_HASH` lúc startup (idempotent).

### audit_log
Ghi nhận mọi action admin + login (success/fail).
- `id` BIGSERIAL.
- `detail` JSONB: chứa metadata export (user, ts, device_id, range, row_count, format), hoặc mapping change (old/new source).
- Index: `idx_audit_ts (ts)`.
- Retention: `AUDIT_RETENTION_DAYS` (config-driven, default 365).

### revoked_refresh
Blacklist refresh token JTI sau logout.
- `jti` PK (UUID hex từ JWT).
- `expires_at` để có thể cleanup sau khi token tự hết hạn.
- Index: `idx_revoked_expires (expires_at)`.
- Retention: `REVOKED_TOKEN_RETENTION_DAYS` (config-driven, default 30).

## Quan hệ (logical)

- `device_sources.device_id` ↔ Telemetry/Status/Event tag `device_id` (InfluxDB, không có FK cứng vì khác DB engine).
- `users.username` ↔ `audit_log.user_name` (no FK, cho phép user bị xoá mà vẫn giữ audit).
- `users.username` ↔ `revoked_refresh.user_name` (no FK, lý do tương tự).

## Migrations

Quản lý bằng **Alembic** ở `backend/alembic/versions/`.
- Lệnh: `docker compose exec backend alembic upgrade head`
- Tự chạy lúc container start (xem `backend/Dockerfile` CMD).

## Retention — config-driven

**Không hard-code số ngày trong query hay cron job.** Mọi giá trị đến từ env:
- `DIAG_RETENTION_DAYS` (default 90)
- `AUDIT_RETENTION_DAYS` (default 365)
- `REVOKED_TOKEN_RETENTION_DAYS` (default 30)

Job cleanup chạy nightly bằng APScheduler (`CLEANUP_CRON_HOUR`, default 2). Khi policy thay đổi (vd. audit cần 2–3 năm cho compliance), chỉ đổi env, không sửa code.

## Tài liệu liên quan

- [Plan Webapp Architecture](../01_plan/plan_webapp_architecture.md)
- [API Reference](../03_api/api_reference.md)
- [Payload Spec v1](../99_attachments/payload_spec_v1.md)

## Change history

- 2026-08-30: Tạo ERD Postgres cho M1 (v0.1.0).
