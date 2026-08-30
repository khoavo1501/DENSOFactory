---
title: Webapp Architecture
category: design
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 0.1.0
---

# Webapp Architecture (M2)

Tài liệu kiến trúc cho phần frontend SPA (M2). Chi tiết UI/UX xem [Plan UI/UX Concept](../01_plan/plan_uiux_concept.md).

## Stack

| Lớp | Lựa chọn |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Routing | React Router v6 |
| State (server) | TanStack Query (REST cache + refetch) |
| State (client) | Zustand (auth, theme) — persisted to localStorage |
| Style | CSS variables (design tokens) + utility classes |
| WebSocket | Native WebSocket + reconnecting wrapper (exponential backoff 1s→30s) |
| HTTP client | Native `fetch` + CSRF double-submit auto-injection |
| Chart (M4) | uPlot (time-series) + ECharts (gauge) — chưa dùng ở M2 |
| Build | Vite (dev) + Docker nginx (prod) |

## Cấu trúc thư mục

```
webapp/
├── src/
│   ├── api/
│   │   ├── client.ts        # fetch wrapper + CSRF + ApiError
│   │   ├── endpoints.ts     # authApi, devicesApi, eventsApi, adminApi
│   │   └── ws.ts            # ReconnectingWs class
│   ├── components/
│   │   ├── Shell.tsx        # TopBar + left rail layout
│   │   ├── DeviceCard.tsx   # 1 device card
│   │   └── Indicators.tsx   # StateDot, SourceBadge, SeverityChip
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── OverviewPage.tsx
│   │   ├── DeviceDetailPage.tsx
│   │   ├── EventsPage.tsx
│   │   ├── DiagnosticsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── store/
│   │   └── index.ts         # useAuth, useTheme (Zustand)
│   ├── styles/
│   │   ├── tokens.css       # design tokens (color, spacing, typography)
│   │   └── app.css          # component classes (.card, .btn, .grid, ...)
│   ├── types/
│   │   └── index.ts         # Source, DeviceState, Severity, EventCode, etc.
│   ├── App.tsx              # router + query provider
│   └── main.tsx             # entry
├── index.html
├── nginx.conf               # SPA fallback + /api + /ws proxy
├── Dockerfile               # multi-stage: node:20 build + nginx:1.27
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .dockerignore
```

## Routing

| Path | Component | Access |
|---|---|---|
| `/login` | LoginPage | Public |
| `/` | OverviewPage | Auth required |
| `/devices/:id` | DeviceDetailPage | Auth required |
| `/events` | EventsPage | Auth required |
| `/diagnostics` | DiagnosticsPage | Auth required |
| `/settings` | SettingsPage | Admin only |

`Protected` + `AdminOnly` wrappers kiểm tra `useAuth().user` (sau khi hydrate từ `/api/auth/me`).

## Layout shell

- **TopBar** (48px): brand, env chip, theme toggle, user menu (Logout).
- **Left rail** (60px icon-only, 200px khi hover): Home, Events, Diagnostics, Settings (admin).
- **Main**: scrollable content area.

CSS Grid: `grid-template-areas: "topbar topbar" "rail main"`.

## Design tokens (CSS variables)

Defined in `src/styles/tokens.css` (D-02, D-04, D-10):

- **Color** (semantic): `state.online/degraded/error/offline`, `severity.info/warning/critical`, `source.simulated/real`, `accent`.
- **Typography**: Inter (sans), JetBrains Mono (mono) với `font-variant-numeric: tabular-nums`.
- **Spacing**: 8 / 12 / 16 / 24 / 32 (3-step).
- **Density**: row height 28/32/36px (SCADA), padding scale 8/12/16.
- **Theme**: `[data-theme="dark|light"]` toggle trên `<html>`, persisted qua Zustand+localStorage.

## Real-time (WebSocket)

`ReconnectingWs` class:
- Connects `ws://<host>/ws/devices?device_id=<id>` (hoặc `*` cho Overview).
- Auto-reconnect với exponential backoff (1s → 30s cap).
- Status callback cho UI (`open` / `connecting` / `closed` / `error`).
- Cleanup `onUnmount` của effect.

Sử dụng:
- **OverviewPage**: subscribe `*`, update live values khi nhận `telemetry`.
- **DeviceDetailPage**: subscribe `device_id`, update status + registers khi nhận.

## CSRF integration

`api/client.ts` tự động:
1. Đọc cookie `csrf` (non-httpOnly) qua `document.cookie`.
2. Inject header `X-CSRF-Token` cho mọi method `POST/PUT/DELETE`.
3. Backend middleware verify header == cookie (D-16).

## Auth flow

1. **Login**: POST `/api/auth/login` → backend set cookies `at` + `rt` + `csrf`.
2. **Hydrate**: App mount → `GET /api/auth/me` → setUser nếu 200, navigate `/login` nếu 401.
3. **Protected routes**: render null hoặc redirect nếu `!user`.
4. **Admin routes**: render null hoặc redirect về `/` nếu `user.role !== "admin"`.
5. **Logout**: POST `/api/auth/logout` (CSRF) → backend xoá cookies → setUser(null) → navigate `/login`.

## Docker

Multi-stage build:
1. **Build stage** (`node:20-alpine`): `npm ci && npm run build` → output ở `/app/dist`.
2. **Runtime stage** (`nginx:1.27-alpine`): copy dist + nginx.conf.

nginx.conf:
- SPA fallback: `try_files $uri $uri/ /index.html`.
- `/api/` → `proxy_pass http://backend:8000`.
- `/ws/` → `proxy_pass http://backend:8000` với `Upgrade` + `Connection upgrade`.

## Performance

- **Code splitting**: tất cả pages lazy-load qua `React.lazy()`.
- **Bundle**: 248 KB JS + 7 KB CSS (uncompressed, dev build).
- **Refetch interval**:
  - Devices list: 30s
  - Device latest: 30s
  - Events: 15s
  - Diagnostics: 60s
- **WebSocket buffer**: in-memory tại `ReconnectingWs`; từng page chỉ subscribe cần thiết.

## Tài liệu liên quan

- [Plan UI/UX Concept](../01_plan/plan_uiux_concept.md)
- [Plan Webapp Architecture (M0 design)](../01_plan/plan_webapp_architecture.md)
- [API Reference](../03_api/api_reference.md)
- [Runbook Local Dev](../04_runbook/runbook_local_dev.md)

## Change history

- 2026-08-30: Tạo webapp_architecture.md cho M2 (v0.1.0).
