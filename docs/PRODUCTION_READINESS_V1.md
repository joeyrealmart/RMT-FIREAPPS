# RMT FIREAPPS Production Readiness V1

Audit date: 2026-09-08  
Audited HEAD: `fae1495b47f04da37767dabcd179fdc3f73f5abc`  
Scope: architecture and readiness review only. The uncommitted Photo Timestamp Evidence V1 implementation was not modified.

## Executive Decision

RMT FIREAPPS is a strong functional prototype and a suitable supervised LAN pilot. It is not ready for unsupervised production or direct Internet exposure.

The recommended V1 production direction is:

```text
Android/tablet browser or installable web app
  -> IndexedDB application cache + durable sync queue
  -> HTTPS
  -> managed authentication and API
  -> managed PostgreSQL authoritative records
  -> private object storage for photos, video, reports, and mimic backgrounds
  -> independent encrypted export/backup to Realmart Synology
```

For the current scale, a managed Supabase Pro project is the simplest concrete implementation candidate. It starts at USD 25/month and currently includes a managed Postgres database, 100 GB file storage, 250 GB egress, and seven days of daily database backups. Pricing and allowances must be rechecked immediately before purchase. Database backups do not include Storage objects, so Realmart must independently back up evidence files. Sources: [Supabase pricing](https://supabase.com/pricing), [database backups](https://supabase.com/docs/guides/platform/backups), and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

This is a recommendation, not authorization to purchase or activate a paid service.

## Current Architecture

### Current data flow

```text
Login form
  -> authenticateDemoUser() against static demoAccounts
  -> rmtCurrentUser in localStorage
  -> role-specific single-page UI

Admin schedule edit
  -> state.schedules / rmtSchedules cache
  -> POST /api/save-schedules with the complete schedule array
  -> schedules/service-schedules.json

Technician opens assigned job
  -> GET /api/schedules
  -> GET /api/jobs/<scheduleId>/state
  -> server shared job JSON + browser cache
  -> active system/floor device master and mimic background loaded on demand

Inspection/SOP/linked/extinguisher save
  -> browser draft/state
  -> POST one revisioned entity to /api/jobs/<scheduleId>/<action>
  -> expected revision check
  -> atomic replacement of that job's shared JSON file
  -> shared progress returned and cached

Evidence capture
  -> browser data URL/File processing
  -> API JSON body
  -> decoded local file below rmt-fire-local-data
  -> evidence path/URL stored in the shared record

Sign-off/report submission
  -> server recalculates shared progress and unsynced state
  -> revisioned sign-off/submission in shared job JSON
  -> approved structured snapshot and browser-generated/served report artifact
```

When the server is unavailable, some workflows retain a `localStorage` draft and visibly block completion. Linked-verification drafts have a reconnect synchronizer. There is no common durable queue, no service worker, and no reliable offline merge for every entity.

### Frontend

- `outputs/fire-inspection-mvp/index.html` is a single-page HTML application.
- `outputs/fire-inspection-mvp/app.js` is a large classic browser script containing seeded data, UI rendering, scheduling, inspection, reporting, offline draft behavior, and API calls.
- `outputs/fire-inspection-mvp/styles.css` supplies all desktop/mobile styling.
- There is no framework build, package manifest, service worker, IndexedDB database, or installable PWA lifecycle.
- Startup reads selected browser state through `readStoredJson()` and later loads server schedules, shared job state, mimic assets, and device masters.
- Technician session context is restored from `rmtCurrentUser`, `rmtActiveTechPreviewScheduleId`, `rmtActiveTechSystemKey`, and `rmtActiveTechFloorId`.

### Local server

- `work/serve-fire-inspection-mvp.mjs` is a Node core HTTP server.
- It listens on `0.0.0.0:8026` and serves the static app, APIs, local data, evidence, and generated reports.
- `root`, `dataRoot`, and `reportRoot` are hard-coded Windows paths.
- Request handlers perform synchronous file and JSON I/O in the main Node process.
- JSON request bodies are accumulated in memory with one global 80 MiB limit.
- JSON files are generally written through `atomicWriteJson()` for shared stores, while schedule and inspection-run exports use direct `writeFileSync()` calls.

### Server data layout observed

The ignored runtime directory `outputs/rmt-fire-local-data/` held approximately 431.5 MiB across 1,327 files at audit time:

| Area | Files | Approx. bytes | Current purpose |
| --- | ---: | ---: | --- |
| `device-master/` | 24 | 1,899,692 | Device master JSON/CSV and related files |
| `extinguisher-assets/` | 36 | 129,024 | Extinguisher masters and imported source references |
| `inspection-runs/` | 304 | 18,875,023 | Legacy/exported inspection JSON, CSV, and photos |
| `mimic-library/` | 399 | 426,814,911 | Large mimic image/PDF working library |
| `requests/` | 14 | 67,650 | Missing-device requests and evidence |
| `schedules/` | 6 | 64,033 | Whole schedule JSON/CSV and schedule photos |
| `shared-records/` | 542 | 4,657,929 | Per-job shared JSON and evidence |

The mimic library dominates local storage. It must not be loaded at login or copied wholesale into a mobile offline package.

### Shared records

`createEmptySharedJobStore()` creates one JSON file per schedule under `shared-records/jobs/`. It includes:

- `inspectionRecords`
- `criticalSopRecords`
- `systemCheckRecords`
- `itemClaims`
- `linkedVerificationDefinitions`
- `linkedVerificationSideRecords`
- `linkedVerificationConflicts`
- linked-verification audit
- extinguisher frozen asset snapshot, verification records, proposals, and audit
- `signOff`
- `reportSubmission`

`saveRevisionedRecord()` uses stable record IDs and expected revision checks. A stale write returns a conflict. An equivalent retry returns the existing record as idempotent. This is the right production concept, although the JSON-file implementation is not a production database.

Inspection and SOP endpoints save independent records. `calculateSharedProgress()` aggregates planned device completion from the shared job store. Server-side sign-off and report submission reject incomplete or unsynced jobs.

### Schedule and legacy snapshot persistence

- `/api/save-schedules` replaces `schedules/service-schedules.json` with a complete submitted schedule array.
- `/api/save-inspection-run` creates legacy/export JSON and CSV snapshots.
- `schedule.jobProgress` remains migration/fallback data. It must not become authoritative again.
- Browser `rmtSchedules` is a cache, but whole-array browser and server writes still create stale-snapshot risk for schedule administration.

### Browser storage

Browser state is JSON-serialized to `localStorage`. Important keys include:

- identity/session: `rmtCurrentUser`
- active context: `rmtActiveJob`, `rmtActiveTechPreviewScheduleId`, `rmtActiveTechSystemKey`, `rmtActiveTechFloorId`
- schedules and annual scope: `rmtSchedules`, `rmtScopeCycle`, `tmFireScopeHistory`, `rmtContractRules`
- inspection caches: `tmFireInspections`, `rmtCriticalSops`, `rmtSystemChecks`, `tmFireHistory`, `rmtJobHistory`
- mimic/device setup: `rmtMimicFloors`, `tmFireSetupDevices`, `tmFireDevicePins`, `tmFirePinHistory`
- offline drafts: `rmtLinkedVerificationDrafts`, `rmtExtinguisherAssetDrafts`
- requests/site/admin state: `tmFireRequests`, `rmtSiteProfile`, `rmtAdminUiState`

`localStorage` is synchronous, capacity-limited, origin-wide, and not a durable offline database. Existing code strips some photo data before schedule/request caching, which reduces immediate bloat, but the architecture still needs replacement.

### Evidence and files

- Inspection, extinguisher, linked-verification, missing-device, and schedule photos are decoded from data URLs and written below the local data root.
- Shared records retain evidence IDs and URL/path metadata.
- Report files are served from `output/pdf/` through `/reports/*`.
- Clean runtime mimic manifests are in `outputs/fire-inspection-mvp/assets/mimics/`; authoritative device pins remain separate in device/master records.
- The uncommitted Photo Timestamp work introduces original/stamped evidence copies. That implementation was treated as WIP and was not changed during this audit.

## Readiness Classification

| Component | Classification | Decision |
| --- | --- | --- |
| Technician/Admin workflows | Pilot acceptable | Preserve behavior while changing infrastructure |
| Stable IDs and per-item records | Production-acceptable concept | Port to relational tables |
| Expected revision conflicts | Production-acceptable concept | Enforce atomically in SQL/API |
| Frozen job scope and extinguisher snapshot | Production-acceptable concept | Preserve immutable snapshot/version semantics |
| Append-style audit arrays | Pilot acceptable | Replace with independent append-only audit rows |
| Static frontend | Pilot acceptable | Can remain a web app; add build/version and service worker later |
| Node local JSON server | Prototype only | Replace before remote production |
| Whole schedule JSON replacement | Prototype only | Replace with revisioned schedule rows/transactions |
| `localStorage` cache/drafts | Prototype only | Replace durable work with IndexedDB |
| Demo authentication/client roles | Must replace | Real accounts, sessions, server authorization |
| Public `/local-data/*` and `/reports/*` | Must replace | Private signed/authenticated object access |
| Local filesystem evidence | Pilot acceptable on one PC | Move to object storage plus independent backup |
| Atomic temp+rename JSON writes | Pilot acceptable | Helpful against partial JSON, not a database transaction model |
| Hard-coded Windows paths | Prototype only | Environment/configuration settings |
| LAN HTTP on port 8026 | Supervised pilot only | HTTPS and authenticated remote access required |
| Browser offline linked drafts | Pilot only | IndexedDB queue and evidence blobs required |

## Data Inventory

Risk indicates operational impact if the authoritative copy is lost.

| Entity | Current source of truth | Current ID/version | Offline need | Backup importance | Loss risk |
| --- | --- | --- | --- | --- | --- |
| Users | Static `demoAccounts` in `app.js` | Email/key, no server revision | Login/session cache only | High once real | Critical |
| Technicians | Demo accounts plus schedule names | Email/name strings | Assigned identity and job roster | High | Critical |
| Clients | Seed/config plus device/mimic/schedule-derived profiles | Company/site names | Assigned client subset | High | High |
| Sites | Same derived profile model | Site name, no durable site UUID | Assigned site subset | High | High |
| Schedules/jobs | `service-schedules.json`; browser cache | `scheduleId`; whole snapshot timestamps | Assigned jobs required | Critical | Critical |
| System masters | Static/configured templates and device attributes | Template/system keys | Assigned system definitions | High | High |
| Device masters | `device-master/*.json`; browser cache | Device `id`/`tag`; file-level save | Assigned device subset | Critical | Critical |
| Mimic backgrounds | runtime assets plus local mimic library | floor ID/version where manifest exists | Active job/floor only | High | High |
| Mimic pins | Device master/browser setup records | device/tag plus normalized coordinates | Active scope pins | Critical | High |
| Inspections | Shared job `inspectionRecords` | `inspection::<scheduleId>::<deviceId>`, revision | Full offline capture | Critical | Critical |
| Defects | Inspection results/notes/evidence, report derivation | Inspection record/device identity | Full offline capture | Critical | Critical |
| Evidence | Files below local data; metadata in records | Evidence IDs and file URLs | Blob must survive reboot | Critical | Critical |
| Linked verifications | Shared job definitions and side records | linked ID + side ID, revision | Each assigned side | Critical | Critical |
| Extinguisher masters | `extinguisher-assets/*-master.json` | master ID, asset ID/serial, revision | Job snapshot subset | Critical | Critical |
| Extinguisher frozen job assets | Shared job `extinguisherAssetSnapshot` | snapshot ID, master revision | Full assigned list | Critical | Critical |
| Extinguisher verification | Shared per-asset records | schedule + asset record ID, revision | Full offline capture | Critical | Critical |
| Master-change proposals | Shared job proposal records | proposal ID/revision/audit | Draft/submit offline | High | High |
| Report snapshots | Shared `reportSubmission.reportSnapshot` and PDFs | schedule submission revision | View cached report optional | Critical | Critical |
| Acknowledgements/signatures | Shared `signOff`, inline signature data | signoff ID/revision | Must survive offline capture | Critical | Critical |
| Suggested pins | `requests/missing-device-requests.json` | request ID/revision | Full offline draft with photo | High | High |

Production must introduce immutable UUIDs for user, client, site, system, floor, device, job, evidence, report, and audit event. Human-readable tags and serial numbers remain business keys but should not be the database primary key.

## Current Conflict Behavior

### Correctly guarded

- Independent inspection and critical SOP records use expected revisions.
- Linked verification sides retain separate records and reject stale revisions.
- Extinguisher verification and master import use revision checks.
- Missing-device requests use a request revision.
- Sign-off and report submission use revisions and server readiness checks.
- Equivalent duplicate per-record submissions are idempotent.

### Still exposed

- `/api/save-schedules` replaces the full schedule collection without an expected collection revision.
- Device master and mimic saves are file-level replacements without authenticated ownership or general concurrency control.
- Multiple Node processes or writers can still race between JSON read and rename.
- Browser cached whole objects can diverge from server files.
- Offline drafts other than linked verification are not coordinated by one durable queue.

## Security Findings

### Critical

1. **No production authentication or server authorization.** `authenticateDemoUser()` accepts any non-empty password for a known static email. The chosen role is stored in editable `localStorage`. APIs trust request payload identity and do not enforce role or tenant access.
2. **Sensitive records and evidence are available over unauthenticated LAN URLs.** `/local-data/*`, `/reports/*`, job state, schedules, requests, and other APIs do not require a session. Any device that can reach the server can attempt to read or mutate data.

### High

1. **Plain HTTP.** Credentials, signatures, inspection data, and photos have no transport encryption.
2. **Upload validation is insufficient.** Data URLs are accepted with broad in-memory request limits; file type, decoded size, image structure, and malware/content checks are not consistently enforced.
3. **No tenant/site authorization.** There is no server policy preventing one technician from requesting another client/job if an ID is known.
4. **Single workstation/file tree is a failure domain.** No automated, tested, off-device backup is part of the current runtime.
5. **Whole-schedule replacement can lose concurrent Admin changes.** There is no collection revision or database transaction.

### Medium

1. Hard-coded absolute paths expose workstation details and prevent repeatable deployment.
2. Synchronous large JSON/image operations can block all requests and increase outage/corruption risk during heavy uploads.
3. `/api/diagnostics` and `/api/network-info` expose deployment information without authentication.
4. Error responses can expose raw internal exception messages.
5. No rate limits, login lockout, request-size classes, request IDs, or security event monitoring.
6. Signature images are embedded in shared JSON, increasing sensitivity and file growth.
7. Audit arrays are mutable fields inside job JSON rather than separately protected append-only events.

### Low/guarded

1. No permissive CORS headers were found; the browser app is same-origin. This does not compensate for unauthenticated direct LAN access.
2. Route file paths are normalized and checked against the expected root. Keep this defense, but use a hardened static/object server and regression tests before Internet exposure.
3. `.gitignore` excludes common secrets, local runtime data, reports, and temporary files. Continue automated secret scanning in CI.

## Backend Options

### Option A: managed cloud backend

Concrete candidate: Supabase Pro with PostgreSQL, Auth, and private Storage buckets.

| Factor | Assessment |
| --- | --- |
| Setup | Moderate. Schema, RLS, migrations, API integration, and offline queue still require engineering. Infrastructure operations are simpler. |
| Cost | From USD 25/month at audit date. Budget USD 25-75/month initially, subject to storage/egress and backup choices. No purchase is authorized. |
| Maintenance | Low to moderate. Realmart owns schema, policies, app releases, and backup exports; provider owns database hosting. |
| Offline | Must still be implemented in the app with IndexedDB and a sync queue. |
| Evidence | Private object storage with MIME/size policy and signed/authenticated access. |
| Backup | Managed DB backups plus independent database export and Storage-object backup to Synology. |
| Remote access | HTTPS from office/site without phone VPN enrollment. |
| Security | Strong foundation only if RLS, private buckets, server-side privileged operations, MFA, and key handling are correct. |
| Recovery | Faster managed DB recovery; Storage objects need separate recovery process. |
| Scale | More than sufficient for 10 staff and gradual growth. |
| Dependency | Vendor dependency exists; mitigate with standard Postgres schema, SQL migrations, portable object keys, and regular exports. |

### Option B: Realmart mini PC plus Synology

Concrete candidate: dedicated mini PC running a containerized API, PostgreSQL, and private object/file service; Synology provides backup, not the live database; Tailscale Standard or a professionally configured HTTPS gateway provides remote access.

| Factor | Assessment |
| --- | --- |
| Setup | High. Hardware, UPS, OS hardening, database, TLS/VPN, DNS, monitoring, updates, and restore automation are Realmart responsibilities. |
| Cost | Hardware/UPS up front, power and backup storage, plus remote access. Tailscale Standard is currently USD 8/user/month, about USD 80/month for 10 seats. A self-managed WireGuard route avoids license cost but increases maintenance. [Tailscale pricing](https://tailscale.com/pricing) |
| Maintenance | High for a non-specialist. Requires a named maintainer and tested runbook. |
| Offline | Same IndexedDB queue is still required because site/home connectivity can fail. |
| Evidence | Local object/file store can be economical, but retention, integrity, encryption, and remote throughput must be managed. |
| Backup | Good fit for Synology Hyper Backup/snapshots plus off-site encrypted copy. |
| Remote access | Never expose SMB/Postgres. Use identity-aware VPN/HTTPS gateway and least-privilege rules. [Tailscale remote access](https://tailscale.com/docs/use-cases/vpn-replacement/remote-workers) |
| Security | Full burden is on Realmart, including patching, certificates, firewall, logs, and incident response. |
| Recovery | Depends on spare hardware, documented restore, and available operator. |
| Scale | Technically sufficient, but home upload speed and outages constrain field use. |
| Dependency | More company control; dependency shifts to ISP, hardware, VPN, and internal operational knowledge. |

### Recommendation

Use Option A for V1 production and use Synology as an independent encrypted backup/export destination. It has the lower operational risk and likely the lower initial total cost for 10 staff. Keep the application portable through SQL migrations and storage-neutral evidence keys.

Use the mini PC only for:

- a supervised local pilot before cloud migration;
- a backup/export worker near the Synology;
- a later read-only recovery service after restore drills exist.

Do not make the home Internet connection or one mini PC the only path to production service unless Realmart appoints an IT maintainer and accepts the outage risk.

## Storage Estimate

Assumptions must be validated from a three-month pilot:

- 20 jobs/month;
- 30-100 inspections/job, giving 600-2,000 inspection records/month;
- structured record data averages 5-20 KiB per inspection including audit metadata but excluding media;
- each captured photo retains an original plus compressed/stamped display copy, about 3-7 MiB combined;
- 15-50% of inspections capture one or two photos;
- 5-20 occasional 10-30 second videos/month, approximately 20-80 MiB each after an enforced codec/size policy.

| Data | Low estimate/month | High estimate/month |
| --- | ---: | ---: |
| Structured records/audit | 10 MiB | 50 MiB |
| Photo originals + display copies | 0.3 GiB | 10 GiB |
| Future short videos + thumbnails | 0.1 GiB | 1.6 GiB |
| New mimic/report assets | 0.1 GiB | 0.5 GiB |
| **Estimated total** | **0.5 GiB** | **12 GiB** |

Annual primary storage is roughly 6-144 GiB before retention cleanup and backups. Start with at least 250 GiB usable object capacity for the application or a plan that can expand, and at least 1 TiB usable protected Synology capacity for retained evidence plus versioned backups. Monitor actual bytes per job and review after 90 days. Backups and replicas are not spare capacity; allow 2-3 times primary retained data across all copies.

## Largest Production Blockers

1. Real authentication and server-enforced Admin/Supervisor/Technician authorization.
2. PostgreSQL authoritative schema with transactional, per-record revision updates.
3. Private object storage and secure evidence upload/download.
4. IndexedDB durable offline records, blobs, and queue.
5. Complete sync conflict UX and reconnect behavior for every editable entity.
6. Removal of whole-schedule replacement and mutable job audit arrays.
7. Automated backups of both database and object files with restore drills.
8. HTTPS, environment-based configuration, monitoring, retention, and security logging.
9. Migration tooling with counts, checksums, dry-run, and rollback.
10. Physical Android, two-technician, long-offline, reboot, and recovery acceptance tests.

## Estimated Remaining Technical Work

For one experienced engineer, with access to Realmart decisions and test phones:

- schema, migrations, Auth/RLS/API foundation: 3-5 weeks;
- IndexedDB cache/queue/evidence integration: 4-7 weeks;
- data migration tools and reconciliation: 2-4 weeks;
- deployment, backup automation, monitoring, security hardening: 2-4 weeks;
- field QA, corrections, training/runbooks: 3-5 weeks.

Reasonable V1 range: 14-25 engineer-weeks. This is a planning estimate, not a delivery promise. It excludes new product features and assumes current workflows remain stable.

## Go/No-Go Position

- **Supervised same-LAN pilot with disposable/test data:** PASS WITH CONTROLS.
- **Real field data on the current local server:** NOT READY without explicit risk acceptance and daily manual backup.
- **Internet-facing or unattended production:** NOT READY.
- **Recommended next implementation:** schema/auth/storage proof of concept followed by the offline foundation in `OFFLINE_SYNC_ARCHITECTURE.md`.
