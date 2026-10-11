# RMT V1 Rendered Checklist Coverage

Generated from the corrected application on 2026-10-11. The browser gate renders the real technician forms; it does not infer coverage from template flags.

## Normal Device Matrix

| System | Checklist | Add Remarks visible | PASS without remark | FAULT auto-opens remark | FAULT requires correct data | N/A handled correctly | Save and reopen | Save and Next | Critical control preserved | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Manual Call Point | Normal device inspection | Yes | Pass | Pass | Pass | Pass | Pass | Pass | N/A | PASS |
| Smoke Detector | Normal device inspection | Yes | Pass | Pass | Pass | Pass | Pass | Pass | N/A | PASS |
| Heat Detector | Normal device inspection | Yes | Pass | Pass | Pass | Pass | Pass | Pass | N/A | PASS |
| Beam Detector | Normal device inspection | Yes | Pass | Pass | Pass | Pass | Pass | Pass | N/A | PASS |
| Bell / Sounder | Normal device inspection | Yes | Pass | Pass | Pass | Pass | Pass | Pass | N/A | PASS |
| Hose Reel | Normal device inspection | Yes | Pass | Pass | Pass | Pass | Pass | Pass | N/A | PASS |
| Emergency Light | Normal device inspection | Yes | Pass | Pass | Pass | Pass | Pass | Pass | N/A | PASS |
| Exit Sign | Normal device inspection | Yes | Pass | Pass | Pass | Pass | Pass | Pass | N/A | PASS |
| Fire Door | Normal device inspection | Yes | Pass | Pass | Pass | Pass | Pass | Pass | N/A | PASS |
| Fireman Intercom | Normal device inspection | Yes | Pass | Pass | Pass | Pass | Pass | Pass | N/A | PASS |
| Flow Switch | Normal device inspection | Yes | Pass | Pass | Pass | Pass | Pass | Pass | Linked relationships remain separate | PASS |
| Other configured device | Normal device inspection | Yes | Pass | Pass | Pass | Pass | Pass | Pass | N/A | PASS |

The normal matrix rendered 57 checklist questions. PASS, FAULT, and N/A were saved and reopened for every row. `qa-tech-save-next.cjs` separately verifies the shared Save and Next handler with explicit answers.

## Critical SOP Matrix

| System aliases | Rendered checklist | Steps | Remark controls | PASS remark collapsed | FAULT remark auto-shown | Unsafe structured state blocks completion | Final restoration preserved | Result |
| --- | --- | ---: | ---: | --- | --- | --- | --- | --- |
| Main Fire Alarm Panel | Fire Alarm / Tripping SOP | 11 | 11 | Yes | Yes | Yes | Yes | PASS |
| Hose Reel Pump | Hose Reel Pump SOP | 18 | 18 | Yes | Yes | Yes | Yes | PASS |
| Sprinkler, Wet Riser, Hydrant, Jockey, Duty, Standby Electrical, Standby Diesel | Sprinkler / Hydrant Pump SOP | 18 | 18 | Yes | Yes | Yes | Yes | PASS |
| CO2, FM200, FK-5-1-12, IG55 | Gas Discharge SOP | 16 | 16 | Yes | Yes | Yes | Yes | PASS |
| Wet Chemical | Wet Chemical SOP | 15 | 15 | Yes | Yes | Yes | Yes | PASS |

The critical matrix rendered 78 SOP steps. Every step has exactly one remark control. No production demo-photo control was rendered. Pump, Gas, Wet Chemical, linked verification, staged progression, evidence, and final restoration are covered by the focused negative suites listed below.

## Specialized Workflow

| System | Checklist | Rendered proof | Result |
| --- | --- | --- | --- |
| Portable Fire Extinguisher | Frozen asset verification plus collection / return workflow | `qa-extinguisher-assets-v1.cjs`: eight mobile asset cards, serial matching, exception statuses, proposals, reconciliation, no overflow | PASS |

## Focused Test Sources

- `work/qa-v1-quality-gate.cjs`
- `work/qa-v1-quality-gate-server.cjs`
- `work/qa-tech-save-next.cjs`
- `work/qa-pump-staged-checklist.cjs`
- `work/qa-critical-dependency-sequence.cjs`
- `work/qa-fap-pump-checklist-corrections.cjs`
- `work/qa-parallel-field-workflow.cjs`
- `work/qa-linked-verification-v1.cjs`
- `work/qa-extinguisher-assets-v1.cjs`
- `work/qa-photo-timestamp-evidence-v1.cjs`

Machine-readable results are in `rendered-checklist-coverage.json` and `result.json` in this folder.
