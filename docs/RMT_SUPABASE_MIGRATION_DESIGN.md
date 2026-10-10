# RMT Supabase Migration Design

## Decision

Architecture only. No V1 database migration, paid dependency, credentials or hosted project is created.

## Future PostgreSQL mapping

| Current concept | Future table |
| --- | --- |
| client/site/floor master | `clients`, `sites`, `floors` |
| staff and roles | `users`, `technicians` |
| schedules and assigned work | `jobs`, `job_assignments`, `job_scope` |
| site equipment | `devices` |
| individual results and defects | `inspections`, `defects` |
| photo originals/derivatives | `evidence` |
| activity/audit | `activity_events` |
| report lifecycle | `reports`, `report_versions` |
| two-tech checks | `linked_verifications` |
| extinguisher register | `extinguisher_assets` |

## Security and sync shape

- Authentication maps user identity to a role and technician record.
- Row-level security limits technicians to assigned jobs and job scope; administrative review is role-gated.
- Evidence storage uses private paths and signed, short-lived retrieval.
- All mutable entities carry stable IDs, revisions and idempotency operation IDs.
- Audit events are append-only; corrections create new events rather than replacing history.
- Offline queues reconcile against expected server revision and show conflicts rather than last-write-wins.

## Hosting and backup

The future production target may be a self-hosted Realmart server near Synology, or a managed Supabase deployment only after a cost/security review. Backups must cover PostgreSQL, private evidence, configuration and restore drills, with an eventual off-site copy.

## Appwrite

Appwrite is not recommended for this roadmap now. Running both Appwrite and Supabase would duplicate migration, permissions and sync work without a V1 need.
