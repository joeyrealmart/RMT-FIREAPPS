# Checklist Technical And Flow Audit

## Inventory

- 12 normal device templates with 57 configured questions.
- 5 critical SOP templates with 78 configured steps.
- Critical templates: Fire Alarm/tripping, gas/CO2, wet chemical, hose reel pump, sprinkler/hydrant pump.
- Three UOB system summary templates also exist.

The full extracted inventory is `.memory/audits/checklist-inventory.json`.

## System Review

| System/device | Current flow | Good | Flow concern | Recommendation | Classification |
| --- | --- | --- | --- | --- | --- |
| MFAP / Fire Alarm | Critical SOP before field devices; linked indications in configured steps; restoration/completion gate | Correct stage dependency and authoritative linked state | SOP and multiple linked cards produce a 6k+ px phone page | Preserve content; show one active step/group and compact linked summary | V1 before pilot |
| MCP, Smoke, Heat | Pin -> short checklist -> PASS/FAULT/N/A -> evidence -> save | Routine templates are short (4-5 questions) | Avoid repeating known job/device metadata | Autofill record context; expand fault fields only on FAULT | V1 now |
| Flow Switch | One device can participate in water-system and MFAP relationships | Correct cross-system model | Mapping depends on site configuration | Keep configuration-driven; no special-case duplication | Keep |
| Pump panels/pumps | Critical SOP with pump configuration, readings and linked indication | Captures structured pump context and standby configuration | 10k+ px phone page; many controls visible simultaneously | Group by configured Jockey/Duty/Standby sequence and render current group only | V1 before pilot |
| Hose Reel / Sprinkler / Wet Riser / Hydrant | Parent/supply relationship is configurable | Avoids invented dedicated pump prerequisites | Site master data may be incomplete/unconfirmed | Retain `UNCONFIRMED` rather than infer parent from type/count | Keep |
| Gas/CO2/FM200 | Approved critical SOP with separate linked indication | Maintains suppression-side and panel-side records | Long page; subtype content must not be combined | One configured subtype/SOP at a time; no generic technical wording | V1 before pilot |
| Wet Chemical | Dedicated configured SOP | Separate from gas subtype logic | Master hierarchy remains site-specific | Keep unchanged until master data confirmed | Keep |
| Emergency Light / Exit Sign | Short normal device template and mimic route | Manageable height and direct field workflow | Completion meaning must remain configured | Keep; use same compact PASS/FAULT presentation | V1 now |
| Extinguisher | Dedicated asset verification plus collection/return/loan workflow | Correctly avoids forcing every process into generic device card | More complex than routine PASS/FAULT | Preserve dedicated workflow; improve list search/status only | Keep |
| Fireman Intercom | Short device template | Fits routine inspection pattern | Site scope may be absent | Show only when configured | Keep |

## Technical Content Boundary

This audit does not declare any isolation, tripping, restoration, pressure, valve, pump or suppression procedure technically correct. Realmart/manufacturer/customer-approved content is authoritative. Before pilot, an RMT fire-protection SME must validate:

- required PASS, FAULT and N/A outcomes;
- which steps require evidence or readings;
- which restoration steps block completion;
- whether supervisor/acknowledgement fields remain required;
- wording and ordering for each site-approved SOP version.

## Simplification Rules

- Keep all approved fields in the record model.
- Show known context compactly; do not ask technicians to retype it.
- Render one active stage/step group rather than every later field.
- FAULT expands defect, corrective/replacement and evidence fields.
- PASS remains fast while retaining optional photo capability.
- N/A must use configured reason/evidence rules; never become a bypass.
- No technical field should be removed solely because it increases page height.

## Report Impact

Every result must retain template/SOP version, job/device identity, technician, timestamp, readings, evidence and final restoration state. Presentation simplification must not reduce report or audit data.
