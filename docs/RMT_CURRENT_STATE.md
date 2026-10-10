# RMT FIREAPPS Current State

Updated: 2026-09-18  
HEAD: `fae1495b47f04da37767dabcd179fdc3f73f5abc`  
Commit/push: current WIP is uncommitted and unpushed

## True Now

- Technician redesign and Admin workspace work are protected WIP; do not restart or broadly refactor them.
- Wetex preparation/fixture data is protected. The two-phone physical release gate remains pending; do not regenerate frozen scope casually.
- Photo Timestamp Evidence V1 is protected uncommitted WIP.
- Linked verification, extinguisher verification, report workflow, annual scope, and shared-record revisions must remain intact.
- Dexie offline V2 is an isolated developer POC only. It is not connected to the normal Technician path.
- Workbox proof assets exist but service-worker activation remains blocked until Dexie physical validation succeeds.
- UX-LAB: 7/7 deterministic journeys passed after a QA-only photo-processing race was fixed; 23 screenshots, zero console errors, four LOW touch-target observations, no HEAVY product defect.
- The overnight RMT review package has eight browser pages for Technician, Admin, checklist/autofill, multi-tech/offline/linked integrity, and proposed V1 decisions. It is review-only and does not modify production behavior.
- LTK Mimic Lab clean CAD redraw is generated for Main Panel, Feed Mill, and Egg Production with editable DXF/SVG/PNG, source overlays, four-way style comparisons, and identity-transform QA. It remains ready for Joey review; no production integration is approved.
- Mimic Factory generated 31 editable review candidates from every usable source currently present: LTK 3, MTB 23, Thermofisher 3, and Avillion 2. MTB is a strong CAD-derived candidate; scanned/drawn sources remain `REVIEW_REQUIRED` and may need manual AutoCAD finishing. Hibiscuss, Hexachase, IATAC, UMB, Costa Mahkota, Myamax, and Wetex are `BLOCKED_SOURCE_MISSING`; no geometry was invented.
- Shared-record, isolated IndexedDB queue, and linked-verification deterministic QA pass. The Wetex fixture remains scheduled with 65 frozen planned items after these tests.
- Physical Android and Joey review remain authoritative over automated claims.
- Visual UX Review Round 3 is ready both locally at `/dev/visual-review-v3/index.html` and as a GitHub-reviewable package in `docs/reviews/ux-v3/`: ten review pages, twelve CURRENT/Option A/Option B assets, and passing desktop/mobile browser QA. Production behavior is unchanged.
- The latest Mimic Factory validation confirms 31 source-backed editable candidates across LTK, MTB, Thermofisher, and Avillion; 186 HTTP assets pass with no console or request errors. Seven clients remain explicitly `BLOCKED_SOURCE_MISSING`.
- The design stack is local/free; Glyph MCP remains unverified and uninstalled.
- Qodo Agentic Toolbox CLI `1.0.3` is installed and verified locally as an independent post-implementation review gate. Status is `LOGIN_REQUIRED`, not active; no account, Codex integration, GitHub App, repository permission, or code upload is active.

## Current Gates

1. Joey reviews the unified RMT UX package and the Mimic Factory candidates; every mimic remains outside production until accepted.
2. Missing client sources must be supplied before those mimic candidates can be created. Geometry must not be guessed.
3. Wetex two-phone, offline/reconnect, evidence, timeline, and Admin report validation remain V1 release gates.

## Do Not Change

- Production pin/device engine or normalized pin coordinates.
- Frozen schedules, Wetex records, annual coverage/reservations, or shared records for asset work.
- Photo Timestamp WIP, Technician redesign, reporting, linked verification, or offline POC outside their approved tasks.
- V1/V1.1/V2 boundaries without Joey's approval.
