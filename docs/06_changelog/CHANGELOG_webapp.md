---
title: Webapp Changelog
category: changelog
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 0.5.0
---

# Webapp Changelog

Lịch sử thay đổi của phần webapp/dashboard cho hệ thống Gateway IIoT.
Định dạng theo [keep-a-changelog](https://keepachangelog.com/vi-VN/1.1.0/).

## [Unreleased]

## [0.5.0] - 2026-08-30

### Added
- M4: Device Detail hoàn chỉnh với 5 tabs (Telemetry / Status / Events / Diag / Info).
- M4: Tabs component (`webapp/src/components/Tabs.tsx`) với ARIA tablist/tabpanel.
- M4: TimeRangePicker (`webapp/src/components/TimeRangePicker.tsx`) — quick ranges 5m/15m/1h/6h/24h/7d + custom datetime.
- M4: TimeSeriesChart (`webapp/src/components/TimeSeriesChart.tsx`) dùng **uPlot**, time-series hiệu năng cao cho register history.
- M4: Gauge (`webapp/src/components/Gauge.tsx`) dùng **ECharts** cho "main register" — pointer, min/max, unit.
- M4: timeRange utilities (`webapp/src/utils/timeRange.ts`) — resolveRange/formatDateTime.
- M4: Telemetry tab layout: register list (left, 240px) + gauge + history chart (right). Single column khi <1280px.
- M4: Status tab — kv grid hiển thị state/uptime/reason/last update.
- M4: Events tab trong Device Detail — list 100 event gần nhất, severity chip.
- M4: Diag tab — latest diag row từ Postgres với kv grid.
- M4: Info tab — placeholder cho master metadata (info payload, live only per spec mục 7.2).
- M4: Events page — time range picker + code multi-select filter (top 13 codes từ enum đóng).
- M4: Responsive tablet (1024-1279) — gauge -20% size, telemetry-grid collapses to 1 column.
- M4: New dependencies: `uplot` 1.6.31, `echarts` 5.5.1, `echarts-for-react` 3.0.2.
- M4: New DECISIONS D-51..D-54 (xem DECISIONS.md).

## [0.4.0] - 2026-08-30

### Added
- M3: Design System (M3 chốt UI/UX) — `docs/02_design/design_system.md` với design tokens, components spec, motion, accessibility, toast spec.
- M3: Wireframes ASCII cho 6 màn hình (Login, Overview, DeviceDetail, Events, Diagnostics, Settings) — `docs/02_design/wireframes.md`.
- M3: `ToastStack` component (`webapp/src/components/Toast.tsx`) — top-right, max 5 stack, group theo `code` (5s window), auto-dismiss 8s cho info/warning, manual cho critical.
- M3: `useToasts` Zustand store (`webapp/src/store/toasts.ts`) với group/remove/clear actions.
- M3: Wire toast vào `OverviewPage`: nhận `event` (critical/warning) + `status` (state transition online→error) qua WebSocket, push toast real-time.
- M3: Pulse animation cho state dot `error` đã có (D-22) — confirm spec.
- M3: New DECISIONS D-50 (xem DECISIONS.md).

## [0.3.0] - 2026-08-30

### Added
- M2: Frontend SPA (Vite + React 18 + TypeScript).
- M2: Layout shell Grafana-style (TopBar + left rail, dark/light toggle).
- M2: Design tokens (CSS variables) — colors, spacing, typography per D-10 SCADA+HMI density.
- M2: Auth flow — login page, `/api/auth/me` hydration, logout.
- M2: TanStack Query cho REST API + Zustand cho auth/theme state (persisted to localStorage).
- M2: Reconnecting WebSocket client (exponential backoff 1s→30s).
- M2: API client với CSRF double-submit (auto-inject `X-CSRF-Token` header).
- M2: Pages: `/login`, `/` (Overview), `/devices/:id`, `/events`, `/diagnostics`, `/settings`.
- M2: Components: `DeviceCard`, `StateDot`, `SourceBadge`, `SeverityChip`.
- M2: Indicator nguồn (`SIM`/`REAL`) trên mỗi device card (D-11).
- M2: Indicator state dot với pulse animation cho `error` (D-07).
- M2: Dark/light mode toggle (D-04), persisted.
- M2: Source filter (All / Simulated / Real) trên Overview.
- M2: Admin-only `/settings` (Simulator toggle, Source Mapping CRUD).
- M2: nginx reverse proxy (port 5173) cho `/api` + `/ws`.
- M2: Dockerfile multi-stage (node:20-alpine build + nginx:1.27-alpine runtime).
- M2: docker-compose thêm service `webapp` (port 5173).
- M2: Lazy loading cho tất cả pages (code splitting).
- M2: New DECISIONS D-47, D-48, D-49 (xem DECISIONS.md).

### Changed
- docker-compose: backend `expose` → `ports` để webapp nginx có thể proxy trong network nội bộ (D-29).

## [0.2.1] - 2026-08-30

### Fixed (QA M1 findings, 18 issues)

#### Blocker
- **#1 logout cookie attrs**: `delete_cookie` now mirrors `httpOnly`, `Secure`, `SameSite`, `Path` (Finding #1).
- **#2 wire MQTT consumer**: real `app/mqtt/consumer.py` (aiomqtt + jsonschema) wired into `lifespan`; validated per `backend/master_protocol_v1.json` (volume-mounted, hot-reloadable per spec mục 7.1); full pipeline Simulator → EMQX → consumer → InfluxDB verified (Finding #2).

#### Major
- **#3 logout invalid token audit**: `auth.logout.invalid_token` row written when rt decode fails (Finding #3).
- **#4 rt rotation comment**: code comment links D-19 future work (Finding #4).
- **#5 declared source from mapping**: dispatch uses `device_sources.resolve_source()` not hard-coded `"real"` (Finding #5).

#### Minor
- **#6 purge_diag consistency**: switched to `delete(DeviceDiag).where(...)` (Finding #6).
- **#7 rate-limit auth**: 5 attempts/min/IP for login, 30/min/IP for refresh; disabled in test mode (Finding #7).
- **#8 exclude_none on response**: `EventOut`/`StatusOut` use `model_config(exclude_none=True)` (Finding #8).
- **#9 placeholder bcrypt hash**: `.env.example` now `__REPLACE_WITH_BCRYPT_HASH__` (Finding #9).
- **#11 integration tests**: `backend/tests/test_api.py` (12 tests) + `conftest.py`; 17/17 passing.
- **#12 utcfromtimestamp**: replaced with `datetime.fromtimestamp(ts, tz=timezone.utc)` (Finding #12).
- **#18 login.fail detail**: audit `detail={"reason":"invalid_credentials"}` (Finding #18).

### Added
- `backend/master_protocol_v1.json` — JSON Schema v1 (oneOf envelope + 5 categories).
- `backend/app/mqtt/consumer.py` — aiomqtt loop, schema hot-reload, dispatch by topic category, InfluxDB write.
- `backend/app/core/rate_limit.py` — in-memory sliding window limiter.
- `backend/app/core/cookies.py` — `delete_cookie_kwargs()` / `delete_csrf_cookie_kwargs()` helpers.
- `backend/tests/test_api.py` — integration tests with TestClient + Postgres.
- `backend/tests/conftest.py` — env setup before import.
- New DECISIONS D-43, D-44, D-45, D-46 (see DECISIONS.md).

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
[0.5.0]: #
[0.4.0]: #
[0.3.0]: #
[0.2.1]: #
[0.2.0]: #
[0.1.0]: #
