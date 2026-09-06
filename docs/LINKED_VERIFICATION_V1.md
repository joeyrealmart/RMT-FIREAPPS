# Linked Verification V1

Linked Verification V1 records a single verification event with two or more
separate technician sides. Each side retains its own technician identity,
location, result, timestamp, evidence reference, revision, and audit events.
The server reconciles the event only after every configured side is available.

The first configured types are `FIRE_PUMP_INDICATION` and
`CO2_GAS_RELEASE_INDICATION`. Their side locations and approved SOP content are
site configuration, not technical procedures created by the application.

## Current Status

- one completed side: `AWAITING_COUNTERPART`;
- matching completed sides: `VERIFIED`;
- conflicting results or revision conflict: `MISMATCH_REVIEW_REQUIRED`;
- local completion with no server connection:
  `LOCAL_COMPLETE_AWAITING_SYNC`.

Shared server side records are authoritative once synchronized. A technician
can save only the side assigned to that technician, and a stale write returns a
conflict rather than replacing the current side record.

## Prototype Limitations

- Offline drafts currently use browser storage only.
- Production evidence must move to IndexedDB and file-backed storage; large
  photo data must not remain in browser storage.
- A durable background upload queue is still required.
- General offline conflict management is not implemented beyond the safe
  per-side conflict response.
- Admin can view a mismatch but does not yet have a dedicated mismatch-resolution
  action.
- Production deployment still requires real authenticated server sessions and
  role enforcement rather than prototype client identity data.
