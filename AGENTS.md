# RMT FIREAPPS Agent Entry Point

RMT FIREAPPS is Realmart's internal fire-protection scheduling, field inspection, evidence, defect, review, and reporting application.

Before working:

1. Read `docs/RMT_CURRENT_STATE.md` and `docs/RMT_PROJECT_CONTEXT.md`.
2. Read `.memory/requirements.md`, `.memory/decisions.md`,
   `.memory/current-work.md`, `.memory/known-issues.md`, and
   `.memory/failed-approaches.md`. Treat these as project memory, not as a
   substitute for authoritative shared records or current source code.
3. Load the relevant skill from `.agents/skills/`.
4. Query `.tools/graphify/Scripts/graphify.exe query "<question>"` before broad code investigation.
5. Follow `docs/RMT_AGENT_ORCHESTRATION_TREE.md`: LIGHT -> local RuFlo/Ollama or deterministic tools; MEDIUM -> deterministic tools first, then Codex only if code is needed; HEAVY -> Graphify, skills, Ponytail, Prompt Master, then Codex High.

Canonical route: Joey -> GPT/Product Direction -> RMT Project Brain -> Task Router -> appropriate design/local/engineering worker -> Qodo review gate -> deterministic QA -> physical test/Joey approval. Codex is reserved for difficult engineering.

Never invent fire-system procedures or mimic geometry; bypass frozen scope, ownership, revisions, dependencies, or Admin approval; treat browser cache as authoritative; reset unrelated WIP; or commit/push without Joey's approval.

Canonical references: `docs/RMT_PROJECT_CONTEXT.md`, `docs/RMT_CURRENT_STATE.md`, `docs/RMT_AGENT_ORCHESTRATION_TREE.md`, `docs/RMT_GRAPH_MAP.md`, `docs/RMT_CODEX_HEAVY_QUEUE.md`, and `docs/RMT_AGENT_USAGE_LOG.md`.

For design review, use the verified local stack recorded in `docs/RMT_DESIGN_STACK_STATUS.md`. Static HTML/CSS, local Node, Playwright, and Ollama own review artifacts; design references never override RMT business rules or authorize production edits.

After an implementation exists, route it through the independent Qodo review gate defined in `docs/RMT_QODO_REVIEW_POLICY.md`, then deterministic QA. Qodo is currently `LOGIN_REQUIRED`, not active. Its findings are advisory: classify them first and return only genuine unresolved issues to Codex. Never allow Qodo to auto-fix, commit, push, merge, or decide RMT business requirements.
