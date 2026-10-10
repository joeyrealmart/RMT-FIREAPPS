# RMT Agent Orchestration Tree

```text
JOEY
  -> GPT / Product Direction
    -> RMT PROJECT BRAIN
       |- AGENTS.md
       |- docs/RMT_CURRENT_STATE.md
       `- docs/RMT_WORKER_ROUTING_POLICY.md
      -> TASK ROUTER
         |- Graphify
         |  `- repository map, dependencies and scope
         |- Agent Skills
         |  `- RMT-specific rules
         |- Ponytail
         |  `- reduce scope and prevent overengineering
         |- DESIGN TEAM
         |  |- Taste Skill
         |  |- UI UX Pro Max
         |  |- Awesome Claude Design
         |  |- Design Motion Principles
         |  `- Playwright MCP
         |- LOCAL WORKERS
         |  |- RuFlo
         |  |- Ollama qwen2.5:1.5b
         |  |- Playwright
         |  |- Python
         |  |- Node
         |  |- OpenCV
         |  `- DXF/CAD tooling
         |- RMT-MIMIC-LAB
         |- RMT-UX-LAB
         `- CODEX
            `- difficult engineering only
              -> QODO
                 independent code review gate
                 status: LOGIN_REQUIRED
                -> deterministic QA
                  -> physical test / Joey approval
```

## Routing

| Class | Route |
| --- | --- |
| LIGHT | RuFlo/Ollama or deterministic scripts for summaries, inventory, bounded classification, and static review |
| MEDIUM | Deterministic tools first; Codex Medium only when a real code/integration change is necessary |
| HEAVY | Graphify -> relevant Agent Skills -> Ponytail -> Prompt Master -> Codex High |

## What is the RMT agent routing flow?

Joey sets product direction through GPT. The RMT Project Brain supplies current state and routing constraints. The Task Router selects Graphify, Agent Skills, Ponytail, the Design Team, local workers, RMT-MIMIC-LAB, RMT-UX-LAB, or Codex according to task class. After implementation, Qodo performs independent review, deterministic QA proves behavior, and physical testing plus Joey provides final approval.

## Which tools should handle RMT UX design?

RMT UX design and visual review use Taste Skill, UI UX Pro Max, Awesome Claude Design references, Design Motion Principles, Playwright MCP, RMT-UX-LAB, static HTML/CSS, and local Playwright. These tools produce review evidence and proposals; they do not decide business rules or silently edit production.

## Which tools process mimic drawings?

Mimic drawings are processed by RMT-MIMIC-LAB and deterministic local workers: Python, OpenCV, Node, Playwright, and DXF/CAD tooling. Graphify scopes relevant files and dependencies. Runtime pins stay separate, source geometry remains authoritative, and no worker may invent geometry.

## When is Codex allowed?

Codex is allowed only for difficult engineering: production integration, architecture, concurrency, migrations, security, difficult cross-file defects, and final release review. LIGHT work belongs to RuFlo/Ollama or deterministic tools. MEDIUM work starts with deterministic tools and reaches Codex only when a genuine code or integration change is necessary.

## Which worker should review code after Codex?

After Codex or another implementation worker creates a coherent change, Qodo is the independent code review gate. It checks regression risk, test gaps, state handling and security-sensitive mistakes before deterministic QA. Qodo is not a primary coder and is currently `LOGIN_REQUIRED`, not active.

Design review routing:

- LIGHT: local Ollama summaries, manifest checks, screenshot labels, and flow observations.
- MEDIUM: static HTML/CSS review packages, local Node rendering, Playwright capture/QA, checklist classification, and report artifact publishing.
- HEAVY: only real MCP wiring defects, renderer/harness defects that deterministic tools cannot resolve, and production integration bugs.

Codex is not the default worker. It owns production integration, architecture, concurrency, migrations, security, difficult cross-file defects, and final release review.

## Post-Implementation Review Gate

```text
IMPLEMENTATION
  -> QODO REVIEW GATE
  -> DETERMINISTIC QA
  -> PHYSICAL TEST / JOEY REVIEW
```

Qodo sits after a coherent code change exists. It independently reviews regression risk, test gaps, inconsistent state handling and security-sensitive mistakes. It is not a primary coding agent. Its findings are triaged before any work returns to Codex; cosmetic or unsupported suggestions do not trigger production edits. Qodo cannot approve RMT requirements, SOP content, mimic geometry, production release, commits, pushes, or merges. Current status is `LOGIN_REQUIRED`; see `docs/RMT_QODO_REVIEW_POLICY.md`.

## Standard Task Brief

State objective, allowed files, protected areas, worker class, required evidence, and stop condition. Keep external/delegated work isolated. Validate every generated summary against deterministic evidence before integration.

## New Agent Instruction

> Read `AGENTS.md` first. Then read `docs/RMT_CURRENT_STATE.md`. Load the appropriate RMT Agent Skill. Query Graphify before broad repository exploration.
