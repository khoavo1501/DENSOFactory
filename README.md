# IIoT Gateway — DENSO Factory

Web dashboard cho hệ thống Gateway IIoT giá rẻ: PLC/thiết bị công nghiệp đời cũ (RS-485/Modbus RTU) → Master (STM32 + W5500) → MQTT → Backend → Webapp realtime.

![stack](https://img.shields.io/badge/stack-React%2018%20%7C%20FastAPI%20%7C%20Postgres%20%7C%20InfluxDB%20%7C%20EMQX%20%7C%20Docker-0f172a)

## Quickstart (dev)

```bash
# 1. Copy env
cp .env.example .env

# 2. Generate admin bcrypt hash (output as $2b$12$...)
make hash P=admin123
# Paste hash into .env as ADMIN_BOOTSTRAP_PASSWORD_HASH=$$2b$$12$$...

# 3. Start stack
make up

# 4. (Optional) Start simulator (3 devices)
make start-simulator

# 5. Open http://localhost:5173 — login admin/admin123
```

Toàn bộ stack chạy trong Docker Compose: `postgres`, `influxdb`, `emqx`, `backend` (FastAPI), `webapp` (nginx + React build).

## Kiến trúc

```
┌──────────────────┐         ┌──────────────────┐
│  Master (STM32)  │         │  Simulator (dev) │
│  RS-485/Modbus    │         │  simulator.py     │
│  → MQTT publish   │         │                  │
└──────────┬───────┘         └──────────┬───────┘
           │                            │
           ▼                            ▼
     ┌────────────────────────────────────┐
     │  EMQX (MQTT broker, port 1883)      │
     └────────────┬───────────────────────┘
                  │
                  ▼
     ┌────────────────────────────────────┐
     │  Backend (FastAPI)                   │
     │  - MQTT consumer (aiomqtt)          │
     │  - Schema validate (jsonschema)     │
     │  - REST API + WebSocket             │
     │  - InfluxDB write + Postgres        │
     └────────┬───────────────────┬───────┘
              │                   │
              ▼                   ▼
     ┌─────────────────┐  ┌──────────────┐
     │   InfluxDB       │  │  Postgres    │
     │   (telemetry,    │  │  (sources,   │
     │    events)       │  │   diag,      │
     │                 │  │   users,     │
     │                 │  │   audit)     │
     └────────┬────────┘  └──────┬───────┘
              │                  │
              ▼                  ▼
     ┌────────────────────────────────────┐
     │  Webapp (nginx + React SPA)         │
     │  - TanStack Query (REST)            │
     │  - ReconnectingWs (real-time)      │
     │  - uPlot (chart) + ECharts (gauge) │
     │  - Zustand (auth/theme/sound)      │
     │  http://localhost:5173              │
     └────────────────────────────────────┘
```

## Cấu trúc project

```
.
├── backend/               # FastAPI + SQLAlchemy + Alembic + aiomqtt
│   ├── app/
│   │   ├── api/          # auth, devices, events, admin, exports
│   │   ├── core/         # config, jwt, csrf, security, rate_limit
│   │   ├── db/           # SQLAlchemy session
│   │   ├── models/       # ORM models (5 tables)
│   │   ├── mqtt/         # consumer (aiomqtt) + dispatch
│   │   ├── schemas/      # Pydantic
│   │   ├── services/     # business logic
│   │   ├── ws/           # WebSocket hub
│   │   └── main.py       # FastAPI app
│   ├── alembic/          # DB migrations
│   ├── tests/            # 25 unit + integration tests
│   ├── master_protocol_v1.json   # JSON Schema for MQTT payload validation
│   └── Dockerfile
├── webapp/                # React 18 + TypeScript + Vite SPA
│   ├── src/
│   │   ├── api/          # REST + WebSocket client
│   │   ├── components/   # Shell, Tabs, Toast, Chart, Gauge, ...
│   │   ├── pages/        # 6 pages (Login, Overview, Device, Events, Diagnostics, Settings)
│   │   ├── store/        # Zustand stores
│   │   ├── styles/       # CSS variables (dark/light)
│   │   └── types/        # TypeScript types
│   ├── nginx.conf
│   └── Dockerfile
├── simulator/             # MQTT publisher for dev (Python + paho-mqtt)
├── scripts/               # generate-bcrypt-hash.py
├── docs/                  # tài liệu (xem docs/README.md)
├── docker-compose.yml
├── Makefile
└── .env.example
```

## Tài liệu

Tất cả tài liệu nằm trong `docs/`. Bắt đầu từ **[docs/README.md](docs/README.md)**.

| Mục | Mô tả |
|---|---|
| `docs/DECISIONS.md` | 60 quyết định kiến trúc (D-01 → D-60) đã chốt |
| `docs/01_plan/plan_overview.md` | WBS, milestones, future work |
| `docs/01_plan/plan_data_pipeline.md` | Sơ đồ luồng dữ liệu, switch nguồn |
| `docs/01_plan/plan_webapp_architecture.md` | ERD, API, env vars, retention |
| `docs/01_plan/plan_uiux_concept.md` | Design tokens, components, layout |
| `docs/02_design/design_system.md` | Tokens + components spec |
| `docs/02_design/wireframes.md` | ASCII wireframes 6 màn hình |
| `docs/02_design/erd_postgres.md` | Database schema |
| `docs/02_design/webapp_architecture.md` | Frontend stack |
| `docs/03_api/api_reference.md` | REST + WebSocket API |
| `docs/04_runbook/runbook_local_dev.md` | Khởi động + troubleshooting |
| `docs/04_runbook/runbook_deploy.md` | Production deployment (M7) |
| `docs/04_runbook/git_workflow.md` | Git conventions |
| `docs/05_test/test_report_m6.md` | 7 integration test cases |
| `docs/05_test/test_report_m7.md` | Final wrap-up (Lighthouse + stability) |
| `docs/06_changelog/CHANGELOG_webapp.md` | Lịch sử thay đổi theo phiên bản |
| `docs/99_attachments/payload_spec_v1.md` | Spec payload (nguồn chân lý schema) |

## Các lệnh thường dùng

| Lệnh | Mục đích |
|---|---|
| `make up` | Khởi động core stack (postgres + influxdb + emqx + backend) |
| `make down` | Dừng tất cả (giữ volumes) |
| `make logs` | Tail log tất cả services |
| `make build` | Build Docker images |
| `make rebuild` | Build lại từ đầu (no cache) |
| `make hash P=xxx` | Generate bcrypt hash cho password |
| `make start-simulator` | Bật simulator (3 devices) |
| `make stop-simulator` | Tắt simulator |
| `make clean` | Xoá volumes (DESTROYS DATA) |

## Stack

- **Backend**: Python 3.12, FastAPI 0.115, SQLAlchemy 2.0, Alembic, aiomqtt, pydantic-settings
- **Frontend**: React 18.3, TypeScript 5.6, Vite 5.4, TanStack Query 5, Zustand, uPlot 1.6, ECharts 5.5
- **Infra**: PostgreSQL 16, InfluxDB 2.7, EMQX 5.6, nginx 1.27, Docker Compose
- **Tests**: pytest 8.3 (25 integration tests), Vite build verification

## Phases

- **M0** (DONE): Tài liệu + file management skeleton
- **M1** (DONE): Backend + data layer + MQTT consumer + 13 QA fixes
- **M2** (DONE): Webapp skeleton (React + nginx proxy + WS reconnect)
- **M3** (DONE): UI/UX concept (design system + wireframes + toast)
- **M4** (DONE): Device detail (5 tabs + uPlot chart + ECharts gauge)
- **M5** (DONE): Events/Export + sound + user management
- **M6** (DONE): Real integration + 2 bug fixes (LWT + source_changed)
- **M7** (in progress): Polish + Lighthouse + 1h stability + deploy runbook

## Giấy phép

Internal project. All rights reserved.
