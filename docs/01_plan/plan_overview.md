---
title: Plan Overview
category: plan
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 1.0.0
---

# Plan Overview

## 1. Mục tiêu

Xây dựng phần **webapp / dashboard** cho hệ thống Gateway IIoT giá rẻ, kết nối PLC/thiết bị công nghiệp đời cũ (RS-485/Modbus RTU) lên server thông qua Master (STM32 + W5500) publish dữ liệu qua **MQTT**.

Backend/hạ tầng dữ liệu đã có:
- MQTT broker (EMQX), topic `devices/{device_id}/{category}` với 5 loại: `telemetry`, `status`, `event`, `info`, `diag`.
- Backend consumer validate payload theo JSON Schema và ghi InfluxDB (`device_telemetry`, `device_status`, `device_event`).
- WebSocket broadcast realtime.

**Nguồn chân lý schema**: [Payload Spec v1](../99_attachments/payload_spec_v1.md).

## 2. Phạm vi

### 2.1 In-scope
1. Dashboard tổng (Overview): danh sách device, badge trạng thái, badge nguồn, chỉ số nhanh.
2. Device Detail: register grid, line chart lịch sử, events, diag, info.
3. Event / Alarm Log: bảng, lọc theo `severity`/`code`/device/time, phân trang.
4. Diagnostics / Health: diag gần nhất + per-slave stats.
5. Settings / Admin: toggle Simulator, mapping `device_id ↔ source`, export.
6. Realtime qua WebSocket.
7. Source indicator rõ ràng (`simulated` vs `real`).

### 2.2 Out-of-scope (phase này)
- Điều khiển ngược xuống master (firmware update, config push).
- Multi-role auth phức tạp (chỉ `admin` + `viewer`).
- Lưu trữ dài hạn / archive InfluxDB (do hạ tầng hiện hữu đã lo).
- Mobile-first responsive nâng cao.

## 3. Tiêu chí thành công

| Tiêu chí | Mục tiêu |
|---|---|
| Độ trễ telemetry realtime | ≤ 2 s end-to-end |
| Độ trễ event realtime | ≤ 2 s |
| Số device hiển thị đồng thời | 15 (thực tế) / 50 (benchmark) |
| Load chart 24h | ≤ 3 s |
| Chuyển nguồn dữ liệu | Không crash, không mất lịch sử |
| Indicator nguồn khớp mapping | 100% |

## 4. Giả định

| # | Giả định | Lý do |
|---|---|---|
| G1 | Tối đa **15 device** vận hành thật, benchmark 50 | Quy mô nhà máy vừa |
| G2 | ≤ 200 register/device, telemetry 1–2 s | Theo payload spec mục 8 |
| G3 | SPA, Docker container cùng stack hiện tại | Đồng nhất hạ tầng |
| G4 | Realtime end-to-end ≤ 2 s | Tiêu chí chính |
| G5 | Desktop + tablet, ưu tiên desktop | UI/UX chốt bởi người dùng |
| G6 | Diag lưu Postgres riêng (`device_diag`) | Không ghi InfluxDB (spec mục 7.2) |

## 5. WBS & Milestones

| # | Giai đoạn | Deliverable | DoD |
|---|---|---|---|
| **M0** | Document skeleton (PR riêng) | `docs/FILE_MANAGEMENT.md`, mục lục, 7 thư mục, 4 file plan, changelog | Cấu trúc khớp chuẩn; PR chỉ chứa `.md` |
| **M1** | Backend & dữ liệu | Postgres + Alembic; service `device_sources`; API admin (mapping, simulator); API history (telemetry/diag/events); auth (JWT cookie + refresh + CSRF); export CSV/XLSX; audit log; `docs/03_api/api_reference.md`; `docs/02_design/erd_postgres.md` | OpenAPI khớp implementation; mapping đúng; audit ghi nhận mọi action admin; auth chặn viewer vào admin |
| **M2** | Khung frontend + realtime | SPA Vite + TS + Tailwind + shadcn; layout shell Grafana-style; TanStack Query + WS reconnect; trang Overview tối giản; dark/light toggle; login flow | Toggle dark/light không flash; WS reconnect sau 30s; indicator nguồn khớp 100% |
| **M3** | Chốt UI/UX concept | Design tokens; component inventory; layout shell; realtime rules; `docs/02_design/design_system.md`; wireframes | Wireframe + design system được duyệt |
| **M4** | Áp style + Device Detail | Trang `/devices/:id` đầy đủ tabs; uPlot + ECharts gauge; TimeRangePicker; responsive tablet | Mở 1 device xem chart 24h ≤ 3s; tablet 1024×768 dùng được |
| **M5** | Event/Alarm + Settings + Export | Trang `/events` với filter; ToastStack + ack; trang `/settings` 3 panel; export buttons | Filter critical-only đúng; Start/Stop simulator phản ánh trong vài giây; CSV mở được bằng Excel |
| **M6** | Tích hợp Real + switch | E2E master thật; song song 5 sim + 10 real; test LWT, mapping đổi runtime, source_changed WS; `docs/04_runbook/runbook_deploy.md` | Checklist case đạt 100% |
| **M7** | Test & Polish | Chạy TC-S*, TC-SW*, TC-P*; Lighthouse desktop ≥ 90; `docs/05_test/test_report_phase*.md`; `docs/06_changelog/CHANGELOG_webapp.md` đến v0.x | Mọi DoD đạt; demo ổn định 1h liên tục với 15 device |

## 6. Future Work

- **JWT secret rotation zero-downtime**: khi multi-instance, cần `JWT_SECRET_VER` + dual-secret transition window + admin endpoint bump version.
- **Refresh token rotation**: hiện `rt` không rotate; production nên rotate mỗi lần refresh (rotation detection: nếu `rt` đã dùng → revoke cả chain).
- **CSRF per-form token**: 1 token cho mọi mutation; production nên cấp per-form token.
- **Export checksum + signed URL** cho compliance (khi có yêu cầu pháp lý).
- **Email alerting** cho critical event thay vì chỉ toast trong app.

## 7. Tài liệu liên quan

- [Plan Data Pipeline](./plan_data_pipeline.md) — sơ đồ luồng, switch nguồn, mapping rules.
- [Plan Webapp Architecture](./plan_webapp_architecture.md) — kiến trúc kỹ thuật, API, ERD, token model, retention.
- [Plan UI/UX Concept](./plan_uiux_concept.md) — design tokens, component inventory, layout shell.
- [File Management Standard](../FILE_MANAGEMENT.md) — chuẩn quản lý tài liệu dự án.
- [Payload Spec v1](../99_attachments/payload_spec_v1.md) — nguồn chân lý schema.

## Change history

- 2026-08-30: Tạo plan_overview.md (M0).
- 2026-08-30: Bump lên v1.0.0 — đánh dấu toàn bộ M0–M7 hoàn tất; liệt kê deliverables, known limitations ở `docs/05_test/test_report_m7.md`.
