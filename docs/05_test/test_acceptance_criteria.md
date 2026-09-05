---
title: Test Acceptance Criteria
category: test
owner: project_lead
created: 2026-09-01
updated: 2026-09-01
status: approved
version: 1.1.0
---

# Test Acceptance Criteria (v0.9.0)

> Tiêu chí chấp nhận (Acceptance Criteria) tổng hợp từ M0 → M9. Mỗi AC là **Pass/Fail** rõ ràng, có **cách verify** cụ thể và **nguồn gốc** (plan/milestone).
> Bảng này dùng cho **acceptance gate**: nếu bất kỳ AC nào Fail → không ship.

## Tổng quan

- **9 milestones**: M0..M7, M9 (M8 bị bỏ qua).
- **8 nhóm AC** dưới đây, tổng ~50 AC.
- **Pass = OK to ship**, **Fail = blocker**.

---

## AC-1: Foundation (M0)

| # | AC | Pass/Fail | Cách verify | Nguồn |
|---|---|---|---|---|
| 1.1 | `docs/FILE_MANAGEMENT.md` tồn tại với 10 mục (scope, structure, naming, ...) | ☐ | `cat docs/FILE_MANAGEMENT.md` | M0 |
| 1.2 | 7 thư mục con (`01_plan/..06_changelog/`, `99_attachments/`) tồn tại với README.md | ☐ | `ls docs/0*` | M0 |
| 1.3 | Mọi file `.md` có frontmatter (title, category, owner, created, updated, status, version) | ☐ | `head -10 docs/01_plan/plan_overview.md` | M0 |
| 1.4 | `docs/99_attachments/payload_spec_v1.md` tồn tại (spec nguồn chân lý) | ☐ | `ls docs/99_attachments/` | M0 |

## AC-2: Backend (M1, M9)

| # | AC | Pass/Fail | Cách verify | Nguồn |
|---|---|---|---|---|
| 2.1 | 5 services Docker Up + healthy | ☐ | `docker compose ps` (postgres/influxdb/emqx/redis/backend + webapp) | M1, M9 |
| 2.2 | Alembic migration chạy tự động lúc backend start | ☐ | `docker compose logs backend \| grep "alembic"` | M1 |
| 2.3 | `GET /healthz` returns `{"status":"ok"}` | ☐ | `curl http://localhost:8000/healthz` | M1 |
| 2.4 | `GET /docs` (Swagger UI) accessible | ☐ | `curl -sI http://localhost:8000/docs` (200) | M1 |
| 2.5 | 25/25 unit tests pass | ☐ | `docker compose exec backend python -m pytest tests/` | M1, M5, QA |
| 2.6 | 5 Postgres tables tồn tại | ☐ | `docker compose exec postgres psql -U iigw -d iigw -c "\\dt"` | M1 |
| 2.7 | MQTT consumer kết nối EMQX khi start | ☐ | `docker compose logs backend \| grep "mqtt consumer connected"` | M1 |
| 2.8 | Multi-instance: backend2 start với profile `multi-instance` | ☐ | `docker compose --profile multi-instance up -d backend2` | M9 |
| 2.9 | Rate limit shared qua Redis ZSET | ☐ | Login sai 5 lần backend1 → 429; backend2 cũng 429 | M9 |
| 2.10 | Cross-instance WS broadcast qua Redis pub/sub | ☐ | backend1 publish source_changed → backend2 WS nhận | M9 |

## AC-3: Data pipeline (M1, M6)

| # | AC | Pass/Fail | Cách verify | Nguồn |
|---|---|---|---|---|
| 3.1 | Simulator publish 3 device → backend consumer ghi vào InfluxDB | ☐ | `make start-simulator` + `influx query '...count()'` | M1, M6 |
| 3.2 | Gateway "thật" publish → tương tự simulator | ☐ | Run script ở mục 9 test_checklist.md | M6 |
| 3.3 | Pattern inference: `GW_LINE_A_01` → real, `SIM_*` → simulated | ☐ | `GET /api/devices` | M1 |
| 3.4 | LWT (ts=0, state=offline) → state hiển thị offline | ☐ | Publish LWT → `GET /api/devices/{id}/latest` show offline | M6 |
| 3.5 | Negative payload (key sai, registers rỗng, reason=null, code ngoài enum) bị drop | ☐ | `docker compose logs backend \| grep "drop"` | M6 |
| 3.6 | 9/9 negative tests dropped trong M6 test report | ☐ | Xem `docs/05_test/test_report_m6.md` TC4 | M6 |
| 3.7 | source_changed broadcast qua WS khi admin đổi mapping | ☐ | PUT mapping, WS subscriber nhận message | M6 |

## AC-4: API (M1, M5)

| # | AC | Pass/Fail | Cách verify | Nguồn |
|---|---|---|---|---|
| 4.1 | OpenAPI docs auto-generated | ☐ | `GET /openapi.json` returns valid JSON | M1 |
| 4.2 | `GET /api/devices` returns list với `source` field | ☐ | `curl -b cookies http://localhost:8000/api/devices` | M1 |
| 4.3 | `GET /api/devices/{id}/telemetry/history?register=X&from=&to=` trả time-series | ☐ | Same URL with valid params | M1 |
| 4.4 | `GET /api/events?severity=critical&code=...` filter đúng | ☐ | Same URL | M1, M5 |
| 4.5 | `GET /api/exports/telemetry?format=csv` returns CSV file | ☐ | Download via browser, mở Excel được | M1, M5 |
| 4.6 | `GET /api/exports/events?format=xlsx` returns XLSX file | ☐ | Download + mở Excel | M1, M5 |
| 4.7 | Export >100,000 rows returns 413 | ☐ | Set EXPORT_MAX_ROWS=10 trong env, test | M1 |

## AC-5: Auth (M1, M5)

| # | AC | Pass/Fail | Cách verify | Nguồn |
|---|---|---|---|---|
| 5.1 | Login sai password → 401 | ☐ | UI test 1.2 | M1 |
| 5.2 | Login rate limit 5/min/IP | ☐ | 5 lần login sai, lần 6 → 429 | M1, M9 |
| 5.3 | JWT_SECRET < 32 bytes fail-fast ở startup | ☐ | `JWT_SECRET=short docker compose up backend` → crash | M1 |
| 5.4 | Cookie `at` HttpOnly + SameSite=strict | ☐ | DevTools → Application → Cookies | M1 |
| 5.5 | Refresh token rotate qua `POST /api/auth/refresh` | ☐ | Sau 15 phút, login lại OK | M1, M5 |
| 5.6 | Logout xoá cookies + blacklist `jti` trong `revoked_refresh` | ☐ | `psql -c "SELECT * FROM revoked_refresh"` | M1 |
| 5.7 | CSRF block mutation thiếu `X-CSRF-Token` header | ☐ | `curl -X POST without header → 403` | M1 |
| 5.8 | Logout với forged rt ghi audit `auth.logout.invalid_token` | ☐ | Check `audit_log` table | M1 (QA) |
| 5.9 | User management: admin có thể CRUD viewer | ☐ | UI test 6.6-6.10 | M5 |

## AC-6: Webapp (M2, M3, M4, M7)

| # | AC | Pass/Fail | Cách verify | Nguồn |
|---|---|---|---|---|
| 6.1 | Webapp serve trên port 5173 | ☐ | `curl -sI http://localhost:5173/` (200) | M2 |
| 6.2 | 6 pages route đúng: /, /devices/:id, /events, /diagnostics, /settings, /login | ☐ | Click qua các route | M2-M5 |
| 6.3 | Lazy loading: bundle chính ~250KB, DeviceDetailPage chunk ~450KB | ☐ | DevTools → Network → JS sizes | M4, M7 |
| 6.4 | Dark/Light theme toggle + persist | ☐ | UI test 8.1-8.3 | M2, M7 |
| 6.5 | Design tokens (color/spacing/typography) khớp với design_system.md | ☐ | Visual + DevTools | M3 |
| 6.6 | Wireframes đã deliver: Login, Overview, DeviceDetail, Events, Diagnostics, Settings | ☐ | Cross-check wireframes.md vs UI | M3, M7 |
| 6.7 | uPlot chart: zoom (wheel) + pan (drag) | ☐ | UI test 3.10 | M4 |
| 6.8 | ECharts gauge: hiển thị value realtime | ☐ | UI test 3.9 | M4 |
| 6.9 | TimeRangePicker: 5m/15m/1h/6h/24h/7d + Custom | ☐ | UI test 3.4 | M4 |
| 6.10 | Toast: top-right, max 5, group rule | ☐ | UI test 7.1-7.3 | M3 |
| 6.11 | Sound toggle + Web Audio beep on critical | ☐ | UI test 7.4 | M5 |
| 6.12 | User role check: viewer không vào `/settings` | ☐ | Login as viewer → /settings redirect | M5 |

## AC-7: Production hardening (M7)

| # | AC | Pass/Fail | Cách verify | Nguồn |
|---|---|---|---|---|
| 7.1 | README.md ở root project (overview + quickstart) | ☐ | `cat README.md` | M7 |
| 7.2 | `docs/04_runbook/runbook_deploy.md` (production setup) | ☐ | `cat docs/04_runbook/runbook_deploy.md` | M7 |
| 7.3 | `docs/04_runbook/runbook_local_dev.md` (dev setup) | ☐ | `cat docs/04_runbook/runbook_local_dev.md` | M1 |
| 7.4 | `docs/DECISIONS.md` có 65 quyết định (D-01..D-65) | ☐ | `grep -c "^## D-" docs/DECISIONS.md` returns 65 | M0..M9 |
| 7.5 | `docs/CHANGELOG_webapp.md` v0.9.0 | ☐ | `head -20 docs/06_changelog/CHANGELOG_webapp.md` | M0..M9 |
| 7.6 | `docs/06_changelog/RELEASE_v0.9.0.md` summary | ☐ | `cat docs/06_changelog/RELEASE_v0.9.0.md` | M7 |
| 7.7 | Smoke test 1h stable (3 SIM + 1 REAL) — 0 errors | ☐ | Xem `docs/05_test/test_report_m7.md` | M7 |
| 7.8 | Không có real secret trong git (chỉ placeholder) | ☐ | `git ls-files \| xargs grep "JWT_SECRET="` returns only .env.example | M7 |
| 7.9 | `.env` ignored ở cả root, backend, webapp | ☐ | `git check-ignore .env backend/.env webapp/.env` | M7 |
| 7.10 | Docker stack reproducible: `make up` chạy thành công từ fresh clone | ☐ | Test trên máy mới | M7 |

## AC-8: Tests (M6, M7, M9)

| # | AC | Pass/Fail | Cách verify | Nguồn |
|---|---|---|---|---|
| 8.1 | `docs/05_test/test_report_m6.md`: 7 test cases E2E (multi-device, switch, LWT, negative, source_changed, session refresh, performance) | ☐ | `cat docs/05_test/test_report_m6.md` | M6 |
| 8.2 | `docs/05_test/test_report_m7.md`: bundle analysis, smoke 1h, known limitations | ☐ | `cat docs/05_test/test_report_m7.md` | M7 |
| 8.3 | `docs/05_test/test_report_m9.md`: 3 test cases multi-instance (single, cross, rate limit) | ☐ | `cat docs/05_test/test_report_m9.md` | M9 |
| 8.4 | `docs/05_test/test_checklist.md`: 70+ tiêu chí manual test | ☐ | `cat docs/05_test/test_checklist.md` | M7 (cleanup) |
| 8.5 | 25/25 unit tests pass | ☐ | `pytest tests/` | M1, M5 |
| 8.6 | 5/5 critical fix từ QA M1 review | ☐ | `git log --grep "QA M1"` | QA M1 |

---

## Decision matrix

Khi review cho release gate:

| Pass | Action |
|---|---|
| **All 50+ AC Pass** | SHIP v0.9.0 |
| **48-49 Pass** (1-2 Fail) | MERGE sau fix minor |
| **45-47 Pass** (3-5 Fail) | DELAY release, fix trong next sprint |
| **<45 Pass** (6+ Fail) | BLOCK release, fix blocker |

## Changelog

- 2026-09-01: Test Acceptance Criteria v1.0.0 — 50+ AC cho v0.9.0 (M0-M9).
- 2026-09-01: Bump v1.1.0 — link `scripts/quick_smoke.sh`.
