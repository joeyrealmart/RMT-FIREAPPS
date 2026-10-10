# Offline, Sync And Evidence Audit

## Current Data Path

`Technician UI -> browser state/cache -> revisioned shared API -> atomic JSON store -> report snapshot`

The isolated proof adds:

`IndexedDB draft/evidence metadata -> idempotent queue -> retry -> revision/conflict response`

## What Is Already Strong

- Independent per-item records avoid whole-job overwrite for inspection/SOP results.
- Expected revision rejects stale same-item writes.
- Operation IDs support idempotent duplicate saves.
- Different devices can save independently.
- Linked-verification sides remain separate and preserve ownership.
- Sign-off/report submission is server validated.
- Original and stamped evidence references are separate; shared records do not retain base64 blobs.
- Isolated Dexie QA covers refresh/restart persistence, pending/synced/failed/conflict states, duplicate queue operations and wrong-owner rejection.

## Open Production Risks

- Dexie queue is not integrated into the production technician flow.
- Workbox is intentionally unregistered; no durable background replay exists.
- Browser localStorage still overlaps schedule/session caches and must never become authoritative.
- Whole-schedule Admin writes remain a stale-snapshot risk.
- Evidence file durability, cleanup, backup and partial-upload recovery need production storage design.
- Demo authentication, plain HTTP and unauthenticated APIs prevent safe remote deployment.

## Recommendation

- Keep online shared records as the authoritative V1 pilot path.
- Physically validate the isolated Dexie proof on Android before integration.
- Integrate one record type at a time behind a disabled-by-default feature flag.
- Treat 409/revision conflicts as visible user action, never retry-and-overwrite.
- Keep Workbox disabled until queue ownership, auth expiry and evidence upload semantics are proven.
- Do not use Dexie Cloud or another paid sync layer merely because Dexie is adopted locally.

## Failure Scenarios Required Before Field Rollout

- Offline before opening a job; offline after download; browser killed; storage eviction.
- Duplicate Save, reconnect twice and service-worker/page simultaneous retry.
- Stale same-device edit, assignment changed while offline, submitted job edited offline.
- Photo metadata saved but file missing; file uploaded but record response lost; partial upload.
- Two technicians submit matching and mismatching linked sides.
