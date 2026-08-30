---
title: Design System
category: design
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 1.0.0
---

# Design System

> Nguồn chân lý cho visual language của IIoT Gateway webapp (M3 chốt).
> Liên kết trực tiếp với implementation: `webapp/src/styles/tokens.css`.

Phong cách tổng thể (D-02): **Grafana-style + High-Performance HMI**, mật độ SCADA, tối ưu cho operator đứng 8h/ngày.

## 1. Nguyên tắc thiết kế

1. **Mật độ thông tin cao** (D-10) — operator cần thấy nhiều data cùng lúc, không cuộn nhiều.
2. **Đọc nhanh** — số dùng `tabular-nums`, màu sắc semantic, không gradient/glassmorphism.
3. **Phản hồi tức thì** — state dot pulse, badge nguồn phân biệt rõ, toast cho critical event.
4. **Predictable** — cùng một vị trí luôn hiển thị cùng loại thông tin.
5. **English-only** (D-09) — toàn bộ label, message, code.

## 2. Color tokens

### 2.1 Surface (dark mode — mặc định)
| Token | Hex | Mục đích |
|---|---|---|
| `--bg-base` | `#0f1419` | App background |
| `--bg-elevated` | `#1a212b` | Card, panel |
| `--bg-overlay` | `#232b36` | Modal, dropdown |
| `--bg-hover` | `#2a3340` | Hover state |
| `--border` | `#2d3748` | Divider 1px |
| `--border-strong` | `#3d4856` | Emphasized border |

### 2.2 Surface (light mode)
| Token | Hex |
|---|---|
| `--bg-base` | `#f7f8fa` |
| `--bg-elevated` | `#ffffff` |
| `--bg-overlay` | `#ffffff` |
| `--bg-hover` | `#eef0f3` |
| `--border` | `#d8dde3` |
| `--border-strong` | `#b8c0cb` |

### 2.3 Text
| Token | Dark | Light |
|---|---|---|
| `--text-primary` | `#e6edf3` | `#11151a` |
| `--text-secondary` | `#9ca8b8` | `#5a6573` |
| `--text-muted` | `#6b7785` | `#8a95a3` |
| `--text-inverse` | `#0f1419` | `#ffffff` |

### 2.4 State (device status, D-22)
| Token | Dark | Light | Mục đích |
|---|---|---|---|
| `--state-online` | `#16a34a` | `#15803d` | `online` |
| `--state-degraded` | `#eab308` | `#ca8a04` | `degraded` |
| `--state-error` | `#dc2626` | `#b91c1c` | `error` |
| `--state-offline` | `#6b7280` | `#4b5563` | `offline` |

State dot: 8x8px, pulse animation 0.6s khi `error`.

### 2.5 Severity (event, D-22)
| Token | Dark | Light |
|---|---|---|
| `--severity-info` | `#3b82f6` | `#2563eb` |
| `--severity-warning` | `#f97316` | `#ea580c` |
| `--severity-critical` | `#ef4444` | `#dc2626` |

### 2.6 Source (D-11)
| Token | Dark | Light | Badge style |
|---|---|---|---|
| `--source-simulated` | `#a78bfa` | `#7c3aed` | Dashed border, "SIM" |
| `--source-real` | `#38bdf8` | `#0284c7` | Solid border, "REAL" |

### 2.7 Accent
`--accent` (#3b82f6 dark / #2563eb light) dùng cho: focus ring, active nav, primary button, link.

## 3. Typography (D-10)

| Token | Value | Mục đích |
|---|---|---|
| `--font-sans` | Inter | UI text |
| `--font-mono` | JetBrains Mono | Giá trị số, register, ts |

Sizes (CSS rem-equivalent, base 13px):
- `h1`: 16px / 600
- `card-title`: 13px / 600
- `body`: 13px / 400
- `muted` / `kv .k`: 11px / uppercase + letter-spacing 0.5
- `numeric` (table cells): tabular-nums, mono
- `display` (gauge, big number): 22px / 600

## 4. Spacing (3-step scale, D-10)

| Token | px |
|---|---|
| `--space-1` | 8 |
| `--space-2` | 12 |
| `--space-3` | 16 |
| `--space-4` | 24 |
| `--space-5` | 32 |

Không dùng 4/6/10. Padding trong card/panel/button thuộc 1 trong 3 step này.

## 5. Density (SCADA, D-10)

| Token | px | Mục đích |
|---|---|---|
| `--row-table` | 28 | Table row |
| `--row-list` | 32 | List/card body |
| `--row-header` | 36 | Section header |

## 6. Layout (D-03, D-05)

| Token | px | Mục đích |
|---|---|---|
| `--topbar-height` | 48 | Top bar |
| `--rail-width` | 60 | Left rail icon-only (default) |
| `--rail-width-expanded` | 200 | Left rail expanded (hover) |

Grid:
```
┌────────────────────────────┐
│        TopBar (48px)        │
├──────┬─────────────────────┤
│      │                     │
│ Rail │      Main           │
│ 60px │                     │
└──────┴─────────────────────┘
```

## 7. Radius

| Token | px |
|---|---|
| `--radius-sm` | 4 (input, badge) |
| `--radius-md` | 6 (card, button) |
| `--radius-lg` | 8 (modal) |

## 8. Z-index

| Token | Value | Mục đích |
|---|---|---|
| `--z-modal` | 900 | Modal, drawer |
| `--z-toast` | 1000 | Toast top-right |

## 9. Motion

- **State dot pulse** (D-22): `transform: scale(1)→1.4→1`, 0.6s ease-out, chỉ chạy 1 lần khi state chuyển sang `error`.
- **Toast slide-in**: top-right, fade + slide 8px từ phải, 200ms.
- **Source badge fade**: khi mapping thay đổi, fade 200ms (no flash).
- **Hover**: transition 100ms trên background/border.
- **Không dùng**: parallax, scroll-jacking, animation quá 300ms (gây mỏi mắt operator).

## 10. Components (từ plan_uiux_concept.md, đã implement ở M2)

| Component | File | Mục đích |
|---|---|---|
| `Shell` | `webapp/src/components/Shell.tsx` | TopBar + left rail layout |
| `DeviceCard` | `webapp/src/components/DeviceCard.tsx` | 1 device trên Overview |
| `StateDot` | `webapp/src/components/Indicators.tsx` | Dot 8px với pulse cho `error` |
| `SourceBadge` | `webapp/src/components/Indicators.tsx` | "SIM" / "REAL" badge |
| `SeverityChip` | `webapp/src/components/Indicators.tsx` | info/warning/critical |
| `ToastStack` | M3 (mới) | Top-right toast cho critical event |

## 11. Toast specification (D-07, M3 mới)

Vị trí: top-right, fixed, `z-index: 1000`.

Lifecycle:
- `info` / `warning`: auto-dismiss 8s.
- `critical`: KHÔNG auto-dismiss. Có nút X manual close.

Visual:
- Width: 320px, max 5 toasts cùng lúc.
- Background: `--bg-elevated` với border-left 4px theo severity color.
- Icon: SVG icon nhỏ bên trái (info / warn / bell).
- Title (severity + code) + message + ts relative ("3s ago").
- Action button (optional): "View" → navigate tới event detail.

Sound:
- Default **OFF** (D-07).
- Toggle trong user menu (TopBar), persist localStorage `iigw.sound`.
- File: `/sounds/critical.mp3` (load lazy, 1 file, <50KB).

Group rule: nếu cùng `code` xuất hiện trong 5s → update toast hiện có (count++), không tạo mới.

## 12. Accessibility (baseline)

- Contrast ratio ≥ 4.5:1 cho mọi text (verified cho cả dark + light).
- Focus ring: `outline: 2px solid var(--accent)` với `outline-offset: 2px`.
- Keyboard: tab order hợp lý, Esc đóng modal/toast, Enter submit form.
- ARIA: `aria-live="polite"` cho toast, `aria-live="assertive"` cho critical.
- Icon-only buttons: phải có `aria-label` hoặc `title`.

## 13. Responsive

| Breakpoint | Layout |
|---|---|
| `≥1280` | Desktop: 4 col grid Overview, full layout |
| `1024–1279` | Tablet: 2 col grid, left rail icon-only mặc định, gauge -20% size |
| `<1024` | Mobile graceful-degrade: 1 col, cảnh báo "vui lòng dùng desktop/tablet", chart cuộn ngang |

## 14. Resources

- Reference: Grafana dashboard UI patterns
- Fonts: Inter (UI), JetBrains Mono (numbers)
- Icons: emoji + Unicode glyphs (mục tiêu M3, custom SVG ở M5+)

## Change history

- 2026-08-30: Tạo design_system.md (M3, v1.0.0) — chốt design tokens, toast spec, motion, accessibility.
