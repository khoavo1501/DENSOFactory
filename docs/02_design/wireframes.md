---
title: Wireframes
category: design
owner: project_lead
created: 2026-08-30
updated: 2026-08-30
status: approved
version: 1.1.0
---

# Wireframes

ASCII wireframes cho 6 màn hình webapp (M3). Tất cả hiển thị ở **dark mode** (mặc định), ≥1280px desktop.

Legend:
- `▦` icon-only nav item (active = có border trái)
- `●` state dot (green=online, yellow=degraded, red=error, gray=offline)
- `[SIM]` source badge (dashed)
- `[REAL]` source badge (solid)
- `≡` TopBar
- `—` left rail

---

## 1. Login (`/login`)

```
                          ┌────────────────────────────┐
                          │                            │
                          │   IIoT Gateway — Sign in   │
                          │                            │
                          │   USERNAME                 │
                          │   ┌──────────────────────┐ │
                          │   │ admin                │ │
                          │   └──────────────────────┘ │
                          │                            │
                          │   PASSWORD                 │
                          │   ┌──────────────────────┐ │
                          │   │ ●●●●●●●●             │ │
                          │   └──────────────────────┘ │
                          │                            │
                          │   ┌──────────────────────┐ │
                          │   │     Sign in          │ │
                          │   └──────────────────────┘ │
                          │                            │
                          └────────────────────────────┘
```

Public. No shell.

---

## 2. Overview (`/`)

```
═══════════════════════════════════════════════════════════════════════════════
 IIoT Gateway  [DEV]                                    [Dark] admin · admin  [Logout]
═══════════════════════════════════════════════════════════════════════════════
   ▦     │   Overview              3 devices        [All][Sim][Real] [↻]
  (active)│
   ✦     │
   ◆     │   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
   ⚙     │   │ ● GW_LINE_A_01  │ │ ● GW_LINE_A_02  │ │ ● GW_LINE_B_01  │
         │   │   [REAL]        │ │   [REAL]        │ │   [REAL]        │
         │   │                 │ │                 │ │                 │
         │   │   35.2 °C       │ │   72.1 %RH      │ │   142.0 bar     │
         │   │   ──/\──        │ │   ──/\──        │ │   ─/\──         │
         │   │   state: online │ │   state: online │ │   state: online │
         │   │   11:23:45      │ │   11:23:45      │ │   11:23:45      │
         │   └─────────────────┘ └─────────────────┘ └─────────────────┘
         │
         │   Toast (top-right, M3):                    ┌──────────────────────┐
         │                                              │ SLAVE_COMM_LOST ×    │
         │                                              │ critical · 2s ago    │
         │                                              │ Slave 3 timeout      │
         │                                              └──────────────────────┘
         │
         │   Logged in as admin. Use Settings to toggle Simulator / change
         │   source mapping.
```

Layout: 4 col grid auto-fill, card 280px min.

---

## 3. Device Detail (`/devices/:id`)

```
═══════════════════════════════════════════════════════════════════════════════
 ≡
   ▦     │   ← Back   SIM_LINE_A_01   [SIM]  ●  online  · uptime 3600s
         │
   ✦     │   ┌──────────────────────────────────────────────────────────┐
         │   │ Telemetry (live)                                          │
   ◆     │   ├──────────────────────────────────────────────────────────┤
         │   │ hr_100       352                                       │
   ⚙     │   │ hr_101       315                                       │
         │   │ co_0         true   @ 11:23:45                          │
         │   │ di_300       false  @ 11:23:45                          │
         │   └──────────────────────────────────────────────────────────┘
         │
         │   ┌──────────────────────────────────────────────────────────┐
         │   │ Status (last 24h)              [5m][1h][6h][24h][7d]     │
         │   │ ╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱  │
         │   └──────────────────────────────────────────────────────────┘
         │
         │   ┌──────────────────────────────────────────────────────────┐
         │   │ Events (recent)                                          │
         │   │ 11:20:01  critical  SLAVE_COMM_LOST   "Slave 3 timeout"   │
         │   │ 11:18:30  warning   VALUE_OUT_OF_RANGE "hr_100=1250"      │
         │   └──────────────────────────────────────────────────────────┘
         │
         │   (M4) gauge + history chart for selected register
```

Tabs thực tế ở M4. M3 chỉ show Telemetry + Status + Events.

---

## 4. Events (`/events`)

```
═══════════════════════════════════════════════════════════════════════════════
   ▦     │   Events (last 24h)         [All][Critical][Warning][Info]
         │
  (✦)    │   ┌─────────────┬────────────┬─────────────┬──────────┬───────────┐
  active  │   │ Time        │ Severity   │ Code        │ Device   │ Message   │
         │   ├─────────────┼────────────┼─────────────┼──────────┼───────────┤
   ◆     │   │ 11:20:01    │ critical   │ SLAVE_...   │ SIM_L_A01│ Slave 3.. │
   ⚙     │   │ 11:18:30    │ warning    │ VALUE_...   │ SIM_L_A01│ hr_100=.. │
         │   │ 10:55:12    │ info       │ POWER_ON    │ GW_L_B_01│ just po.. │
         │   │ ...                                                       │
         │   └─────────────┴────────────┴─────────────┴──────────┴───────────┘
         │                                       [← Prev] Page 1 [Next →]
```

Filter bar: severity multi, code multi, device multi, time range (M5).

---

## 5. Diagnostics (`/diagnostics`)

```
═══════════════════════════════════════════════════════════════════════════════
   ▦     │   Diagnostics
         │
   ✦     │   ┌────────────┬────────────┬──────┬──────┬──────┬─────────┬───────┐
         │   │ Device     │ Last diag  │ Poll │ TX+  │ TX-  │ Latency │ Uptime│
   (◆)   │   ├────────────┼────────────┼──────┼──────┼──────┼─────────┼───────┤
  active  │   │ GW_LINE_A01│ 11:20:00   │ 120  │ 43200│ 3    │ 10.2 ms │ 86400 │
   ⚙     │   │ GW_LINE_A02│ 11:20:00   │ 115  │ 43150│ 0    │  8.7 ms │ 86400 │
         │   │ SIM_LINE_B01│ 11:20:00  │ 118  │ 43200│ 0    │  9.1 ms │ 86400 │
         │   └────────────┴────────────┴──────┴──────┴──────┴─────────┴───────┘
         │
         │   ┌──────────────────────────────────────────────────────────┐
         │   │ Diag history — GW_LINE_A_01             288 rows        │
         │   ├──────────────────────────────────────────────────────────┤
         │   │ Time        │ Poll (ms) │ Latency (ms) │ TX ok/fail       │
         │   │ 11:20:00    │ 120       │ 10.2         │ 43200/3          │
         │   │ 11:15:00    │ 118       │ 10.4         │ 43180/3          │
         │   │ ...                                                       │
         │   └──────────────────────────────────────────────────────────┘
```

Click row → drawer per-slave stats (M5).

---

## 6. Settings (`/settings`)

```
═══════════════════════════════════════════════════════════════════════════════
   ▦     │   Settings
         │
   ✦     │   ┌──────────────────────────────────────────────────────────┐
   ◆     │   │ Simulator Service                  [RUNNING]              │
 (⚙)    │   │ Toggle the simulator container. Real data unaffected.    │
 active  │   │ [Start] [Stop]                                         │
         │   └──────────────────────────────────────────────────────────┘
         │
         │   ┌──────────────────────────────────────────────────────────┐
         │   │ Source Mapping     Override pattern inference per device│
         │   │ ┌──────────────────────┐  ┌──────────┐                  │
         │   │ │ SIM_OVERRIDE_01      │  │ simulated▼│   [Add]         │
         │   │ └──────────────────────┘  └──────────┘                  │
         │   ├──────────────────────────────────────────────────────────┤
         │   │ DEVICE_ID          │ Source │ Updated         │         │
         │   ├────────────────────┼────────┼─────────────────┼─────────┤
         │   │ GW_LINE_A_01        │ [REAL] │ 2026-08-30 10:00│[Remove] │
         │   │ SIM_LINE_A_01       │ [SIM]  │ 2026-08-30 09:55│[Remove] │
         │   │ TEST_DEVICE         │ [SIM]  │ 2026-08-29 18:30│[Remove] │
         │   └──────────────────────────────────────────────────────────┘
         │
         │   ┌──────────────────────────────────────────────────────────┐
         │   │ User          │ Role    │ Created                          │
         │   │ admin         │ admin   │ 2026-08-30 09:00                 │
         │   │ (M5: user management — create viewer, change password)   │
         │   └──────────────────────────────────────────────────────────┘
```

Admin-only. User management section is M5 scope.

---

## 7. Toast overlay (M3 mới, top-right fixed)

```
                                                              ┌────────────────────┐
                                                              │ ⚠ SLAVE_COMM_LOST  ×│
                                                              │ critical · 2s ago  │
                                                              │ Slave 3 timeout    │
                                                              │ after 3 retries    │
                                                              │ [View]              │
                                                              └────────────────────┘
                                                              ┌────────────────────┐
                                                              │ ⓘ POWER_ON         ×│
                                                              │ info · 5s ago      │
                                                              │ SIM_LINE_B_01      │
                                                              └────────────────────┘
```

- Max 5 stack.
- Critical: no auto-dismiss, manual X.
- Warning/info: 8s auto-dismiss.
- `aria-live="assertive"` cho critical, `polite` cho warning/info.
- Sound OFF by default, toggle trong user menu.

---

## 8. Mobile / tablet graceful-degrade (<1024px hoặc 1024–1279)

```
┌──────────────────────────────────┐
│ ≡ IIoT Gateway    [Dark] admin  │
├──────────────────────────────────┤
│ ▦ ✦ ◆ ⚙  (horizontal scroll)   │
├──────────────────────────────────┤
│                                  │
│ ┌──────────────────────────────┐ │
│ │ ● GW_LINE_A_01   [REAL]      │ │
│ │   35.2 °C                    │ │
│ │   state: online              │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ ● GW_LINE_A_02   [REAL]      │ │
│ │   72.1 %RH                   │ │
│ └──────────────────────────────┘ │
│                                  │
│ (1 col stack, full width cards)  │
└──────────────────────────────────┘
```

Tablet 1024–1279px: 2 col grid, gauge -20% size.
<1024px: 1 col, banner cảnh báo "recommended: desktop/tablet".

---

## 9. State transitions

| From | To | Visual cue |
|---|---|---|
| `online` → `degraded` | State dot yellow + soft glow |
| `online` → `error` | State dot red + 0.6s pulse + critical toast + (sound) |
| `error` → `offline` | State dot gray (no pulse) + toast info |
| `offline` → `online` | State dot green + toast info "device back online" |
| Source mapping changed | Source badge fade 200ms (no flash) |

---

## 10. Mapping to design system

| Wireframe element | Token / class |
|---|---|
| TopBar | `.topbar`, height `--topbar-height` |
| Left rail | `.rail`, width `--rail-width` |
| State dot | `.dot` + `.dot.<state>` (with pulse for `error`) |
| Source badge | `.badge.simulated` (dashed) / `.badge.real` (solid) |
| Severity chip | `.sev-info` / `.sev-warning` / `.sev-critical` |
| Card | `.card`, padding `--space-2` |
| Table | row height `--row-table` (28px) |
| Button primary | `.btn.btn-primary`, height `--row-list` |
| Toast | `.toast-stack` (M3 mới), z `--z-toast` |

## Change history

- 2026-08-30: Tạo wireframes.md (M3, v1.0.0) — 6 màn hình + toast + responsive + state transitions.
- 2026-08-30: M4 — note trạng thái delivered: Login (M2), Overview (M2), DeviceDetail (M4 với tabs Telemetry/Status/Events/Diag/Info), Events (M4 với time range + code multi-select), Diagnostics (M2), Settings (M2).
