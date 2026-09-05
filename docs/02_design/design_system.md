---
title: Design System
category: design
owner: project_lead
created: 2026-08-30
updated: 2026-09-05
status: approved
version: 2.0.0
---

# Design System

> Nguồn chân lý cho visual language của IIoT Gateway webapp.
> Liên kết trực tiếp với implementation: `webapp/src/styles/tokens.css`
> và `webapp/src/styles/app.css`.

Phong cách tổng thể: **Enterprise SCADA / HMI** theo brief, dựa trên
Grafana dashboard pattern. Mật độ vừa phải (operator 8h/ngày), accent
amber `#E0973B` để cảnh báo tách bạch với state (green/red).

## 1. Nguyên tắc thiết kế

1. **Mật độ thông tin vừa** — operator thấy data cùng lúc, không cuộn nhiều.
2. **Đọc nhanh** — số dùng `tabular-nums`, màu sắc semantic, không gradient.
3. **Phản hồi tức thì** — state dot pulse (chỉ critical), hover lift, skeleton loader.
4. **Predictable** — breadcrumb drill-down: Dashboard → Gateway → PLC.
5. **English-only** (D-09) — toàn bộ label, message, code.

## 2. Color tokens

### 2.1 Surface (dark mode — mặc định)
| Token | Hex | Mục đích |
|---|---|---|
| `--bg-base` | `#0d1117` | App background |
| `--bg-elevated` | `#151b23` | Card, panel, topbar |
| `--bg-overlay` | `#1c232c` | Dropdown, modal |
| `--bg-hover` | `#1f2731` | Hover state |
| `--border` | `#2a323d` | Divider 1px |
| `--border-strong` | `#3a4452` | Emphasized border |

### 2.2 Surface (light mode)
| Token | Hex |
|---|---|
| `--bg-base` | `#f2f4f7` |
| `--bg-elevated` | `#ffffff` |
| `--bg-overlay` | `#ffffff` |
| `--bg-hover` | `#ebeef3` |
| `--border` | `#d8dde3` |
| `--border-strong` | `#b8c0cb` |

### 2.3 Text
| Token | Dark | Light |
|---|---|---|
| `--text-primary` | `#e8ecf2` | `#0f1620` |
| `--text-secondary` | `#9aa6b6` | `#4a5663` |
| `--text-muted` | `#6b7684` | `#7a8593` |
| `--text-inverse` | `#0d1117` | `#ffffff` |

### 2.4 Accent (amber)
- `--accent` `#e0973b` (dark) / `#c87f1d` (light) — dùng cho focus ring,
  active nav, primary button, link, hover lift border.
- `--accent-soft` `rgba(224, 151, 59, 0.14)` — accent fill nhạt (active
  nav background, card icon container).

### 2.5 State (device)
| Token | Dark | Light | Mục đích |
|---|---|---|---|
| `--state-online` | `#39c58f` | `#2a9d72` | `online` |
| `--state-degraded` | `#e0973b` | `#c87f1d` | `degraded` |
| `--state-error` | `#db5a5a` | `#c04444` | `error` (collapse) |
| `--state-offline` | `#7a8493` | `#6b7682` | `offline` |

### 2.6 Severity (event)
| Token | Dark | Light |
|---|---|---|
| `--severity-info` | `#5aa6e0` | `#2563eb` |
| `--severity-warning` | `#e0973b` | `#c87f1d` |
| `--severity-critical` | `#db5a5a` | `#c04444` |

### 2.7 Source
| Token | Dark | Light |
|---|---|---|
| `--source-simulated` | `#b48ee6` | `#7c3aed` |
| `--source-real` | `#39c5e0` | `#0284c7` |

## 3. Typography

| Token | Value | Mục đích |
|---|---|---|
| `--font-sans` | IBM Plex Sans | UI text, headings, body |
| `--font-mono` | IBM Plex Mono | device_id, register, telemetry values, ts |

Sizes (`rem` based, root 14px):
- h1 page: 28px / 600 / `letter-spacing: -0.025em`
- card-title: 14px / 600 / `letter-spacing: -0.01em`
- body: 13px / 400
- eyebrow: 11px / 500 / lowercase / `letter-spacing: 0.04em`
- numeric (tables): Plex Mono / `tabular-nums`
- display (gauge, big number): 24-40px / 600 / `letter-spacing: -0.03em`

## 4. Spacing (4-step scale)

| Token | px |
|---|---|
| `--space-1` | 8 |
| `--space-2` | 12 |
| `--space-3` | 16 |
| `--space-4` | 24 |
| `--space-5` | 32 |
| `--space-6` | 48 |

## 5. Density (SCADA, D-10)

| Token | px | Mục đích |
|---|---|---|
| `--row-table` | 32 | Table row |
| `--row-list` | 36 | List/card body |
| `--row-header` | 40 | Section header |

## 6. Layout (D-03, D-05)

| Token | px | Mục đích |
|---|---|---|
| `--topbar-height` | 56 | Top bar |
| `--sidebar-width` | 220 | Left sidebar (always visible) |
| `--content-max` | 1440 | Page max-width container |

Grid:
```
┌──────────────────────────────────────────┐
│           TopBar (56px)                  │
├──────────┬───────────────────────────────┤
│          │                               │
│ Sidebar  │   Main (max 1440px)           │
│ 220px    │   - breadcrumb                 │
│          │   - page header (h1 + meta)    │
│          │   - stat cards / table / chart │
│          │                               │
└──────────┴───────────────────────────────┘
```

Top bar (56px) chứa: brand mark + env chip + spacer + sound toggle +
theme toggle (Dark/Light) + user (username + role pill + sign out).

Sidebar (220px) chứa: 1 nav group "Overview" → Dashboard. (M10+ sẽ
thêm Gateways / Events / Diagnostics / Settings tuỳ brief.)

## 7. Radius

| Token | px | Mục đích |
|---|---|---|
| `--radius-xs` | 3 | env chip, role pill |
| `--radius-sm` | 4 | input, badge, btn |
| `--radius-md` | 6 | card, button (default) |
| `--radius-lg` | 8 | modal |
| `--radius-xl` | 12 | (reserved) |

Shape Consistency Lock: tất cả element dùng một trong các token trên.
Không hardcode `border-radius` ở component.

## 8. Z-index

| Token | Value | Mục đích |
|---|---|---|
| `--z-sticky` | 50 | Sticky topbar |
| `--z-modal` | 900 | Modal, drawer |
| `--z-toast` | 1000 | Toast top-right |

## 9. Motion

Tokens: `--t-fast: 120ms`, `--t-base: 180ms`, `--t-slow: 280ms`,
`--ease: cubic-bezier(0.2, 0.8, 0.2, 1)`.

- **State dot pulse** (D-22): `box-shadow` mở rộng + fade, 1.6s
  infinite, chỉ trên `error` (không dùng trên degraded/online).
- **Card hover lift**: `translateY(-2px) + box-shadow` tăng + border
  đổi sang `--accent`, 180ms.
- **Button active**: `translateY(1px)`, 120ms — giả lập phím bấm vật lý.
- **Skeleton shimmer**: gradient chạy ngang, 1.4s loop.
- **Reduced motion**: tắt tất cả animation/transition khi user prefers.

Không dùng: parallax, scroll-jacking, animation > 400ms.

## 10. Components

| Component | File | Mục đích |
|---|---|---|
| `Shell` | `webapp/src/components/Shell.tsx` | TopBar + sidebar layout |
| `Breadcrumb` + `PageHeader` | `webapp/src/components/Breadcrumb.tsx` | Drill-down + page title |
| `StatusBadge` | `webapp/src/components/Indicators.tsx` | "online"/"offline"/"warning" pill với dot |
| `StatusDot` | `webapp/src/components/Indicators.tsx` | 8px dot, pulse chỉ cho error |
| `SourceBadge` | `webapp/src/components/Indicators.tsx` | "sim"/"real" |
| `GatewayCard` + `StatCard` | `webapp/src/components/GatewayCard.tsx` | Dashboard grid + stat cards |
| `Gauge` (replacing) | (via recharts LineChart) | telemetry time-series |

Icon: `lucide-react` (stroke 1.5–2.0, 14–22px). Không vẽ SVG inline.

## 11. Page patterns (3 trang chính)

### 11.1 Dashboard (`/`)
- 3 stat cards (gateways online, PLCs online, active warnings)
- Gateway grid (auto-fill minmax 280px) — hover lift + accent border
- Empty state: "No gateways yet" + action hint (admin link)
- Loading: 6 skeleton cards, 1.4s shimmer

### 11.2 Gateway Detail (`/gateways/:gateway_id`)
- Breadcrumb: Dashboard / {gateway name}
- Status header: icon + name + meta strip (gateway_id, fw, ip, loc, seen) + status badge
- PLC data table: status dot + mode + temp/rpm/amps/heartbeat + last seen
  - Row hover background, click → drill to PLC
- Active warnings card (if any)

### 11.3 PLC Detail (`/gateways/:gatewayId/plc/:plcId`)
- Breadcrumb: Dashboard / {gateway} / {plc_id}
- 4-cell info header: temperature, RPM, current, heartbeat (mono)
- Time range quick selector: 15m / 1h / 6h / 24h
- 3 LineChart cards (recharts) — temperature / RPM / current
- **Offline empty state** khi `plc.status == "offline"`:
  icon WifiOff, thông báo "PLC offline" + last seen + retry button

## 12. Forms

- Label trên input, helper text optional, error dưới input.
- Inputs có `focus-visible` ring (`box-shadow: var(--shadow-focus)`).
- Login card có radial gradient background tint amber trên dark mode.

## 13. Accessibility (baseline)

- Contrast ≥ 4.5:1 cho body text (verified).
- Focus ring: `outline: 2px solid var(--accent)` + offset 2px.
- Skip-to-content link (ẩn, hiện khi focus) trên top of shell.
- Keyboard: tab order, Enter submit, Esc đóng.
- ARIA: `aria-label` trên icon-only buttons, `aria-pressed` cho sound
  toggle, `aria-live` cho toast, `role="alert"` cho error messages.
- Tables có `<thead>` đúng cấu trúc, `<th>` với scope ngầm định.

## 14. Responsive

| Breakpoint | Layout |
|---|---|
| `≥1024` | Desktop: 3-col stat grid, full sidebar |
| `768–1023` | Tablet: 2-col stat grid, 1-col chart grid |
| `<768` | Mobile: 1-col stack, sidebar collapses to top dropdown (future) |

## 15. Resources

- Fonts: IBM Plex Sans (UI), IBM Plex Mono (numbers) — Google Fonts
- Icons: `lucide-react`
- Charts: `recharts` LineChart
- Reference: Grafana dashboard UI, IBM Carbon data density

## Change history

- 2026-09-05: Redesign v2.0.0 — switch sang IBM Plex, amber accent,
  hex spec colors, lucide icons, recharts, 3 trang chính
  (Dashboard / Gateway / PLC). Bỏ Geist/Inter/emoji glyphs/echarts.
- 2026-08-30: Tạo design_system.md (M3, v1.0.0) — chốt design tokens,
  toast spec, motion, accessibility.
