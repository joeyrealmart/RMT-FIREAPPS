---
name: rmt-core
description: Guard RMT FIREAPPS production business logic, data boundaries, and release discipline. Use for core app changes, integration decisions, or work that could affect schedules, inspections, users, shared records, or reports.
---

# RMT Core

- Read `AGENTS.md`, `docs/RMT_CURRENT_STATE.md`, `docs/RMT_PROJECT_CONTEXT.md`, and `docs/RMT_AGENT_ORCHESTRATION_TREE.md` before broad work.
- Load the relevant RMT skill, query Graphify, and route the task by LIGHT/MEDIUM/HEAVY class before implementation.
- Read the current working tree before editing; preserve unrelated dirty work.
- Treat `outputs/fire-inspection-mvp/` as production app code and `work/` as QA/tooling.
- Preserve frozen schedule scope, shared-record revisions, technician ownership, critical dependency gates, and append-only audit history.
- Never invent fire-system procedures or silently mutate master/client data.
- Keep browser storage cache/draft-only where shared server records are authoritative.
- Make the smallest compatible change and run focused QA before broader regression.
- Do not commit or push unless the user explicitly asks.
