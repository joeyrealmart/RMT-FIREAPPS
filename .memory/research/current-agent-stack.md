# Current RMT Agent Stack

Assessment date: 2026-10-07

Repository state: `review/technician-navigation` at `c2566578be019bf369f86be593a8b05b34ccf2ef`; protected dirty WIP.

## Evidence Standard

`WORKING` means a current executable/API check or recorded deterministic test exists. `INSTALLED` alone does not mean callable from the active Codex session. Project memory is useful context, but source code, shared server records, deterministic tests, and physical tests remain authoritative.

| Component | Role | Status | Free/local | Callable from active Codex | Main limitation | Overlap | Decision | Best RMT use |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Codex | Production engineering and integration | WORKING | Credit-metered; execution is local but model is hosted | Yes | Scarce usage; should not do routine inventory or repetitive QA | Some overlap with every worker | KEEP, reserve | Architecture, data integrity, concurrency, difficult cross-file defects, security-sensitive changes, final integration/review |
| Ollama `0.34.4` | Local inference | WORKING API at `127.0.0.1:11434`; `qwen2.5:1.5b-instruct` and `nomic-embed-text` present | Yes | Through scripts/RuFlo, not a Codex model fallback | 1.5B model has produced factual errors and is too weak for autonomous production edits | RuFlo, Mem0 | KEEP, bounded | Classification, summaries, inventories, log grouping, draft test matrices; never release authority |
| RuFlo `3.38.23` wrapper | Local LIGHT orchestration | PARTIAL | Intended local/free | Only through isolated pilot route | Fresh invocation resolved internal CLI `3.40.0`; pinned boundary needs re-proof | Ollama plus project task routing | KEEP CONTROLLED; REPAIR LATER | One bounded Ollama task at a time, no production branch access |
| Freebuff `0.2.13` | Proposed independent coding/review worker | BLOCKED / LOGIN_REQUIRED | Package is free; runtime/data path may be external | No | Launcher attempted runtime creation/download outside approved audit boundary; source/privacy approval absent | Cline/Goose/OpenCode and Codex review | KEEP BLOCKED, do not repair in V1 sprint | Possible isolated second opinion only after privacy and runtime review |
| Antigravity | Proposed second opinion / large-context or drawing review | UNVERIFIED | Unknown | No verified CLI/MCP bridge | Conflicting installation/session evidence and no authoritative supported integration source | Design stack, Mimic Lab, other agents | DO NOT USE; clarify product/source first | None until exact product, license, executable, and data boundary are verified |
| Vercel Labs Find Skills / skills ecosystem | Specialist skill discovery | WORKING CATALOG; standalone `find-skills` folder not visible in current project/user skill dirs | Free catalog; network lookup | Official `skills.sh` API works; no reinstall performed | Search is semantic and returns false positives; every result needs source/license review | OpenAI skill-installer and manual GitHub discovery | KEEP | Discover candidate skills, then human review; never auto-install search results |
| Playwright / Playwright MCP | Deterministic browser QA | WORKING; `@playwright/mcp 0.0.81` plus existing local QA | Yes/local | Yes via existing scripts/tools | Emulation is not physical Android evidence | Mobile MCP | KEEP, primary QA | Browser journeys, DOM/network/console assertions, screenshots, multi-context simulations |
| Mobile MCP `1.0.8` | Physical Android interaction | INSTALLED/CONFIGURED; handshake passed | Yes/local | Tool path exists; no connected device | Cannot prove physical flows without ADB device | Playwright emulation | KEEP; CONNECT WHEN NEEDED | Bounded physical Android evidence after device authorization |
| Mem0 `2.2.1` + embedded Qdrant `1.19.1` + `.memory` | Project memory and semantic retrieval | WORKING in isolated infrastructure | Yes/local | Via project scripts, not a production app service | Memory can become stale and is not shared-record authority | Graphify, Markdown memory | KEEP | Retrieve decisions/current context; re-index deliberately; never decide runtime state |
| Leantime | Planned project-management layer | BLOCKED / NOT INSTALLED | Open source, but deployment required | No | Docker and WSL absent; setup cost exceeds current value | Sprint board Markdown | DEFER | Keep `.memory`/Markdown task board until infrastructure changes |
| Qodo `1.0.3` | Independent review gate | INSTALLED, LOGIN_REQUIRED, inactive | Cloud/account boundary; paid status uncertain | No active authenticated review | Source upload/login/permissions not approved | Code-review skills and Codex | KEEP INACTIVE | Advisory review only after explicit approval; no auto-fix/commit/push |

## Find Skills Verification

- Project memory records a successful official catalog query on 2026-10-04.
- On 2026-10-07 the official API used by Vercel's CLI, `https://skills.sh/api/search`, returned live results without installing anything.
- No standalone `find-skills` skill directory or cached `skills` CLI package was visible in the current project/user skill directories. Therefore the accurate status is **catalog access verified, standalone installation not independently confirmed**.
- Do not reinstall during discovery. If Joey later wants the local skill wrapper, verify the intended Codex agent target and install scope first.

Official source: [vercel-labs/skills](https://github.com/vercel-labs/skills) (MIT).

## Repair Priorities

1. Do not repair Freebuff or Antigravity during V1 stabilization.
2. Re-prove RuFlo's wrapper/internal CLI version boundary before increasing autonomy.
3. Connect Mobile MCP only for a scheduled physical test.
4. Keep Leantime deferred until Docker/WSL is independently justified.
5. Treat Ollama 1.5B output as draft analysis requiring deterministic evidence.
