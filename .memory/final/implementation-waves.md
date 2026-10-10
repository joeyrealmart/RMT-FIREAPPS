# Recommended Implementation Waves

Recommendations only. Each wave is independently reviewable and reversible.

## Wave 0: Decisions And Physical Evidence

- Benefit: prevents building against assumptions.
- Work: SME SOP/version matrix, Android offline POC, two-phone Wetex test, production hosting/auth decision.
- Risk: low.
- Tests: physical Android and restore/backup drill.
- Rollback: none; no production changes.

## Wave 1: Field Quick Wins

- Work: progressive SOP disclosure, compact linked summaries, 44 px action targets, tablet mimic containment, visible save/sync state.
- Benefit: high field usability.
- Effort: medium.
- Risk: medium because stage routing must remain authoritative.
- Files: technician rendering/CSS and focused QA only.
- Tests: hierarchy, touch/scroll, Save & Next, linked verification, phone/tablet viewport.
- Rollback: feature-specific commit or flags.

## Wave 2: Checklist Governance

- Work: version/config audit, remove only confirmed duplicate presentation, preserve approved data.
- Benefit: technical confidence and lower burden.
- Effort: medium.
- Risk: high if procedures are changed without SME approval.
- Tests: every critical dependency/restoration path and report fields.
- Rollback: versioned template definitions.

## Wave 3: Mimic Hardening

- Work: zoom/pan/floor retention, clean approved backgrounds, alignment checks, offline background package.
- Benefit: faster field navigation.
- Effort: medium.
- Risk: marker misalignment.
- Tests: identity/transform, pin IDs, touch gestures, physical Android/tablet.
- Rollback: prior active background/version.

## Wave 4: Offline/Sync/Evidence

- Work: incremental Dexie adapter, idempotent queue, evidence file queue, conflict UI, later Workbox shell.
- Benefit: reliable plant-room work.
- Effort/risk: high.
- Dependencies: production auth/IDs/storage and completed physical POC.
- Tests: process kill, storage persistence, duplicate retries, conflicts, ownership, partial evidence upload.
- Rollback: disabled-by-default flag and online authoritative path.

## Wave 5: Production Backend And Reports

- Work: authenticated/TLS APIs, database/object storage, schedule revisions, backup/restore, report stress and delivery.
- Benefit: production readiness.
- Effort/risk: high.
- Tests: migration rehearsal, permissions, audit immutability, restore, load and report reconciliation.
- Rollback: export/snapshot plus parallel supervised prototype during migration.

## Wave 6: V2

- Work: approved knowledge retrieval, drawing suggestions, analytics, quotation integration.
- Benefit: future efficiency.
- Dependency: stable V1 operational data.
- Risk: high if started early.
- Rollback: independent modules; no automatic master-data changes.
