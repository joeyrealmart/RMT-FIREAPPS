# RMT Audit Agent Map

## Consolidator

Codex coordinates evidence, resolves disagreements and writes the final audit. It must not modify production in this sprint.

## Workers Used

| Worker | Scope | Evidence/output | Prohibited |
| --- | --- | --- | --- |
| Graphify | Exact module/file orientation | 4,498-node graph queries; `.memory/project-tree.md` | Broad implementation or source edits |
| Playwright/Node | Objective responsive measurements and existing QA evidence | `.memory/audits/current-ux-measurements.json`, checklist inventory | API writes; physical-device claims |
| PowerShell/Git | Branch/worktree/status and local server inspection | Baseline and project tree | Reset, clean, stash, commit, push |
| Ollama `qwen2.5:1.5b-instruct` | Independent bounded red-team classification | `.memory/agent-notes/ollama-red-team.md` | Final technical judgment; source modification |
| Official web sources | Shortlist verification for libraries/tools | `.memory/discovery/` | Installation or migration approval |
| Freebuff | Intended phone UX second opinion | BLOCKED before task execution | Runtime download/install during audit |
| Antigravity | Intended mimic architecture second opinion | Integration blocker; installation logs only | Unverified production access |

## Review Allocation

- Checklist content: static configured-template inventory plus existing Realmart decisions. Technical validity remains an SME decision.
- Checklist flow and mobile/tablet: Playwright measurements and existing UX review evidence.
- Mimic: current implementation/QA and existing Mimic Lab evidence; no geometry generation.
- Offline/sync/evidence: architecture docs and focused deterministic QA assertions.
- Reports: report snapshot and evidence QA assertions.
- Discovery: official docs only, maximum a few credible candidates per category.

## Consolidation Rules

1. Deterministic evidence outranks model opinion.
2. Physical Android findings outrank browser emulation.
3. Approved business rules outrank generic UX advice.
4. New tools must add capability, not duplicate an existing proof.
5. Any recommendation affecting SOP content, evidence policy or production hosting requires Joey/ChatGPT approval.

## Findings Location

- Worker notes: `.memory/agent-notes/`
- App audits: `.memory/audits/`
- Capability discovery: `.memory/discovery/`
- Consolidated recommendations: `.memory/final/`
