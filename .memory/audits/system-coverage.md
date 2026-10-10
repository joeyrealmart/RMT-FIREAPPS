# Checklist/System Coverage Matrix

This is an implementation inventory, not a technical certification.

| Requested area | Standalone configured template found | Related configured path | Audit status |
| --- | --- | --- | --- |
| MFAP | Yes: Main Fire Alarm Panel routine + Fire Alarm critical SOP | Stage 1 prerequisite and completion | Present; SME approval required |
| MCP | Yes: Manual Call Point | Fire Alarm field devices | Present |
| Smoke Detector | Yes | Fire Alarm field devices | Present |
| Heat Detector | Yes | Fire Alarm field devices | Present |
| Alarm Bell | No standalone template in extracted inventory | May be site/device data or default template | Gap: confirm master/template need; do not invent |
| Pump Panel | Covered through critical pump SOPs | Hose reel pump and sprinkler/hydrant pump SOP | Present as SOP, not separate routine template |
| Jockey Pump | Covered through pump SOP configuration | Pump group | Present; presentation is long |
| Duty Pump | Covered through pump SOP configuration | Pump group | Present |
| Standby Electrical Pump | Covered through standby pump configuration | Pump group | Present when configured |
| Standby Diesel Pump | Covered through standby pump configuration | Pump group | Present when configured |
| Hose Reel | No standalone routine template found | Hose reel pump critical SOP and configurable parent/supply | Partial; site device template/fields require confirmation |
| Sprinkler | No standalone routine template found | Sprinkler/hydrant pump SOP; Flow Switch routine template | Partial; site configuration governs |
| Wet Riser | No standalone routine template found | Pump SOP/configurable parent/supply | Partial; no inferred parent |
| Hydrant | No standalone routine template found | Sprinkler/hydrant pump SOP | Partial |
| CO2 | Gas discharge/CO2 critical SOP | Linked suppression/panel indication | Present |
| FM200 | Yes: FM200 System routine + gas SOP path | Configured suppression subtype | Present; keep subtype SOP version distinct |
| FK-5-1-12 | No standalone template found | Generic configured gas/special-suppression framework can represent it | Configuration/master data required |
| IG55 | No standalone template found | Generic configured gas/special-suppression framework can represent it | Configuration/master data required |
| Wet Chemical | Critical SOP found | Dedicated system category | Present |
| Emergency Light | Yes | Direct field/mimic workflow | Present |
| Exit Sign | Yes | Direct field/mimic workflow | Present |
| Extinguisher | Yes plus dedicated asset workflow | Collection/return/loan and verification | Present |
| Fireman Intercom | Yes | Configured field device | Present |

## Required Human Review

- Confirm whether Alarm Bell, Hose Reel, Wet Riser, Hydrant, FK-5-1-12 and IG55 need dedicated templates or are intentionally handled by configured/default paths.
- Confirm every technical step, evidence rule and N/A rule against approved Realmart/site/manufacturer content.
- Do not turn missing standalone templates into invented procedures.
