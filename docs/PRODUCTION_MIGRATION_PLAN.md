# RMT FIREAPPS Production Migration Plan

Source baseline: `fae1495b47f04da37767dabcd179fdc3f73f5abc`  
Destination: authenticated PostgreSQL records, private object storage, IndexedDB offline client.

## Migration Principles

1. Freeze product features while production foundations are introduced.
2. Never migrate directly from unreviewed browser caches when a server/shared record exists.
3. Preserve original files and JSON as immutable source evidence.
4. Assign stable UUIDs without changing human-readable tags/serials.
5. Import with dry-run, validation, counts, checksums, and a reversible mapping manifest.
6. Preserve `plannedDeviceIds`, annual coverage, SOP template version, authorship, timestamps, revisions, and report snapshots.
7. Do not silently resolve duplicates or conflicts. Quarantine them for Admin review.
8. Run old and new systems side by side only in read/compare mode. Avoid dual authoritative writes.

## Schemas to Fix Before Real Data Growth

### Identity and tenancy

Create UUID-backed tables for `organizations`, `users`, `staff_profiles`, `clients`, `sites`, and `staff_site_access`. Names/emails remain unique business attributes where appropriate, not cross-entity foreign keys.

### Masters and versions

Create:

- `fire_systems`
- `system_relationships`
- `sop_templates`
- `sop_template_versions`
- `devices`
- `device_master_revisions`
- `floors`
- `mimic_background_versions`
- `mimic_pins`
- `extinguisher_masters`
- `extinguisher_assets`
- `extinguisher_master_revisions`

Pins reference device and floor UUIDs while retaining normalized coordinates. Mimic background versions are separate from pins.

### Jobs and immutable scope

Create:

- `schedules`
- `jobs`
- `job_systems`
- `job_items`
- `job_scope_snapshots`
- `annual_contract_cycles`
- `annual_coverage_events`
- `scope_reservations`

One `job_item` row freezes each planned device/checklist item. Do not store the authoritative visit scope as one mutable JSON array. `covered` is created from qualifying completed results, while `reserved` represents valid scheduled future scope.

### Field records

Create independent revisioned tables for:

- `inspection_records`
- `critical_sop_records`
- `system_completion_records`
- `defects`
- `linked_verification_definitions`
- `linked_verification_sides`
- `extinguisher_job_snapshots`
- `extinguisher_verifications`
- `master_change_proposals`
- `suggested_pin_requests`
- `signoffs`
- `report_submissions`
- `report_snapshots`
- `evidence`
- `audit_events`
- `idempotency_receipts`

Use an integer `revision` and compare-and-update transaction. Audit events are inserts only.

## Source Precedence

When multiple prototype copies exist, use this precedence:

1. Shared per-job record JSON for inspection/SOP/linked/extinguisher/sign-off/report data.
2. Server device master, extinguisher master, request, mimic, and schedule files.
3. Legacy inspection-run exports as historical evidence or reconciliation input.
4. `schedule.jobProgress` only when no shared record exists and migration metadata proves it was not already migrated.
5. Browser `localStorage` only for explicitly identified unsynced drafts, never as a silent replacement for server data.

## Entity Migration

### Users and technicians

- Do not import demo passwords or `rmtCurrentUser` sessions.
- Create real accounts through an Admin-controlled invite process.
- Map historical technician name/email strings to a staff UUID table.
- Preserve unmatched names as `legacy_actor_name` and flag for review.

### Clients and sites

- Extract unique company/site pairs from device masters, mimic records, schedules, and shared snapshots.
- Normalize whitespace/case only in a dry-run candidate field.
- Admin confirms duplicate/alias merges.
- Produce `legacy_client_site -> clientId/siteId` mapping.

### Systems and devices

- Import current device master as a versioned snapshot per client/site.
- Preserve device `id`, tag, serial, type, system, floor, location, and normalized pin values.
- Reject duplicate legacy IDs within a site into a quarantine table.
- Do not infer missing water-system parent relationships. Import only configured relationships.

### Mimics and pins

- Import approved clean background files to private/application object storage.
- Record width, height, background version, checksum, and source reference.
- Import pins separately and retain existing normalized coordinates.
- Generate an overlay comparison image/report; manual approval is required when geometry differs.
- Keep unapproved pilot redraws outside production migration.

### Schedules/jobs

- Import `service-schedules.json` once with a source file checksum.
- Create schedule/job rows and one immutable `job_item` for every frozen planned ID.
- Preserve frequency, dates, technician assignment, status, annual cycle, rechecks, and critical items.
- Detect schedules that lack frozen scope and quarantine rather than regenerating during migration.

### Annual coverage

- Import cycle identity, `coveredIds`, `reservedIds`, forced/recheck reasons, and source schedule IDs.
- Rebuild expected coverage events from completed authoritative item records.
- Compare rebuilt coverage with legacy scope history.
- Differences require Admin resolution; scheduled-but-incomplete items must not become covered.

### Inspections, SOP, and defects

- Import one shared record row per current record ID and retain source revision/timestamps.
- Extract defects from FAULT results into explicit defect rows while preserving the source inspection link.
- Preserve technical SOP payload and template/version reference exactly; do not invent content.
- If only legacy `jobProgress` exists, migrate once and mark source provenance.

### Evidence

- Enumerate all referenced and unreferenced files.
- Calculate SHA-256 and byte count before upload.
- Create evidence metadata row, upload to immutable key, then verify download checksum.
- Preserve original and stamped relationships.
- Quarantine references with missing files and files with no record. Do not delete source files.

### Linked verification

- Import definitions and each side independently.
- Preserve linked ID, side ID, frozen technician assignment, result, local/server timestamps, revision, evidence, conflicts, and audit.
- Recalculate final state from imported sides and compare with legacy final state.

### Extinguishers

- Import master by site, preserving serial as business identity and stable asset mapping.
- Import each job snapshot as immutable JSON plus normalized snapshot rows.
- Import verifications and proposals independently.
- Never apply historical technician proposals to the master during migration unless the existing Admin approval is explicit.

### Suggested pins

- Import missing-device requests with exact schedule/client/site/floor/system context.
- Preserve status, technician, position, evidence, revision, and Admin decision.
- Approved requests link to the created device UUID; pending/rejected requests do not mutate the master.

### Reports and signatures

- Import report submission state and immutable approved snapshot.
- Move signature/evidence bytes to private object storage and replace inline data with evidence reference.
- Preserve snapshot checksum, source record revisions, submission/review identity, and timestamps.
- Imported PDFs are artifacts; structured snapshot/data remains authoritative.

## Migration Tool Outputs

Every dry run and execution creates:

- source inventory with paths, bytes, and SHA-256;
- entity counts by client/site/type/status;
- stable legacy-to-UUID mapping file;
- duplicate/quarantine list;
- missing evidence list;
- row-import counts and rejects;
- annual coverage reconciliation;
- linked-verification reconciliation;
- report snapshot integrity report;
- signed migration manifest with tool version and Git SHA.

Store the manifest with the backup, not in the public web bundle.

## Principal Migration Risks

| Risk | Control |
| --- | --- |
| Same client/site written with spelling aliases | Dry-run alias report and Admin-approved mapping; never auto-merge |
| Duplicate device IDs/tags within one site | Quarantine duplicates and preserve original rows/files |
| Browser cache newer than server for an unsynced draft | Import only explicitly marked drafts with user/device provenance; reconcile against server revision |
| `schedule.jobProgress` duplicates a shared record | Shared record wins; one-time migration flag and idempotency receipt prevent double import |
| Planned scope missing or regenerated | Require frozen source IDs; quarantine incomplete schedules instead of recalculating |
| Reserved items incorrectly counted as covered | Rebuild coverage from qualifying completed records and compare with legacy cycle data |
| Missing/orphaned evidence | Checksum inventory and quarantine; never fabricate or silently drop references |
| Inline signature/photo content increases migration memory | Stream/decode one object at a time and replace with object reference only after verification |
| Unapproved suggested pin or extinguisher proposal mutates master | Import proposal status independently; mutate master only where prior Admin approval is explicit |
| SOP version cannot be identified | Preserve full legacy payload and mark version unresolved for Admin review |
| Report snapshot no longer matches source revisions | Retain snapshot as historical artifact and record reconciliation mismatch; do not regenerate silently |
| Test/demo data enters production | Explicit allowlist of clients/jobs plus owner-reviewed exclusion manifest |

## Phased Delivery

### Phase 1: Pilot-ready foundation

Technical work:

1. Freeze current V1 workflows and document acceptance fixtures.
2. Define PostgreSQL schema, migrations, RLS policy matrix, and stable IDs.
3. Implement real Auth and server-enforced Admin/Supervisor/Technician rules.
4. Port schedules, per-item records, progress, sign-off, and report submission APIs.
5. Move evidence to private object storage using evidence IDs and size/MIME/checksum validation.
6. Add environment configuration, HTTPS staging, structured logs, and basic monitoring.
7. Build migration dry-run and compare current JSON against staging.

Tests:

- authorization matrix and cross-site denial;
- different-device simultaneous saves;
- same-device revision conflict and idempotent retry;
- schedule freeze and server progress;
- evidence private access and checksum;
- report approval from authoritative records;
- migration counts/reconciliation.

Rollback:

- current local prototype remains read-only fallback for test data;
- preserve source JSON/media untouched;
- database migrations are forward/backward compatible until cutover;
- redeploy prior application artifact if staging acceptance fails.

Exit condition: secure online workflow works end to end for a controlled pilot. Offline field work is still limited until Phase 2.

### Phase 2: Production-ready offline operation

Technical work:

1. Implement IndexedDB schema and migrations.
2. Implement job package download and checksum verification.
3. Implement durable entity/evidence sync queue, retries, idempotency receipts, and conflict inbox.
4. Implement original/stamped photo queue and safe storage cleanup.
5. Port linked-verification and extinguisher offline drafts to common queue.
6. Implement session refresh/revocation and lost-device handling.
7. Add automated DB/object backup to Synology and restore validation.
8. Complete physical Android acceptance and staff training.

Tests:

- offline one hour and overnight;
- phone/browser reboot with unsynced photos;
- network switching and interrupted upload;
- two-phone same/different item;
- stale schedule version;
- 100+ item job and large mimic;
- completion blocked until clean sync;
- database plus object restore.

Rollback:

- feature flag the offline writer per pilot group;
- keep server schema backward compatible for the previous online client;
- never delete old local drafts during rollback;
- export conflict/pending queue before reinstalling a device.

Exit condition: real two-phone jobs pass online/offline acceptance, restore drill passes, and no critical/high security finding remains open.

### Phase 3: Improved resilience

Technical work:

- point-in-time recovery or more frequent database recovery;
- off-site encrypted backup replication;
- standby recovery environment/read-only failover;
- resumable constrained short-video evidence;
- central observability, security alerts, retention automation;
- mobile app packaging/MDM only if web app limitations justify it;
- periodic access review and incident exercises.

Tests:

- provider/home Internet outage exercise;
- full server loss and recovery on replacement infrastructure;
- lost phone/session revocation;
- ransomware/accidental-delete object recovery;
- load and storage growth test at 3-5 times expected volume.

Rollback:

- retain Phase 2 production path while resilience components are introduced;
- failover remains disabled until two successful drills;
- video evidence remains feature flagged.

## Production Readiness Test Matrix

| Scenario | Required proof |
| --- | --- |
| Offline 1 hour | All required record types and photos persist and later sync |
| Offline overnight | Drafts survive OS/browser suspension and stale tokens |
| Phone reboot unsynced | IndexedDB records/blobs intact; queue resumes |
| Browser/app restart | Correct user/job context restored after authentication |
| Wi-Fi -> mobile | No duplicate mutation or evidence object |
| Mobile -> offline -> Wi-Fi | Retry/backoff and visible pending state |
| Duplicate Save tap | One authoritative revision; idempotent response |
| Two techs, different devices | Independent successful writes and aggregated progress |
| Two techs, same device | Second stale write receives visible conflict |
| MFAP completed on Phone A | Phone B refresh/sync unlocks configured child only |
| Linked verification | Independent sides, offline capture, reconcile/mismatch |
| Extinguisher job | Frozen list, proposals, reconciliation, no master mutation without approval |
| Evidence retry | Kill network mid-upload; resume and checksum match |
| Large mimic | On-demand cache; UI remains responsive; no unrelated assets loaded |
| Large job | 100+ items; bounded startup/render/API behavior |
| Video placeholder | 30-second-sized blob can queue/load without implementation of playback/reporting |
| Server restart | Accepted records durable; in-flight queue recovers safely |
| Report approval | Block unsynced/conflicted/missing evidence; immutable approved snapshot |
| Backup restore | Database rows and every referenced object restored and reconciled |
| Cross-client access | Technician cannot read/write unassigned site/job/evidence |
| Disabled staff | Sessions revoked; unsynced work preserved for supervised recovery |

## Cutover Procedure

1. Announce data freeze for the local prototype.
2. Back up repository, local runtime JSON, reports, and media with checksums.
3. Run final migration dry-run and resolve quarantined critical records.
4. Create production accounts and role/site assignments.
5. Import masters, mimics/pins, schedules/scope history, shared records, evidence, and reports.
6. Run reconciliation and owner sign-off.
7. Deploy production client with server URL/configuration.
8. Download assigned pilot job to two physical Android phones.
9. Run one controlled real-site job with fallback procedure.
10. Verify report, backup, and next-day restore sample.
11. Mark old prototype read-only and retain it according to migration retention policy.

## Data Retention and Decommission

- Do not delete local source data immediately after cutover.
- Keep an encrypted immutable migration archive for at least the agreed legal/business retention period.
- Remove demo accounts and physical-test schedules from production import unless explicitly approved.
- Remove credentials/tokens from old browsers and stop the unauthenticated LAN server.
- Document which system is authoritative and the exact cutover time.
- After two successful quarterly restore drills, review whether legacy runtime copies can be reduced.

## Outstanding Decisions Required From Realmart

1. Managed cloud approval and acceptable data region.
2. Realmart staff identity/email and MFA policy.
3. Customer/evidence/signature retention periods.
4. Photo capture expectations for PASS and FAULT and resulting capacity budget.
5. RPO/RTO acceptance and whether paid PITR is justified.
6. Who owns production operations and who may approve emergency restores.
7. Whether technicians will use a PWA/browser or managed Android package.
8. Whether location metadata is needed and what employee/customer notice applies.
9. Which historic demo/test records must be excluded from production.
