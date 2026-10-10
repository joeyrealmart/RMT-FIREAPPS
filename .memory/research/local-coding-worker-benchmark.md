# RMT Local Coding Worker Benchmark

Assessment date: 2026-10-07

## Protection Boundary

- Active checkout: `review/technician-navigation`
- Protected source commit: `c2566578be019bf369f86be593a8b05b34ccf2ef`
- Active RMT production WIP was not reset, stashed, committed, pushed, or used as the Aider edit target.
- Isolated worktree: `C:\Users\Joey\Documents\Codex\2026-07-09\RMT-AIDER-LAB`
- Isolated branch: `lab/aider-worker-test`
- Worktree source: committed state at `c2566578be019bf369f86be593a8b05b34ccf2ef`; uncommitted production WIP was not copied.

## Hardware

| Item | Result |
| --- | --- |
| CPU | Intel Core i5-8250U at 1.60 GHz |
| CPU topology | 4 physical cores / 8 logical processors |
| Installed RAM | 7.92 GB |
| Free RAM before model work | 0.79 GB |
| Free RAM after model unload | 1.97 GB |
| GPU | Intel UHD Graphics 620 |
| Reported adapter memory | 1.0 GB shared/integrated; dedicated free VRAM was not available |
| System disk | 237.36 GB total / 34.45 GB free before model download |
| Windows | Windows 11 Home Single Language, version 10.0.26200 |
| Ollama | 0.34.4, local API at `127.0.0.1:11434` |
| Node | 24.21.0 |
| npm | 11.19.0 |
| System Python | Not on PATH; Aider uses its own isolated runtime |

## Skills Installed

The existing RMT skills remain installed. The following project-local skills were added through the official `npx skills add` workflow:

- `code-review` from `mattpocock/skills`
- `playwright-best-practices` from `currents-dev/playwright-best-practices-skill`
- `accessibility` from `addyosmani/web-quality-skills`
- `security-review` from `getsentry/skills`

The Sentry skill was inspected before installation. Its package contains a license and Markdown instructions/references only: no executable scripts, package hooks, dependency installation, credential collection, external upload, or destructive action. The skills CLI displayed a generic `Critical Risk` scanner rating, but the inspected installed contents do not contain executable files. Invoke it only for explicit security review, not routinely.

## Direct Ollama Baseline

### Fast model: `qwen2.5:1.5b-instruct`

- Installed size: 986,061,892 bytes (Q4_K_M).
- Four bounded tasks: repository classification, log summary, simple code explanation, and tiny diff review.
- Response times: 12.38 s, 1.51 s, 3.64 s, and 1.32 s.
- Quality: classification and explanation were adequate; log result was correct but under-explained; diff review incorrectly returned `NO FINDINGS` for code that dereferences a potentially missing existing record.
- Routing: summaries, inventories, classification, and log grouping only. Never architecture, security, concurrency, migrations, or release authority.

### Coding model: `qwen2.5-coder:3b`

- Official Ollama package: 3.1B parameters, Q4_K_M, 1,929,912,626 bytes.
- Four identical bounded tasks.
- Response times: 36.43 s, 4.25 s, 8.03 s, and 3.88 s.
- Observed model-runner working set during Aider: approximately 1.9-2.3 GB.
- Quality: basic classification and explanation were adequate; it also incorrectly returned `NO FINDINGS` on the revision-edge review.
- Routing: may draft tiny isolated code or tests only when all behavior is explicitly specified and deterministic validation is cheap. It is not approved as an autonomous RMT coding worker on this PC.

### Optional stronger model

Not installed. A 7B coding model is 4.7 GB before runtime/context overhead and is not a comfortable fit for this 7.92 GB Windows machine. The newer Qwen3 coder family starts at an impractical 19 GB local package. Installing a larger model would increase memory pressure without evidence of a practical interactive workflow.

## Aider

- Installed using the official Windows installer from `aider.chat`.
- Version: 0.86.2.
- Executable: `C:\Users\Joey\.local\bin\aider.exe`.
- Aider installed into an isolated user-level environment; no production credentials or cloud API keys were supplied.
- Git detection: successful in the isolated worktree.
- Ollama connectivity: successful with `ollama_chat/qwen2.5-coder:3b` at `127.0.0.1:11434`.
- Auto-commit: disabled with `--no-auto-commits --no-dirty-commits`.
- Push/deployment: not configured and not performed.
- Analytics and update checks: disabled for the benchmark command.

## Aider Benchmark

| Field | Result |
| --- | --- |
| Task | Create one dependency-free static login accessibility QA script |
| Prompt | Assert login form, email/password labels and types, submit button, and globally unique HTML IDs |
| Files given | Target QA file; Aider also accepted `outputs/fire-inspection-mvp/index.html` into context after detecting its path |
| Model | `ollama_chat/qwen2.5-coder:3b` |
| Iterations | 2 controlled attempts |
| Time | More than six minutes per attempt without a completed edit |
| Files changed by worker | Empty target file and an incidental `.aider*` ignore entry; both removed after the failed trial |
| Final lab diff | Clean; zero retained lines changed |
| Deterministic test | Not runnable because no script was produced |
| Playwright | Not applicable; no production/UI edit was produced |
| Errors | User-home update/history access warning under sandbox; excessive context-processing time; no completed output |
| Codex review effort | Small: inspect process/resource use, stop the worker, inspect/clean its lab-only artifacts, record failure |

The benchmark **fails** the acceptance criteria. The worker was too slow for an 80 KB repository file, the direct model missed a simple correctness edge case, and no testable diff was produced. Repeated prompting would defeat the credit-saving goal.

## Bottleneck Classification

- Hardware: primary constraint for interactive local coding; CPU-only inference and 7.92 GB RAM limit model size and context throughput.
- Repository context: material constraint; Aider's prompt plus the 80 KB HTML file made each attempt impractical.
- Model: quality constraint; the 3B coding model missed the same correctness issue as the 1.5B general model.
- Aider: operationally compatible with Windows, Git, and Ollama, but cannot compensate for model/context/hardware limits.
- Prompt: sufficiently bounded; reducing scope did not help because Aider detected and added the referenced source file.

## Routing Decision

Do not promote Aider as an RMT coding worker on this PC. Keep the existing routing table unchanged.

Local/free tasks that remain suitable:

- Ollama 1.5B: documentation drafts, summaries, inventories, log grouping, and low-stakes classification with deterministic fact checks.
- Graphify/`rg`/Git/PowerShell: repository scope and evidence gathering.
- Node/Python/Playwright: deterministic QA, screenshots, DOM/network/console checks, and fixture analysis.

Tasks that must remain with Codex or qualified human review:

- production implementation and integration;
- shared-record ownership, revisions, concurrency, and conflict behavior;
- offline queues/IndexedDB production integration;
- authentication, authorization, secrets, and security decisions;
- schema/data migrations and destructive operations;
- difficult cross-file bugs and final release review;
- fire-protection procedure approval and source-geometry interpretation.

## Existing Worker Status

- RuFlo: controlled/partial; wrapper/internal CLI version mismatch remains documented and is not a blocker for this trial.
- Freebuff: current Codex-session integration blocked; do not repair during V1 stabilization.
- Antigravity: unverified; do not install or use without source/license/data-boundary review.
- Mobile MCP: installed/configured but requires an authorized physical ADB device for field evidence.

## Recommendation

**D. HARDWARE LIMITATION - KEEP LOCAL WORK TO OLLAMA SUPPORT TASKS.**

Do not install Goose, OpenCode, Cline, SWE-agent, another coding model, or another agent during this task. Revisit a coding worker only on stronger hardware or a dedicated local inference server.

## Future Worker Lab Boundary

All future Freebuff, Antigravity, cloud-worker, bridge, and synthetic coding capability tests must use `C:\Users\Joey\Documents\Codex\2026-07-09\RMT-AGENT-LAB`. The active RMT checkout is read-only for those experiments. The existing `RMT-AIDER-LAB` remains untouched as historical Aider evidence and is not the workspace for future worker tests.
