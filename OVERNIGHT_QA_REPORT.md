# RMT FIREAPPS Overnight QA Report

## Summary

Baseline SHA: `85fd0e8ec281f9f63194c756b056749041f60912`

Final pushed SHA: recorded in the Codex final response after this report is committed and pushed. A Git commit cannot reliably contain its own final SHA because editing the report changes the SHA.

Recommendation: **PASS WITH MANUAL TESTING**

This session performed automated and simulated QA only. No physical Android phone and no real two-phone field test was performed.

## Tests Executed

Syntax checks:

- `node --check outputs/fire-inspection-mvp/app.js` - PASS
- `node --check work/serve-fire-inspection-mvp.mjs` - PASS
- `node --check work/qa-*.cjs` - PASS for all existing QA scripts
- `python -m py_compile work/build_mimic_library_manifest.py` - PASS

Focused and full regression QA:

- `work/qa-start-button.cjs` - PASS
- `work/qa-start-unlock.cjs` - PASS
- `work/qa-fire-inspection-mvp.cjs` - PASS
- `work/qa-schedule-floor-options.cjs` - PASS
- `work/qa-tech-save-next.cjs` - PASS
- `work/qa-critical-dependency-sequence.cjs` - PASS
- `work/qa-mfap-precheck.cjs` - PASS
- `work/qa-shared-records.cjs` - PASS
- `work/qa-tech-shared-resume.cjs` - PASS
- `work/qa-tech-signoff-and-scroll.cjs` - PASS
- `work/qa-audit-tracking.cjs` - PASS
- `work/qa-android-mobile-web.cjs` - PASS

## Automated / Simulated Coverage

Covered by the existing automated suite:

- Login and role-based technician/admin flows
- WETEX, UOB and MTB scheduling visibility
- Schedule floor options and ready-client filtering
- Assigned job loading and start/resume behavior
- Android Chrome mobile viewport emulation
- Mimic pin visibility and tap-to-checklist behavior
- Save & Next progression
- Reload/resume from shared records
- Simulated multi-technician shared-record saves
- Same-device revision conflict protection
- Duplicate/rapid save behavior through shared revision checks
- Critical dependency locks
- MFAP prerequisite and downstream fire-alarm device unlock
- Flow Switch primary/secondary dependency configuration
- Critical SOP save/resume
- Final restoration readiness
- Sign-off blocking/acceptance behavior
- Report generation from scheduled/shared inspection state
- Technician attribution and audit tracking
- Console error and missing-resource checks

## Bugs Discovered

### OQA-001: Missing favicon produced browser console 404 noise

Screen/function: App shell browser load

Steps to reproduce: Load `http://127.0.0.1:8026/` in browser automation and inspect console errors.

Expected behavior: No failed resource load during ordinary app load.

Actual behavior: Browser emitted `Failed to load resource: the server responded with a status of 404 (Not Found)` for the missing favicon.

Severity: Low

Root cause: `index.html` did not define a favicon and no `favicon.ico` existed.

Fix made: Added a small inline data-URI Realmart-style favicon in `outputs/fire-inspection-mvp/index.html`.

Regression result: Rechecked browser load and full QA suite. Console error list is now clean in QA output.

### OQA-002: Fast Start Schedule followed by Generate Report could render partial active scope

Screen/function: Admin schedule list / Start This Job / Generate Report

Steps to reproduce: Save a WETEX maintenance schedule, click `Start This Job`, then immediately click `Generate Report`.

Expected behavior: Report waits until scheduled job state and assigned scope are loaded, then shows the full scheduled scope.

Actual behavior: One automated run rendered 11 report rows instead of the expected 12 scheduled devices.

Severity: High

Root cause: The schedule start button launched `startScheduledJob()` asynchronously without a busy guard. A fast report click could read old or partially loaded active job state before scheduled scope was ready.

Fix made: Added a schedule-start busy guard in `outputs/fire-inspection-mvp/app.js`. While a schedule is loading, schedule start buttons and the report button are disabled, and `showReport()` refuses to run if schedule start is still in progress.

Regression result: Reran `work/qa-fire-inspection-mvp.cjs`; the customer report full active schedule scope test passed. Reran the complete QA suite; all tests passed.

## Fixes Made

- Added inline favicon to remove false browser 404 console noise.
- Added schedule-start/report timing guard so report generation cannot run against a partially loaded scheduled job.

No fire-system SOP content was changed. No critical dependency gates were weakened. No offline sync, production authentication, production database, or new module was added.

## Regression Tests Added / Changed

No new QA file was required. The existing `Customer report uses full active schedule scope` test in `work/qa-fire-inspection-mvp.cjs` reproduced the timing issue and now passes after the production fix.

## PASS / FAIL Results

Overall automated result: PASS

Failures remaining from automated QA: none in the executed suite.

## Remaining Known Bugs / Limitations

- Full offline merge and conflict synchronization is not implemented in Phase 1 by design.
- If the local server is unavailable, technician work can only be saved as a local draft and job completion must remain blocked.
- Local prototype authentication is still not production-grade.
- Camera/photo attachment behavior is only covered by simulated browser/file evidence paths, not a real Android camera capture.
- Physical touch behavior, browser permissions, camera upload behavior, and Wi-Fi stability still require real-device testing.
- Real field data quality, report wording and critical-system readings still require Realmart review using actual service jobs.

## Items Requiring Physical Android Testing

- Open LAN URL from at least one Android phone on the same Wi-Fi.
- Confirm no horizontal overflow in real Chrome, not only Pixel 5 emulation.
- Tap dense mimic pins on WETEX/UOB/MTB and confirm hit targets feel usable.
- Open checklist from assigned item card and from mimic marker.
- Use actual phone photo capture/upload for normal faults and critical SOP evidence.
- Complete signature/sign-off using finger input on phone screen.
- Refresh browser during an in-progress checklist and confirm resume behavior.
- Disconnect/reconnect Wi-Fi and confirm unsynced draft warning is understandable.

## Items Requiring Real Two-Phone Testing

- Tech 1 and Tech 2 open the same scheduled job from two physical Android devices.
- Tech 1 saves Device A while Tech 2 saves Device B.
- Both phones refresh/sync and see both results.
- Both phones open the same device; first save succeeds and stale second save receives conflict instead of overwriting.
- MFAP prerequisite completed on Phone 1 unlocks related child device on Phone 2.
- Confirm progress aggregation reflects both technicians.
- Confirm sign-off blocks incomplete/unsynced work.
- Confirm final customer/backend reports include both technicians' records and audit attribution.

## Risks Before Field Use

- Online shared-record behavior passed automated simulation, but it still needs real two-phone Wi-Fi validation.
- The app is still a local prototype and should not yet be treated as production storage.
- Offline field operation is limited to local draft behavior until a later offline conflict-sync phase is designed and tested.
- Dense mimic drawings may still need cleanup or floor-by-floor review for real technician usability.

## Files Intentionally Changed

- `outputs/fire-inspection-mvp/app.js`
- `outputs/fire-inspection-mvp/index.html`
- `OVERNIGHT_QA_REPORT.md`

## Files Intentionally Not Committed

- `outputs/rmt-fireapps-code-review-pack.zip`
- `work/debug-tech-open.cjs`
- Generated mobile QA screenshots and local test/server data
