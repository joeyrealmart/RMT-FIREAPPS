# RMT Technician Physical Test Pack

Use the same active test job throughout each sequence. Do not alter sampling or regenerate `plannedDeviceIds`.

Review URL: `http://192.168.0.129:8026/?fresh=20260916-tech-review`

## Desktop

1. Log in as Technician and open the assigned job.
2. Choose one system from the left sidebar; confirm only that system appears.
3. Open one device/task and record PASS or FAULT.
4. Use Save & Next and confirm the next assigned task opens.
5. Use the application Back controls to return to System and Home without browser Back.

## Android

1. Open Home and confirm large system cards and the five-item bottom navigation.
2. Open a system and one assigned device.
3. Record PASS or FAULT and attach a photo where required.
4. Use Save & Next; confirm progress updates and the next assigned task opens.
5. Open Mimic and confirm only service-scope pins appear.
6. Use Back to System List and Back Home; decline the unsaved-change warning once to confirm data is retained.
7. Check FAP/SPP: linked auto-fill source, optional remarks, decimal battery value, and Jockey -> Duty -> configured Standby order.

## Wetex Two-Phone

Test job: `DEMO-WETEX-MULTITECH-SYNC-202609`

- Frozen scope: 56 normal devices + 9 critical items = 65 total.
- Phone A: `tech@rmtfire.local`, 33 assigned items.
- Phone B: `tech2@rmtfire.local`, 32 assigned items.
- Do not regenerate or edit `plannedDeviceIds` during this test.

1. Both phones open the same Wetex job. Confirm each phone shows only its assigned work and the combined job progress agrees.
2. Confirm system icons and colors are consistent: navy current, grey not started, amber pending, green pass/complete, red fault.
3. Open one assigned device on each phone. Confirm Technician, Technician ID, job, client, site, system, device, floor/location, and time are already in the record/context and are not requested as manual fields.
4. On Phone A, select PASS for the checklist questions, attach optional evidence, and tap `SAVE & NEXT`. Confirm the next Phone A device opens.
5. On Phone B, select FAULT for one question. Confirm defect/corrective fields expand only after FAULT; add required evidence and tap `SAVE & NEXT`.
6. Save different devices at nearly the same time. Refresh both phones and confirm both authoritative records and combined progress remain.
7. Attempt to edit a device assigned to the other technician. Confirm the wrong-owner save is rejected.
8. Rapidly tap save twice on one device. Confirm only one logical result exists and progress increases once.
9. Open Mimic in `ORIGINAL`, then `CLEAR`. Confirm both use the same separate authoritative pin layer and only current service-scope pins appear.
10. Disconnect Phone B from Wi-Fi/mobile data. Record one draft and evidence, then refresh/reopen. Confirm the local draft remains visibly unsynced and job submission stays blocked.
11. Reconnect Phone B. Use the approved POC retry control only for the isolated offline proof; production Dexie/Workbox remains disabled. Confirm one sync attempt creates no duplicate and does not overwrite newer shared work.
12. Complete Pump and CO2 linked-verification sides using the configured assignments. Confirm one side alone shows Awaiting Counterpart and both matching sides reconcile to Verified.
13. Open the Fire Alarm Panel checklist. Confirm the authoritative Pump/CO2 linked result auto-fills the configured indication step. Do not manually invent a result.
14. For configured pump work, confirm standby type is reused after first selection and the sequence remains Jockey -> Duty -> configured Standby.
15. Complete both technician scopes, critical prerequisites, and final restoration/completion. Confirm combined progress is 65/65 before submission.
16. Submit the job for Admin review. Confirm both phones become view-only and display Awaiting Admin Review.
17. In Admin, verify both technician identities, timestamps, PASS/FAULT results, evidence, meaningful activity, linked verification, and report data before approval.
18. Approve the report and confirm the approved state remains after refresh on Admin and both phones.

Record any tap delay, unexpected scroll, missing pin, duplicate save, stale status, or ownership bypass before continuing field use.

## UX-LAB Follow-up

1. On Android, confirm the Original/Clean toggle, floor button, and completion Clear action remain comfortable to tap despite measuring below the preferred 44 px height in automation.
2. Confirm the deterministic journeys match the physical order: Login -> Job -> System -> Mimic -> Device -> Save -> Remaining Work.

## LTK Revision 2 Review

Open the local LTK review page and compare Main Panel, Feed Mill, and Egg Production using Original, Clean, Overlay, and Side-by-side views. Approve only clearly preserved walls, partitions, openings, beams, and staircase lines. Flag missing door arcs, diagonals, curves, labels, or any line that cannot be confirmed from the source. Do not integrate the backgrounds or process another client until Joey approves LTK.
