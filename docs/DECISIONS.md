---
title: Architecture Decisions
category: attachment
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 1.1.0
---

# Architecture Decisions

> Nguồn chân lý chính thức cho mọi quyết định kiến trúc đã chốt qua các vòng hội thoại planning.
> Hiện có **46 quyết định** (D-01 → D-46). Mỗi quyết định có: **ID**, **chủ đề**, **quyết định**, **lý do**, **hệ quả**, **tham chiếu**.

Khi một quyết định bị đảo, **KHÔNG xoá entry cũ** — thêm entry mới với `superseded_by: D-XX` và giữ lịch sử để truy vết.

---

## Mục lục

- D-01 → D-13: Phase Plan (UI/UX, switch nguồn, retention linh hoạt, idempotent logout, login rate-limit, MQTT consumer fail-safe, test isolation)
- D-14 → D-20: Auth & Security (JWT, CSRF, cookie matrix, secret rotation)
- D-21 → D-30: Data & Backend (DB, env vars, file location, pattern inference)
- D-31 → D-42: Operations + Docs & File Management (Docker, retention defaults, audit, export, cấu trúc docs, payload_spec move, version policy)
- D-43 → D-46: Additions từ QA M1 review (idempotent logout, rate-limit, consumer fail-safe, test isolation)

---

# Phase Plan (UI/UX, switch nguồn)

## D-01 — Đối tượng sử dụng chính
- **Quyết định:** Kỹ sư vận hành nhà máy.
- **Hệ quả:** UI ưu tiên đọc nhanh, mật độ thông tin cao, không gây mỏi mắt khi đứng 8h/ngày; label ngắn gọn, action ít, focus vào data.

## D-02 — Phong cách UI
- **Quyết định:** Grafana-style + High-Performance HMI.
- **Lý do:** Tham khảo Grafana (layout shell, time-range picker), kết hợp tư duy HMI hiện đại (typography, spacing, motion có chủ đích).
- **Hệ quả:** Layout shell cố định TopBar + left rail; component chuyên SCADA (gauge, sparkline, register grid) thay vì SaaS card bo cong.

## D-03 — Thiết bị hiển thị
- **Quyết định:** Desktop + Tablet (ưu tiên desktop).
- **Breakpoint:** `≥1280` desktop, `1024–1279` tablet ngang, `<1024` graceful-degrade.
- **Hệ quả:** Mobile không tối ưu sâu; chart có thể cuộn ngang trên mobile; cảnh báo "vui lòng dùng desktop/tablet".

## D-04 — Chế độ màu
- **Quyết định:** Cả dark + light, có toggle.
- **Hệ quả:** Lưu preference ở `localStorage`; design tokens cho cả 2 mode (mục B.1 trong `plan_uiux_concept.md`).

## D-05 — Bố cục
- **Quyết định:** Overview trước → drill-down.
- **Hệ quả:** Trang `/` làm homepage, là grid `DeviceCard`; sidebar chỉ filter/quick-jump, không ẩn grid.

## D-06 — Loại chart
- **Quyết định:** Kết hợp — line chart (uPlot) cho lịch sử telemetry, gauge (ECharts) cho giá trị tức thời, bảng số cho snapshot registers.
- **Hệ quả:** uPlot chuyên time-series hàng chục nghìn điểm; ECharts bổ sung cho gauge/heatmap khi cần.

## D-07 — Hiển thị cảnh báo
- **Quyết định:** Toasts (top-right), không full-screen banner.
- **Chi tiết:**
  - Tối đa 5 toast cùng lúc, group theo `code`.
  - Auto-dismiss 8s cho `warning`/`info`; **KHÔNG auto-dismiss** cho `critical`.
  - Critical có subtle border glow ở dark mode.
  - Filter "Show only critical" trong TopBar.
- **Sound:** Default **OFF**, có toggle trong user menu (xem D-25).

## D-08 — Branding
- **Quyết định:** Không cần branding/logo công ty.
- **Hệ quả:** Dùng bảng màu semantic chuẩn HMI; không tích hợp logo.

## D-09 — Ngôn ngữ UI
- **Quyết định:** Tiếng Anh (toàn bộ label/placeholder/error trong UI).
- **Hệ quả:** Enum `state`/`severity`/`code` hiển thị tiếng Anh (vd. `online`, `critical`, `SLAVE_COMM_LOST`).

## D-10 — Mật độ thông tin
- **Quyết định:** SCADA + HMI hiện đại.
- **Chi tiết:**
  - Row height 28px (table), 32px (list/card), 36px (header).
  - Padding scale 8/12/16 (3 step).
  - Numeric tabular-nums cho cột số.
  - Font sans Inter, mono JetBrains Mono.

---

# Switch nguồn dữ liệu

## D-11 — Cơ chế switch nguồn
- **Quyết định:** Phương án C — kết hợp:
  1. Bảng `device_sources` (Postgres) — mapping `device_id ↔ source` (override pattern).
  2. Pattern inference — fallback khi không có mapping.
  3. API toggle Simulator Service — start/stop tiến trình.
- **Lý do:** Hỗ trợ cả 2 yêu cầu (toggle, song song); bật/tắt không động đến dữ liệu lịch sử.
- **Hệ quả:** Xem `plan_data_pipeline.md` mục 3 chi tiết.

## D-12 — Quy ước `device_id`
- **Quyết định:**
  - `real`: pattern `^[A-Z]+_[A-Z]+_[0-9]+$` (vd. `GW_LINE_A_01`).
  - `simulated`: pattern `^SIM_[A-Za-z0-9_-]{1,58}$` (vd. `SIM_LINE_A_01`).
- **Thứ tự ưu tiên:** (1) explicit mapping; (2) pattern; (3) default `real` + log warning.
- **Hệ quả:** Backend reject nếu `device_id` thuộc source khác mapping → log warning + drop.

## D-13 — Số device tối đa
- **Quyết định:** Tối đa **15 device** vận hành thật, benchmark hiệu năng 50.
- **Trạng thái:** Con số có thể cập nhật khi biết thêm quy mô nhà máy thực tế.

---

# Auth & Security

## D-14 — Auth: JWT cookie + Refresh
- **Quyết định:** JWT cookie với 2 loại token:
  - **Access token (`at`)**: TTL 15 phút, httpOnly, Secure, SameSite=Strict, Path=/.
  - **Refresh token (`rt`)**: TTL 8 giờ, cùng attributes, **Path=/** (xem D-15).
- **Lý do 8h:** Khớp ca làm việc, tránh gián đoạn nhân viên giữa ca.
- **Lý do access ngắn (15m):** Có thể revoke nhanh khi cần; refresh diễn ra ngầm, user không cảm nhận.
- **Hệ quả:** Mỗi refresh rotate cả `at`, `csrf`. Refresh token không rotate trong phase này (xem D-18 future work).

## D-15 — Refresh token `Path=/`
- **Quyết định:** `Path=/` cho cả `at` và `rt` (mặc dù `rt` chỉ cần ở `/api/auth`).
- **Lý do:** `httpOnly` + `Secure` + `SameSite=Strict` đã giảm rủi ro đáng kể; path mismatch gây bug refresh âm thầm fail — rủi ro vận hành lớn hơn rủi ro bảo mật lý thuyết.

## D-16 — CSRF: double-submit cookie
- **Quyết định:** Áp dụng double-submit cookie làm lớp phòng thủ thứ 2.
- **Cơ chế:**
  - Server set cookie `csrf` (KHÔNG httpOnly, Secure, SameSite=Strict, Path=/).
  - Frontend đọc `csrf` từ `document.cookie` rồi gửi header `X-CSRF-Token` cho mọi `POST/PUT/DELETE`.
  - Backend middleware so sánh header vs cookie, lệch → 403.
  - Exempt: `auth/login`, `auth/refresh` (chưa có session).
- **Lý do:** `SameSite=Strict` không tuyệt đối (một số trình duyệt cũ, subdomain/proxy). Action ở `/settings` là state-changing, nhạy cảm → defense in depth rẻ hơn nhiều so với rủi ro.

## D-17 — CSRF cookie Max-Age
- **Quyết định:** Khớp access token TTL (15 phút), rotate mỗi lần refresh.
- **Lý do:** Giảm cửa sổ rủi ro (token lộ chỉ dùng được tối đa 15 phút). Chi phí gần như bằng 0.

## D-18 — JWT secret rotation
- **Quyết định (phase này):** Restart-only với env mới. Chưa có endpoint admin rotate.
- **Lý do:** Số lần rotate trong POC thấp; restart thủ công chấp nhận được.
- **Future work:** Khi multi-instance cần zero-downtime rotation, thêm `JWT_SECRET_VER` + dual-secret transition window + admin endpoint bump version.

## D-19 — Refresh token rotation (Future Work)
- **Trạng thái:** Hiện `rt` không rotate. Mỗi refresh cấp `rt` mới nhưng cũ vẫn valid đến khi hết TTL.
- **Future work:** Rotate mỗi lần refresh; rotation detection (nếu `rt` đã dùng → revoke cả chain).

## D-20 — Password hashing
- **Quyết định:** bcrypt cost 12.
- **Hệ quả:** `ADMIN_BOOTSTRAP_PASSWORD_HASH` lưu bcrypt hash, không bao giờ plaintext.

---

# Data & Backend

## D-21 — Lưu diag ở Postgres (không InfluxDB)
- **Quyết định:** Lưu diag vào Postgres table `device_diag`, không ghi InfluxDB.
- **Lý do:** Spec mục 7.2 nói `info` và `diag` chỉ log; vì webapp cần query/history diag, lưu Postgres là lựa chọn thực dụng.
- **Hệ quả:** Xem `erd_postgres.md` cho schema.

## D-22 — Pattern inference rules
- **Quyết định:** Xem D-12. Service `app/services/device_sources.py` thực hiện.

## D-23 — Auth roles
- **Quyết định:** 2 role: `admin` (full) và `viewer` (chỉ xem, không vào `/settings`).
- **Hệ quả:** Middleware `require_admin` cho `/api/admin/*` và `/settings`.

## D-24 — Export limits
- **Quyết định:**
  - Max rows mỗi export: `EXPORT_MAX_ROWS` (default 100,000).
  - Vượt → `413 Payload Too Large`, yêu cầu thu hẹp range.
  - Không làm async export ở phase này.
- **Lý do 100k:** Balance giữa UX (đủ cho vài ngày data ở 1Hz) và memory.

## D-25 — Sound cho critical event
- **Quyết định:** Default **OFF**, toggle trong user menu.
- **Lý do:** Tránh làm phiền vận hành viên trong ca; user chủ động bật nếu cần.

## D-26 — Export audit metadata
- **Quyết định:** Mỗi export ghi `audit_log.detail` chứa:
  ```json
  {
    "format": "csv",
    "category": "telemetry",
    "device_id": "GW_LINE_A_01",
    "from_ts": 1692816000,
    "to_ts": 1692902400,
    "row_count": 12345,
    "filters": { "register": "hr_100" }
  }
  ```
- **KHÔNG lưu:** nội dung file, checksum.
- **Future work:** Checksum + signed URL khi cần compliance (xem `plan_overview.md` mục 6).

## D-27 — InfluxDB query safety
- **Quyết định:** Mọi tham số `device_id`, `register`, `severity`, `code` trong Flux query phải qua `escape_flux_string()` (loại bỏ `\n\r\t;`, escape `\\` và `"`).
- **Hệ quả:** Xem `app/utils/text.py`.

## D-28 — WebSocket auth
- **Trạng thái:** M1 chưa yêu cầu auth cho `/ws/devices`. Mọi client subscribe được.
- **Future work:** Yêu cầu access token qua query param hoặc subprotocol.

---

# Operations

## D-29 — Docker là hạ tầng mặc định
- **Quyết định:** Toàn bộ stack (backend, postgres, influxdb, emqx, simulator) chạy trong Docker Compose. Không chạy trực tiếp trên máy host.
- **Lý do:**
  - Đảm bảo parity giữa dev/CI/prod.
  - Tránh lệ thuộc Python version/packages trên máy local.
  - Reproducible: một lệnh `make up` cho toàn bộ stack.
- **Hệ quả:** Xem `docker-compose.yml` + `Makefile` + `runbook_local_dev.md`.

## D-30 — Retention config-driven (KHÔNG hard-code)
- **Quyết định:** Tất cả retention days đọc từ env, không hard-code trong query hay cron job.
- **Env vars:**
  - `DIAG_RETENTION_DAYS` (default 90)
  - `AUDIT_RETENTION_DAYS` (default 365)
  - `REVOKED_TOKEN_RETENTION_DAYS` (default 30)
- **Code shape:** `settings.DIAG_RETENTION_DAYS` — chỉ xuất hiện ở config, không ở query.
- **Lý do:** Khi chuyển POC → production, audit có thể cần 2–3 năm (compliance). Chỉ đổi env, không sửa code hay migration.

## D-31 — Cleanup job
- **Quyết định:** APScheduler cron nightly (`CLEANUP_CRON_HOUR`, default 2).
- **Hệ quả:** Log số dòng đã xoá + giá trị retention hiện dùng ở mỗi lần chạy.

## D-32 — Audit log cho mọi action admin
- **Quyết định:** Audit bắt buộc từ M1 cho:
  - `auth.login.success` / `auth.login.fail`
  - `auth.logout`
  - `admin.sources.upsert` / `admin.sources.delete`
  - `admin.simulator.start` / `admin.simulator.stop`
  - `export.telemetry` / `export.events` / `export.diag` (metadata only, xem D-26)
- **Lý do:** Settings có thể thay đổi mapping/Start-Stop simulator; production cần truy vết "ai đã làm gì khi nào".

## D-33 — Bootstrap admin từ env
- **Quyết định:** `ADMIN_BOOTSTRAP_USER` + `ADMIN_BOOTSTRAP_PASSWORD_HASH` tạo user admin lúc startup, idempotent.
- **Hệ quả:** Bcrypt hash sinh qua `scripts/generate-bcrypt-hash.py`. Không lưu plaintext.

## D-34 — Env vars: bắt buộc vs optional
- **Bắt buộc (fail-fast khi thiếu):**
  - `JWT_SECRET` (≥32 bytes, validate ở Pydantic)
  - `ADMIN_BOOTSTRAP_USER`
  - `ADMIN_BOOTSTRAP_PASSWORD_HASH`
- **Optional (có default):**
  - `DIAG_RETENTION_DAYS=90`
  - `AUDIT_RETENTION_DAYS=365`
  - `REVOKED_TOKEN_RETENTION_DAYS=30`
  - `ACCESS_TOKEN_TTL_MIN=15`
  - `REFRESH_TOKEN_TTL_HOURS=8`
  - `CLEANUP_CRON_HOUR=2`
  - `EXPORT_MAX_ROWS=100000`
  - `COOKIE_SECURE=false`
- **Lý do:** Bắt buộc thiếu → fail ngay lúc startup (an toàn). Optional có default hợp lý → dễ demo.

## D-35 — Simulator profile
- **Quyết định:** Simulator là Docker container riêng, chạy qua profile `with-simulator`.
- **Lệnh:** `make start-simulator` / `make stop-simulator`.
- **Lý do:** Tách biệt với core stack; production không cần simulator.

---

# Docs & File Management

## D-36 — Cấu trúc docs/ theo 7 danh mục
- **Quyết định:** 7 thư mục con đánh số: `01_plan/`, `02_design/`, `03_api/`, `04_runbook/`, `05_test/`, `06_changelog/`, `99_attachments/`.
- **Nguồn chân lý:** `docs/FILE_MANAGEMENT.md` (xem D-39).
- **Hệ quả:** Mọi file mới phải thuộc đúng 1 danh mục; vi phạm phải sửa trước khi merge.

## D-37 — Di chuyển `payload_spec_v1.md` vào `99_attachments/`
- **Quyết định:** Move từ `docs/payload_spec_v1.md` → `docs/99_attachments/payload_spec_v1.md` ngay trong M0.
- **Lý do:** Số tham chiếu còn ít ở M0/M1, sửa sớm rẻ hơn nhiều. Giữ ở root vì "khỏi phá link" là lý do yếu, đi ngược lại chuẩn mà dự án vừa định ra — nếu ngoại lệ ngay từ file đầu, quy ước mất uy tín.
- **Quy trình:** Grep toàn repo, cập nhật mọi link trong cùng PR.

## D-38 — Frontmatter bắt buộc
- **Quyết định:** Mọi file `.md` (trừ `README.md` của từng thư mục) phải có YAML frontmatter:
  ```yaml
  ---
  title: <Tên>
  category: <plan|design|api|runbook|test|changelog|attachment>
  owner: <username>
  created: YYYY-MM-DD
  updated: YYYY-MM-DD
  status: <draft|in-review|approved|archived>
  version: <semver>
  ---
  ```
- **Versioning:** Semver. MAJOR = thay đổi cấu trúc, MINOR = thêm section, PATCH = sửa typo.
- **Hệ quả:** Mỗi lần sửa phải bump version + cập nhật `updated` + mô tả trong section "Change history" cuối file.

## D-39 — `FILE_MANAGEMENT.md` làm chuẩn quản lý file
- **Quyết định:** File `docs/FILE_MANAGEMENT.md` (v1.0.0, status=approved) là nguồn chân lý cho quy tắc đặt tên, phân loại, vòng đời, ownership.
- **Nội dung:** 10 mục (phạm vi, cấu trúc, đặt tên, danh mục, frontmatter, tạo/sửa/archive, liên kết, ngôn ngữ, audit, checklist).
- **Hệ quả:** Sửa `FILE_MANAGEMENT.md` → tăng version MAJOR.

## D-40 — Ngôn ngữ tài liệu
- **Quyết định:**
  - Tài liệu kỹ thuật nội bộ (plan, design, api, test, changelog): **tiếng Anh**.
  - Runbook: **tiếng Việt** được phép (phù hợp đội ngũ vận hành nhà máy).
  - Commit message + PR môc tả: tiếng Anh.
  - UI label: tiếng Anh (xem D-09).
- **Trạng thái thực tế:** M0/M1 gốc tiếng Việt đã được dùng (do planning bằng tiếng Việt). Có thể chuẩn hoá sang tiếng Anh ở các milestone sau.

## D-41 — Review & archive định kỳ
- **Quyết định:** Mỗi quý review `docs/FILE_MANAGEMENT.md` + `docs/README.md`, archive file lỗi thời.
- **Ngưỡng archive:** File không cập nhật >6 tháng → `status: archived` + chuyển thư mục.

## D-42 — PR template cho docs
- **Quyết định (M0):** Chưa cần template riêng cho PR docs. Dùng chung hoặc không template.
- **Lý do:** 1–2 PR đầu, thêm sớm là over-engineering. Tách riêng khi nhiều người cùng đóng góp tài liệu và cần checklist riêng.

## D-43 — Idempotent logout
- **Quyết định:** Logout với cùng `rt` (double-logout) không raise 500; ghi audit nhưng skip insert vào `revoked_refresh` nếu jti đã tồn tại.
- **Lý do:** Tránh 500 error khi client gửi logout 2 lần liên tiếp.
- **Hệ quả:** Endpoint luôn trả 204; audit log ghi `auth.logout` dù duplicate.

## D-44 — Login rate-limit
- **Quyết định:** 5 attempts/min/IP cho `/api/auth/login`, 30/min/IP cho `/api/auth/refresh`. Skip khi `APP_ENV=test`.
- **Lý do:** Chống brute-force + DoS qua spam login. In-memory sliding window, multi-instance cần Redis ở phase sau.
- **Hệ quả:** Sau 5 fail/wrong password trong 60s, login trả 429.

## D-45 — MQTT consumer fail-safe
- **Quyết định:** Consumer `aiomqtt` retry với exponential backoff (1s → 30s cap) khi mất kết nối broker; schema reload khi mtime đổi (không restart).
- **Lý do:** Spec mục 7.1 yêu cầu "sửa master_protocol_v1.json có hiệu lực ngay, không cần restart backend". Lỗi mạng không nên crash app.
- **Hệ quả:** Backend chịu được broker down, schema hot-reload.

## D-46 — Test isolation
- **Quyết định:** Integration test (TestClient + Postgres) chạy với `APP_ENV=test` (skip MQTT consumer, skip rate-limit), truncate tables trước mỗi test.
- **Lý do:** Test nhanh, deterministic, không cần broker/MQTT runtime.
- **Hệ quả:** 17 test pass trong ~5s; test suite chạy song song được.

---

# Phụ lục: Bảng tổng hợp env vars

| Tên | Bắt buộc | Default | Quyết định |
|---|---|---|---|
| `JWT_SECRET` | ✅ | — | D-14, D-34 |
| `ADMIN_BOOTSTRAP_USER` | ✅ | — | D-33, D-34 |
| `ADMIN_BOOTSTRAP_PASSWORD_HASH` | ✅ | — | D-20, D-33, D-34 |
| `DATABASE_URL` | | `postgresql+psycopg2://iigw:iigw@postgres:5432/iigw` | D-21 |
| `INFLUXDB_URL` | | `http://influxdb:8086` | — |
| `INFLUXDB_TOKEN` | | `iigw-dev-token` (dev) | — |
| `INFLUXDB_ORG` | | `iigw` | — |
| `INFLUXDB_BUCKET` | | `telemetry` | — |
| `MQTT_BROKER_HOST` | | `emqx` | D-29 |
| `MQTT_BROKER_PORT` | | `1883` | D-29 |
| `DIAG_RETENTION_DAYS` | | `90` | D-30 |
| `AUDIT_RETENTION_DAYS` | | `365` | D-30 |
| `REVOKED_TOKEN_RETENTION_DAYS` | | `30` | D-30 |
| `ACCESS_TOKEN_TTL_MIN` | | `15` | D-14 |
| `REFRESH_TOKEN_TTL_HOURS` | | `8` | D-14 |
| `CLEANUP_CRON_HOUR` | | `2` | D-31 |
| `EXPORT_MAX_ROWS` | | `100000` | D-24 |
| `CORS_ORIGINS` | | `http://localhost:5173,...` | — |
| `COOKIE_SECURE` | | `false` | D-14, D-16 |
| `APP_ENV` | | `dev` | — |

---

# Phụ lục: Bảng tổng hợp cookie matrix

| Cookie | httpOnly | Secure | SameSite | Path | Max-Age | Rotate | Quyết định |
|---|---|---|---|---|---|---|---|
| `at` (access) | ✅ | ✅ (config) | Strict | `/` | 15m | Mỗi refresh | D-14, D-15, D-17 |
| `rt` (refresh) | ✅ | ✅ (config) | Strict | `/` | 8h | Không (M1) | D-14, D-15, D-19 |
| `csrf` (token) | ❌ | ✅ (config) | Strict | `/` | 15m | Mỗi refresh | D-16, D-17 |

---

# Phụ lục: Bảng tổng hợp role permissions

| Resource | admin | viewer |
|---|---|---|
| `/api/auth/*` | ✅ | ✅ |
| `/api/devices/*` (read) | ✅ | ✅ |
| `/api/events/*` (read) | ✅ | ✅ |
| `/api/exports/*` | ✅ | ✅ |
| `/api/admin/*` | ✅ | ❌ |
| `/settings` (UI) | ✅ | ❌ |

---

# Tài liệu liên quan

- [File Management Standard](./FILE_MANAGEMENT.md)
- [Plan Overview](./01_plan/plan_overview.md)
- [Plan Data Pipeline](./01_plan/plan_data_pipeline.md)
- [Plan Webapp Architecture](./01_plan/plan_webapp_architecture.md)
- [Plan UI/UX Concept](./01_plan/plan_uiux_concept.md)
- [ERD Postgres](./02_design/erd_postgres.md)
- [API Reference](./03_api/api_reference.md)
- [Runbook Local Dev](./04_runbook/runbook_local_dev.md)
- [CHANGELOG_webapp](./06_changelog/CHANGELOG_webapp.md)

## Change history

- 2026-08-30: Tạo file DECISIONS.md (v1.0.0) — tổng hợp 42 quyết định từ 3 vòng hội thoại planning.
- 2026-08-30: Bump lên v1.1.0 — thêm D-43, D-44, D-45, D-46 từ QA M1 review (idempotent logout, login rate-limit, MQTT consumer fail-safe, test isolation).
