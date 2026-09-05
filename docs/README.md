---
title: Documentation Index
category: attachment
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 1.11.0
---

# Documentation Index

Mục lục dẫn vào tất cả tài liệu trong dự án. Mọi tài liệu phải tuân theo [FILE_MANAGEMENT.md](./FILE_MANAGEMENT.md).

## 1. Quy tắc chung

- [File Management Standard](./FILE_MANAGEMENT.md) — chuẩn đặt tên, phân loại, vòng đời tài liệu.
- [Architecture Decisions](./DECISIONS.md) — nguồn chân lý cho quyết định kiến trúc đã chốt (D-01 → D-65).

## 2. Kế hoạch (`01_plan/`)

- [Plan Overview](./01_plan/plan_overview.md) — kế hoạch tổng, WBS, milestones.
- [Plan Data Pipeline](./01_plan/plan_data_pipeline.md) — sơ đồ luồng dữ liệu, switch nguồn, mapping rules.
- [Plan Webapp Architecture](./01_plan/plan_webapp_architecture.md) — kiến trúc webapp, API, ERD, token model, retention.
- [Plan UI/UX Concept](./01_plan/plan_uiux_concept.md) — design tokens, component inventory, layout shell.

## 3. Thiết kế (`02_design/`)

- [ERD Postgres](./02_design/erd_postgres.md) — sơ đồ + chi tiết từng bảng.
- [Webapp Architecture](./02_design/webapp_architecture.md) — frontend M2: stack, routing, WebSocket, CSRF, Docker.
- [Design System](./02_design/design_system.md) — design tokens + components spec (M3 chốt).
- [Wireframes](./02_design/wireframes.md) — ASCII wireframes 6 màn hình (M3).

## 4. API (`03_api/`)

- [API Reference](./03_api/api_reference.md) — REST + WebSocket reference (OpenAPI + curl examples).

## 5. Vận hành (`04_runbook/`)

- [Runbook Local Dev](./04_runbook/runbook_local_dev.md) — khởi động + troubleshooting.
- [Runbook Deploy](./04_runbook/runbook_deploy.md) — production setup, security, backup, scale (M7).
- [Git Workflow](./04_runbook/git_workflow.md) — branch + commit + PR conventions.

## 6. Test (`05_test/`)

- [Test Report M6](./05_test/test_report_m6.md) — 7 test cases (E2E, switch, LWT, negative, source_changed WS, session refresh, performance), 25/25 unit tests pass.
- [Test Report M7](./05_test/test_report_m7.md) — final wrap-up: bundle 740KB JS, smoke 1h stable, 25/25 tests, known limitations.
- [Test Report M6](./05_test/test_report_m6.md) — 7 test cases (E2E, switch, LWT, negative, source_changed WS, session refresh, performance), 25/25 unit tests pass.
- [Test Report M7](./05_test/test_report_m7.md) — final wrap-up: bundle 740KB JS, smoke 1h stable, 25/25 tests, known limitations.
- [Test Report M9](./05_test/test_report_m9.md) — multi-instance via Redis pub/sub, cross-instance WS, rate limit shared.
- [Test Checklist](./05_test/test_checklist.md) — 70+ tiêu chí manual test cho user/QA.
- [Test Acceptance Criteria](./05_test/test_acceptance_criteria.md) — 50+ AC tổng hợp M0-M9, decision matrix cho release gate.
- [Operation Flow Report](./05_test/operation_flow.md) — luồng hoạt động end-to-end (gateway → Modbus → MQTT → backend → webapp), 5 bước happy path + 5 failure modes.
- [How to Run the Project](./05_test/how_to_run.md) — hướng dẫn chạy A-Z: yêu cầu, chuẩn bị, 5 lệnh Makefile, troubleshooting, quick reference.

## 7. Lịch sử thay đổi (`06_changelog/`)

- [Release v0.9.0](./06_changelog/RELEASE_v0.9.0.md) — project complete (M0–M9) summary.
- [CHANGELOG_webapp](./06_changelog/CHANGELOG_webapp.md) — lịch sử thay đổi webapp (theo keep-a-changelog).

- [CHANGELOG_webapp](./06_changelog/CHANGELOG_webapp.md) — lịch sử thay đổi webapp (theo keep-a-changelog).

## 8. Tài liệu tham khảo (`99_attachments/`)

- [Payload Spec v1](./99_attachments/payload_spec_v1.md) — đặc tả payload protocol v1 từ gateway (STM32 + W5500) lên MQTT broker.

## Change history

- 2026-08-30: Tạo mục lục dự án (M0).
- 2026-08-30: Bump lên v1.6.0 — D-61..D-62 (M7 project complete, bundle budget).
- 2026-08-30: Bump lên v1.7.0 — D-63..D-65 (M9 multi-instance via Redis pub/sub).
- 2026-09-01: Bump lên v1.8.0 — link Release v0.9.0 (M0-M9 complete).
- 2026-09-01: Bump lên v1.9.0 — link test_checklist + test_acceptance_criteria + scripts/quick_smoke.sh.
- 2026-09-01: Bump lên v1.10.0 — link operation_flow.md (end-to-end flow report).
- 2026-09-01: Bump lên v1.11.0 — link how_to_run.md (A-Z guide).
- 2026-08-30: Bump lên v1.5.0 — D-59..D-60 (M6 LWT fix, source_changed WS broadcast).
- 2026-08-30: Bump lên v1.4.0 — D-55..D-58 (M5 user management, sound, export, self-demote).
- 2026-08-30: Bump lên v1.3.0 — D-51..D-54 (M4 chart, gauge, time range, event filter).
- 2026-08-30: Bump lên v1.2.0 — link design_system.md + wireframes.md (M3), D-50.
- 2026-08-30: Bump lên v1.1.0 — bổ sung link webapp_architecture.md, api_reference.md, runbook, git_workflow, cập nhật số quyết định (M2).
