# RMT FIREAPPS Project Tree

Updated: 2026-10-04  
Audit checkout: `review/technician-navigation` at `c2566578be019bf369f86be593a8b05b34ccf2ef`

## Runtime V1

| Area | Current implementation |
| --- | --- |
| Browser application | `outputs/fire-inspection-mvp/index.html`, `styles.css`, `app.js` |
| Local server/API | `work/serve-fire-inspection-mvp.mjs` |
| Users and roles | Browser role state plus demo users in `app.js`; server endpoints are not production-authenticated |
| Scheduling | Schedule UI and scope functions in `app.js`; schedule JSON persistence in the local server |
| Annual scope | `getMaintenanceScopeDevices()` and related cycle/reservation helpers in `app.js`; QA in `work/qa-annual-scope-rotation.cjs` |
| Inspections | Per-device UI and save flow in `app.js`; revisioned records in server shared-job store |
| Device checklists | `checklistTemplates` in `app.js`: 12 templates, 57 configured questions |
| Critical/system SOPs | `criticalSopTemplates` in `app.js`: Fire Alarm, gas/CO2, wet chemical, hose reel pump, sprinkler/hydrant pump; 78 configured steps |
| Dependencies | Configuration-driven critical workflow definitions and gate evaluation in `app.js`; server validation remains authoritative |
| Linked verification | Generic linked event/side records in `app.js` and the local server; `work/qa-linked-verification-v1.cjs` |
| Extinguishers | Existing collection/return form plus serial-based asset verification in `app.js` and shared server data |
| Evidence | Original/stamped evidence metadata and files; Photo Timestamp WIP in `app.js` and server; focused QA script |
| Mimic/drawing | Background floor assets plus normalized device pins in `app.js`; clean-background manifests under `assets/mimics/` |
| Reports | Structured report snapshot and Admin review UI in `app.js`; archive/export endpoints in server |
| Suggested pins | Technician request plus Admin approve/adjust/reject; frozen job scope remains unchanged |
| Shared records | Per-item inspection, SOP, sign-off, linked-side, and report records with revisions/idempotency in server |

## System Coverage Present

- Fire alarm/MFAP, MCP, smoke, heat, flow switch and Fireman Intercom data paths exist.
- Pump, hose reel, sprinkler/wet riser/hydrant, gas/CO2/FM200, wet chemical, emergency light, exit sign and extinguisher paths exist to varying depth.
- Site-configured system tabs determine what technicians see. Missing site master relationships must remain unconfirmed rather than inferred.

## Offline And V2 Groundwork

| Area | Status | Files |
| --- | --- | --- |
| IndexedDB/Dexie proof | Isolated proof only; not production-active | `outputs/fire-inspection-mvp/dev/offline-poc/`, `vendor/dexie.min.js`, `work/qa-android-offline-poc.cjs` |
| Queue/idempotency proof | Isolated and automated; physical Android still required | same as above plus `work/qa-indexeddb-offline-prototype.cjs` |
| Workbox shell | Build proof only; no live registration | `sw-rmt-offline-prototype.js`, `work/qa-workbox-offline-shell.cjs` |
| Production offline architecture | Designed, not implemented | `docs/OFFLINE_SYNC_ARCHITECTURE.md` |
| Production migration | Proposed only | `docs/PRODUCTION_MIGRATION_PLAN.md`, `docs/PRODUCTION_READINESS_V1.md` |
| V2 | Future architecture/capability work, not a second production app | roadmap and current-state docs |

## QA And Review Evidence

- Production-focused Playwright QA scripts live under `work/qa-*.cjs`.
- Technician navigation review: `docs/reviews/technician-nav/`.
- Technician icons/status review: `docs/reviews/technician-flow-icons-status/`.
- Visual Review V3: `outputs/rmt-ux-lab/visual-review-v3/` and summary doc.
- Mimic factory and isolated LTK/Avillion review assets are not production mimic data.
- Current audit measurements: `.memory/audits/current-ux-measurements.json` and `checklist-inventory.json`.

## Infrastructure

| Component | Evidence-based status |
| --- | --- |
| Git | PASS; current WIP intentionally dirty |
| Graphify | PASS; graph contains 4,498 nodes |
| Playwright | PASS; live read-only audit completed across five viewports |
| Ollama | PASS for bounded classification; `qwen2.5:1.5b-instruct` quality is insufficient for final decisions |
| RuFlo | PARTIAL; use only proven bounded local route |
| Freebuff | Installed package 0.2.13; technical blocker because launcher attempted runtime creation/download outside audit boundary |
| Antigravity | Installed/authenticated evidence found; Codex integration/interface not verified |
| Mobile MCP | Handshake previously passed; no physical device attached |
| Qodo | `LOGIN_REQUIRED`; inactive |
| Leantime | Unavailable; task seed is maintained as Markdown |

## Branches And Worktrees

- Current audit checkout: `review/technician-navigation` at `c2566578...`, dirty WIP.
- `main`: `fae1495...`, four commits ahead of `origin/main`.
- Review worktrees: Technician UX V3 temp worktree and `ruflo-pilot` worktree.
- No separate production V2 branch was found. V2 is documented future work.

## Authority Boundaries

- Shared server records are authoritative; localStorage is cache/draft only.
- `plannedDeviceIds` is frozen per schedule.
- Device master, mimic background and normalized pin records remain separate.
- Critical SOP content is approved configuration; this audit does not invent procedures.
- Physical Android and two-phone tests remain the release authority.
