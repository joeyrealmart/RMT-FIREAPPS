# Field Technician And Admin Flow Audit

## Golden Technician Flow

`Login -> Today's Jobs -> Open/Resume -> System -> Current Stage -> Mimic -> Pin -> PASS/FAULT/N/A -> Evidence/remark only when required -> Save & Next or Save to Mimic -> Completion -> Submit`

Keep visible at all times: site/job, active system/stage, device/location, progress, fault/pending-sync state and next primary action.

## Golden Admin Flow

`Login -> Control Desk -> attention queue -> job/report/defect detail -> approve, return or follow up -> return to preserved queue/filter`

Admin should manage exceptions: not started/overdue, no meaningful activity, unsynced work, critical faults, linked mismatches, reports awaiting review and pending suggested pins.

## Objective Findings

- Login is fast in headless browser (267-392 ms); job opening is normally 374-425 ms with one 2.5 s cold outlier.
- Phone horizontal overflow is resolved for tested technician routes.
- System/SOP pages remain very tall; Pump is the highest burden.
- Tablet landscape mimic sizing is not contained.
- Current system cards have adequate 48-94 px actions; isolated 34-42 px buttons and native inputs remain.
- Browser tests do not replace real sunlight, camera, keyboard, glove, weak-network and process-kill testing.

## V1 Priorities

1. Progressive disclosure without changing approved data.
2. Persistent system/stage context and one dominant next action.
3. Visible sync/conflict state adjacent to Save.
4. Tablet landscape containment.
5. Production security/backup boundary before real customer data.

## V1.1

- Production IndexedDB queue after physical proof.
- Better Admin exception and activity views.
- Report layout hardening and client delivery.
- Real-device automated tests if Appium adds value after manual pilot.

## V2

- Drawing intelligence/import suggestions with human approval.
- Knowledge retrieval and troubleshooting assistance limited to approved content.
- Analytics, quotation integration and predictive maintenance only after trustworthy operational data exists.
