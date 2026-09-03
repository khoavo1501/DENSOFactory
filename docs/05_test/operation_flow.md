---
title: Operation Flow Report
category: test
owner: project_lead
created: 2026-09-01
updated: 2026-09-01
status: approved
version: 1.0.0
---

# Operation Flow Report — IIoT Gateway v0.9.0

> Báo cáo luồng hoạt động end-to-end của dự án: từ master (STM32+W5500) đọc dữ liệu Modbus đến operator xem realtime trên webapp.
> Mục tiêu: giúp user/QA/operator hiểu rõ **luồng dữ liệu đi đâu**, **ai xử lý gì**, **khi nào persist**, **khi nào broadcast**.

## 1. Tổng quan kiến trúc

```
┌────────────┐  RS-485/Modbus RTU  ┌──────────────┐
│   PLCs /   │ ─────────────────► │   Master     │
│  Sensors   │                     │ STM32 + W5500│
└────────────┘                     └──────┬───────┘
                                        │ MQTT publish
                                        │ (QoS 1, retain
                                        │  cho status/info)
                                        ▼
                              ┌──────────────────┐
                              │   EMQX Broker     │
                              │   :1883           │
                              └────────┬─────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │   Backend (FastAPI)              │
                    │   ┌──────────────────────────┐   │
                    │   │ MQTT Consumer (aiomqtt)   │  │
                    │   │   - subscribe devices/+/+ │  │
                    │   │   - validate JSON Schema  |   │
                    │   │   - dispatch by topic    │   │
                    │   └──────────┬───────────────┘   │
                    │              │                    │
                    │   ┌──────────▼───────────────┐   │
                    │   │ Schema hot-reload        │   │
                    │   │ (master_protocol_v1.json)│   │
                    │   └──────────┬───────────────┘   │
                    │              │                    │
                    │   ┌──────────▼───────────────┐   │
                    │   │ Handlers                 │   │
                    │   │  ├ telemetry -> InfluxDB │   │
                    │   │  ├ status    -> InfluxDB │   │
                    │   │  ├ event     -> InfluxDB │   │
                    │   │  ├ diag      -> Postgres  │   │
                    │   │  └ info      -> log only  │   │
                    │   └──────────┬───────────────┘   │
                    │              │                    │
                    │   ┌──────────▼───────────────┐   │
                    │   │ WS Hub (in-memory +      │   │
                    │   │ Redis pub/sub for M9)    │   │
                    │   └──────────┬───────────────┘   │
                    │              │                    │
                    └──────────────┼────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
  ┌──────────┐              ┌──────────┐              ┌──────────┐
  │ Postgres │              │ InfluxDB │              │  Redis   │
  │ :5432    │              │ :8086    │              │  :6379   │
  │          │              │          │              │ (M9)     │
  │  users   │              │ _telem.  │              │  pub/sub │
  │  sources │              │ _status  │              │  ZSET rl │
  │  diag    │              │ _event   │              └──────────┘
  │  audit   │              │          │
  │  revoked │              │          │
  └──────────┘              └──────────┘
        ▲                          ▲
        │                          │
        │      ┌───────────────────┴─────────┐
        │      │   Webapp (nginx + React)      │
        └──────┤   http://localhost:5173      │
               │   - TanStack Query (REST)     │
               │   - WebSocket (realtime)     │
               │   - Zustand (auth/theme)     │
               │   - uPlot + ECharts          │
               └─────────────────────────────┘
                          ▲
                          │ HTTPS
                          │
                    ┌──────────┐
                    │ Operator │
                    │  browser │
                    └──────────┘
```

## 2. Luồng end-to-end — Happy path (5 bước)

### Bước 1: Khởi động stack

```bash
$ cd /mnt/newvolume/WorkSpace/Project/DENSOFactory
$ cp .env.example .env
$ make hash P=admin123            # paste bcrypt hash vào .env
$ make up                          # docker compose up -d (6 services)
$ make start-simulator             # optional: 3 SIM devices
```

**Output**:
- 6 services Up: postgres (healthy), influxdb (healthy), emqx (healthy), redis (healthy), backend, webapp
- Backend chạy alembic migration tự động → 5 tables trong Postgres
- Backend kết nối EMQX qua MQTT (subscribe `devices/+/+`)
- Backend kết nối Redis (nếu `REDIS_URL` set) — start RedisBus
- Webapp nginx serve React build trên port 5173

### Bước 2: Operator login

```
Browser (port 5173)             Backend (port 8000)
  │                                  │
  │  GET /                           │
  ├─────────────────────────────────►│
  │  (nginx serves React index.html) │
  │◄─────────────────────────────────┤
  │  HTML + JS bundle                │
  │                                  │
  │  React mount                     │
  │  useAuth.checkLogin()            │
  │  → fetch /api/auth/me            │
  │  (cookies có thể cũ)             │
  │                                  │
  │  GET /api/auth/me (no cookies)   │
  ├─────────────────────────────────►│
  │                                  │ get_current_user() -> 401
  │◄─────────────────────────────────┤
  │  → useAuth.setUser(null)          │
  │  → <Navigate to="/login">        │
  │                                  │
  │  User nhập admin/admin123         │
  │  POST /api/auth/login            │
  ├─────────────────────────────────►│
  │  {username, password}            │ verify_password(...)
  │                                  │ create_access_token (15m)
  │                                  │ create_refresh_token (8h)
  │                                  │ set cookies: at, rt, csrf
  │◄─────────────────────────────────┤
  │  Set-Cookie: at=eyJ...;           │
  │               rt=eyJ...;          │
  │               csrf=hex...;        │
  │  {username: "admin", role:...}   │
  │                                  │
  │  React useAuth.setUser(user)      │
  │  → <Navigate to="/">             │
  │                                  │
  │  fetch /api/auth/me (có at)      │
  ├─────────────────────────────────►│
  │                                  │ get_current_user() -> ok
  │◄─────────────────────────────────┤
  │  {username, role}                │
  │  → Shell render (TopBar + rail)  │
```

**Thời gian**: ~500ms (login + hydrate)

### Bước 3: Operator mở Overview page

```
Browser                              Backend
  │                                    │
  │  GET /api/devices                  │
  ├───────────────────────────────────►│
  │  Cookie: at, rt, csrf             │
  │                                    │ get_current_user() OK
  │                                    │ SELECT DISTINCT device_id, state, last_seen
  │                                    │   FROM InfluxDB (last 30d)
  │                                    │   LEFT JOIN device_sources
  │◄───────────────────────────────────┤
  │  [                                  │
  │    {                                │
  │      "device_id": "GW_LINE_A_01",  │
  │      "source": "real",             │
  │      "state": "online",            │
  │      "last_seen_ts": 1692816000     │
  │    },                               │
  │    {                                │
  │      "device_id": "SIM_LINE_A_01", │
  │      "source": "simulated",        │
  │      "state": "online"             │
  │    }                                │
  │  ]                                  │
  │                                    │
  │  React Query cache 30s             │
  │  → DeviceCard grid (4 devices)    │
  │                                    │
  │  WS connect:                       │
  │  ws://.../ws/devices?device_id=* │
  ├───────────────────────────────────►│
  │  (nginx proxy /ws -> backend)     │
  │                                    │ ws_devices() accept()
  │                                    │ hub.subscribe("*")
  │                                    │   ↑ wait for messages
  │◄───────────────────────────────────┤
  │  WebSocket open                    │
```

**Đồng thời, master (giả lập) publish telemetry:**

```
Master (or simulator)              EMQX               Backend
  │                                  │                   │
  │  PUBLISH devices/GW_LINE_A_01/  │                   │
  │         telemetry                │                   │
  │  {                               │                   │
  │   device_id, ts, type,           │                   │
  │   registers: {hr_100: 352, ...} │                   │
  │  }                               │                   │
  ├─────────────────────────────────►│                   │
  │  QoS 1                           │                   │
  │                                  │  deliver to subs  │
  │                                  ├──────────────────►│
  │                                  │  (aiomqtt message)│
  │                                  │                   │ schema validate
  │                                  │                   │ dispatch.handle_telemetry
  │                                  │                   │ ├ InfluxDB write
  │                                  │                   │ └ hub.publish(GW_LINE_A_01, ...)
  │                                  │                   │      ├ local in-memory queue
  │                                  │                   │      └ RedisBus.publish (M9)
  │                                  │                   │            └ cross-instance broadcast
  │                                  │                   │
  │                                  │                   │ ws_devices() loop:
  │                                  │                   │   msg = q.get() -> send_text(msg)
  │                                  │                   │
  │◄─────────────────────────────────┼───────────────────┤
  │  Browser nhận JSON qua WS        │                   │
  │  → DeviceCard update gauge        │                   │
  │    (live value display)           │                   │
```

**Thời gian end-to-end**: 1-2 giây (publish → browser render)

### Bước 4: Operator click vào 1 device → DeviceDetail

```
Browser                              Backend
  │                                    │
  │  Click card SIM_LINE_A_01          │
  │  → navigate /devices/SIM_LINE_A_01
  │                                    │
  │  GET /api/devices/SIM_LINE_A_01/   │
  │      latest                        │
  ├───────────────────────────────────►│
  │                                    │ SELECT state FROM InfluxDB
  │                                    │ SELECT registers FROM InfluxDB (last 5m)
  │◄───────────────────────────────────┤
  │  {status: {state: "online", ...},   │
  │   source: "simulated"}             │
  │                                    │
  │  Tabs render                       │
  │  Telemetry active                  │
  │  → fetch /api/devices/SIM_LINE_A_01/telemetry/history?register=hr_100&from=...
  ├───────────────────────────────────►│
  │                                    │ InfluxDB query (1m agg)
  │◄───────────────────────────────────┤
  │  [{ts, value}, ...]                │
  │                                    │
  │  uPlot render chart                │
  │  ECharts render gauge              │
  │                                    │
  │  WS subscribe per-device:          │
  │  ws://.../ws/devices?device_id=SIM_LINE_A_01
  ├───────────────────────────────────►│
  │  (chỉ nhận message cho device này) │
  │                                    │
  │  Mỗi 2s simulator publish →        │
  │  → WS msg → React update gauge    │
```

### Bước 5: Critical event → Toast + sound

```
Simulator (or master)            EMQX           Backend                  Browser
  │                                │              │                          │
  │  PUBLISH devices/X/event       │              │                          │
  │  {                             │              │                          │
  │   events: [{                  │              │                          │
  │     code: SLAVE_COMM_LOST,     │              │                          │
  │     severity: "critical"       │              │                          │
  │   }]                           │              │                          │
  ├────────────────────────────────►│              │                          │
  │                                │              │ schema validate          │
  │                                │              │ dispatch.handle_event    │
  │                                │              │ ├ InfluxDB write         │
  │                                │              │ └ hub.publish(X, msg)    │
  │                                │              │   ├ local queue          │
  │                                │              │   └ RedisBus (M9)        │
  │                                │              │                          │
  │                                │              │ ws_devices() loop:      │
  │                                │              │   q.get() -> send_text   │
  │                                │              │                          │
  │                                │              │   (1) Overview WS sub:   │
  │                                │              │   useToasts.push()       │
  │                                │              │   → ToastStack render    │
  │                                │              │                          │
  │                                │              │   (2) DeviceDetail WS:   │
  │                                │              │   setLiveRegisters()     │
  │                                │              │   → update gauges        │
  │                                │              │                          │
  │                                │              │   (3) Sound (nếu bật):   │
  │                                │              │   playCriticalBeep()     │
  │                                │              │   → Web Audio beep       │
  │                                │              │                          │
  │                                │              │   (4) Audit log:         │
  │                                │              │   audit.write(...)       │
  │                                │              │   → Postgres audit_log   │
  │                                │              │                          │
  │◄───────────────────────────────┼──────────────┤                          │
  │  Browser nhận:                  │              │                          │
  │  - Toast top-right (critical)    │              │                          │
  │  - Beep (nếu sound bật)         │              │                          │
  │  - Badge update                 │              │                          │
  │  - Events tab refresh           │              │                          │
```

## 3. Luồng xử lý 5 loại MQTT message

| Topic | Handler | Persistence | WS Broadcast |
|---|---|---|---|
| `devices/{id}/telemetry` | `dispatch.handle_telemetry` | InfluxDB `device_telemetry` (1 point/register) | ✅ `telemetry` event |
| `devices/{id}/status` | `dispatch.handle_status` (ts=0 → server time) | InfluxDB `device_status` | ✅ `status` event |
| `devices/{id}/event` | `dispatch.handle_event` (validate code in enum) | InfluxDB `device_event` | ✅ `event` event (push to toast if critical) |
| `devices/{id}/diag` | `dispatch.handle_diag` (merge vào Postgres) | **Postgres** `device_diag` (PK: device_id, ts) | ✅ `diag` event |
| `devices/{id}/info` | (log only per spec mục 7.2) | log only | ❌ (not stored) |

**Retention** (config-driven qua env):
- `device_diag` Postgres: 90 ngày
- `audit_log` Postgres: 365 ngày
- `revoked_refresh` Postgres: 30 ngày
- InfluxDB: 30 ngày (mặc định)

## 4. Luồng Auth (7 sub-flow)

### 4.1 Login
```
POST /api/auth/login {username, password}
  → verify_password (bcrypt cost 12)
  → create_access_token (HS256, 15m)
  → create_refresh_token (HS256, 8h)
  → audit.write(auth.login.success)
  → Set-Cookie: at, rt, csrf (HttpOnly, SameSite=Strict)
  → 200 {username, role}
```

### 4.2 Authenticated request
```
GET /api/devices
  Cookie: at=eyJ..., csrf=hex...
  → get_current_user (decode at, verify user in DB)
  → handler logic
  → 200 [...]
```

### 4.3 CSRF-protected mutation
```
PUT /api/admin/devices-sources/{id}
  Cookie: csrf=hex...
  Header: X-CSRF-Token: hex...
  → CSRF middleware: cookie == header?
    - match → handler runs
    - mismatch → 403
```

### 4.4 Access token refresh
```
GET /api/anything (at expired, rt valid)
  → get_current_user: 401 (at expired)
  Frontend auto-calls:
POST /api/auth/refresh
  Cookie: rt=eyJ...
  → check rt not in revoked_refresh
  → create new at + rt (rotate)
  → audit.write(auth.refresh.success)
  → Set-Cookie: at, rt, csrf (new values)
  → 200 {username, role}
  Frontend retries original request with new at.
```

### 4.5 Logout
```
POST /api/auth/logout
  → insert jti into revoked_refresh (TTL = 8h)
  → audit.write(auth.logout)
  → Set-Cookie: at, rt, csrf with Max-Age=0
  → 204
```

### 4.6 Rate limit (5/min login, 30/min refresh)
```
attempt 1-5: pass through
attempt 6+: 429 Too Many Requests
```
- Single-instance: in-memory deque
- Multi-instance (M9): Redis ZSET (shared across all backends)

### 4.7 User management (admin only)
```
POST /api/admin/users {username, password, role}
  → validate password >=8 chars
  → bcrypt hash password
  → INSERT INTO users
  → audit.write(admin.users.create)
  → 201 {username, role}
```

## 5. Luồng xử lý sự cố

### 5.1 Master mất kết nối (LWT)
```
Master disconnect unexpectedly
  → EMQX publishes LWT (devices/{id}/status, ts=0, state=offline, reason=...)
  → Backend consumer: schema validate OK
  → dispatch.handle_status: ts=0 → replaced with _now()
  → InfluxDB write at server time (NOT 1970)
  → hub.publish → WS broadcast
  → Frontend: state changes to "offline" within 2s
  → If state was "online" → "error" transition: toast critical + state dot pulse
```

### 5.2 Payload invalid (key sai format)
```
Master publishes {temperature: 30} (key không match pattern)
  → Backend consumer: schema validate FAILED
  → log warning "schema validation failed ... drop"
  → KHÔNG ghi InfluxDB
  → KHÔNG broadcast WS
  → Không xuất hiện trong API
```

### 5.3 Backend restart
```
docker compose restart backend
  → Container stop, WS clients disconnect
  → Container start, alembic upgrade head
  → MQTT consumer reconnect EMQX (re-subscribe)
  → RedisBus reconnect (M9)
  → InfluxDB + Postgres reconnect (pool)
  → Frontend WS auto-reconnect (exponential backoff 1s → 30s)
  → Refetch /api/devices + /api/auth/me
  → No data loss (InfluxDB + Postgres persistent)
```

### 5.4 Source mapping change
```
Admin PUT /api/admin/devices-sources/{id} {source: "simulated"}
  → UPDATE device_sources SET source = 'simulated'
  → audit.write(admin.sources.upsert)
  → BackgroundTasks: _broadcast_source_changed
    → hub.publish(device_id, {type: "source_changed", source: "simulated", ...})
    → RedisBus.publish (M9) → other instances
  → Local subscribers (Overview WS) → update badge
  → Cross-instance subscribers (M9) → update badge
```

## 6. Thời gian xử lý (latency)

| Bước | Latency |
|---|---|
| Login → redirect `/` | ~500ms |
| Page first paint (initial bundle) | ~200ms |
| API `GET /api/devices` | <100ms (cached 30s) |
| WebSocket message receive (MQTT publish → render) | **1-2s** (spec target) |
| `GET /api/devices/{id}/telemetry/history` (24h, 1m agg) | <500ms |
| Source change → badge update (cross-instance) | ~500ms |
| LWT publish → state=offline visible | ~1s |
| Cleanup job (daily 2am) | async, no impact |

## 7. Persistence & storage

| Data | Store | Retention | Indexes |
|---|---|---|---|
| Telemetry (1 point/register) | InfluxDB `device_telemetry` | 30d | (device_id, register, _time) |
| Status | InfluxDB `device_status` | 30d | (device_id, _time) |
| Event | InfluxDB `device_event` | 30d | (device_id, severity, code, _time) |
| Diag (per-slave) | Postgres `device_diag` | 90d (config) | PK (device_id, ts) |
| User | Postgres `users` | forever | PK username |
| Source mapping | Postgres `device_sources` | forever | PK device_id |
| Audit log | Postgres `audit_log` | 365d (config) | (ts) |
| Revoked refresh token | Postgres `revoked_refresh` | 30d (config) | PK jti, (expires_at) |

## 8. Cấu hình đáng chú ý

| Env | Default | Mục đích |
|---|---|---|
| `JWT_SECRET` | required, ≥32 bytes | HS256 secret, fail-fast ở startup |
| `DIAG_RETENTION_DAYS` | 90 | Cleanup job cho `device_diag` |
| `AUDIT_RETENTION_DAYS` | 365 | Cleanup job cho `audit_log` |
| `ACCESS_TOKEN_TTL_MIN` | 15 | TTL access token |
| `REFRESH_TOKEN_TTL_HOURS` | 8 | TTL refresh token |
| `REDIS_URL` | (empty) | Bật multi-instance (M9); empty = single-instance |
| `INSTANCE_ID` | `backend-1` | Unique per pod cho Redis pub/sub skip-origin |
| `EXPORT_MAX_ROWS` | 100000 | Hard cap cho CSV/XLSX export |
| `COOKIE_SECURE` | false | Set true ở production (HTTPS) |
| `CORS_ORIGINS` | http://localhost:5173 | Allowlist cho CORS |

## 9. Tóm tắt — 1 dòng

**Dữ liệu từ Modbus → Master (STM32) → MQTT → EMQX → Backend (FastAPI) → InfluxDB/Postgres + WebSocket → nginx → React SPA → Operator browser**, với **Redis pub/sub** cho multi-instance horizontal scale (M9).

## 10. Cách sử dụng tài liệu này

- **Cho user/operator**: đọc mục 1-2 để hiểu cấu trúc tổng quan + happy path
- **Cho developer mới**: đọc toàn bộ, tập trung mục 3 (handlers), 4 (auth), 5 (failure modes)
- **Cho DevOps**: mục 6 (latency), 7 (storage), 8 (env vars), kết hợp `docs/04_runbook/`
- **Cho QA**: kết hợp với `docs/05_test/test_checklist.md` (manual) + `scripts/quick_smoke.sh` (auto)

## Change history

- 2026-09-01: Operation Flow Report v1.0.0 — end-to-end flow cho v0.9.0.
