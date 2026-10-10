# RMT Codex Heavy Queue

Updated: 2026-09-18

Only genuine product defects requiring production architecture, data integrity, concurrency, migration, security, or difficult cross-file integration belong here.

## Current Queue

### DESIGN-TOOLING-001 - Round 3 deterministic renderer bridge - NOT_REQUIRED

- Severity: MEDIUM for review delivery; no production impact.
- Reproduction: local Ollama can produce bounded critique text, while `tools/rmt-ux-lab/build-visual-review-v2.mjs` is fixed to the Round 2 screen schema and assets. There is no verified local worker that can turn the requested Round 3 screen matrix into deterministic HTML/CSS, screenshots, and browser QA without new integration code.
- Actual evidence: the verified local stack includes Graphify, RuFlo/Ollama, Playwright, Taste Skill, UI UX Pro Max, design-motion reference material, and the Round 2 renderer. Playwright MCP starts locally, but it automates an existing page; it does not author the missing Round 3 renderer.
- Graphify affected files: `tools/rmt-ux-lab/build-visual-review-v2.mjs`, `tools/rmt-ux-lab/visual-review-v2/`, `work/qa-rmt-visual-review-v2.cjs`, and proposed isolated `visual-review-v3` equivalents only.
- Relevant skills: `ponytail`, `rmt-qa-release`, UI UX Pro Max, Taste Skill.
- Why local tooling alone is insufficient: the current 1.5B local model is suitable for bounded critique and summaries, not reliable multi-file renderer generation. Deterministic tools can validate a renderer but cannot create a new screen schema without an implementation bridge.
- Codex boundary: only build the isolated V3 renderer/harness and wire local outputs after Joey explicitly releases this queue item. Production RMT HTML, CSS, JavaScript, data, pins, fixtures, reports, and workflows remain protected.
- Resolution: the existing Round 2 assets, checklist inventory, static HTML/CSS templates, local Node packaging, and Playwright validation were sufficient. No new rendering engine or Codex production work was required.
- Evidence: `outputs/rmt-ux-lab/visual-review-v3/` contains ten review pages and twelve current/proposed assets; `work/qa-rmt-visual-review-v3.cjs` passes desktop and mobile with zero console errors, failed requests, or horizontal overflow.

## Completed Escalations

### MIMIC-ENGINE-001 - Clean CAD reconstruction engine - COMPLETE / REVIEW REQUIRED

- Severity: HIGH for Mimic Factory output quality; isolated from production.
- Reproduction: LTK Revision 3 retains 182/79/264 scan-derived segments and visibly preserves disconnected/noisy strokes. Joey rejected it as a final redraw.
- Actual evidence: `outputs/rmt-mimic-lab/LTK/*/background-clean.png` and the approved clean appearance reference under `outputs/mimic-cad-pilot/ltk/`.
- Graphify affected files: `tools/rmt-mimic-lab/build_ltk_lab.py`, `work/create-ltk-cad-redraw.py`, review assets and focused Mimic Lab QA.
- Relevant skills: `rmt-mimic`, `ponytail`.
- Why local tooling alone is insufficient: the current algorithm is segment-preservation based; meeting the approved standard requires a bounded engine change to reconstruct editable CAD primitives while retaining identity transforms.
- Codex boundary: engine implementation and review only. Individual future client processing remains local/deterministic.
- Result: deterministic reconstruction now emits editable DXF/SVG/PNG, transform/QA manifests, source overlays, four-way comparisons, and LAN review assets for all three LTK drawings. Output is not production-integrated and remains subject to Joey's source review.

No HEAVY production defects were found by the latest deterministic UX-LAB run.

The four current UX findings are LOW touch-target measurements and remain physical-review/local-polish candidates. No production defect is waiting for Codex.

## Protected Boundaries

- Wetex fixture and frozen scope
- Photo Timestamp WIP
- Technician redesign
- Production pin/device engine
- Shared records and revision protection
- Annual scope and report workflows
