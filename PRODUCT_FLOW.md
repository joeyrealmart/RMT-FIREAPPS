# RMT FIREAPPS - Product Flow Audit

Last updated: 2026-08-28

## Current Objective

Stabilize one complete maintenance inspection journey before adding new features:

Login -> Assigned/Today's Jobs -> Select Client/Site -> Select Fire System -> Start Inspection -> Mimic / Device Location -> Select Device -> Perform Inspection -> PASS or FAULT -> Fault evidence if needed -> Save -> Next Device -> Inspection Progress -> Complete Inspection -> Supervisor Review -> Client Summary Report / Detailed Report.

The technician workflow must stay simple on phone/tablet. The assigned checklist list is the main work path; the mimic is for finding and confirming device location.

## Current Screens

- Login screen with demo Admin, Technician, Tech 2, and Tech 3 accounts.
- Main workspace top bar with role badge, sync state, report/staff/admin buttons.
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
- `GET /api/device-masters`

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
- `rmtCalendarMonth`
- `rmtActiveJob`
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
- `outputs/rmt-fire-local-data/mimic-library/mimic-library-app-data.json`
- mimic images and photo proof folders under `outputs/rmt-fire-local-data`

Current known loaded master data:

- UOB / UOB: 92 devices, 3 floors.
- WETEX / WETEX: 569 devices, 11 floors.
- WETEX PARADE / WETEX/CLASSIC: 138 devices, 4 floors.
- MTB Reality Sdn Bhd / Bandar Hilir: 56 devices, 2 floors.
- ThemoFisher / Cheng: 11 devices, 2 floors.

The local data folder contains real client/site/device information and must not be committed to GitHub without explicit approval and sanitizing.

## Offline Functionality

Current state: partial only.

- The app saves many answers to browser localStorage.
- If the page is already loaded, some work can continue temporarily without the local server.
- PC-folder save, shared schedules, shared inspection runs, mimic library loading, and reports require the local Node server.
- There is no service worker, IndexedDB queue, background sync, conflict handling, or true offline-first database yet.
- Phone/tablet access currently depends on same Wi-Fi and the local server listening on `0.0.0.0:8026`.

## Existing Functions / Modules

Major current function groups in `outputs/fire-inspection-mvp/app.js`:

- Branding and demo authentication.
- Role-based UI placement and visibility.
- Client/site/floor selection.
- Mimic library loading and map rendering.
- Marker rendering and tap handling.
- Device selection and checklist rendering.
- Inspection save and Save & Next.
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
- Customer report view and PC-folder inspection run save.
- Staff tracking/audit event generation.

## Known Current Direction

- Protect the golden path before adding modules.
- Keep admin setup separate from technician work.
- Show only assigned scope pins to technicians.
- Critical systems are always 100% every maintenance visit.
- Passive percentage selection is site-wide and must rotate without repeating until the cycle is complete.
- Backend audit must show staff, time, duration, skipped SOP, missing evidence, failed items, and sign-off.
- Extinguisher collection/return/loan is a separate job form, not part of normal maintenance checklist.
