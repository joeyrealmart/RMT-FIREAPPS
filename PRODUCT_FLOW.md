# RMT FIREAPPS - Product Flow Audit

Last updated: 2026-08-30

## Current Objective

Stabilize one complete maintenance inspection journey before adding new features:

Login -> Assigned/Today's Jobs -> Select Client/Site -> Select Fire System -> Start Inspection -> Mimic / Device Location -> Select Device -> Perform Inspection -> PASS or FAULT -> Fault evidence if needed -> Save -> Next Device -> Inspection Progress -> Complete Inspection -> Supervisor Review -> Client Summary Report / Detailed Report.

The technician workflow must stay simple on phone/tablet. The assigned checklist list is the main work path; the mimic is for finding and confirming device location.

## Current Screens

- Login screen with demo Admin, Technician, Tech 2, and Tech 3 accounts.
- Main workspace top bar with role badge, sync state, report/staff/admin buttons.
- Compact diagnostics strip showing server connection, mode, current technician, active job ID, shared record revision/sync state, draft count, and same-WiFi phone URL.
- Admin work calendar for scheduling maintenance and other site jobs.
- Technician extinguisher collection/return/loan form.
- Admin service job panel.
- Admin mimic setup panel for uploading floor images and pinning devices.
- Technician work panel showing assigned jobs.
- Mimic/map panel with floor selector, original/clean view toggle, markers, and admin tag palette.
- Technician assigned item panel with item list, checklist mount, Save & Next, and final sign-off.
- Summary band with total/pass/fail/pending/request counts.
- Staff tracking panel for admin audit view.
- First-time site setup/device master draft table.
- Maintenance scope panel for admin-generated scope.
- System checklist panel for admin system-level checks.
- Critical SOP panel for MFAP, pump, gas, CO2, FM200, wet chemical, and related active systems.
- Admin review panel for suggested missing device pins.
- Suggest missing device modal.
- Report view with Realmart letterhead, summary, critical system details, defect/setup lists, and detailed rows.

## Navigation / Routes

This is currently a single-page prototype, not a multi-route production app.

- `/` and `/index.html`: main prototype.
- `/phone-test.html`: phone/network helper page.
- `/assets/*`: app assets and branding images.
- `/local-data/*`: local PC saved data exposed by the preview server.
- `/reports/*`: generated PDF/report files exposed by the preview server.

Local API endpoints in `work/serve-fire-inspection-mvp.mjs`:

- `POST /api/save-mimic-floor`
- `POST /api/save-device-master`
- `POST /api/save-inspection-run`
- `POST /api/save-schedules`
- `GET /api/schedules`
- `GET /api/inspection-runs`
- `GET /api/network-info`
- `GET /api/diagnostics`
- `GET /api/device-masters`
- `GET /api/jobs/:scheduleId/state`
- `GET /api/jobs/:scheduleId/progress`
- `POST /api/jobs/:scheduleId/migrate`
- `POST /api/jobs/:scheduleId/inspection-records`
- `POST /api/jobs/:scheduleId/critical-sop-records`
- `POST /api/jobs/:scheduleId/item-claims`
- `POST /api/jobs/:scheduleId/signoff`

## Authentication / Roles

Current auth is demo-only and stored in browser localStorage.

Demo users:

- `admin@rmtfire.local`
- `tech@rmtfire.local`
- `tech2@rmtfire.local`
- `tech3@rmtfire.local`

Demo mode requires the user to type any local test password. Fixed password values are intentionally not stored in the source code.

Current role intent:

- Admin manages schedules, mimic setup, device master, scope generation, request approval, staff tracking, and reports.
- Technician should only see assigned jobs/checklists, missing-pin request, and assigned extinguisher job forms.
- Supervisor review exists conceptually in reports/sign-off but is not yet a separate real account workflow.

## Data Structure

Browser localStorage keys used by the app include:

- `rmtCurrentUser`
- `tmFireInspections`
- `rmtSystemChecks`
- `rmtCriticalSops`
- `tmFireHistory`
- `tmFireRequests`
- `tmFireScopeHistory`
- `rmtScopeCycle`
- `tmFireSetupDevices`
- `tmFireDevicePins`
- `tmFirePinHistory`
- `rmtMimicFloors`
- `rmtSchedules`
- `rmtContractRules`
- `rmtCriticalDependencyConfig`
- `rmtCalendarMonth`
- `rmtActiveJob`
- `rmtSharedJobRecords`
- `rmtJobHistory`
- `rmtMimicViewMode`
- `rmtSiteProfile`

Local PC folder data:

- `outputs/rmt-fire-local-data/device-master/*-device-master.json`
- `outputs/rmt-fire-local-data/device-master/*-device-master.csv`
- `outputs/rmt-fire-local-data/schedules/service-schedules.json`
- `outputs/rmt-fire-local-data/schedules/service-schedules.csv`
- `outputs/rmt-fire-local-data/inspection-runs/*-inspection-run.json`
- `outputs/rmt-fire-local-data/inspection-runs/*-inspection-results.csv`
- `outputs/rmt-fire-local-data/shared-records/jobs/*`
- `outputs/rmt-fire-local-data/mimic-library/mimic-library-app-data.json`
- mimic images and photo proof folders under `outputs/rmt-fire-local-data`

## Shared-Record Architecture

Phase 1 online multi-tech safety is now based on authoritative shared records stored by the local Node server.

- One scheduled job maps to one shared-record store under `outputs/rmt-fire-local-data/shared-records/jobs/`.
- Each normal device save writes one independent inspection record.
- Each critical SOP save writes one independent critical-SOP record.
- One item save must not replace the whole schedule or whole job snapshot.
- Every shared item/SOP/sign-off write includes an expected revision.
- If another phone has already saved a newer revision for the same item, the server returns conflict and does not overwrite it.
- Different devices can be saved by different technicians without clashing because they are different records.
- Item claims are advisory only. They warn that another technician has opened an item, but revision checks remain the authority.
- Progress is aggregated from shared item/SOP records, not from whichever phone last wrote a cached job object.
- Critical dependency gates read shared SOP/item state, so a prerequisite completed on Phone A can unlock the child checklist on Phone B after refresh/shared-state load.
- Final sign-off is server validated and is rejected if shared progress is incomplete.
- Shared JSON writes use a temp file and rename to reduce partial-write corruption risk.
- `schedule.jobProgress` is now legacy fallback/migration only. It should not be rewritten during normal item saves.
- Browser `localStorage` keeps cache/resume/draft data only for active inspection work.

Current known loaded master data:

- UOB / UOB: 92 devices, 3 floors.
- WETEX / WETEX: 569 devices, 11 floors.
- WETEX PARADE / WETEX/CLASSIC: 138 devices, 4 floors.
- MTB Reality Sdn Bhd / Bandar Hilir: 56 devices, 2 floors.
- ThemoFisher / Cheng: 11 devices, 2 floors.

The local data folder contains real client/site/device information and must not be committed to GitHub without explicit approval and sanitizing.

## Offline Functionality

Current state: online-first shared records plus partial local draft support.

- When the local server is available, technician item/SOP saves go to authoritative shared records with revision checks.
- If the page is already loaded and the server becomes unavailable, the technician can save a local draft in browser `localStorage`.
- A server-unavailable/local draft cannot be completed or signed off.
- PC-folder save, shared schedules, shared records, mimic library loading, and reports require the local Node server.
- There is no service worker, IndexedDB queue, background sync, offline merge engine, or true offline-first conflict handling yet.
- Phone/tablet access currently depends on same Wi-Fi and the local server listening on `0.0.0.0:8026`.
- `/api/diagnostics` reports the current local server mode and detected LAN URLs for manual two-phone validation without exposing passwords, API keys, or local client data files.

## Existing Functions / Modules

Major current function groups in `outputs/fire-inspection-mvp/app.js`:

- Branding and demo authentication.
- Role-based UI placement and visibility.
- Client/site/floor selection.
- Mimic library loading and map rendering.
- Marker rendering and tap handling.
- Device selection and checklist rendering.
- Inspection save, shared-record sync, revision-conflict handling, and Save & Next.
- Device history.
- Admin schedule calendar, drag/drop jobs, delete/load schedules.
- Contract frequency and site-wide rotating scope.
- Scope cycle selection for percentage maintenance.
- Technician assigned job list and assigned item cards.
- Technician sign-off and signature canvas.
- Extinguisher collection/return/loan tracking and photo proof.
- Missing-device request and admin approval.
- Device master import/export/save to PC.
- Critical SOP templates and save logic.
- Critical workflow dependency definitions, parent prerequisite gates, child-device locks, Flow Switch primary/secondary dependencies, and final restoration gates.
- Customer report view and PC-folder inspection run save.
- Staff tracking/audit event generation.

## Critical Dependency Model

Critical systems now use a data/config-driven parent -> child dependency model instead of scattered UI-only checks.

- Fire Alarm: MFAP/main control panel prerequisite -> permitted fire-alarm field device checks -> final restoration/normal confirmation.
- Pump / water-based systems: relevant pump or starter/control panel prerequisite -> permitted hose reel/sprinkler/wet riser/hydrant/flow-switch checks -> readings/results -> final restoration.
- Gas Release / FM200 / CO2 / Wet Chemical: releasing/control panel SOP prerequisite -> downstream checklist/evidence -> final restoration/normal confirmation.
- Flow Switch is configurable across systems. One physical Flow Switch can have a primary water-system dependency and an optional secondary MFAP indication dependency without duplicating the device.

The dependency engine must block child inspection through normal navigation, mimic tapping, Save & Next, refresh, logout/login, and reopened jobs until mandatory prerequisites are complete. It must also preserve the SOP template snapshot/version used when an inspection begins.

## Known Current Direction

- Protect the golden path before adding modules.
- Keep admin setup separate from technician work.
- Show only assigned scope pins to technicians.
- Critical systems are always 100% every maintenance visit.
- Critical child devices are locked until their configured prerequisite stage is complete; final parent restoration is locked until linked child checks are complete.
- Shared per-item records are authoritative for online technician progress.
- `schedule.jobProgress` is retained for legacy migration/fallback only.
- Same-item stale saves must show conflict rather than silently overwriting newer work.
- Server-unavailable saves are local drafts only and must block final completion.
- Passive percentage selection is site-wide and must rotate without repeating until the cycle is complete.
- Backend audit must show staff, time, duration, skipped SOP, missing evidence, failed items, and sign-off.
- Extinguisher collection/return/loan is a separate job form, not part of normal maintenance checklist.
