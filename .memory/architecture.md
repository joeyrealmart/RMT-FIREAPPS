# Architecture

## CONFIRMED product shape

RMT FIREAPPS V1 is Realmart's internal scheduling, field inspection, evidence,
defect, review, and reporting application.

- Technician: assigned job -> system prerequisite -> mimic/field devices ->
  completion -> submission.
- Admin: control desk -> exceptions -> job/activity/fault/report review ->
  approval or correction.
- Shared per-item records are authoritative for multi-technician work.
- Browser storage is cache/draft-only where server records exist.
- Frozen `plannedDeviceIds` define scheduled service scope.
- Existing mimic backgrounds and normalized interactive pins are separate layers.
- Critical dependencies and shared-record revision checks remain authoritative.

## Infrastructure target

- Leantime: project-control layer.
- `.memory/`: durable human-readable project memory.
- Mem0 plus a local vector store: semantic retrieval, project-scoped only.
- Git: code/diff history.
- Codex: lead engineer and final integrator.
- RuFlo/Ollama: tightly bounded local orchestration and light work.
- Playwright: browser/PWA regression.
- Mobile MCP plus physical testing: Android/device workflow evidence.

Infrastructure must remain isolated from the production RMT runtime and must not
become authoritative for schedules, inspection records, evidence, or reports.

