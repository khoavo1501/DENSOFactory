---
title: Webapp Changelog
category: changelog
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 0.2.0
---

# Webapp Changelog

Lịch sử thay đổi của phần webapp/dashboard cho hệ thống Gateway IIoT.
Định dạng theo [keep-a-changelog](https://keepachangelog.com/vi-VN/1.1.0/).

## [Unreleased]

## [0.2.0] - 2026-08-30

### Added
- M1: Backend FastAPI hoàn chỉnh (REST + WebSocket).
- M1: Postgres schema qua Alembic migration `0001_initial`: `device_sources`, `device_diag`, `users`, `audit_log`, `revoked_refresh`.
- M1: Auth JWT cookie (access 15m + refresh 8h) + CSRF double-submit cookie.
- M1: Bcrypt password hashing (cost 12); admin bootstrap từ env.
- M1: API `/api/auth/{login, refresh, logout, me}`.
- M1: API `/api/devices` (list, latest, telemetry snapshot/history, diag latest/history).
- M1: API `/api/events` (list, summary) với filter theo enum `code` + `severity` (đóng theo spec mục 4.2).
- M1: API `/api/admin/devices-sources` (CRUD) + `/api/admin/simulator/{status,start,stop}`.
- M1: API `/api/exports/{telemetry,events,diag}` CSV/XLSX, enforce `EXPORT_MAX_ROWS` (413 nếu vượt).
- M1: Audit log ghi nhận mọi action admin + login (success/fail) + metadata export.
- M1: Cleanup job (APScheduler, cron nightly) theo `DIAG_RETENTION_DAYS` / `AUDIT_RETENTION_DAYS` / `REVOKED_TOKEN_RETENTION_DAYS` (config-driven, không hard-code).
- M1: `device_sources` service với pattern inference (`SIM_*` / `^[A-Z]+_[A-Z]+_[0-9]+$`) + reject nếu mapping sai.
- M1: InfluxDB client (httpx, CSV) với escape cho mọi tham số trong Flux query.
- M1: WebSocket `/ws/devices?device_id=...` (in-memory hub; multi-instance broadcast là future work).
- M1: MQTT dispatcher stubs (`telemetry/status/event/diag`) — M2 sẽ wire vào consumer thật.
- M1: Simulator container (`simulator/simulator.py`) publish payload đúng spec.
- M1: Docker Compose stack (postgres, influxdb, emqx, backend, simulator profile).
- M1: `Makefile` với các lệnh `up/down/logs/build/hash/start-simulator`.
- M1: `scripts/generate-bcrypt-hash.py` để bootstrap admin.
- **M1: `docs/DECISIONS.md`** — nguồn chân lý cho 42 quyết định kiến trúc (D-01 → D-42).
- Docs: `docs/03_api/api_reference.md` (OpenAPI + curl examples).
- Docs: `docs/02_design/erd_postgres.md` (sơ đồ + chi tiết từng bảng).
- Docs: `docs/04_runbook/runbook_local_dev.md` (khởi động + troubleshooting).

### Changed
- Không thay đổi schema payload (vẫn bám sát `payload_spec_v1.md`).
- Retention numbers chuyển sang env-driven (config, không hard-code trong code).

### Security
- JWT_SECRET, ADMIN_BOOTSTRAP_USER, ADMIN_BOOTSTRAP_PASSWORD_HASH fail-fast khi thiếu.
- Cookie attributes: `httpOnly`, `Secure` (config), `SameSite=Strict`, `Path=/`.
- CSRF double-submit cookie, rotate mỗi access token refresh.
- Password: bcrypt cost 12.
- Refresh token blacklist sau logout, retention config-driven.

## [0.1.0] - 2026-08-30

### Added
- M0: Tạo cấu trúc tài liệu chuẩn (`docs/FILE_MANAGEMENT.md`, 7 thư mục danh mục, mục lục `docs/README.md`).
- M0: Tạo bộ kế hoạch tổng: `plan_overview.md`, `plan_data_pipeline.md`, `plan_webapp_architecture.md`, `plan_uiux_concept.md`.
- M0: Chốt quyết định UI/UX: Grafana-style + HMI hiện đại, desktop+tablet, dark/light, overview-first, toasts.
- M0: Chốt quyết định kỹ thuật: JWT cookie (access 15m + refresh 8h), CSRF double-submit cookie, retention config-driven, Postgres cho diag/users/audit.

### Changed
- Di chuyển `docs/payload_spec_v1.md` → `docs/99_attachments/payload_spec_v1.md` để khớp chuẩn phân loại.

### Security
- N/A (chưa có code ở M0).

[Unreleased]: #
[0.2.0]: #
[0.1.0]: #
