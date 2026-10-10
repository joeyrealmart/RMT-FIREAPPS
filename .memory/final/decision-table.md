# Master Decision Table

`HUMAN APPROVAL` is intentionally blank.

| ID | Area | Finding/evidence | Recommendation | Benefit | Effort | Risk | Release | Red-team view | Codex final view | Human approval |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D01 | Architecture | Revisioned per-item records and frozen scope are established | Preserve; no rewrite | High | Low | Low | V1 | Accept | ACCEPTED | |
| D02 | Security | Demo auth/plain HTTP/unauthenticated APIs | Replace before real customer data or remote access | High | High | High | V1 before pilot | Agreed but mislabeled quick win | ACCEPTED | |
| D03 | Checklist UI | Pump 8.6k-10.8k px; Fire/Gas 5k+ | Progressive disclosure, one active group | High | Medium | Medium | V1 before pilot | Questioned need | ACCEPTED with no content removal | |
| D04 | Linked UI | Multiple full cards extend system pages | Compact summary plus focused editor | Medium | Low/Medium | Low | V1 before pilot | Not assessed | ACCEPTED | |
| D05 | Mimic | Phone fits; tablet landscape overflows | Fix containment and physically test position retention | High | Low/Medium | Low | V1 before pilot | Misidentified portrait | MODIFIED/ACCEPTED | |
| D06 | Offline | Dexie POC passes; production flow not integrated | Physical POC, then incremental flagged integration | High | High | High | V1.1 unless field requirement forces V1 | Modify | ACCEPTED | |
| D07 | Workbox | Build proof only | Keep unregistered until queue semantics proven | Medium | Medium | High | V1.1 | Modify | ACCEPTED | |
| D08 | Evidence | Original/stamped refs separate; local file durability unresolved | Production object/file storage, backup and partial-upload protocol | High | High | High | V1 production | Not assessed | ACCEPTED | |
| D09 | Schedule saves | Whole-schedule Admin snapshot path remains | Add schedule revision/patch writes | High | Medium/High | High | V1 production | Not assessed | ACCEPTED | |
| D10 | Reports | Structured snapshot and approval work | Keep contract; stress-test layout and evidence | Medium | Medium | Low | V1 | Not assessed | ACCEPTED | |
| D11 | Forms | Current config renderer works | Do not migrate to JSON Forms now | Low | High | High | Drop V1 | Modify | REJECTED as V1 dependency | |
| D12 | Drawing engine | Current normalized pins work | Do not add Konva/DXF runtime | Low | High | High | V2 only | Modify | REJECTED for V1 | |
| D13 | Android automation | Physical manual tests remain authority | Consider Appium after pilot, not before | Medium | Medium/High | Low | V1.1 | Modify | MODIFIED | |
| D14 | SOP content | Software content needs Realmart/site approval | SME version review; no invented procedure | High | Medium | Low | V1 before pilot | Not assessed | ACCEPTED | |
| D15 | Hosting | Local single server unsuitable for unsupervised production | Choose managed or maintained on-prem production platform | High | High | High | V1 production | Not assessed | NEEDS HUMAN DECISION | |
