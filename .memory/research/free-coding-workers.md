# Free/Local Coding Worker Shortlist

Assessment date: 2026-10-07. Repository metadata was checked through the GitHub API and product claims against official repositories/documentation. No worker was installed or configured.

## Critical Constraint

The PC has about 8 GB RAM and the proven local coding-capable endpoint currently offers `qwen2.5:1.5b-instruct`. That model is useful for bounded classification, but it has already made factual RMT errors. Most autonomous coding harnesses need a substantially stronger model and larger context. Therefore **no new autonomous local coding worker qualifies as Tier A on this PC today**. A better harness cannot make a 1.5B model safe for revisions, offline sync, auth, or cross-file production work.

## Ranked Candidates

### 1. Aider — Tier B, best future bounded editor

- Source/license/activity: [Aider-AI/aider](https://github.com/Aider-AI/aider), Apache-2.0, ~49K stars; last repository push reported 2026-05-22.
- Free/local: open source; supports local Ollama and Windows.
- Integrations: strong Git/repo-map/test/lint workflow; no verified first-class MCP route in this review.
- RMT use: small isolated CSS/JS edits, docs, targeted tests in a clean worktree.
- Codex reduction: medium if backed by a capable local/server model; low with current 1.5B model.
- Risks: Git auto-commit/default dirty-tree behavior conflicts with RMT's protected WIP. Trial only with `--no-auto-commits --no-dirty-commits`, explicit files, and an isolated worktree.
- Recommendation: KEEP AVAILABLE; do not install during V1 field stabilization.

Official docs: [Ollama connection](https://aider.chat/docs/llms/ollama.html), [Git behavior](https://aider.chat/docs/git.html).

### 2. Goose — Tier B, strongest extensible local orchestrator candidate

- Source/license/activity: [aaif-goose/goose](https://github.com/aaif-goose/goose), Apache-2.0, ~55K stars, active 2026-10-06; now under the Agentic AI Foundation.
- Free/local: open source desktop/CLI/API; Ollama provider; native Windows distribution.
- Integrations: deep MCP support, recipes, subagents, ACP, GitHub extensions.
- RMT use: repeatable read-only recipes, documentation, QA coordination, isolated low-risk maintenance tasks.
- Codex reduction: potentially medium/high with a stronger local inference server.
- Risks: overlaps RuFlo, broad shell/tool access, recipe/subagent complexity, and current local model is too weak.
- Recommendation: KEEP AVAILABLE; evaluate against RuFlo in a separate tooling worktree, not both simultaneously.

Official overview: [goose documentation](https://block.github.io/goose/index.html).

### 3. OpenCode — Tier B, strong active CLI but Windows/scale caveats

- Source/license/activity: [anomalyco/opencode](https://github.com/anomalyco/opencode), MIT, ~212K stars, active 2026-10-06.
- Free/local: open source; local Ollama discovery/provider supported.
- Windows: native packages exist, but official docs recommend WSL for best compatibility.
- Integrations: MCP, GitHub Actions/app, local/remote providers.
- RMT use: bounded repo search, simple changes, test execution in an isolated worktree.
- Codex reduction: medium with a capable model; low with the installed 1.5B model.
- Risks: rapidly moving project, large permission surface, GitHub mode adds credentials/write permissions, and high orchestration overlap.
- Recommendation: KEEP AVAILABLE; no GitHub app and no write token in first trial.

Official docs: [Ollama provider](https://opencode.ai/docs/providers), [MCP](https://opencode.ai/v2/docs/mcp-servers), [Windows guidance](https://docs.opencode.ai/docs/).

### 4. Cline — Tier B, best native Windows IDE option

- Source/license/activity: [cline/cline](https://github.com/cline/cline), Apache-2.0, ~70K stars, active 2026-10-06.
- Free/local: open source desktop/VS Code/CLI; Ollama and OpenAI-compatible local endpoints supported.
- Windows: native desktop and VS Code support.
- Integrations: MCP, SDK/plugins, headless CLI and CI workflows.
- RMT use: human-approved edits, diff reviews, local commands and focused QA from the editor.
- Codex reduction: medium with a capable local model.
- Risks: can read/write files and execute shell commands; telemetry/privacy settings need review; current 1.5B model is unlikely to operate tools reliably.
- Recommendation: KEEP AVAILABLE, not install-now; if trialed, deny auto-approval and restrict to an isolated worktree.

Official source: [Cline repository](https://github.com/cline/cline).

### 5. SWE-agent — Tier C, issue-resolution experiment

- Source/license/activity: [SWE-agent/SWE-agent](https://github.com/SWE-agent/SWE-agent), MIT, ~20K stars, active 2026-10-06.
- Free/local: supports OpenAI-compatible/local Ollama endpoints through LiteLLM.
- Windows: supported, but environment/container availability can limit it.
- Integrations: GitHub issue workflow, configurable tools; MCP not a primary documented strength.
- RMT use: reproduce and attempt one isolated issue with a deterministic test.
- Codex reduction: low/medium only after Docker/WSL or a safe direct runtime exists.
- Risks: container/runtime setup, trajectory volume, autonomous shell actions, and weak local model behavior.
- Recommendation: V2/tooling experiment only.

Official docs: [local models](https://github.com/SWE-agent/SWE-agent/blob/main/docs/installation/keys.md), [Windows FAQ](https://github.com/SWE-agent/SWE-agent/blob/main/docs/faq.md).

### 6. OpenHands — Tier C/D on this PC

- Source/license/activity: [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands), MIT, ~90K stars, active 2026-10-06.
- Free/local: open source; can connect to Ollama/local model servers.
- Windows: official path expects WSL and Docker Desktop.
- Integrations: local/remote backends and agent protocols.
- RMT use: future isolated issue agent on stronger hardware.
- Codex reduction: potentially high on a dedicated server, effectively none on this PC.
- Risks: official local-model recommendation is roughly 35B-class with 24 GB VRAM or 64 GB unified memory, far beyond this machine; Docker/WSL absent.
- Recommendation: REJECT FOR CURRENT PC; reconsider only with dedicated hardware.

Official docs: [Windows/local setup](https://github.com/OpenHands/docs/blob/main/openhands/usage/run-openhands/local-setup.mdx), [local LLM requirements](https://github.com/OpenHands/docs/blob/main/openhands/usage/llms/local-llms.mdx).

### 7. Continue — Tier D, maintenance ended

- Source/license: [continuedev/continue](https://github.com/continuedev/continue), Apache-2.0, ~36K stars.
- Free/local: Ollama and Windows were supported.
- Status: upstream README states the repository is no longer actively maintained/read-only and calls 2.0.0 the final release, despite recent metadata updates.
- Recommendation: REJECT for new RMT adoption.

### 8. Roo Code — Tier D, archived

- Source/license: [RooCodeInc/Roo-Code](https://github.com/RooCodeInc/Roo-Code), Apache-2.0, ~24K stars.
- Free/local: Ollama/LM Studio support; VS Code workflow.
- Status: GitHub repository archived on 2026-05-15; CLI documentation did not offer native Windows support.
- Recommendation: REJECT; Cline/Goose/OpenCode are active alternatives.

## Tier Summary

| Tier | Workers | Decision |
| --- | --- | --- |
| A — install/repair now | None | Existing deterministic stack is safer; current local model is the bottleneck |
| B — keep available | Aider, Goose, OpenCode, Cline | Trial one at a time in isolated worktrees after V1 field gate |
| C — V2 preparation | SWE-agent, OpenHands on stronger infrastructure | Do not install now |
| D — reject | Continue, Roo Code | Maintenance/archive status makes new adoption unjustified |

## Security Trial Contract

Any future worker trial must use a separate branch/worktree, no production credentials, no GitHub write token, no auto-commit/push, explicit allowed files, deterministic tests, diff review, and a disposable data root. Never run two autonomous editors against the same worktree.
