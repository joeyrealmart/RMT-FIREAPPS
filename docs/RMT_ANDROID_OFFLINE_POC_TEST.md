# RMT Android Offline POC Test

This tests the isolated Dexie prototype only. It does not activate offline mode
in the normal Technician screens and must not use the Wetex fixture.

Open the local server URL on the Android phone:

`http://<PC-LAN-IP>:8026/dev/offline-poc/index.html?enable=1`

Use a unique job ID beginning with `OFFLINE-POC-`, for example
`OFFLINE-POC-JOEY-20260916`.

## A. Online persistence

1. Select Tech A and `POC Device A`.
2. Select **Save Test Draft**, then **Queue Save**.
3. Refresh; confirm Drafts remains at least 1 and Evidence Metadata retains the
   same immutable `poc-original://` reference.
4. Fully close and reopen the browser, return to the same URL and job ID; the
   draft must remain.

## B. Offline queue

5. Select **Simulate Offline: On**.
6. Confirm the persistent banner reads **OFFLINE — SAVING TO PHONE** and shows
   separate record and photo counts. Select **Retry Sync**; the queue must stay
   `PENDING` and the draft must stay.
7. Refresh/reopen once more; confirm both draft and queue remain.

## C. Reconnect/idempotency

8. Select **Simulate Offline: Off**. The POC automatically attempts the pending
   queue and must show **CONNECTION RESTORED — SYNCING**, then **SYNCING** with
   an elapsed timer. Connectivity alone must not show `SYNCED`.
9. Confirm the queue becomes `SYNCED`, pending records and photos both reach
   zero, and the banner briefly shows **ALL SYNCED** before collapsing to
   **SYNCED** with the last successful time.
10. Select **Queue Save** again without selecting **Save Test Draft**. Confirm
    the existing logical mutation remains `SYNCED`, no second queue item is
    created and no server revision is added.
11. Now select **Save Test Draft**. Confirm a new logical mutation ID appears.
    Queue and sync it; this genuinely new action must be accepted separately.

## D. Conflict and recoverability

12. Use a fresh `OFFLINE-POC-*` job ID, save a draft and queue it.
13. Select **Simulate Revision Conflict**, then **Retry Sync**.
14. Confirm state is `FAILED`, last error begins `CONFLICT`, and the local draft
    and evidence metadata are still present. The banner must show **SYNC
    INCOMPLETE**, a Retry action and separate pending photo count. Do not use
    Clear until reviewed.

## E. Two technician assignment guard

15. On Phone A use Tech A with `POC Device A` and queue/sync normally.
16. On Phone B use Tech B but select `POC Device A`, save, queue and retry.
17. Confirm Phone B receives a failed assignment rejection and its local draft
    remains. Then use Tech B with `POC Device B`; this should sync independently.

## F. Real Android lifecycle

18. With a pending operation, remove the app/browser from Recents and force-stop
    Chrome. Reopen the same URL and job ID; confirm the logical mutation ID,
    draft, queue and evidence metadata are unchanged.
19. Repeat with a phone reboot before reconnecting.
20. Disable Wi-Fi and mobile data using Android controls, create one pending
    action, restore the network and retry twice. Confirm one accepted action.

## G. Local completion versus server-safe submission

21. While one operation is pending offline, select **Mark Inspection Locally
    Complete**. Confirm **LOCAL COMPLETE — SYNC PENDING** remains visible.
22. Reconnect and allow all records and photos to synchronize. Only after all
    unresolved queue, evidence, error and conflict counts reach zero may the POC
    show **SUBMITTED — ALL SYNCED**.
23. Start synchronization and close/reload the page during the active request.
    On reopen, the interrupted `SYNCING` record must recover to retryable
    `PENDING`; it must not disappear or remain permanently stuck.

## Status state machine

- `OFFLINE`: browser/network simulation is unavailable; records and evidence
  remain local with exact pending counts.
- `RECONNECTING`: connection returned and queued work is preparing to sync.
- `SYNCING`: at least one queue operation is actively being sent; elapsed time
  counts upward and stops at terminal state.
- `INCOMPLETE`: network is available but pending/failed/conflicting work remains;
  Retry and details remain available.
- `SYNCED`: pending queue, pending evidence, failures and conflicts are all zero.

The non-blocking **MANY ITEMS WAITING TO SYNC** message appears at 20 combined
unresolved records/photos. This is a documented UX warning threshold only, not
a data or safety limit; inspection work remains available.

The current isolated POC stores evidence metadata and immutable references only;
it does not capture a real camera file/blob. Actual photo-byte durability across
force-stop and reboot remains a separate physical gate after evidence-file
storage is integrated. Do not record that item as passed from this POC.

## Clear button

**Clear POC Data** deletes only this browser's `rmt-fireapps-offline-v2-poc`
IndexedDB database. It does not delete server records, schedules, photos, Wetex
records, or normal RMT localStorage.

## Pass criteria

Drafts, queue items and metadata survive refresh/reopen; duplicate queueing is
idempotent; reconnect changes only a successful queue to `SYNCED`; conflicts and
assignment rejections remain visible and recoverable. Record Android model,
browser, network state and screenshots of unexpected states.
