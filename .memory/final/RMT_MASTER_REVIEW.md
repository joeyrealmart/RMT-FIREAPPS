# RMT FIREAPPS V1 + V2 Master Review

Date: 2026-10-04  
Mode: audit/discovery/testing only  
Production changes: none  
Audit completion: 94%; blocked items are physical-device evidence and two external-worker integrations.

## 1. Executive Summary

RMT FIREAPPS has a credible supervised V1 pilot foundation: frozen job scope, revisioned per-item records, critical dependencies, linked verification, evidence metadata, report review and extensive focused QA. It should **not** be rewritten. It is not ready for unsupervised production or direct internet exposure because production authentication/TLS, durable offline sync, evidence storage/backup and schedule-level concurrency remain incomplete.

The highest measured field burden is not login performance or phone-width overflow. It is long critical-system pages: Pump reaches 8.6k-10.8k px; Fire Alarm and Gas exceed 5k px. The first implementation wave should progressively disclose existing approved content, compact linked-verification presentation, contain tablet mimic width and improve visible sync state without changing business logic.

## 2. Infrastructure/Workers Actually Used

- Graphify: PASS, targeted queries against a 4,498-node graph.
- Playwright/Node: PASS, five responsive viewports, writes blocked.
- Git/PowerShell: PASS, baseline/worktree inventory.
- Ollama `qwen2.5:1.5b-instruct`: PASS for bounded challenge, but factual errors required rejection.
- Official web documentation: PASS for bounded discovery.
- Freebuff: TECHNICAL BLOCKER; installed package exists, but invocation attempted runtime mutation/download outside audit scope.
- Antigravity: INTEGRATION BLOCKER; installed/session logs exist, no verified Codex bridge.
- Mobile MCP: prior handshake only; no physical device.
- Leantime: unavailable; Markdown task seed created.

## 3. Current V1 Readiness

| Area | Score | Evidence |
| --- | ---: | --- |
| Checklist Content | 7/10 | Broad configured coverage; SME/version sign-off still required |
| Checklist Flow | 6/10 | Correct stages/dependencies; very long SOP pages |
| Phone UX | 7/10 | No measured overflow, good system-card targets; excessive vertical composition |
| Tablet UX | 5/10 | Uses width poorly and landscape mimic overflows |
| Drawer/Navigation | 7/10 | Clear system grouping and proposed persistent rail; position-dependent movement remains |
| Drawing/Mimic | 7/10 | Stable normalized pins and scope filtering; physical position retention unproven |
| Offline | 4/10 | Strong isolated proof, not production-integrated |
| Sync UX | 6/10 | Online revision/conflict behavior good; offline state not general |
| Evidence | 7/10 | Original/stamped separation and QA; production file durability unresolved |
| Reports | 7/10 | Structured snapshot and review states; realistic-volume/customer validation pending |
| Field Experience | 6/10 | Core journey works; long critical pages and offline uncertainty remain |
| V2 Direction | 7/10 | Sensible separation from V1; must remain locked until operational data exists |

Overall V1 readiness: **6.3/10**.  
Supervised field readiness: **6.0/10, physical testing required**.

P0 verified: **0**. This is not a declaration that no P0 exists.  
P1 verified: security boundary, production offline gap, schedule snapshot risk, evidence durability gap, tablet landscape overflow and physical validation gap.

## 4. Top 10 Problems

See `.memory/final/top-problems.md`. The first five are production security, production offline, long SOP pages, whole-schedule writes and evidence durability.

## 5. Top 10 Quick Wins

See `.memory/final/quick-wins.md`. The first implementation candidate is progressive disclosure plus compact linked rows, not a redesign.

## 6. Checklist Technical Recommendations

Inventory: 12 device templates/57 questions and five critical templates/78 steps. Preserve approved content and template/SOP versioning. Require a Realmart technical approver to classify required PASS/FAULT/N/A, photos, readings and restoration for every critical template. Never infer site pump/supply or suppression relationships.

## 7. Checklist Flow

Keep `System Check -> Field Devices -> Completion`. Render only the current stage or configured step group. Keep FAULT-specific fields collapsed until FAULT, PASS fast, N/A reason governed by configuration, and all known technician/job/device metadata autofilled in records.

## 8. Phone UX

Read-only browser evidence: login ready 267-392 ms; normal job open 374-425 ms with one 2.5 s cold outlier. No overflow at 360/390/430 px. Long content remains the main issue: Pump up to 10,834 px, Fire Alarm 6,726 px and Gas 6,976 px.

## 9. Tablet UX

Portrait remains vertically long. Landscape mimic/emergency views exceed the 1,024 px viewport by roughly 171-194 px. Fix containment before testing split view. Do not simply stretch the phone layout.

## 10. Drawer/Navigation

Home-to-system is two taps. Cross-system navigation becomes position-dependent after scrolling. Preserve persistent desktop rail/mobile drawer, current system, progress and fault/pending indicators. Avoid multiple equal-priority navigation actions.

## 11. Drawing/Mimic

Classification: **KEEP AND ENHANCE CURRENT**. Background and authoritative normalized pins are correctly separate. Service-scope marker filtering and locked-pin explanation exist. Fix landscape containment and physically prove floor/zoom/pan retention after Save/restart. Do not add Konva/DXF runtime for V1.

## 12. Offline

The Dexie POC proves draft persistence, queue idempotency, conflicts and ownership in isolation. It does not prove the production technician flow. Physical Android POC is the next gate; integration should be incremental and disabled by default.

## 13. Sync

Online per-item revisions and idempotency are the correct authority. Same-item stale writes conflict; different items remain independent. Remaining risks are schedule snapshot writes, offline retries, auth expiry and partial evidence upload.

## 14. Evidence

Photo Timestamp WIP separates original/stamped references and avoids base64 in shared records. Production storage, retention, privacy, backup and interrupted-upload behavior require decisions and testing.

## 15. Reports

Keep the structured snapshot contract. It includes critical/normal results, technician/timestamp, faults, evidence, linked verification, extinguishers, coverage and suggested-pin filtering. Stress-test pagination, long notes and missing evidence. pdfme is a candidate for a controlled layout pilot, not an automatic replacement.

## 16. Field Technician Experience

Golden flow: `Jobs -> System -> Current Stage -> Mimic -> Pin -> Result -> Conditional Evidence -> Save & Next/Mimic -> Completion -> Submit`. The technician should always see location/context, remaining count, sync state and one dominant next action.

## 17. V2 Review

V2 should be post-operational enhancement: approved knowledge retrieval, human-reviewed drawing suggestions, analytics, quotations and maintenance intelligence. It must not delay production security, offline reliability or the Wetex pilot.

## 18. V1/V2 Recommendations

- V1 now: supervised online pilot, field UI reduction, tablet containment, physical evidence and two-phone tests.
- V1 before real data: auth/TLS/authorization, backup/restore, evidence durability, schedule revisions.
- V1.1: incremental production offline queue, report delivery, Appium if justified.
- V2: AI/drawing/analytics/quotation modules with human approval.

## 19. Find Skills Discovery

Existing RMT skills already cover technician UI, core records, offline sync, mimic, reporting and release QA. No additional generic skill is necessary before the next implementation wave.

## 20. Agent Discovery

No new autonomous coding agent is recommended. Local deterministic tools plus Codex for medium/heavy integration remain safer. Freebuff and Antigravity integration should be repaired only in a separate tooling task if their independent review value is still desired.

## 21. MCP Discovery

Mobile MCP is the only near-term capability addition with clear value, once a physical device is connected. GitHub/database/CAD MCPs add little before the production backend and drawing strategy are finalized.

## 22. Library/GitHub Discovery

Shortlist: Dexie, Workbox, pdfme, PDF.js and Appium. Dexie/Workbox/pdfme are already evaluated or pinned. JSON Forms, Konva and DXF viewers are rejected for V1 due to overlap and migration risk.

## 23. API Discovery

No paid API is required for V1. Production hosting/auth/object storage is an architecture decision, not a quick API add-on. Cloud drawing conversion and device farms are not justified before local pilot evidence.

## 24. Drawing Tool Discovery

Best V1 solution remains optimized clean backgrounds plus normalized pins and human-reviewed transforms. PDF.js may support Admin source viewing. Direct DXF/CAD runtime rendering remains V2/review-lab territory.

## 25. Cost/Credit Saving Opportunities

Use `rg`/Graphify for scope, Playwright for measurements, scripts for inventories, OpenCV/DXF tools for assets and Ollama only for low-stakes classification. Reserve Codex for data integrity, production integration and difficult bugs. Do not add agents that duplicate these capabilities.

## 26. What Should Not Change

- Revisioned per-item shared records and server authority.
- Frozen `plannedDeviceIds`, annual 10/20/30 selection and critical 100% rules.
- Dependency and final restoration gates.
- Linked-side ownership and mismatch behavior.
- Separate mimic background and normalized pin records.
- Original/stamped evidence separation.
- Report submission/read-only/Admin-return states.
- Approved SOP content without SME authorization.

## 27. Tool Shortlist

- Skills: existing `rmt-core`, `rmt-technician-ui`, `rmt-offline-sync`, `rmt-mimic`, `rmt-reporting`.
- Agents/workers: Graphify, Playwright, deterministic Node/Python, bounded Ollama, Codex only for implementation.
- MCP: Mobile MCP; no other immediate addition.
- Libraries: Dexie, Workbox, pdfme, optional PDF.js; Appium as test framework.
- APIs: none immediately approved.

## 28. Implementation Waves

See `.memory/final/implementation-waves.md`. Wave 0 is decisions/physical evidence; Wave 1 is field quick wins; architecture/offline follows only after gates.

## 29. Risks

Primary risks are data loss/conflict, unauthorized access, evidence loss, SOP misconfiguration, pin/background misalignment and overengineering before field evidence.

## 30. Agent Disagreements

The local Ollama reviewer incorrectly attributed overflow to tablet portrait, questioned physical Android authority and treated security work as a quick win. Deterministic measurements and confirmed requirements overruled these claims. Freebuff/Antigravity did not provide findings due integration blockers.

## 31. Red-Team Findings

- Progressive disclosure is justified by measured height, but must not remove technical fields.
- New form/canvas frameworks are unjustified.
- Offline integration remains high-risk despite a passing POC.
- Security cannot be deferred once real data or remote access begins.
- Playwright success must not be reported as physical Android success.

## 32. Blocked Validation

- Physical Android phone/tablet gestures, camera, process kill and offline storage.
- Real two-phone simultaneous/conflict field run for the final build.
- Freebuff and Antigravity independent second opinions.
- Production backend/auth/backup restore because no production platform is active.
- Full technical SOP correctness pending Realmart SME review.

## 33. Questions For Human

See `.memory/final/questions-for-human.md`: hosting, offline pilot gate, SOP approver, evidence retention/GPS and actual tablet use.

## 34. Final Codex Recommendation

Proceed with a controlled Wave 0/1: run the Android/two-phone/offline proof, approve SOP ownership, then implement only progressive disclosure, compact linked status, touch-target and tablet containment fixes. In parallel decide production auth/storage/backup. Do not rewrite the frontend, pin engine, checklist engine or shared-record model, and do not begin V2 until the supervised Wetex pilot is stable.
