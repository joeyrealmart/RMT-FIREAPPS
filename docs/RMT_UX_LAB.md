# RMT UX Lab

## Purpose

RMT-UX-LAB is an isolated Playwright harness for reviewing the current Admin and Technician journeys from a user's perspective. It records actions, screen transitions, scrolling, viewport overflow, touch-target concerns, navigation overlap, screenshots, and observed blockers.

It does not change production business logic or authoritative data. The harness uses temporary browser contexts, synthetic schedules, and intercepted write APIs.

## Run

Start the local RMT preview server on port `8026`, then run:

```powershell
node tools/rmt-ux-lab/run-ux-lab.cjs
```

Outputs:

- `outputs/rmt-ux-lab/ux-observations.json`
- `outputs/rmt-ux-lab/ux-summary.json`
- `outputs/rmt-ux-lab/screenshots/`

## Personas

- New Technician
- Experienced Technician
- Impatient Technician
- Mobile Technician
- Offline Technician
- Admin
- Report Reviewer

## Covered Journeys

- Technician login, assigned job, system selection, device, evidence, PASS, Save & Next, mimic, return, and completion readiness.
- Fire Alarm, pump, CO2, SPP, extinguisher, hose reel, emergency light, and Keluar/exit system discoverability.
- Offline status visibility without claiming that production offline reconciliation is complete.
- Admin login, control desk, technician activity, defects, and report review navigation.

## Severity Rules

- `BLOCKER`: an assigned workflow cannot be completed.
- `HIGH`: the next task is unavailable, hidden, overlapped, or structurally confusing.
- `MEDIUM`: unnecessary screens, repeated input, or avoidable navigation.
- `LOW`: smaller ergonomic or wording concern.
- `COSMETIC`: visual polish only.

Only deterministic observations are recorded as findings. Local RuFlo/Ollama may classify those recorded observations but must not invent additional product issues.

## Safety Boundaries

- No production data writes.
- No Wetex scope regeneration.
- No pin/device changes.
- No Photo Timestamp changes.
- No Dexie integration or Workbox registration.
- No commit or push.

## Latest Deterministic Run

Run date: 2026-09-17

- 7 of 7 journeys passed.
- 23 screenshots captured.
- 0 blocker, high, or medium findings.
- 4 low ergonomic findings: three controls measured below the preferred 44 px mobile touch height.
- 0 console errors.
- Local RuFlo/Ollama classification completed with `qwen2.5:1.5b-instruct`; no cloud fallback was allowed.

No finding from this run met the HEAVY product-defect threshold for Codex production work.
