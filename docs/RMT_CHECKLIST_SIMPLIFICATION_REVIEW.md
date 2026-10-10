# RMT Checklist Simplification Review

Status: local analysis complete; no production checklist or SOP content changed.

## Guardrail

This review classifies existing fields only. It does not invent fire-system procedures, remove configured safety evidence, or change approved SOP wording. `outputs/rmt-ux-lab/checklist-friction.json` is the machine-readable inventory generated from the current browser-loaded templates.

## Classification

- `REQUIRED`: keep when the current configuration explicitly requires a result, reading, evidence, remark, or witness.
- `OPTIONAL`: keep available without blocking progress.
- `AUTO_FILL`: populate from authenticated user, frozen job/device context, saved system configuration, or authoritative linked verification.
- `DERIVED`: calculate from authoritative shared records.
- `REMOVE_CANDIDATE`: duplicate manual entry that should not exist when the same authoritative value is already known. This is a review label, not automatic removal.

## Highest-Value Simplifications

1. Auto-fill technician name, technician ID, account identity, client, site, job, schedule, system, device, floor/location, and timestamp.
2. Derive progress, PASS/FAULT totals, pending totals, sync state, revisions, and linked-verification final state.
3. Keep the existing FAP pump/gas indication result read-only and auto-filled from completed authoritative linked-verification records.
4. Keep the existing SPP technician attribution auto-filled from the logged-in technician.
5. Reuse the saved standby-pump type after its first configured selection; do not ask repeatedly.
6. Keep running-condition remarks optional where the current template already marks them optional.
7. Do not ask technicians to retype identity or job/device context that the application already knows.

## Current Verified Behavior

- FAP indication step: auto-fills `Pass` only when applicable Pump/CO2 linked verification is complete and confirmed; negative/mismatch state remains visible.
- SPP panel-setting step: can auto-fill from Pump linked verification.
- SPP steps configured with `captureTechnician`: record the authenticated technician.
- Standby configuration: selected once and reused by the configured standby test.
- Standard device inspection: PASS/FAULT remains the primary result; PASS photo is available; FAULT retains required description/photo validation.

## Review Candidates, Not Automatic Changes

- Any manual technician-name or technician-ID input in a technician workflow.
- Any repeated client/site/job/system/device/floor/location field inside an already selected frozen job.
- Any manually entered progress, count, revision, sync status, or linked-verification final state.

Configured supervisor/witness fields, readings, evidence, and critical restoration requirements are not removal candidates merely because they add taps. They require business/SOP approval before change.
