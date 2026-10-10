# RMT Agent Routing Table

Objective: move routine work to deterministic/local tools without weakening RMT's frozen scope, ownership, revisions, dependencies, evidence, Admin approval, or physical-test gates.

## Routing Policy

```text
Joey/product direction
-> Graphify + relevant RMT skill + Ponytail scope
-> one primary local/deterministic worker
-> deterministic test/evidence
-> Codex reviews only diff, failures and risk areas
-> physical Android/two-phone test when behavior is device-dependent
```

Do not ask multiple agents to independently solve the same low-risk task. A local LLM result is a proposal, not proof.

| Task type | Primary worker | Fallback | Codex required? | Credit cost | Local possible? | Example |
| --- | --- | --- | --- | --- | --- | --- |
| Repository scope/dependencies | Graphify + `rg` | targeted file reads | No | None | Yes | Find exact marker filter and callers before inspection |
| CSS/UI polish | Playwright measurement + local HTML/CSS/Node | future Aider/Cline trial | Only if production behavior or cross-file state changes | None/low | Yes | Fix overflow after a screenshot/DOM reproduction |
| Simple JS bug | Deterministic reproduction + scoped local editor candidate | Codex scoped patch | Only on worker failure or risky state | Low | Partly | Correct one event handler with focused test |
| Complex JS/state bug | Graphify + RMT skill + Codex | none | Yes | Medium/high | Investigation local | Shared state rerender/order defect |
| Shared-record sync/revisions | Graphify + `rmt-core`/`rmt-offline-sync` + Codex | none | Yes | High | Tests local | Same-item stale conflict or idempotency defect |
| Offline queue/IndexedDB | Deterministic Dexie harness + `rmt-offline-sync`; Codex integrates | Playwright physical-style QA | Yes for production integration | Medium/high | Yes | Retry queue preserves conflict and evidence metadata |
| Security/auth/RBAC/TLS | Threat checklist + official docs; Codex architecture/review | specialist human review | Yes | High | Partly | Production identity and per-job authorization |
| Playwright browser QA | Existing Node/Playwright suites | Playwright MCP | No unless genuine defect appears | None | Yes | Mobile route, network, DOM and console checks |
| Physical mobile QA | Mobile MCP/ADB plus Joey | Playwright emulation | No for execution; Codex only for reproduced code defect | None/low | Yes | Camera, process kill, touch and reconnect on Android |
| Drawing/mimic cleanup | RMT-MIMIC-LAB + Python/OpenCV/DXF + `rmt-mimic` | manual AutoCAD review | Only for mimic-engine bug | None | Yes | Produce clean source-backed background and transform QA |
| SVG generation/inspection | Deterministic SVG tooling + screenshot comparison | CAD skill candidate in lab | No | None | Yes | Validate viewBox/aspect ratio without changing pins |
| DXF/CAD | Existing DXF scripts + manual CAD review | `earthtojake` DXF skill later | No unless integration bug | None | Yes | Editable review output, never production geometry authority |
| Reports/PDF | Structured report QA + pdfme POC + `rmt-reporting` | Codex for data/layout integration | Yes for contract/data changes | Low/medium | Yes | Pagination/evidence/signature regression |
| Documentation | `.memory` templates + Ollama draft + deterministic fact check | human edit | No | None | Yes | Summarize test output without inventing PASS |
| Technical checklist classification | RMT SME + approved configuration; script inventories | Ollama may group wording only | Codex cannot approve procedure; human required | Low | Yes | Identify duplicates, never create pump/CO2 SOP steps |
| Fire-system research | Official Malaysian/customer/manufacturer references + qualified human | web research | No production change without human approval | Low | Partly | Compare manuals as reference, not app procedure |
| Code review | Diff-first checklist skill + deterministic QA | Codex risk review; Qodo only if approved | Codex only for medium/high risk | Low | Yes | Review changed lines and test gaps, not whole repo |
| Git/GitHub research | Git CLI/GitHub API read-only | web official sources | No | None | Yes/network | License/activity/release check |
| Project planning | Markdown sprint board and `.memory` | Leantime later | No | None | Yes | Track Wetex physical gates |
| V2 local AI/RAG | Mem0 + Qdrant + Ollama prototype | dedicated inference server later | Yes before production integration | Medium/high | Prototype yes | Curated manual retrieval with citations/access control |

## Escalation Rule

Full Codex work is warranted only for architecture, security-sensitive code, synchronization/conflict behavior, data migrations/integrity, production offline behavior, difficult cross-file bugs, worker/test failure, or conflicting evidence. Otherwise Codex should receive a compact packet: objective, allowed files, reproduction, worker diff, deterministic test output, and residual risks.

## Realistic Credit Offload

Can move away from Codex now:

- repository searches and dependency maps;
- inventories, duplicate detection and test matrices;
- routine browser execution, screenshots and console/network collection;
- documentation drafts and low-stakes classification;
- deterministic mimic/background processing;
- Git/GitHub metadata research;
- repeatable syntax/diff/static checks.

Should remain with Codex or a qualified human:

- production architecture and migrations;
- shared-record, revision and offline conflict logic;
- authentication, authorization, secrets and exposure decisions;
- evidence durability and destructive data operations;
- final release integration/review;
- fire-protection procedure approval and mimic geometry interpretation.

No numeric offload percentage is claimed until task logs measure actual successful handoffs.

## Install-Now Shortlist (Maximum Four)

1. `code-review` skill from `mattpocock/skills`.
2. `playwright-best-practices` from Currents.
3. `accessibility` from Addy Osmani.
4. `security-review` from Sentry, after exact skill inspection.

These are recommendations only. No new coding agent should be installed now; evaluate Aider or Goose only after the Wetex/V1 field gate and only in an isolated worktree.
