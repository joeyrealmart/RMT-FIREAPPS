# RMT FIREAPPS - Prototype QA Checklist

Last updated: 2026-08-28

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
| 1. Login | Admin and technician demo users can log in. | Needs regression |
| 2. Assigned jobs | Technician sees only jobs assigned to them / technician pool. | Needs regression |
| 3. Select client/site | Admin can schedule existing or new client without confusing fields. | Needs test |
| 4. Select fire system / scope | Admin can set maintenance scope; passive percentage is site-wide; active critical is 100%. | Needs test |
| 5. Start inspection | Tech can start scheduled job from assigned list. | Needs regression |
| 6. Mimic/device location | Tech sees assigned pins only; floor selector is close to mimic; Map highlights selected pin. | Failed Android regression |
| 7. Select device | Tech can open checklist from item list and from pin on Android/desktop. | Failed stale-phone regression |
| 8. Perform inspection | Normal devices have fast PASS/FAULT checklist and remarks. | Needs regression |
| 9. Fault flow | Failed item requires useful fault information and photo evidence. | Open |
| 10. Critical SOP | MFAP/pumps/gas/CO2/FM200/wet chemical open step-by-step SOP with required evidence. | MFAP automated pass; all critical types need regression |
| 11. Save | Save button is available at the end of form and saves to browser plus PC folder when server is available. | Needs test |
| 12. Save & Next | Save & Next opens the next assigned item without forcing the user to scroll back up. | Failed QA |
| 13. Progress | Tech can see done/pending/fail/SOP-started count. | Needs regression |
| 14. Complete inspection | Final sign-off appears only after all assigned items/SOP are complete. | Automated pass; full journey still open |
| 15. Signature | Client/supervisor can sign on phone/tablet; signature is saved in job record. | Automated pass |
| 16. Supervisor review | Admin/supervisor can review staff/time/fail/SOP red flags. | Partial |
| 17. Customer report | Admin can generate client-friendly summary plus detailed critical data. | Partial |
| 18. Backend report | Admin can view red flags, staff tracking, skipped SOP, duration, and evidence gaps. | Partial |
| 19. Reload/resume | Browser reload keeps active job/progress correctly. | Partial pass |
| 20. Multi-tech | Tech 1/2/3 can work without confusing who filled which item. | Needs test after Android failure |

## Audit Test Results - 2026-08-28

Passed:

- `node --check outputs/fire-inspection-mvp/app.js`
- `node --check work/serve-fire-inspection-mvp.mjs`
- Local server reachable at `http://127.0.0.1:8026/`
- LAN URL reported as `http://192.168.0.129:8026/`
- `work/qa-tech-signoff-and-scroll.cjs`
- `work/qa-mfap-precheck.cjs`
- `work/qa-schedule-floor-options.cjs`
- `work/qa-audit-tracking.cjs`
- `work/qa-start-button.cjs`
- `work/qa-start-unlock.cjs`

Failed:

- `work/qa-android-mobile-web.cjs`: stale phone job state did not open checklist/SOP from whole item-card tap.
- `work/qa-tech-save-next.cjs`: timed out waiting for checklist after Save & Next.

Notes:

- Some passing QA scripts still report one 404 console message. Need request tracing to confirm whether this is only favicon/noise.
- The app is not ready to call the golden path stable until the failed Android and Save & Next tests pass.

## Automated Smoke Tests

Use the bundled Node runtime if normal `node` is unavailable.

- Syntax check: `node --check outputs/fire-inspection-mvp/app.js`
- Main prototype smoke: `node work/qa-fire-inspection-mvp.cjs`
- Start button test: `node work/qa-start-button.cjs`
- Start unlock test: `node work/qa-start-unlock.cjs`
- Save & Next test: `node work/qa-tech-save-next.cjs`
- Sign-off/scroll test: `node work/qa-tech-signoff-and-scroll.cjs`
- Shared resume test: `node work/qa-tech-shared-resume.cjs`
- Android/mobile browser test: `node work/qa-android-mobile-web.cjs`
- Audit/staff tracking test: `node work/qa-audit-tracking.cjs`
- MFAP precheck test: `node work/qa-mfap-precheck.cjs`
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
