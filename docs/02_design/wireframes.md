---
title: Wireframes
category: design
owner: project_lead
created: 2026-08-30
updated: 2026-09-05
status: approved
version: 2.0.0
---

# Wireframes

ASCII wireframes cho 3 trang chính webapp (v2 — M10 design). Tất cả
hiển thị ở **dark mode** (mặc định), ≥1280px desktop.

Layout: TopBar 56px (full width) + Sidebar 220px (always visible) +
Main (max 1440px, padding 24px).

Legend:
- `◉` status dot online
- `○` status dot offline
- `◌` empty state
- `[online]` `[offline]` status badge (text + dot)
- `·` separator
- `▣` icon (lucide, 16px)

---

## 1. Login (`/login`)

Public. No shell. Centered card with amber-tinted radial background.

```
                       ┌────────────────────────────┐
                       │ [IG]  iigw · webapp        │
                       │                            │
                       │  Sign in                   │
                       │  Access the industrial     │
                       │  telemetry dashboard.      │
                       │                            │
                       │  USERNAME                  │
                       │  ┌──────────────────────┐  │
                       │  │ admin                │  │
                       │  └──────────────────────┘  │
                       │                            │
                       │  PASSWORD                  │
                       │  ┌──────────────────────┐  │
                       │  │ ●●●●●●●●             │  │
                       │  └──────────────────────┘  │
                       │                            │
                       │  ┌──────────────────────┐  │
                       │  │  → Sign in           │  │  ← primary amber
                       │  └──────────────────────┘  │
                       │                            │
                       │  ─────────────────────     │
                       │  default         admin     │
                       │                  /admin123 │
                       └────────────────────────────┘
```

---

## 2. Dashboard (`/`)

```
═══════════════════════════════════════════════════════════════════════════════
 [IG] IIoT Gateway [dev]              [◉ sound] [☀ Light] admin [ADMIN] [⎋]    ← topbar 56
═══════════════════════════════════════════════════════════════════════════════
│ OVERVIEW │ Dashboard                                  3 of 5 gateways online   │ ← sidebar
│  • Dash  │ ─────────────────────────────────────────────────────────────────│   220
│          │                                                                    │
│          │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│          │  │ ⌂              │  │ ◐              │  │ △              │         │
│          │  │ GATEWAYS ONLINE│  │ PLC ONLINE     │  │ ACTIVE WARNINGS│         │  ← 3 stat cards
│          │  │   3 / 5       │  │   3 / 5       │  │     0          │         │     280px
│          │  │ 60% online    │  │ all connected  │  │ all clear      │         │     wide each
│          │  └────────────────┘  └────────────────┘  └────────────────┘         │
│          │                                                                    │
│          │  ┌──────────────────┐  ┌──────────────────┐                        │
│          │  │ ◉ SIM_LINE_A_01  │  │ ◉ SIM_LINE_A_02  │   ← hover: lift 2px    │  ← grid
│          │  │   ▣ Aichi        │  │   ▣ Aichi        │     + amber border      │     280px+
│          │  │ PLC  3/3 online │  │ PLC  1/1 online │                        │
│          │  │ fw    1.0.0     │  │ fw    1.0.0     │                        │
│          │  │ sync  14:23:01  │  │ sync  14:23:01  │                        │
│          │  │ SIM_LINE_A_01 ›│  │ SIM_LINE_A_02 ›│                        │
│          │  └──────────────────┘  └──────────────────┘                        │
│          │  ┌──────────────────┐  ┌──────────────────┐                        │
│          │  │ ◉ SIM_LINE_B_01  │  │ ○ BTN_PA15_01    │                        │
│          │  │   …              │  │   …              │                        │
│          │  └──────────────────┘  └──────────────────┘                        │
│          │                                                                    │
```

Each gateway card on hover: `translateY(-2px)` + amber border.
Empty state (no gateways): big card with `◌` icon + heading "No gateways
yet" + body + retry button.

---

## 3. Gateway Detail (`/gateways/:gateway_id`)

```
═══════════════════════════════════════════════════════════════════════════════
 [IG] IIoT Gateway [dev]              [◉ sound] [☀ Light] admin [ADMIN] [⎋]
═══════════════════════════════════════════════════════════════════════════════
│ OVERVIEW │ Dashboard  ›  SIM_LINE_A_01                                    │
│  • Dash  │ ─────────────────────────────────────────────────────────────────│
│          │                                                                    │
│          │  SIM_LINE_A_01  3 PLCs online                          [↻]       │
│          │                                                                    │
│          │  ┌────┐ SIM_LINE_A_01                                             │  ← status header
│          │  │ ▣  │ gateway_id SIM_LINE_A_01 · fw 1.0.0 · seen 14:23:01        │     card with
│          │  └────┘                                              [online ●]    │     amber accent
│          │                                                                    │
│          │  PLC             STATUS  MODE   TEMP    RPM   AMPS   HB   SEEN    │  ← table
│          │  ──────────────────────────────────────────────────────────────│     rows
│          │  ◉ SIM_LINE_A_01  online  run 79.7°C  304   0.0A   #1  14:23:01   │     hover bg
│          │  ◉ SIM_LINE_A_02  online  run 43.7°C  760   0.1A   #0  14:23:01   │
│          │  ◉ SIM_LINE_B_01  online  run 41.7°C  405   0.0A   #1  14:23:01   │  ← click
│          │                                                               ›   │     → PLC
│          │                                                                    │
│          │  (no active warnings)                                              │
│          │                                                                    │
│          │  Polling 60s default. Updated 14:23:01.                            │  ← mono footer
```

Offline gateway: header icon border + status badge turn red.
Empty (no PLCs): centered `No PLCs assigned` empty state.

---

## 4. PLC Detail (`/gateways/:gatewayId/plc/:plcId`)

```
═══════════════════════════════════════════════════════════════════════════════
 [IG] IIoT Gateway [dev]              [◉ sound] [☀ Light] admin [ADMIN] [⎋]
═══════════════════════════════════════════════════════════════════════════════
│ OVERVIEW │ Dashboard  ›  SIM_LINE_A_01  ›  SIM_LINE_A_01                    │
│  • Dash  │ ─────────────────────────────────────────────────────────────────│
│          │                                                                    │
│          │  ← Back   SIM_LINE_A_01 [sim] ◉  online  · uptime 152s            │
│          │                                                                    │
│          │  ┌──────────┬──────────┬──────────┬──────────┐                     │  ← info header
│          │  │ temperature  │    rpm      │  current  │ heartbeat│            │     4-cell
│          │  │  79.7°C     │    304     │   0.0A    │   #1     │            │     mono grid
│          │  └──────────┴──────────┴──────────┴──────────┘                     │
│          │                                                                    │
│          │  range:  [15m] [1h] [6h] [24h]                tick #142             │
│          │                                                                    │
│          │  ┌──────────────────────┐  ┌──────────────────────┐               │
│          │  │ ◐ Temperature        │  │ ◐ RPM                │               │  ← 2 chart cards
│          │  │ 79.7°C               │  │ 304                  │               │     recharts
│          │  │   ╱╲╱╲╱╲╱╲╱╲╱╲╱╲     │  │   ╱╲╱╲╱╲╱╲╱╲╱╲     │               │     LineChart
│          │  │ 103 points · 1h      │  │ 103 points · 1h      │               │
│          │  └──────────────────────┘  └──────────────────────┘               │
│          │  ┌──────────────────────┐                                         │
│          │  │ ◐ Current            │                                         │
│          │  │ 0.0A                 │                                         │
│          │  └──────────────────────┘                                         │
│          │                                                                    │
│          │  gateway SIM_LINE_A_01 · last seen 14:23:01                         │
```

PLC offline state replaces ALL chart cards with one centered empty state:

```
│          │  ┌────────────────────────────────────────────┐                    │
│          │  │              [⊘]                           │                    │
│          │  │                                            │                    │
│          │  │          PLC offline                       │                    │
│          │  │                                            │                    │
│          │  │  Connection to SIM_LINE_B_01 was lost.     │                    │
│          │  │  Last seen Sep 5, 14:18:42.                │                    │
│          │  │  History charts will resume once the       │                    │
│          │  │  device reconnects.                        │                    │
│          │  │                                            │                    │
│          │  │            [↻ Retry]                      │                    │
│          │  │                                            │                    │
│          │  └────────────────────────────────────────────┘                    │
```

## 5. State coverage

| Surface | Loading | Empty | Error |
|---|---|---|---|
| Dashboard stat cards | `—` placeholder values | "0" | red value + "all offline" hint |
| Dashboard gateway grid | 6 skeleton cards, 1.4s shimmer | `◌` icon + "No gateways yet" | alert card + retry |
| Gateway table | `loading PLCs…` in row | "No PLCs assigned" in row | inline error card |
| PLC info header | "loading…" subtitle | "PLC not found" empty state | — |
| PLC charts | `loading history…` in chart | "No data in this range" | "Connection failed. Please try again." toast |
| PLC offline | n/a (no charts render) | WifiOff icon + retry card | n/a |

## Change history

- 2026-09-05: Redesign v2.0.0 — 3 trang chính (Dashboard, Gateway,
  PLC), sidebar nav 220px, IBM Plex + amber accent, recharts charts.
- 2026-08-30: Wireframes v1.1.0 — 6 màn hình (Login, Overview,
  DeviceDetail, Events, Diagnostics, Settings) với icon rail.
