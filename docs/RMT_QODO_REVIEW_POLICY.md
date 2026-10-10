# RMT Qodo Review Policy

Updated: 2026-09-18  
Status: `VERIFIED_REQUIRES_USER_LOGIN`

## Installed Tool

- Product: Qodo Agentic Toolbox CLI (Beta)
- Version: `1.0.3`
- Official installer: `https://get.qodo.ai/install.ps1`
- Install location: `C:\Users\Joey\.qodo\bin`
- License: proprietary; use is subject to Qodo's General Terms of Service
- Authentication: a Qodo account and browser login are required before review tools or Codex integration can run
- Processing: local diffs and supplied context are sent to Qodo's managed cloud review core
- Cost: installation and initial trial do not require a credit card; Qodo's current pricing states there is no permanent general free tier after the trial unless a separate eligible program applies

No Qodo account is connected yet. No RMT source, diff, or repository data has been sent to Qodo. The GitHub App is not installed and has no repository permissions.

## Review Gate

```text
IMPLEMENTATION
-> QODO REVIEW GATE
-> DETERMINISTIC QA
-> PHYSICAL TEST / JOEY REVIEW
```

Qodo runs only after a coherent change exists. It reviews local committed, uncommitted, staged, or explicitly scoped untracked changes. Review context should state the requirement and intentional technical decisions so Qodo can distinguish defects from approved behavior.

Qodo checks:

- regression and cross-file risk
- duplicated or inconsistent logic
- error handling and state-management gaps
- missing or weak tests
- suspicious dead code
- security-sensitive mistakes
- obvious performance problems
- mismatch with RMT repository rules

Qodo does not decide:

- RMT business requirements
- Technician SOP or fire-system procedures
- Admin workflow direction
- mimic geometry or pin placement
- production approval
- final release approval

## Finding Triage

1. Classify findings as genuine product risk, test gap, stale assumption, or cosmetic/noise.
2. Run deterministic evidence checks before returning an issue to Codex.
3. Return only genuine unresolved implementation issues to Codex.
4. Do not automatically apply Qodo suggestions, fixes, commits, or pushes.
5. Physical Android observations and Joey's product decisions remain authoritative.

## Safety Boundaries

- Scope each local review to the intended change; do not review the whole dirty repository by default.
- Never include secrets, local client data, photos, credentials, generated evidence, or unrelated WIP.
- Keep Wetex frozen scope, Photo Timestamp WIP, production pins, annual rotation, shared-record revisions, linked verification, and reporting protected unless the task explicitly includes them.
- Qodo may report findings but must not auto-fix, commit, push, merge, or change branch protection.

## Optional GitHub Integration

The GitHub App is not enabled. If Joey later authorizes it, install it only for the selected RMT repository. GitHub lists these permissions for the Qodo App:

- read: actions, checks, metadata
- read/write: code, discussions, issues, pull requests
- user read: public repositories, public organization information, public profile

Because these permissions include repository write access, GitHub integration requires a separate explicit approval. Auto-merge, automatic fixes, branch-protection changes, and unreviewed commits remain prohibited.

## Required User Action

When Joey decides to activate the hosted reviewer:

1. Run `qodo login` in a normal interactive terminal and complete browser authentication.
2. Run `qodo agents install --agent codex --yes`.
3. Restart Codex so the verified Qodo integration is discovered.
4. Validate with a small isolated non-production diff before reviewing RMT WIP.

