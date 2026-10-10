---
name: rmt-qa-release
description: Run RMT FIREAPPS focused QA, regression selection, release hygiene, and checkpoint review. Use before commits, pushes, field tests, or release recommendations.
---

# RMT QA Release

- Record the baseline SHA and inspect `git status`/diff before testing.
- Run syntax checks and `git diff --check`; run shared-record mutating QA sequentially.
- Distinguish automated simulation from physical Android/two-phone validation.
- Treat physical observations as authoritative bugs even when browser QA passes.
- Reject stale test assumptions without weakening production safety gates.
- Inspect intended files for secrets, local client data, photos, archives, generated reports, and debug artifacts.
- Report passes, failures, unresolved risks, required physical tests, and whether anything was committed or pushed.

