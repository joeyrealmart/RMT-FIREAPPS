# Android Physical Test Plan

## Devices

- Two Android phones on the same Wi-Fi for shared-record tests.
- One Android tablet if available for portrait/landscape mimic testing.
- Record browser/version, viewport, network state and job ID.

## Core Flow

1. Login and confirm Today's Jobs loads promptly.
2. Open the same Wetex job on both phones.
3. Verify frozen scope and ownership on each phone.
4. Open Fire Alarm Stage 1, view locked mimic, return to system check.
5. Complete prerequisite; verify the second phone unlocks after shared refresh.
6. Save different devices simultaneously; verify both records/progress.
7. Open the same device on both phones; first save succeeds, stale save conflicts.
8. PASS with optional evidence; FAULT with required notes/evidence; N/A with configured reason.
9. Use Save & Next and Save-to-mimic; confirm floor/zoom/pan/area are retained.
10. Swipe starting on a pin and confirm it does not open; genuine tap opens it.

## Offline POC

1. Open `/dev/offline-poc/?enable=1` while online.
2. Save/load draft; refresh and close/reopen browser.
3. Disable Wi-Fi/mobile data; queue one inspection-style save and evidence metadata.
4. Reopen and verify draft/queue persists.
5. Reconnect and retry once; verify one server operation and SYNCED state.
6. Simulate conflict; verify local work remains visible as CONFLICT/FAILED.
7. Repeat with Tech A and Tech B ownership.

## Linked Verification

- Pump Room + MFAP, then suppression location + remote panel.
- One side only -> Awaiting Counterpart.
- Matching two sides -> Verified.
- Conflicting results -> Mismatch Review Required.
- Repeat with one side offline and reconnect.

## Evidence

- Capture camera photo in poor and normal lighting.
- Verify timestamp/technician/job/device context and original/stamped separation.
- Kill browser before sync and recover.
- Verify no duplicate upload after repeated retry.

## Completion/Admin

- Missing/unsynced/conflict work blocks submission.
- Submit completed job; technician becomes read-only.
- Admin reviews, returns for correction and approves after resubmission.
- Generated report matches both technicians, faults, linked status, evidence and frozen scope.

## Tablet

- Portrait and landscape system/mimic routes.
- Confirm no horizontal overflow after fix.
- Confirm controls remain reachable and drawing does not merely stretch the phone layout.

Playwright results must be labeled emulated; only this plan can produce physical-device evidence.
