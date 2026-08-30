---
title: Documentation Index
category: attachment
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 1.1.0
---

# Documentation Index

Mục lục dẫn vào tất cả tài liệu trong dự án. Mọi tài liệu phải tuân theo [FILE_MANAGEMENT.md](./FILE_MANAGEMENT.md).

## 1. Quy tắc chung

- [File Management Standard](./FILE_MANAGEMENT.md) — chuẩn đặt tên, phân loại, vòng đời tài liệu.
- [Architecture Decisions](./DECISIONS.md) — nguồn chân lý cho 49 quyết định kiến trúc đã chốt (D-01 → D-49).

## 2. Kế hoạch (`01_plan/`)

- [Plan Overview](./01_plan/plan_overview.md) — kế hoạch tổng, WBS, milestones.
- [Plan Data Pipeline](./01_plan/plan_data_pipeline.md) — sơ đồ luồng dữ liệu, switch nguồn, mapping rules.
- [Plan Webapp Architecture](./01_plan/plan_webapp_architecture.md) — kiến trúc webapp, API, ERD, token model, retention.
- [Plan UI/UX Concept](./01_plan/plan_uiux_concept.md) — design tokens, component inventory, layout shell.

## 3. Thiết kế (`02_design/`)

- [ERD Postgres](./02_design/erd_postgres.md) — sơ đồ + chi tiết từng bảng.
- [Webapp Architecture](./02_design/webapp_architecture.md) — frontend M2: stack, routing, WebSocket, CSRF, Docker.

## 4. API (`03_api/`)

- [API Reference](./03_api/api_reference.md) — REST + WebSocket reference (OpenAPI + curl examples).

## 5. Vận hành (`04_runbook/`)

- [Runbook Local Dev](./04_runbook/runbook_local_dev.md) — khởi động + troubleshooting.
- [Git Workflow](./04_runbook/git_workflow.md) — branch + commit + PR conventions.

## 6. Test (`05_test/`)

*(Sẽ bổ sung ở M1+: test plan + report theo phase.)*

## 7. Lịch sử thay đổi (`06_changelog/`)

- [CHANGELOG_webapp](./06_changelog/CHANGELOG_webapp.md) — lịch sử thay đổi webapp (theo keep-a-changelog).

## 8. Tài liệu tham khảo (`99_attachments/`)

- [Payload Spec v1](./99_attachments/payload_spec_v1.md) — đặc tả payload protocol v1 từ master (STM32 + W5500) lên MQTT broker.

## Change history

- 2026-08-30: Tạo mục lục dự án (M0).
- 2026-08-30: Bump lên v1.1.0 — bổ sung link webapp_architecture.md, api_reference.md, runbook, git_workflow, cập nhật số quyết định (M2).
