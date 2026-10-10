# RMT FIREAPPS Offline Sync Architecture

Audit baseline: `fae1495b47f04da37767dabcd179fdc3f73f5abc`  
Status: proposed architecture, not implemented.

## Objectives

The offline layer must let technicians safely continue assigned work through poor signal, browser/app restart, and phone reboot without silently replacing newer shared data.

The production invariants are:

1. The server is authoritative after successful sync.
2. IndexedDB is the durable local database and work queue.
3. `localStorage` holds small UI preferences/session hints only.
4. Media bytes never live in `localStorage`.
5. Every mutable record has a stable ID, revision, author, and timestamp.
6. Every mutation has an idempotency key and expected server revision.
7. A stale write becomes a visible conflict, never silent last-write-wins.
8. Job completion/report submission is blocked while required operations or evidence are unsynced.

## IndexedDB Database

Suggested database: `rmt-fireapps-v1`. Use schema migrations and a monotonically increasing database version.

| Store | Key | Important indexes | Purpose |
| --- | --- | --- | --- |
| `sessionCache` | `key` | expiry | Non-secret session display data and last active context |
| `assignments` | `scheduleId` | technicianId, date, status, updatedAt | Downloaded assigned jobs and immutable scope references |
| `clients` | `clientId` | name, updatedAt | Only clients needed by downloaded jobs/Admin cache |
| `sites` | `siteId` | clientId, updatedAt | Site metadata for downloaded jobs |
| `systems` | `systemId` | siteId, systemType, version | Configured system definitions and dependency references |
| `devices` | `deviceId` | siteId, floorId, systemId, tag | Device subset required by downloaded jobs |
| `jobItems` | `jobItemId` | scheduleId, deviceId, status | Frozen assigned scope and item state |
| `mimicManifests` | `mimicId` | siteId, floorId, version | Background metadata and checksums |
| `mimicBlobs` | `mimicId` | lastUsedAt | Offline background image blobs, downloaded on demand |
| `inspectionDrafts` | `recordId` | scheduleId, deviceId, syncState | Local inspection edits and last known server revision |
| `criticalSopDrafts` | `recordId` | scheduleId, templateId, syncState | Approved/versioned SOP result drafts, not template invention |
| `systemCheckDrafts` | `recordId` | scheduleId, systemId, syncState | System prerequisite/completion draft state |
| `defectDrafts` | `defectId` | scheduleId, deviceId, status | Explicit defect/follow-up draft metadata |
| `linkedSideDrafts` | `recordId` | scheduleId, linkedVerificationId, sideId, syncState | One assigned linked-verification side per record |
| `extinguisherSnapshots` | `snapshotId` | scheduleId, masterId | Frozen extinguisher list for the job |
| `extinguisherDrafts` | `recordId` | scheduleId, assetId, serialNumber, syncState | Per-asset verification drafts |
| `proposalDrafts` | `proposalId` | scheduleId, proposalType, syncState | Missing pin and master-change proposals |
| `signoffDrafts` | `recordId` | scheduleId, syncState | Acknowledgement metadata and signature evidence reference |
| `reportSubmissionDrafts` | `recordId` | scheduleId, syncState | Submission intent only; approval snapshot remains server validated |
| `evidenceBlobs` | `evidenceId` | scheduleId, entityId, state, createdAt | Original image/video blobs and local metadata |
| `evidenceDerivatives` | `derivativeId` | evidenceId, kind | Stamped display image, video thumbnail, future working copy |
| `syncQueue` | `queueId` | status, entityType, entityId, nextAttemptAt | Durable ordered mutation queue |
| `conflicts` | `conflictId` | entityType, entityId, status | Server/current/local payload references and resolution state |
| `auditOutbox` | `eventId` | scheduleId, occurredAt, syncState | Immutable local audit events waiting for server acceptance |
| `syncMeta` | `key` | none | Server cursor, schema version, last successful sync, device installation ID |

Do not duplicate complete site/device libraries on every phone. Download the technician's active/near-term jobs, relevant master versions, active system/floor pins, and backgrounds.

## Stable IDs

Use server-issued UUIDs (UUIDv7 is preferred for index locality) for core entities. Retain existing human-readable IDs as alternate keys.

Examples:

```text
jobItemId            UUID, unique per frozen job item
inspection.recordId  inspection::<scheduleId>::<jobItemId>
criticalSop.recordId critical-sop::<scheduleId>::<templateVersionId>::<parentDeviceId>
linkedSide.recordId  linked-side::<scheduleId>::<linkedVerificationId>::<sideId>
evidenceId           UUID assigned before capture/upload
queueId              UUID assigned when mutation is created
idempotencyKey       UUID assigned once and reused for every retry
```

Never regenerate an idempotency key on retry. Never use timestamps alone as primary IDs.

## Sync Queue Record

```json
{
  "queueId": "uuid",
  "entityType": "inspection",
  "entityId": "inspection::schedule-id::job-item-id",
  "operation": "UPSERT",
  "payloadRef": "inspectionDrafts/inspection::schedule-id::job-item-id",
  "dependencyQueueIds": ["evidence-upload-operation-id"],
  "localRevision": 2,
  "expectedServerRevision": 1,
  "serverRevision": null,
  "createdAt": "2026-09-08T00:00:00.000Z",
  "attemptCount": 0,
  "lastAttemptAt": null,
  "nextAttemptAt": null,
  "status": "PENDING",
  "errorCode": null,
  "errorMessage": null,
  "idempotencyKey": "uuid",
  "technicianId": "uuid",
  "deviceInstallationId": "uuid"
}
```

Allowed states:

- `PENDING`: durable locally, not yet sent.
- `SYNCING`: leased by this app instance for one request.
- `SYNCED`: server acknowledged and returned authoritative revision.
- `CONFLICT`: server revision did not match; user/Admin resolution required.
- `FAILED_RETRYABLE`: network, timeout, or 5xx; retry later.
- `FAILED_PERMANENT`: validation/auth/permission failure requiring correction.
- `CANCELLED`: operation intentionally superseded before server acceptance.

## Queue Processing

1. Save the entity draft, audit event, evidence blob references, and queue operations in one IndexedDB transaction.
2. Show `Saved on this phone, waiting to sync` immediately after the transaction commits.
3. Process only while an authenticated session is valid and network/API health succeeds.
4. Acquire a short local lease on the next eligible operation. On crash, expired leases return to `PENDING`.
5. Upload evidence first using its evidence ID and idempotency key.
6. Submit the entity with `expectedServerRevision` and evidence references.
7. On `200/201`, store the returned server revision and mark the operation `SYNCED`.
8. On `409`, store both server and local references in `conflicts`, mark `CONFLICT`, and stop dependent operations.
9. On network error/timeout/5xx, use exponential backoff with jitter, for example 5s, 15s, 45s, 2m, 5m, then 15m while the app is active.
10. On 401, pause all work and require login refresh. Do not discard drafts.
11. On 403/validation error, mark permanent failure and show a clear correction message.

Foreground sync on app open/resume and explicit `Sync now` are mandatory. Service Worker Background Sync may be used as an optimization, not as the only delivery mechanism because browser/OS scheduling is not guaranteed.

## Duplicate Prevention

- Unique server constraint on `idempotency_key` for each mutation endpoint.
- Unique record constraint on `(schedule_id, job_item_id)` or entity-specific equivalent.
- Evidence object path contains immutable `evidenceId`, not user filename.
- A repeated identical request returns the prior result and revision.
- A second queue operation for the same unsynced entity may compact an earlier pending draft only if the earlier operation has never reached the server. The audit trail must retain both local edit events.

## Conflict Strategy

### Same device/item

Keep optimistic concurrency as the authority. Advisory claims can warn another technician but must not decide data correctness.

```text
Phone A reads revision 3 -> saves expected 3 -> server writes revision 4.
Phone B reads revision 3 -> saves expected 3 -> server returns 409 with revision 4.
```

The app shows both versions and allows only an authorized resolution:

- refresh and discard local draft;
- reapply selected local fields to the latest record, then save against revision 4;
- send to Supervisor/Admin review.

Never automatically merge PASS/FAULT, evidence, signatures, SOP completion, or replacement serials.

### Different devices/items

Independent records sync without collision. Progress is recalculated server-side from authoritative records.

### Linked verification

Each side is independent. Sync both side records, preserve technician/time/result, then reconcile on the server. Missing counterpart remains `AWAITING_COUNTERPART`; disagreement becomes `MISMATCH_REVIEW_REQUIRED`.

### Schedule and frozen scope

Schedule scope is immutable after release to technicians. Admin metadata edits require a schedule revision. Scope changes create a new revision/amendment with audit history, never a silent replacement.

## Evidence Architecture

### Capture

1. Create `evidenceId` before camera/file selection.
2. Store original Blob in `evidenceBlobs` immediately.
3. Record capture time, device time zone, MIME, byte count, pixel dimensions, SHA-256, technician/session/job/entity IDs, and optional geolocation only if separately approved.
4. Generate the stamped display copy in a worker where supported; store it in `evidenceDerivatives`.
5. Create independent upload operations for original and derivative.

### Server/object storage

Use private buckets and immutable object keys:

```text
evidence/<clientId>/<siteId>/<scheduleId>/<entityType>/<entityId>/<evidenceId>/original.jpg
evidence/<clientId>/<siteId>/<scheduleId>/<entityType>/<entityId>/<evidenceId>/stamped.jpg
evidence/<clientId>/<siteId>/<scheduleId>/<entityType>/<entityId>/<evidenceId>/original.mp4
evidence/<clientId>/<siteId>/<scheduleId>/<entityType>/<entityId>/<evidenceId>/thumbnail.jpg
```

Database evidence rows contain object keys, checksums, metadata, retention state, and access policy. They do not contain full base64 content. Reports use evidence IDs and time-limited authenticated URLs or server-rendered assets.

### Photo policy

- Keep original for audit.
- Produce a smaller stamped display/report copy.
- Enforce allowed image MIME after decoding and signature inspection.
- Enforce per-file pixel and byte limits before upload.
- Strip unneeded metadata from display copies; preserve agreed audit metadata separately.
- Do not trust filename extension or browser-provided MIME alone.

### Future 30-second video

- Do not implement in V1 migration unless approved.
- Prepare schema fields for duration, codec, dimensions, bytes, checksum, and thumbnail evidence ID.
- Enforce a 30-second duration target and byte limit on device before queuing.
- Upload resumably/chunked where supported.
- Never embed video bytes in JSON or reports.

## Offline Download Package

Before leaving connectivity, a technician explicitly downloads a job package:

- schedule and frozen `plannedDeviceIds`/job items;
- client/site address and approved contact subset;
- configured system definitions and exact SOP template versions;
- required device records and normalized pins;
- selected mimic manifests and backgrounds;
- linked-verification definitions and assigned side;
- extinguisher frozen asset list;
- latest authoritative revisions and unresolved mandatory rechecks.

The package records `downloadedAt`, content checksums, and server sync cursor. The UI must show `Offline ready` only when all mandatory package items are durable in IndexedDB.

## Completion Rules

The phone may record a local completion intent, but final job completion, report submission, and Admin approval require:

- every required record synced;
- every required evidence object uploaded and verified by checksum;
- no unresolved conflicts;
- prerequisite and completion dependencies satisfied by server state;
- latest schedule revision acknowledged;
- signature evidence synced;
- server transaction creates the completion/submission revision.

## Retention and Cleanup

- Never evict unsynced or conflicted records/blobs.
- Keep active and recently completed job packages locally for a configurable period, initially 30 days after verified sync.
- Allow technician to remove only fully synced old packages through a controlled cleanup screen.
- Monitor storage quota and warn before capture becomes unsafe.
- Cache mimic backgrounds by version/checksum and use least-recently-used cleanup only when no active job references them.

## Offline Acceptance Tests

1. Work offline for one hour with inspections, photos, SOP, and linked side.
2. Leave phone offline overnight, reboot it, reopen, and confirm all drafts/blobs remain.
3. Switch Wi-Fi -> mobile -> offline -> Wi-Fi during upload.
4. Kill browser/app while an evidence upload is in progress; resume without duplicate files.
5. Save the same device on two phones and verify explicit conflict.
6. Save different devices on two phones and verify independent sync.
7. Tap Save twice rapidly and verify one authoritative mutation.
8. Expire authentication while drafts exist; reauthenticate without data loss.
9. Fill storage near quota and verify warning/no silent loss.
10. Sync 100+ devices and a large mimic without blocking technician interaction.
11. Confirm completion/report submission is blocked by one pending evidence operation.
12. Restore the app on a replacement phone and confirm only server-synced data returns.

