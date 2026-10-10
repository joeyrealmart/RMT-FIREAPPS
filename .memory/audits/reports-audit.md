# Reports Audit

## Current Strengths

- Structured `rmt-report-snapshot-v1` separates critical items and normal device records.
- PASS/FAULT totals are derived from authoritative records.
- Technician identity, timestamps, evidence references, linked verification and extinguisher reconciliation are represented.
- Suggested pins are filtered to the active job/site/floor (BUG-029 regression coverage).
- Approved snapshots are persisted and do not embed base64 evidence blobs.
- Admin review, return for correction and approval states exist.

## Open Gaps

- Customer-facing layout and management summary need final field review with real report volume.
- Evidence files require production storage/backup guarantees.
- Approval authorization is not production-grade while APIs are unauthenticated.
- Email/client delivery and quotation workflow remain later phases.
- Report rendering needs pagination, long text and missing-image stress tests using real-sized data.

## Recommendation

Keep the current report snapshot contract. Improve templates and review workflow without rebuilding record aggregation. pdfme remains a credible local/self-hosted renderer candidate already proven in isolation; adoption should follow a side-by-side report pilot rather than replacing the current report immediately.
