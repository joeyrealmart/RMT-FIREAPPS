# Pump Checklist Mapping

Reference template: `sprinkler-hydrant-pump-sop`

This inventory maps every existing Pump SOP step before the staged UI is applied. The implementation changes presentation only: stored step indexes, field IDs, choices, validation, evidence, technician attribution, linked-verification metadata, and report snapshots remain unchanged.

| Current step | Current question / field | Current type | Current validation | Current photo rule | Current remark rule | Current report output | Proposed stage | Proposed UI type | Change required? | Why? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Client / FM informed | Confirmation | Must be confirmed in sequence | None | Required | Existing step 1 confirmation and remark | 1. Preparation & Panel | Confirmation | CONDITIONAL | Keep technical confirmation; show only in active stage. |
| 2 | Panel condition photo before test | Confirmation + evidence | Confirmation and saved photo required | Required | None | Existing step 2 confirmation/photo | 1. Preparation & Panel | Evidence | STRUCTURE | Keep one compact photo status/thumbnail instead of a tall permanent evidence block. |
| 3 | Water Storage Condition; tank type; source; L/W/H feet or known capacity/unit; derived gallons | Selection + structured measurements/configuration | Required configured fields; dimensions/capacity calculation retained | None | Optional | Existing step 3 fields, choice, derived capacity, configuration revision | 2. Water, Suction & Electrical | Selection + measurements | STRUCTURE | Preserve all field IDs/calculation; collapse saved configuration into summary unless Change is selected. |
| 4 | Check suction and delivery valves; Confirmed By | Selection + technician attribution | Valve position required; step remains critical | Required | Existing choice rules | Existing step 4 choice/photo and logged-in technician identity | 2. Water, Suction & Electrical | Selection + evidence | CONDITIONAL | Auto-filled technician remains read-only; fault detail only when abnormal. |
| 5 | Incoming 3-phase supply R-Y / Y-B / B-R | Structured measurements | Existing 376-440 V validation and same-job alert retained | None | Required only when abnormal | Existing step 5 readings, validation and job alert | 2. Water, Suction & Electrical | Measurement | STRUCTURE | Keep three numeric inputs and automatic result; do not ask technician to restate “voltage OK”. |
| 6 | Starter Panel Pilot Lamp Check | Selection | Pass/Fail required | Required on Fail | Required on Fail | Existing step 6 result/remark/photo | 2. Water, Suction & Electrical | Status | CONDITIONAL | PASS remains one selection; fault fields expand only for Fail. |
| 7 | Optional Review | Optional text | May proceed empty | None | Optional | Existing step 7 remark | 2. Water, Suction & Electrical | Optional remark | CONDITIONAL | Keep available without blocking stage completion. |
| 8 | Standby Pump Type | Saved configuration selection | Electrical or Diesel Engine; revision-protected configuration | None | None | Existing step 8 choice/configuration revision | 2. Water, Suction & Electrical | Configuration summary | STRUCTURE | Auto-fill saved value; Change remains explicit. |
| 9 | Test Jockey Pump on Manual | Selection + linked verification | Pass/Fail required; Pump-side linked record remains independently revisioned | Existing configured rule | Required on Fail | Existing step 9 result/remark and `JOCKEY_MANUAL` link | 3. Manual Pump Tests | Status + compact linked row | CONDITIONAL | Keep linked verification authoritative; show compact counterpart status. |
| 10 | Test Duty Pump on Manual | Selection + linked verification | Pass/Fail required; Pump-side linked record remains independently revisioned | Existing configured rule | Required on Fail | Existing step 10 result/remark and `DUTY_MANUAL` link | 3. Manual Pump Tests | Status + compact linked row | CONDITIONAL | Same data, shorter presentation. |
| 11 | Test Standby Pump on Manual | Configured variant fields + linked verification | Electrical requires manual result; Diesel requires battery, oil, cooling-specific field and manual result | Existing configured rule | Required on failed variant fields | Existing step 11 variant fields and `STANDBY_MANUAL` link | 3. Manual Pump Tests | Conditional structured fields | CONDITIONAL | Show only saved Electrical or Diesel variant; preserve every field ID. |
| 12 | Test Jockey Pump on Auto; cut-in/out PSI | Selection + measurements | Pass/Fail and both pressure values required | Existing configured rule | Required on Fail | Existing step 12 result/readings | 4. Jockey Auto | Status + measurements | STRUCTURE | One short active stage. |
| 13 | Test Duty Pump on Auto; cut-in/out PSI | Selection + measurements | Pass/Fail and both pressure values required; existing sprinkler manual-stop behavior retained | Existing configured rule | Required on Fail | Existing step 13 result/readings | 5. Duty Auto | Status + measurements | STRUCTURE | One short active stage. |
| 14 | Test Standby Pump on Auto; cut-in/out PSI | Selection + measurements | Pass/Fail and both pressure values required; existing sprinkler manual-stop behavior retained | Existing configured rule | Required on Fail | Existing step 14 result/readings | 6. Standby & System Test | Status + measurements | STRUCTURE | Keep pressure fields together with standby/system stage. |
| 15 | Breeching inlet and alarm valve | Selection | Pass/Fail/N.A. per current template | None | Required on Fail or N.A. | Existing step 15 choice/remark | 6. Standby & System Test | Status | CONDITIONAL | N.A. remains only where currently permitted and needs reason. |
| 16 | Zone isolating butterfly valves | Critical selection | All Open / Some Closed / N.A.; sequential gate retained | Required | Required on Some Closed or N.A. | Existing step 16 result/photo/supervisor | 7. Restore Normal & Complete | Critical confirmation | CONDITIONAL | Keep deliberate restoration evidence; do not auto-pass. |
| 17 | Selector returned to AUTO | Critical confirmation | Must be deliberately confirmed in sequence | Required | Current no-remark behavior retained | Existing step 17 confirmation/photo/supervisor | 7. Restore Normal & Complete | Critical confirmation | KEEP | Explicit restoration gate remains strong. |
| 18 | Final pressure and panel normal | Critical confirmation + reading | Confirmation and final reading required | Required | Current no-remark behavior retained | Existing step 18 reading/photo/supervisor | 7. Restore Normal & Complete | Critical measurement | STRUCTURE | Keep final pressure and panel-normal evidence in the final stage. |

## Classification Summary

- **KEEP:** all 18 technical steps and their existing stored indexes.
- **REWORD:** none in this implementation; approved SOP wording remains unchanged.
- **MERGE:** none. Visually grouped stages do not merge stored records.
- **CONDITIONAL:** fault remarks/photos, configuration editing, variant fields, and optional review visibility.
- **STRUCTURE:** stage navigator, compact linked status, structured measurements, configuration summary, and compact evidence status.
- **REMOVE-CANDIDATE:** none approved; nothing is deleted.

## Stage Sequence

The current technical sequence is preserved exactly:

1. Preparation & Panel: steps 1-2
2. Water, Suction & Electrical: steps 3-8
3. Manual Pump Tests: steps 9-11
4. Jockey Auto: step 12
5. Duty Auto: step 13
6. Standby & System Test: steps 14-15
7. Restore Normal & Complete: steps 16-18

This grouping intentionally follows the existing contiguous order rather than rearranging checks to fit a cosmetic label.
