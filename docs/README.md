---
title: Documentation Index
category: attachment
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 1.0.0
---

# Documentation Index

Mục lục dẫn vào tất cả tài liệu trong dự án. Mọi tài liệu phải tuân theo [FILE_MANAGEMENT.md](./FILE_MANAGEMENT.md).

## 1. Quy tắc chung

- [File Management Standard](./FILE_MANAGEMENT.md) — chuẩn đặt tên, phân loại, vòng đời tài liệu.
- [Architecture Decisions](./DECISIONS.md) — nguồn chân lý cho 42 quyết định kiến trúc đã chốt (D-01 → D-42).

## 2. Kế hoạch (`01_plan/`)

- [Plan Overview](./01_plan/plan_overview.md) — kế hoạch tổng, WBS, milestones.
- [Plan Data Pipeline](./01_plan/plan_data_pipeline.md) — sơ đồ luồng dữ liệu, switch nguồn, mapping rules.
- [Plan Webapp Architecture](./01_plan/plan_webapp_architecture.md) — kiến trúc webapp, API, ERD, token model, retention.
- [Plan UI/UX Concept](./01_plan/plan_uiux_concept.md) — design tokens, component inventory, layout shell.

## 3. Thiết kế (`02_design/`)

*(Sẽ bổ sung ở M3: design system, wireframes, ERD.)*

## 4. API (`03_api/`)

*(Sẽ bổ sung ở M1: api_reference, ws_protocol.)*

## 5. Vận hành (`04_runbook/`)

*(Sẽ bổ sung ở M1/M6: deploy, troubleshooting.)*

## 6. Test (`05_test/`)

*(Sẽ bổ sung ở M1+: test plan + report theo phase.)*

## 7. Lịch sử thay đổi (`06_changelog/`)

- [CHANGELOG_webapp](./06_changelog/CHANGELOG_webapp.md) — lịch sử thay đổi webapp (theo keep-a-changelog).

## 8. Tài liệu tham khảo (`99_attachments/`)

- [Payload Spec v1](./99_attachments/payload_spec_v1.md) — đặc tả payload protocol v1 từ master (STM32 + W5500) lên MQTT broker.

## Change history

- 2026-08-30: Tạo mục lục dự án (M0).
