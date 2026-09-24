# RMT FIREAPPS Technician Navigation Field Review

Review date: 2026-09-24
Running build: `http://127.0.0.1:8026/`
Fixture: `DEMO-WETEX-RETEST-20260924`
Mode: read-only browser review; write APIs were blocked by the capture harness.

## Measured Current State

- Frozen WETEX scope: 65 items.
- Mobile viewport: 393 x 852.
- Current technician document height after opening the job: 5,805 px.
- Console errors: 0.
- Failed requests: 0.
- Visible touch targets measured: 7; targets below 44 px: 0.
- Current configured system routes: 4.

| Current route | Progress | Parent/system items | Field scope |
|---|---:|---|---|
| Fire Alarm Panel | 0/10 | `GRD.MFAP.1` | 9 MCP / smoke devices |
| SPP / Sprinkler | 0/12 | `LG.SPP.1`, `LG.WRP.1` | 10 flow switches |
| CO2 / Gas Release | 0/6 | 6 configured CO2 items | No separate field-device route |
| Emergency Light | 0/37 | No configured parent prerequisite | 37 emergency lights |

The frozen job does not expose separate routes for Hose Reel Pump, Fireman Intercom, Portable Fire Extinguisher, or KELUAR Sign. Sprinkler Pump and Wet Riser Pump are currently represented inside the shared `SPP / Sprinkler` route. This review does not fabricate missing job configuration.

## Tap Measurements

| Journey | Current minimum | Current practical mobile path | Proposed |
|---|---:|---|---:|
| Technician Home -> Fire Alarm Panel | 2 taps | Open job, then Fire Alarm Panel | 2 taps |
| Technician Home -> Pump system | 2 taps | Open job, then SPP / Sprinkler | 3 taps when choosing a configured pump child |
| Pump -> Fire Alarm Panel | 1 tap at stage tabs; typically 2 after scrolling | Systems/Home control, then Fire Alarm Panel | 1 tap from persistent rail; 2 from mobile drawer |
| Fire Alarm Panel -> CO2 / Gas Release | 1 tap at stage tabs; typically 2 after scrolling | Systems/Home control, then CO2 / Gas Release | 1 tap from persistent rail; 2 from mobile drawer |
| Checklist -> Mimic | 1 tap when visible | Current checklist also presents multiple back/navigation actions | 1 persistent secondary action |

No proposal bypasses `System Check -> Field Devices -> Completion`. The tap reduction concerns navigation only.

## Findings

### 1. Job Home Delays System Choice

**CURRENT:** The 65-item summary renders several large progress blocks before the system cards.
**PROBLEM:** The first working choice is pushed down and the technician must scan administrative summary information before choosing work.
**PROPOSED:** Keep one compact overall progress line, then show configured system cards immediately.
**WHY:** The technician can answer “what do I work on next?” within one screen.

### 2. Pump Types Are Not Independently Discoverable

**CURRENT:** `LG.SPP.1` and `LG.WRP.1` are grouped under `SPP / Sprinkler`; Hose Reel Pump is not in this frozen scope.
**PROBLEM:** A technician looking for a specific configured pump cannot see the distinction until after opening the combined route.
**PROPOSED:** Use a collapsible Pump Systems group containing only configured child systems, with progress per child.
**WHY:** It preserves site configuration while making the physical work location obvious.

### 3. Some Requested Systems Are Absent, Not Merely Hidden

**CURRENT:** Fireman Intercom, Portable Fire Extinguisher, KELUAR Sign, and a separate Hose Reel Pump route are not available in this WETEX job.
**PROBLEM:** A visual-only solution could falsely imply work exists.
**PROPOSED:** Render configured/assigned systems only; show missing setup to Admin, never as a fake technician tab.
**WHY:** Technician navigation must reflect frozen job data.

### 4. The Stage Panel Becomes a Long Mixed Workspace

**CURRENT:** System stages and multiple Linked Verification cards are rendered in the same vertical panel.
**PROBLEM:** The current system/checklist context can be separated from navigation by thousands of pixels.
**PROPOSED:** Keep a compact stage strip and show linked work as a summarized status entry that opens one focused card.
**WHY:** Safety status remains visible without making routine movement depend on long scrolling.

### 5. Mobile System Switching Is Position-Dependent

**CURRENT:** Horizontal system tabs are not sticky; the fixed bottom navigation is generic (`Home`, `Tasks`, `Mimic`, `Reports`, `More`).
**PROBLEM:** Switching systems after working deep in a checklist often requires returning to the list first.
**PROPOSED:** Use a persistent `Systems` action that opens a compact configured-system drawer; desktop keeps a collapsible rail.
**WHY:** System switching becomes predictable from every work state.

### 6. Navigation Actions Compete With Work Actions

**CURRENT:** Critical SOP shows `Back to Dashboard`, `Back to System List`, `View Mimic`, two save actions, and the global bottom navigation.
**PROBLEM:** Several equal-weight choices make the intended next action unclear.
**PROPOSED:** Make `Save & Next` the only primary action, `Mimic` secondary, and place infrequent navigation under the stable Systems/More controls.
**WHY:** The primary field workflow remains obvious without removing safety controls.

### 7. Touch Target Sizing Is Already Sound

**CURRENT:** Measured system/action buttons are 48-94 px high; none were below 44 px.
**PROBLEM:** The field issue is hierarchy and scrolling, not undersized controls.
**PROPOSED:** Preserve these touch sizes while reducing competing controls.
**WHY:** This keeps the proven Android tap area and avoids cosmetic churn.

### 8. Mimic Context Needs a Persistent System Anchor

**CURRENT:** The mimic itself works and shows assigned pins, but returning to another system depends on generic navigation.
**PROBLEM:** The active system, floor, and remaining count can become secondary to the canvas.
**PROPOSED:** Keep a compact mimic header with system, floor, progress, and a persistent Systems action.
**WHY:** The technician can always identify location and scope without changing pin behavior.

## Golden Navigation Proposal

### Desktop

`Job -> configured system rail -> system stage -> device/checklist -> Save & Next`

- Rail remains visible and may collapse to icons.
- Pump group expands only to configured pump systems.
- Active system and done/total remain visible.
- Checklist gets the main workspace; linked work opens as focused content.

### Mobile

`Job -> Systems drawer -> system -> focused checklist or mimic -> Save & Next`

- `Systems`, `Mimic`, `Progress`, and `More` remain reachable at the bottom.
- Only one work card is primary at a time.
- Known metadata is stored automatically and summarized in one line.
- Fault/evidence fields expand only when applicable.

## Capture Manifest

Current evidence is in [`screenshots/current/`](screenshots/current/). The required 12 states are represented by:

1. `01-job-home.png`
2. `02-system-selection.png`
3. `03-fap.png`
4. `04-hose-reel-pump-not-separate.png` (evidence that no separate route exists)
5. `05-sprinkler-pump-grouped.png`
6. `06-wet-riser-pump-grouped.png`
7. `07-co2-gas.png`
8. `08-fireman-intercom-not-present.png` (system-list evidence)
9. `09-extinguisher-not-present.png` (system-list evidence)
10. `10-emergency-keluar.png` (Emergency Light is present; KELUAR is not separate)
11. `11-checklist-active.png`
12. `12-mimic-active.png`

Proposed states are in [`screenshots/proposed/`](screenshots/proposed/). The interactive review is [`prototype/index.html`](prototype/index.html).

## Local Worker Result

- Graphify scoped the technician navigation functions and QA helpers before inspection.
- Playwright captured the running WETEX job and produced the proposal screenshots.
- Local Ollama ran through `ollama / qwen2.5:1.5b-instruct`, but its checklist-oriented classification drifted beyond the measured UX facts. It was retained as evidence in `ollama-classification.json` and was not used as product guidance.
- No production file, pin record, schedule, inspection result, or business rule was changed.
