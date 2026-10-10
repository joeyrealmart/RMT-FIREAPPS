---
name: rmt-linked-verification
description: Maintain RMT FIREAPPS two-technician linked verification records and reconciliation. Use for pump indication, suppression indication, assigned sides, offline side drafts, mismatch review, or linked-verification reporting.
---

# RMT Linked Verification

- Model each required side as a separate authoritative record keyed by stable `linkedVerificationId` and `sideId`.
- Freeze side assignments and preserve technician identity, location, local completion time, result, evidence, revision, and sync state.
- One completed side means awaiting counterpart, never full verification.
- Reconcile only when all configured sides exist; conflicting results become `MISMATCH_REVIEW_REQUIRED`.
- Support offline side drafts without requiring a live heartbeat.
- Do not add operating, discharge, bypass, isolation, or activation procedures.

