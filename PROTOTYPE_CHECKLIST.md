# RMT FIREAPPS - Prototype QA Checklist

Last updated: 2026-08-30

## Session Rule

No new feature development until one complete inspection journey works reliably from login to report generation.

For every important change:

- Run the app.
- Test the changed function.
- Test the golden path again.
- Check navigation.
- Check save/reload behavior.
- Check that another core function was not broken.
- Update `BUGS.md` with new/fixed issues.

## Golden Path Acceptance Checklist

| Step | Acceptance Criteria | Current Status |
| --- | --- | --- |
| 1. Login | Admin and technician demo users can log in. | Automated pass |
| 2. Assigned jobs | Technician sees only jobs assigned to them / technician pool. | Automated pass |
| 3. Select client/site | Admin can schedule existing or new client without confusing fields. | Automated pass / manual retest |
| 4. Select fire system / scope | Admin can set maintenance scope; passive percentage is site-wide; active critical is 100%. | Automated pass |
| 5. Start inspection | Tech can start scheduled job from assigned list. | Automated pass |
| 6. Mimic/device location | Tech sees assigned pins only; floor selector is close to mimic; Map highlights selected pin. | Automated Android pass / manual retest |
| 7. Select device | Tech can open checklist from item list and from pin on Android/desktop. | Automated pass |
| 8. Perform inspection | Normal devices have fast PASS/FAULT checklist and remarks. | Automated pass |
| 9. Fault flow | Failed item requires useful fault information and photo evidence. | Open |
| 10. Critical SOP | MFAP/pumps/gas/CO2/FM200/wet chemical open step-by-step SOP with required evidence. | Automated pass for dependency engine; live-site manual audit still needed |
| 11. Save | Save button is available at the end of form and saves the item/SOP as an authoritative shared record when server is available; server-unavailable saves become local drafts only. | Automated pass |
| 12. Save & Next | Save & Next opens the next assigned item without forcing the user to scroll back up. | Automated pass |
| 13. Progress | Tech can see done/pending/fail/SOP-started/locked count. | Automated pass |
| 14. Complete inspection | Final sign-off appears only after all assigned items/SOP are complete and server validates shared progress. | Automated pass / manual retest |
| 15. Signature | Client/supervisor can sign on phone/tablet; signature is saved in job record. | Automated pass |
| 16. Supervisor review | Admin/supervisor can review staff/time/fail/SOP red flags. | Partial |
| 17. Customer report | Admin can generate client-friendly summary plus detailed critical data. | Automated pass / manual layout review |
| 18. Backend report | Admin can view red flags, staff tracking, skipped SOP, duration, and evidence gaps. | Partial |
| 19. Reload/resume | Browser reload fetches latest shared records and restores active job/progress correctly. | Automated pass |
| 20. Multi-tech | Online Tech 1/2/3 can save different devices without replacing the whole job; same-item stale saves return conflict. | Automated pass / manual field retest |

## Phase 1 Shared-Record Rules

- Shared per-item inspection records and critical-SOP records are now authoritative for active job progress.
- `schedule.jobProgress` is legacy fallback/migration only and should not be rewritten by normal item saves.
- Online multi-tech saves are protected by revision checks.
- Same-item stale saves return conflict instead of overwriting the newer record.
- Local browser `localStorage` is cache/draft only for active inspection work.
- Offline merge/conflict sync is not implemented yet.
- If the local server is unavailable, the technician can save a local draft only and cannot complete/sign off the job.

## Audit Test Results - 2026-08-30

Passed:

- `node --check outputs/fire-inspection-mvp/app.js`
- `node --check work/serve-fire-inspection-mvp.mjs`
- `node --check work/qa-shared-records.cjs`
- `node --check work/qa-critical-dependency-sequence.cjs`
- `node --check work/qa-mfap-precheck.cjs`
- `node --check work/qa-tech-save-next.cjs`
- `node --check work/qa-android-mobile-web.cjs`
- `node --check work/qa-start-unlock.cjs`
- `node --check work/qa-schedule-floor-options.cjs`
- `node --check work/qa-audit-tracking.cjs`
- `node --check work/qa-tech-shared-resume.cjs`
- `node --check work/qa-fire-inspection-mvp.cjs`
- `work/qa-shared-records.cjs`
- `work/qa-critical-dependency-sequence.cjs`
- `work/qa-mfap-precheck.cjs`
- `work/qa-tech-save-next.cjs`
- `work/qa-android-mobile-web.cjs`
- `work/qa-start-button.cjs`
- `work/qa-start-unlock.cjs`
- `work/qa-schedule-floor-options.cjs`
- `work/qa-audit-tracking.cjs`
- `work/qa-tech-shared-resume.cjs`
- `work/qa-fire-inspection-mvp.cjs`
- `work/qa-tech-signoff-and-scroll.cjs`

Failed:

- None in the final run.

Notes:

- `work/qa-shared-records.cjs` confirms independent per-item records, two-tech different-device saves, same-device stale conflict, duplicate-save idempotency, advisory item claims, server sign-off reject/accept, legacy `jobProgress` migration, shared critical prerequisite unlock, report-source readiness, and server-unavailable local draft blocking completion.
- `work/qa-fire-inspection-mvp.cjs` passes after shared-record changes and still covers maintenance scheduling, percentage rotation, assigned pins, critical SOP opening, Gas/CO2 evidence rules, report scope, and extinguisher request/photo checks.
- Some passing QA scripts still report one 404 console message. It does not fail `missingResources`, but request tracing is still needed to confirm whether this is only favicon/noise.
- Android coverage is Playwright mobile emulation. A real Android Chrome manual retest is still required before field use.
- Online multi-technician conflict safety is guarded by shared-record revisions in this prototype. Production auth and real-device field testing are still required.
- Offline conflict handling is still not solved. Do not claim offline multi-phone production readiness until IndexedDB/offline queue/conflict resolution is implemented and tested.

## Automated Smoke Tests

Use the bundled Node runtime if normal `node` is unavailable.

- Syntax check: `node --check outputs/fire-inspection-mvp/app.js`
- Main prototype smoke: `node work/qa-fire-inspection-mvp.cjs`
- Shared-record multi-tech regression: `node work/qa-shared-records.cjs`
- Start button test: `node work/qa-start-button.cjs`
- Start unlock test: `node work/qa-start-unlock.cjs`
- Save & Next test: `node work/qa-tech-save-next.cjs`
- Sign-off/scroll test: `node work/qa-tech-signoff-and-scroll.cjs`
- Shared resume test: `node work/qa-tech-shared-resume.cjs`
- Android/mobile browser test: `node work/qa-android-mobile-web.cjs`
- Audit/staff tracking test: `node work/qa-audit-tracking.cjs`
- MFAP precheck test: `node work/qa-mfap-precheck.cjs`
- Critical dependency sequence test: `node work/qa-critical-dependency-sequence.cjs`
- Schedule floor options test: `node work/qa-schedule-floor-options.cjs`

## Manual Phone/Tablet Test

Use the LAN URL printed by the preview server, for example:

- `http://192.168.0.129:8026/?fresh=20260828-audit`

Manual checks:

- Android Chrome can load the app.
- Android can log in as `tech@rmtfire.local`.
- Assigned UOB/WETEX jobs appear.
- Assigned pins appear on mimic.
- Tapping item list opens checklist immediately.
- Tapping Map moves to mimic and highlights the exact pin.
- Tapping pin opens the correct checklist/SOP.
- Save button at bottom works.
- Save & Next opens the next item.
- No unwanted auto-scroll while browsing checklist.
- Critical SOP requires before/after photo where applicable.
- Completion sign-off appears only at the correct time.
- Signature/thumbprint-style signing works.
- Admin can see staff, time, duration, failed items, and report buttons.

## Files To Maintain

- `PROJECT-DECISIONS.md`: locked product decisions and business workflow.
- `PRODUCT_FLOW.md`: current screens, routes, data model, and workflow state.
- `BUGS.md`: all known bugs and fix status.
- `PROTOTYPE_CHECKLIST.md`: QA gate before claiming any feature/fix is complete.
