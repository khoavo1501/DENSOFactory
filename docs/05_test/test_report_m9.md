---
title: Test Report — M9
category: test
owner: project_lead
created: 2026-09-01
updated: 2026-09-01
status: approved
version: 1.0.0
---

# Test Report — M9 (Multi-instance Backend via Redis)

> Mục tiêu: scale backend horizontally qua Redis pub/sub. WebSocket broadcast đồng bộ giữa nhiều instance. Rate limit shared.

## 1. Phạm vi

| Hạng mục | Verify |
|---|---|
| RedisBus connect/subscribe/publish | ✅ |
| Single-instance: source_changed broadcast end-to-end (TC1) | ✅ |
| Cross-instance: backend1 publish → backend2 nhận qua Redis (TC2) | ✅ |
| Rate limit shared giữa instances (TC3) | ✅ |
| 25/25 unit tests vẫn pass | ✅ |
| Multi-instance profile (`backend2`) start OK | ✅ |

## 2. Kiến trúc

```
   ┌──────────────────┐         ┌──────────────────┐
   │  backend-1       │         │  backend-2       │
   │  (instance_id=   │         │  (instance_id=   │
   │   backend-1)     │         │   backend-2)     │
   │                  │         │                  │
   │  ┌────────────┐  │         │  ┌────────────┐  │
   │  │  Hub       │  │         │  │  Hub       │  │
   │  │ (in-mem)  │  │         │  │ (in-mem)  │  │
   │  └─────┬──────┘  │         │  └─────┬──────┘  │
   │        │ pub     │         │        │ pub     │
   │        ▼         │         │        ▼         │
   │  ┌────────────┐  │         │  ┌────────────┐  │
   │  │ RedisBus  │◄─┼─────┐   ┌─┼─►│ RedisBus  │  │
   │  └────────────┘  │     │   │ └────────────┘  │
   └──────────────────┘     │   └──────────────────┘
                           │
                    ┌──────┴────────┐
                    │    Redis      │
                    │  channel:     │
                    │   iigw:ws     │
                    └───────────────┘
```

Khi instance A publish, message envelope `{origin: A, payload: ...}` được publish lên Redis. Mọi instance (kể cả A) subscribe, skip envelope có `origin == instance_id của mình` (tránh loop), còn lại dispatch vào local hub.

## 3. Kết quả test cases

### TC1 — Single-instance source_changed (baseline)
**Bước:**
1. Subscribe `ws://localhost:5173/ws/devices?device_id=SIM_LINE_A_01`.
2. PUT source mapping từ admin.
3. Đợi tối đa 3s.

**Kết quả:**
```
PUT: 200
WS: source_changed (single instance OK)
```

**Verdict:** ✅ PASS

### TC2 — Cross-instance via Redis pub/sub
**Bước:**
1. Start `backend2` qua `docker compose --profile multi-instance up -d backend2` (port 8001).
2. Subscribe WS tới `ws://localhost:8001/ws/devices?device_id=SIM_LINE_E_01` (backend2 phục vụ).
3. Login admin trên `backend1` (port 8000), PUT source mapping cho `SIM_LINE_E_01`.
4. Đợi tối đa 5s.

**Kết quả:**
```
login backend1: 200
PUT to backend1: 200
backend2 received: type=source_changed device=SIM_LINE_E_01 source=simulated
TC2 PASS
```

**Verdict:** ✅ PASS — backend1 publish qua Redis, backend2 nhận qua hub.

### TC3 — Rate limit shared
**Bước:**
1. Login sai 2 lần trên backend1 (cùng IP) → bị rate limit.
2. Login sai trên backend2 (cùng IP) → cũng 429.

**Kết quả:**
```
attempt 1 (backend1): HTTP 401
attempt 2 (backend1): HTTP 401
attempt 3 (backend1): HTTP 429
attempt 4 (backend1): HTTP 429
attempt 5 (backend1): HTTP 429
attempt 6 (backend1): HTTP 429
attempt 7 (backend2): HTTP 429  <- shared via Redis ZSET
```

**Verdict:** ✅ PASS — rate limit atomic qua Redis, multi-instance chỉ count 1 lần.

## 4. Unit tests

```
$ docker compose exec backend python -m pytest tests/

tests/test_smoke.py              6 passed
tests/test_api.py               19 passed
======================= 25 passed, 23 warnings in 9.83s
```

Test mode `APP_ENV=test` tắt rate limit + Redis (theo `_is_test()` check), nên 25 test cũ vẫn pass không cần Redis.

## 5. Code changes trong M9

| File | Change |
|---|---|
| `backend/app/ws/redis_bus.py` (mới) | RedisBus class với connect/publish/subscribe, skip-origin, auto-fallback in-memory |
| `backend/app/ws/hub.py` | Hub.publish mirror sang bus; dispatch_from_bus cho incoming; start_bus/stop_bus |
| `backend/app/main.py` | lifespan gọi start_bus/stop_bus (idempotent) |
| `backend/app/core/config.py` | REDIS_URL, INSTANCE_ID env vars |
| `backend/app/core/rate_limit.py` | RateLimiter dùng Redis ZSET khi REDIS_URL set, fallback in-memory |
| `backend/app/api/auth.py` | login/refresh async, dùng `check_*_async` |
| `backend/requirements.txt` | `redis[hiredis]==5.0.8` |
| `docker-compose.yml` | redis service; `backend2` trong profile `multi-instance` (port 8001) |

## 6. DoD M9 (per plan)

- [x] WebSocket broadcast đồng bộ giữa nhiều instance (Redis pub/sub).
- [x] Rate limit shared qua Redis ZSET (D-44 future done).
- [x] Test multi-instance end-to-end (2 backends trong compose, 1 Redis, 1 Postgres).
- [x] Auto-fallback nếu Redis down (instance vẫn chạy in-memory only).

## 7. Known limitations

- **WebSocket stickiness**: vẫn 1-instance-per-WS-connection. User connect tới backend-A, messages from backend-B đến qua Redis nhưng nếu backend-A chết, WS phải reconnect. Production nên dùng load balancer với sticky session (cookie-based) hoặc Redis-backed session.
- **Redis single point of failure**: production cần Redis Sentinel/Cluster.
- **Per-tenant data isolation**: chưa có (multi-tenant) — phase sau nếu cần.
- **WebSocket backpressure**: queue maxsize=256, drop khi đầy. Có thể bump.

## Change history

- 2026-09-01: Test Report M9 v1.0.0 — 3 test cases pass, 25/25 unit, Redis pub/sub cho cross-instance WS + rate limit.
