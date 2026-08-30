---
title: Plan UI/UX Concept
category: plan
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 0.1.0
---

# Plan UI/UX Concept

## 1. Quyết định chốt (từ phản hồi người dùng)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Đối tượng | Kỹ sư vận hành nhà máy |
| 2 | Phong cách | **Grafana-style + High-Performance HMI** |
| 3 | Thiết bị | **Desktop + Tablet** (ưu tiên desktop) |
| 4 | Màu | **Cả dark + light**, có toggle |
| 5 | Bố cục | **Overview trước → drill-down** |
| 6 | Chart | **Kết hợp** (line + gauge + table) |
| 7 | Cảnh báo | **Toasts** |
| 8 | Branding | Không |
| 9 | Ngôn ngữ | **Tiếng Anh** |
| 10 | Mật độ | **SCADA + HMI hiện đại** |

## 2. Design tokens

### 2.1 Color semantic

| Token | Dark | Light | Mục đích |
|---|---|---|---|
| `state.online` | #16a34a | #15803d | Master hoạt động bình thường |
| `state.degraded` | #eab308 | #ca8a04 | Hoạt động một phần |
| `state.error` | #dc2626 | #b91c1c | Master lỗi |
| `state.offline` | #6b7280 | #4b5563 | Mất kết nối / LWT |
| `severity.info` | #3b82f6 | #2563eb | Sự kiện thông tin |
| `severity.warning` | #f97316 | #ea580c | Cảnh báo |
| `severity.critical` | #ef4444 + glow | #dc2626 | Nghiêm trọng |
| `source.simulated` | #a78bfa (nét đứt) | #7c3aed | Dữ liệu giả lập |
| `source.real` | #38bdf8 (nét liền) | #0284c7 | Dữ liệu thực tế |

### 2.2 Typography

- **Sans (UI)**: Inter
- **Mono (giá trị số)**: JetBrains Mono
- Numeric tabular: `font-variant-numeric: tabular-nums` cho mọi cột số.

### 2.3 Spacing & density

- Row height: 28px (table) | 32px (list/card) | 36px (header)
- Padding scale: 8 / 12 / 16 (không dùng 4/6/10)
- Compact mode cho SCADA: giảm row height xuống 24px nếu viewport cao.

## 3. Layout shell (Grafana-style)

```
┌──────────────────────────────────────────────────────────────┐
│ TopBar: app name │ env chip │ source filter │ time-range   │
│                  │ picker │ user menu                      │
├────────┬─────────────────────────────────────────────────────┤
│ Left  │  Page content (grid / detail)                        │
│ rail  │                                                     │
│ 60px  │                                                     │
│ (icon)│                                                     │
└────────┴─────────────────────────────────────────────────────┘
```

- **Left rail**: icon-only (60px) mặc định, mở rộng 200px khi hover.
- **TopBar**: cố định, content scroll độc lập.
- **Source filter**: dropdown 3-tuỳ chọn `Simulated / Real / Both` (mặc định Both).
- **Time-range picker**: Grafana-style, quick ranges 5m/15m/1h/6h/24h/7d/custom.

## 4. Component inventory

| Component | Mục đích | Ghi chú HMI |
|---|---|---|
| `DeviceCard` | 1 device trên Overview | Header: name + source badge + state dot; body: gauge chính + sparkline 1 register; footer: last_seen, # critical 24h |
| `RegisterGrid` | Bảng register | Virtualized, sort, filter; cột raw, value (scaled), unit, ts |
| `TimeSeriesChart` | uPlot wrapper | Range picker, multi-series, brush zoom |
| `Gauge` | ECharts gauge | Cho register "chính" (nhiệt độ, áp suất) |
| `EventTable` | TanStack Table | Virtualized, sticky header, filter bar top, ack per-row |
| `ToastStack` | Top-right | Group theo `code`, nút "View all" → drawer |
| `SourceBadge` | Badge nhãn nguồn | Mọi context có device_id |
| `TimeRangePicker` | Grafana-style | Quick ranges + custom |

## 5. Trang & flow

| Trang | Bố cục |
|---|---|
| `/` Overview | TopBar + grid `DeviceCard` (4 cột desktop / 2 tablet). Source filter. Click card → `/devices/:id`. |
| `/devices/:id` | Header: tên, source badge, state dot, last_seen, action menu. Tabs: Telemetry (RegisterGrid + TimeSeriesChart), Status, Events, Diag, Info. |
| `/events` | Top: filter bar (severity multi, code multi, device multi, time range). Body: EventTable. Toasts bật song song khi có event realtime. |
| `/diagnostics` | Bảng tổng hợp diag. Click row → drawer per-slave stats. |
| `/settings` | 3 panel: Simulator Service (Start/Stop + status + log tail) / Source Mapping (bảng + bulk import CSV) / Export (buttons). |
| `/login` | Form đơn giản, 2 role: admin / viewer. |

## 6. Realtime & cảnh báo

### 6.1 Toasts (chốt theo 4.1.7)
- Vị trí: top-right stack.
- Tối đa 5 toast cùng lúc.
- Auto-dismiss: 8s cho `warning`/`info`. **KHÔNG auto-dismiss** cho `critical`.
- Filter "Show only critical" trong TopBar.

### 6.2 Critical event
- Subtle border glow ở dark mode.
- Sound: **default OFF**, toggle trong user menu.

### 6.3 State dot
- Đổi màu ngay khi có status WS.
- Pulse 0.6s cho `critical` / `error`.

### 6.4 Source badge
- Không nhấp nháy khi chuyển mapping, chỉ fade 200ms.

## 7. Responsive

| Breakpoint | Thiết bị | Layout |
|---|---|---|
| `≥1280px` | Desktop | 4 cột grid Overview; full layout |
| `1024–1279px` | Tablet ngang | 2 cột grid; left rail icon-only; gauge -20% |
| `<1024px` | Mobile (graceful-degrade) | Cảnh báo "vui lòng dùng desktop/tablet"; chart cuộn ngang |

Test target: **1024×768 (iPad ngang)**.

## 8. Accessibility (baseline)

- Contrast ratio ≥ 4.5:1 cho text (đặc biệt ở dark mode).
- Focus ring rõ ràng (không bị ẩn bởi custom style).
- Keyboard navigation: tab qua card, Enter mở detail, Esc đóng modal.
- Aria-label cho icon-only button (left rail).
- Toast announce bằng `aria-live="polite"`, critical bằng `aria-live="assertive"`.

## 9. Out of scope (phase này)

- Multi-language (chỉ tiếng Anh).
- Custom theme per user (chỉ dark/light toggle).
- Mobile-first design.

## 10. Tài liệu liên quan

- [Plan Overview](./plan_overview.md)
- [Plan Data Pipeline](./plan_data_pipeline.md)
- [Plan Webapp Architecture](./plan_webapp_architecture.md)
- [Payload Spec v1](../99_attachments/payload_spec_v1.md)

## Change history

- 2026-08-30: Tạo plan_uiux_concept.md (M0).
