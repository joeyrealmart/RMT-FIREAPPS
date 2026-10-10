# RMT FIREAPPS Project Context

## Product Purpose

RMT FIREAPPS is Realmart's internal fire-protection inspection, maintenance, tracking, evidence, defect, review, and reporting system. Its primary users are Admin and Technician.

```text
Admin prepares job and frozen scope
-> Technician performs assigned work
-> evidence, faults and linked verification are recorded
-> Technician submits
-> Admin reviews
-> report is approved or returned for correction
```

## Release Priorities

**V1:** operational control and field execution: clients/sites, scheduling, Technician workflow, mimic, inspections, evidence, multi-technician ownership, offline/reconnect foundations, activity, defects, reports, and Admin approval.

**V1.1:** assisted wording and bounded workflow refinements after field evidence.

**V2:** intelligence, advanced automation, quotation assistance, and other nonessential layers. V2 stays locked until V1 field gates pass.

## Golden Flows

Technician:

```text
Login -> Jobs -> Job -> System -> Device/Mimic -> PASS/FAULT/N/A
-> Evidence -> Save & Next -> Complete -> Submit
```

Admin:

```text
Login -> Control Desk -> Attention -> Job -> Activity -> Faults
-> Report Review -> Approve/Follow-up
```

## Protected Rules

- V1 before V2; physical Android behavior is release truth.
- Preserve frozen `plannedDeviceIds`, annual scope, critical dependency gates, technician ownership, and revision-protected independent records.
- Never silently overwrite newer shared state or invent technical operating procedures.
- Browser `localStorage` is cache/draft only where server shared records exist.
- Technician source wording and evidence remain attributable; Admin retains final review/approval.
- No destructive migration, reset of unrelated WIP, commit, or push without Joey's authorization.

## Mimic Rule

The original customer PDF/drawing is geometry authority. The clean background and authoritative interactive pin layer remain separate.

Preserve source-supported footprint, walls, partitions, doors, stairs, useful beams, corridors, and navigation landmarks. Remove handwriting, arrows, dimensions, title blocks, obsolete visual pin marks, and unrelated engineering clutter. Never invent rooms, lifts, equipment, labels, or geometry. Uncertainty is `REVIEW_REQUIRED`.

## Major Modules

| Area | Actual location | Responsibility |
| --- | --- | --- |
| Browser app shell | `outputs/fire-inspection-mvp/index.html`, `styles.css` | Role-specific single-page UI and responsive presentation |
| Application logic | `outputs/fire-inspection-mvp/app.js` | Admin/Technician state, scheduling, mimic rendering, inspections, evidence, completion, reporting |
| Local prototype server | `work/serve-fire-inspection-mvp.mjs` | Static app, schedules, revisioned shared records, evidence, reports, linked/extinguisher endpoints |
| Technician flow | `app.js`: `startScheduledJob`, `resumeScheduledJob`, `setTechScreen`, `renderTechWorkPanel`, `renderMarkers`, `selectDevice`, `saveInspection`, `saveCriticalSop` | Assigned-job execution and dependency-controlled work |
| Admin control desk | `app.js`: `ADMIN_MODULES`, `adminMainNav` and Admin render/state functions | Home, clients, schedules, reports, defects, mimics, staff, settings |
| Shared records | `app.js` shared API/cache functions plus server shared-job handlers | Per-item inspection/SOP/system records, revisions, idempotency, progress, sign-off |
| Linked verification | `app.js`, server linked endpoints, `docs/LINKED_VERIFICATION_V1.md`, `work/qa-linked-verification-v1.cjs` | Separate technician-side records and reconciliation |
| Reporting | `app.js`, server report functions, `work/qa-report-generator-v1.cjs`, `.agents/skills/rmt-reporting/` | Submission, Admin review, snapshots and report artifacts |
| Runtime mimic assets | `outputs/fire-inspection-mvp/assets/mimics/` | Reviewed clean backgrounds/manifests only; pins stay authoritative elsewhere |
| Offline POC | `outputs/fire-inspection-mvp/dev/offline-poc/`, `docs/RMT_ANDROID_OFFLINE_POC_TEST.md`, `work/qa-android-offline-poc.cjs` | Isolated Dexie draft/queue/conflict proof; not live production offline mode |
| QA | `work/qa-*.cjs` | Focused browser/server/data-integrity regression suites |
| UX Lab | `tools/rmt-ux-lab/`, `outputs/rmt-ux-lab/` | Isolated Playwright journey observation and local classification |
| Mimic Lab | `tools/rmt-mimic-lab/`, `outputs/rmt-mimic-lab/` | Deterministic source analysis, clean review assets, SVG/DXF/PNG, no production integration |

## Development Tooling

- **RMT Project Brain:** `AGENTS.md`, `docs/RMT_CURRENT_STATE.md`, and `docs/RMT_WORKER_ROUTING_POLICY.md` define the current state, protected areas, and worker route before any investigation.
- **Graphify:** local AST knowledge graph under `graphify-out/`; query before broad exploration and update after meaningful code changes.
- **Agent Skills:** `.agents/skills/` contains RMT domain guardrails.
- **Ponytail:** compact task briefs and progressive context disclosure.
- **Prompt Master:** HEAVY tasks only, after Graphify and skills.
- **RuFlo + Ollama:** free local LIGHT summaries/classification; deterministic validation remains authoritative.
- **Playwright / Node / Python / OpenCV:** repeatable QA, extraction, rendering, and local utilities.
- **RMT-UX-LAB / RMT-MIMIC-LAB:** isolated review systems that must not silently modify production data.
- **Design stack:** project-local Taste Skill, UI UX Pro Max, motion/design references, and Microsoft Playwright MCP are documented in `docs/RMT_DESIGN_STACK_STATUS.md`; they produce review artifacts only.
- **Visual Review V3:** `outputs/rmt-ux-lab/visual-review-v3/` combines current Playwright evidence with local static proposals and deterministic QA. It is not a production implementation.
- **Qodo review gate:** official Agentic Toolbox CLI `1.0.3` is installed as an independent post-implementation reviewer. It is `LOGIN_REQUIRED`; no RMT review, Codex integration, GitHub permission, or source upload is active.

Canonical delivery flow:

```text
Product direction -> Project Brain -> Task Router -> implementation worker
-> Qodo independent review -> deterministic QA -> physical test / Joey approval
```

## Onboarding

Repository: `joeyrealmart/RMT-FIREAPPS`

> Read `AGENTS.md` first. Then read `docs/RMT_CURRENT_STATE.md`. Load the appropriate RMT Agent Skill. Query Graphify before broad repository exploration.
