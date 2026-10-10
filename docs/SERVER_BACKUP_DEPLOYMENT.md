# RMT FIREAPPS Server, Backup, and Deployment

Audit baseline: `fae1495b47f04da37767dabcd179fdc3f73f5abc`  
Status: proposed production topology and operations runbook outline.

## Recommended V1 Topology

```text
Technician Android / Admin browser
        |
        | HTTPS 443
        v
Managed Auth + API gateway
        |
        +-> PostgreSQL (authoritative records, revisions, audit)
        |
        +-> Private object storage (evidence, reports, mimic backgrounds)
        |
        +-> monitoring and security logs

Scheduled encrypted export worker
        |
        v
Realmart Synology
        |
        +-> versioned local backup/snapshots
        +-> encrypted off-site backup copy
```

Recommended concrete starting point: one managed Supabase Pro project in the nearest acceptable region, with PostgreSQL, Auth, private Storage buckets, Row Level Security, and independent Synology exports. Supabase documents RLS-based database/storage access and warns that database backups do not include Storage objects, so both layers must be backed up separately: [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [database backups](https://supabase.com/docs/guides/platform/backups).

## Component Placement

### Managed cloud

- **Database:** schedules, frozen job items, masters, inspections, defects, revisions, conflicts, sign-off/report state, and immutable audit events.
- **Authentication:** user credentials, password reset, session tokens, disabled status, and MFA for Admin/Supervisor.
- **Object storage:** private evidence originals/derivatives, report PDFs, signatures, mimic backgrounds, and approved source documents.
- **API/server functions:** privileged operations such as Admin approval, schedule freeze, final completion, report snapshot creation, and signed URL issuance.
- **Monitoring:** uptime, API errors, auth failures, storage growth, queue backlog, backup success, and security events.

### Realmart Synology/home location

- Encrypted independent database exports.
- Versioned copy of private object storage.
- Application release artifacts and SQL migrations.
- Restore verification workspace.
- Not the only live production database.
- SMB and DSM management interfaces remain private and are never published to the Internet.

### Optional mini PC

- Runs scheduled export/verification jobs close to Synology.
- May host a read-only recovery build after a successful restore drill.
- Does not store browser-visible service keys in the web bundle.
- Uses a UPS, automatic restart, disk monitoring, OS updates, and restricted service account.

## Alternative: Realmart-Controlled Primary Server

If Realmart rejects managed cloud, use this minimum topology:

```text
Internet
  -> identity-aware VPN or hardened HTTPS reverse proxy
  -> dedicated mini PC
       -> containerized API
       -> PostgreSQL on private localhost/network only
       -> private evidence object/file service
       -> scheduled backup agent
  -> Synology backup target on private LAN
  -> encrypted off-site backup
```

Rules:

- Never expose PostgreSQL, SMB, Synology DSM, or backup ports publicly.
- Prefer each phone connecting to an authenticated HTTPS service. If Tailscale is chosen, use business accounts, device removal, least-privilege grants, and a tagged server. Tailscale Standard is USD 8/user/month as of the audit date, about USD 80/month for ten seats. [Pricing](https://tailscale.com/pricing) and [remote-access guidance](https://tailscale.com/docs/use-cases/vpn-replacement/secure-access).
- Run PostgreSQL on the mini PC, not directly from a Synology shared folder.
- Use Synology as backup/object archive, not as an uncoordinated live JSON store.
- Require UPS for mini PC, router/ONT, and Synology.
- Contract an IT maintainer for patching, certificate rotation, monitoring, and restore incidents.

## Home Internet Failure

### Managed-cloud recommendation

- Technicians with mobile Internet continue normally.
- Office/home users can use alternate Internet.
- Phones already carrying downloaded jobs can continue offline and queue work.
- Synology export jobs pause and resume after home Internet returns.
- Cloud service failure still requires offline queue and status communication.

### Home-hosted primary alternative

- Remote phones cannot sync while home power/Internet/server is unavailable.
- Phones with downloaded jobs can continue locally, but submission and Admin review remain blocked.
- Recovery requires Internet/power restoration or failover to a tested off-site server.
- A mobile hotspot is not a production failover plan unless tested, secured, and documented.

## Backup Policy

### Targets

- **RPO:** maximum 24 hours for full disaster loss, maximum 15 minutes for database service failure once production volume justifies continuous/PITR protection.
- **RTO:** 8 business hours for ordinary restore, 24 hours for full site/hardware disaster during V1.

RPO means acceptable data loss window. RTO means acceptable service restoration time. Offline phone records not yet synced are outside server backup and must be protected by IndexedDB until upload.

### Database

1. Provider daily backup retained at least seven days.
2. Nightly encrypted logical export to Synology.
3. Weekly full export retained 12 weeks.
4. Month-end export retained 12 months.
5. Schema migrations, migration manifest, row counts, and checksums saved with every export.
6. Quarterly restore into an isolated database and automated reconciliation test.

If faster than 24-hour RPO is required, enable provider PITR only after cost approval or add frequent WAL/managed recovery support. Supabase currently lists PITR as a separate paid add-on; recheck current pricing before purchase.

### Evidence/object files

1. Nightly incremental object sync to an encrypted Synology repository.
2. Verify object key, byte count, and SHA-256 against database evidence rows.
3. Keep deleted-object versions for at least 30 days, subject to customer/privacy policy.
4. Weekly inventory reports identify missing objects and orphaned objects.
5. Monthly encrypted off-site copy to a second NAS or approved cloud backup.

Database backups alone are insufficient because managed database backups may retain only object metadata, not the objects themselves.

### Synology

- Use a dedicated backup account with no interactive Admin rights.
- Enable encryption for off-site Hyper Backup tasks and protect the encryption key separately.
- Use versioned backups and Btrfs snapshots where the model supports them.
- Keep at least one off-device/off-site copy. A snapshot on the same NAS does not protect against theft, fire, or total hardware loss.
- Alert on failed backup, low capacity, SMART/storage-pool warning, and ransomware-like change volume.
- Synology documentation supports Hyper Backup and remote snapshot replication as distinct protection mechanisms: [DSM user guide](https://global.download.synology.com/download/Document/Software/UserGuide/Os/DSM/7.2/enu/Syno_UsersGuide_NAServer_7_2_enu.pdf).

## Restore Procedure

1. Declare incident and stop writes if data integrity is uncertain.
2. Record current service/database/object versions and preserve logs.
3. Select the latest known-good database backup and matching object inventory.
4. Restore into an isolated environment, never over the only remaining copy.
5. Apply schema migrations to the expected application release.
6. Verify row counts by entity, foreign keys, report snapshot hashes, and evidence checksums.
7. Run smoke paths: login, assigned job load, inspection read, evidence read, sign-off/report read, Admin review.
8. Reconcile queued phone operations against restored server revisions; do not bulk replay blindly.
9. Switch traffic only after owner/technical approval.
10. Preserve the incident copy and produce a loss/recovery report.

## Authentication and Roles

### Roles

- **Technician:** see assigned jobs/scope, create assigned-side inspection/evidence/proposals, submit completed work, no master-data approval.
- **Supervisor:** technician permissions plus review/reopen assigned work and resolve approved operational conflicts as configured.
- **Admin:** manage clients/sites/masters/schedules/users, approve reports/proposals, view audit. Destructive master changes require audit and preferably second confirmation.

### Required behavior

- Individual account per person; no shared technician password.
- Strong password policy and password reset through verified company email or controlled Admin process.
- MFA required for Admin/Supervisor, recommended for technicians where practical.
- Short-lived access token with secure refresh mechanism; no credentials in `localStorage`.
- Disabled staff immediately lose new API access; existing device sessions are revoked.
- Server validates role, assignment, site/client access, record revision, and allowed status transition on every request.
- Device logout clears tokens and encrypted local cache keys, but preserves recoverable unsynced data until safely transferred or explicitly handled by Admin.
- Session/device list lets Admin revoke a lost phone.

## Network and Application Security Baseline

- HTTPS only; HSTS after deployment validation.
- Private object buckets, authenticated/signed short-lived reads.
- RLS or server authorization for every tenant/site/job table.
- Service-role keys only on trusted backend, never in JavaScript.
- Environment variables or secret manager, not repository constants.
- Request size limits by endpoint and content type.
- Decode and verify file magic bytes, dimensions, duration, and checksum.
- Random server-generated object keys; sanitize display filenames.
- Rate limits on login, upload, export, and mutation endpoints.
- Content Security Policy, `X-Content-Type-Options`, restrictive frame policy, and safe referrer policy.
- Structured logs with request ID, user ID, device ID, action, entity ID, status, and latency. Never log password/token/photo bytes/signature bytes.
- Append-only audit table with restricted update/delete privileges.
- Dependency and package vulnerability checks in CI once a package system is introduced.
- Production, staging, and developer data are separate projects/databases.

## Deployment Pipeline

1. Merge only reviewed checkpoints to `main`.
2. CI runs syntax, unit/integration, mobile DOM, migration, security, and secret scans.
3. Build immutable frontend artifact with version/SHA.
4. Apply database migration to staging and run reconciliation tests.
5. Deploy API/frontend to staging and execute release acceptance.
6. Take production backup and record rollback version.
7. Apply backward-compatible migration.
8. Deploy production artifact gradually, monitor error/sync queues.
9. Run post-deploy smoke test on Admin and physical Android.
10. Roll back application first if necessary; database rollback follows an explicit compatible migration plan, not an ad hoc restore.

## Monitoring and Alerts

Alert on:

- API unavailable for five minutes;
- authentication failure spike;
- queue conflict/failure backlog;
- evidence upload errors or checksum mismatch;
- report approval blocked by missing evidence;
- database or object storage above 70/85/95%;
- nightly backup/export failure;
- restore verification failure;
- abnormal Admin/master-data activity;
- job records referencing missing device/system/template versions.

## Cost Direction

### Managed V1 estimate

- Managed backend base: from USD 25/month.
- Expected initial usage: likely within included 100 GB object storage and 250 GB egress, but high-photo usage could exceed 100 GB within a year.
- Independent Synology capacity/electricity already owned or separately budgeted.
- Optional domain/email/monitoring costs depend on existing Realmart services.
- Practical initial service budget: USD 25-75/month, excluding engineering and any new hardware.

### Self-hosted primary estimate

- Mini PC, mirrored/replaceable storage, UPS, router/ONT UPS, and spare media are up-front costs.
- Ten-seat Tailscale Standard: approximately USD 80/month at current pricing if used for all staff.
- Power, Internet, off-site backup, and IT maintenance remain additional.
- A free WireGuard setup reduces software cost but increases owner/maintainer workload and recovery risk.

This comparison is why managed cloud plus Synology backup is recommended for V1.

