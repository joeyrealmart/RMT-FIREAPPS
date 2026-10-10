# RMT FIREAPPS Wetex Retest Pack

Physical Android validation is authoritative. Stop and report any difference from the expected behavior below.

## Setup

1. Open the verified LAN URL `http://<PC-IP>:8026/` on two Android phones using the same Wi-Fi.
2. On both phones select `DEMO-WETEX-RETEST-20260924`.
3. Confirm the frozen job remains 65 items: 56 normal and 9 critical.
4. Do not open or modify protected job `DEMO-WETEX-MULTITECH-SYNC-202609`.

## Phone A

- Login: `tech@rmtfire.local` (Demo Technician).
- Confirm 33 assigned items.
- Confirm `GRD.MFAP.1` is assigned to Phone A.
- Record only the MFAP side of linked Pump/FAP tests.

## Phone B

- Login: `tech2@rmtfire.local` (Tech 2).
- Confirm 32 assigned items.
- Confirm `LG.SPP.1` is assigned to Phone B.
- Record only the Pump Room side of linked Pump/FAP tests.

## Pump/FAP Linked Test

1. On Phone B, confirm Pump Step 3 records tank dimensions in feet and calculates `L x W x H x 6.25` Imperial gallons.
2. Confirm Pump Step 5 accepts 376-440 V inclusive. A missing or out-of-range reading must require acknowledgement/remarks, block completion, and create a same-job alert.
3. Confirm normal PASS/confirm on Pump Steps 15-18 does not require remarks. Use FAIL or N/A only where applicable and confirm configured remarks appear.
4. Save one Pump Room manual-test side on Phone B.
5. Without refreshing Phone A, confirm the live linked prompt and any same-job voltage alert appear in the MFAP workflow.
6. Save a matching MFAP result on Phone A. Expected final status: `VERIFIED`.
7. Repeat one linked event with different Pump/MFAP results. Expected final status: `MISMATCH_REVIEW_REQUIRED`.
8. Attempt one wrong-owner save. It must be rejected.

## Offline/Reconnect

1. Keep one phone online and disable connectivity on the other phone.
2. Save that technician's own assigned work and photo/evidence. Confirm a local pending/unsynced state is visible.
3. Refresh or reopen and confirm the local work remains.
4. Restore connectivity and retry once.
5. Confirm the record syncs once, with no duplicate, silent overwrite, or ownership change.

## Completion/Admin Review

1. Validate PASS, FAULT, photo timestamp evidence, Save & Next, and remaining-work counts on assigned devices.
2. Complete required prerequisite, field scope, completion/restoration, and acknowledgement steps without bypassing gates.
3. Submit the completed job for Admin review.
4. Confirm the technician view becomes read-only while awaiting review and Admin can inspect shared records from both technicians.

## Pass Criteria

- Frozen scope remains 65 items and exact planned IDs do not regenerate.
- Assignment remains Phone A 33 / Phone B 32.
- Live MFAP prompt appears without reload after the Pump Room save.
- Same-job voltage alert appears on the MFAP phone.
- Matching sides become `VERIFIED`; differing sides become `MISMATCH_REVIEW_REQUIRED`.
- Offline work remains visible, syncs once after reconnect, and creates no duplicate or overwrite.
- Photo timestamp evidence, technician identity, ownership, and revisions remain intact.

## Stop Conditions

Stop immediately if the physical app changes scope, ownership, evidence, the protected old job, or silently overwrites/conflicts. A physical failure overrides automated QA and must be reported before further development.
