---
title: Release v0.9.0
category: changelog
owner: project_lead
created: 2026-09-01
updated: 2026-09-01
status: approved
version: 0.9.0
---

# Release v0.9.0 — Project Complete (M0–M9)

> IIoT Gateway webapp: real-time dashboard cho hệ thống PLC/Modbus → Gateway (STM32+W5500) → MQTT → Backend → Webapp.

## Highlights

- **End-to-end pipeline**: Simulator/Gateway → EMQX → Backend (FastAPI + aiomqtt + jsonschema) → InfluxDB/Postgres → REST API + WebSocket.
- **Multi-instance backend**: Redis pub/sub (`iigw:ws` channel) cho cross-instance WebSocket broadcast. Rate limit shared qua Redis ZSET (D-44 future done).
- **Frontend SPA**: React 18 + TS + Vite, 6 pages (Login, Overview, DeviceDetail 5-tab, Events, Diagnostics, Settings), uPlot chart + ECharts gauge, dark/light theme, sound alerts (Web Audio).
- **Auth**: JWT cookie (access 15m + refresh 8h) + CSRF double-submit + bcrypt cost 12 + login rate limit.
- **Admin**: User management (CRUD + role + password), source mapping (pattern `SIM_*` / `^[A-Z]+_[A-Z]+_[0-9]+$`), simulator toggle, CSV/XLSX export với 100K row limit.
- **Audit + retention**: mọi admin action audit; diag 90d, audit 365d, revoked 30d (config-driven qua env, không hard-code).
- **Tests**: 25/25 unit + 3 bộ integration test report (M6 7 TC, M7 1h smoke, M9 3 TC multi-instance).

## Phases

| Phase | Scope | Status |
|---|---|---|
| M0 | Tài liệu skeleton (FILE_MANAGEMENT, 7 danh mục) | ✅ DONE |
| M1 | Backend FastAPI + Postgres + InfluxDB + MQTT consumer + 13 QA fixes | ✅ DONE |
| M2 | Webapp React 18 + nginx proxy + WS reconnect | ✅ DONE |
| M3 | UI/UX concept (design system, wireframes, toast) | ✅ DONE |
| M4 | Device detail (5 tabs + uPlot + ECharts + time range) | ✅ DONE |
| M5 | Events/Export + sound + user management + advanced filter | ✅ DONE |
| M6 | Real integration + 2 bug fixes (LWT timestamp, source_changed) | ✅ DONE |
| M7 | Polish + README + deploy runbook + bundle analysis | ✅ DONE |
| M9 | Multi-instance backend via Redis pub/sub | ✅ DONE |

## Stack

- **Backend**: Python 3.12, FastAPI 0.115, SQLAlchemy 2.0, Alembic, aiomqtt, redis, jsonschema
- **Frontend**: React 18.3, TypeScript 5.6, Vite 5.4, TanStack Query 5, Zustand, uPlot, ECharts, react-router-dom 6
- **Infra**: PostgreSQL 16, InfluxDB 2.7, EMQX 5.6, Redis 7, nginx 1.27, Docker Compose

## Bundle metrics

- Total dist: 4.2 MB (with source maps)
- JS+CSS unzipped: ~740 KB
- JS+CSS gzipped estimate: ~240 KB
- index.html gzipped estimate: ~1 KB
- DeviceDetailPage chunk (ECharts + uPlot) lazy-loaded (~448 KB unzipped)

## Tài liệu (25 files)

- `README.md` (root) — project overview + quickstart
- `docs/DECISIONS.md` — 65 quyết định kiến trúc (D-01 → D-65)
- `docs/01_plan/` — 4 plan files (overview, data pipeline, webapp architecture, UI/UX concept)
- `docs/02_design/` — 4 design files (ERD, webapp architecture, design system, wireframes)
- `docs/03_api/api_reference.md` — REST + WebSocket API
- `docs/04_runbook/` — 3 runbooks (local dev, deploy, git workflow)
- `docs/05_test/` — 3 test reports (M6 7 TC, M7 1h smoke, M9 3 TC)
- `docs/06_changelog/` — keep-a-changelog + release notes
- `docs/99_attachments/payload_spec_v1.md` — schema nguồn chân lý

## Known limitations (tracked in `docs/05_test/test_report_m7.md`)

- WebSocket stickiness (cần load balancer sticky session)
- Redis SPOF (production cần Sentinel/Cluster)
- Rate limit + WS hub in-memory fallback (khi Redis down)
- Sound Web Audio API autoplay policy (cần 1 click đầu)
- Diag 5-15 phút (không realtime stream)
- Single sign-on (SSO/OIDC) chưa có
- Export chưa có signed URL

## Quick start

```bash
cp .env.example .env
make hash P=admin123  # paste vào ADMIN_BOOTSTRAP_PASSWORD_HASH=$$2b$$12$$...
make up
make start-simulator   # optional
open http://localhost:5173  # login admin/admin123
```

Xem `docs/04_runbook/runbook_local_dev.md` (dev) hoặc `runbook_deploy.md` (production).

## Next steps (Future work, không block v0.9.0)

- M10: SSO/OIDC (Keycloak/Google/Microsoft)
- M11: Email alerting cho critical event
- M12: Ack events UI (operator click "ack" trong Events page)
- M13: Production deploy thực sự (HTTPS + backup + Prometheus + Grafana)
- M14: Signed export URL (cho compliance)

## Git tag

```bash
git tag -a v0.9.0 -m "Release v0.9.0: project complete (M0-M9)"
```

## Change history

- 2026-09-01: Release v0.9.0 — project complete M0–M9.
