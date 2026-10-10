---
name: rmt-offline-sync
description: Design or validate RMT FIREAPPS offline drafts, IndexedDB queues, reconnect, idempotency, and conflict handling. Use for Dexie, Workbox, offline evidence, or synchronization tasks.
---

# RMT Offline Sync

- Keep offline prototypes feature-flagged and disabled by default until physically validated.
- Use stable operation IDs, ownership, expected revisions, explicit sync states, and idempotent retries.
- Never silently overwrite newer server data or discard a local conflict.
- Keep evidence originals immutable; queue references and metadata rather than bloating startup state.
- Shared server records remain authoritative after successful reconciliation.
- Test refresh/restart persistence, duplicate save, disconnect/reconnect, rejection/conflict, and two-technician ownership.

