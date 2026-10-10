# Known Issues

- KNOWN ISSUE (P1 release gate): Wetex two-phone physical validation is still
  required for ownership, simultaneous saves, linked indication, evidence,
  offline/reconnect behavior, submission, and Admin review.
- KNOWN ISSUE (P1 architecture): Production-wide IndexedDB/Workbox offline sync is
  not approved or active; the existing Dexie/Workbox work is isolated proof work.
- KNOWN ISSUE (P1 evidence): Photo Timestamp Evidence WIP must be preserved and
  physically validated; original evidence must never be overwritten.
- TEST RESULT (current audit): the earlier 390 x 844 login-overflow observation was
  not reproduced on 2026-10-04 at 360, 390, or 430 px emulated phone widths. Keep
  physical Android validation as the authority before closing the field issue.
- KNOWN ISSUE (P2 UI): tablet-landscape mimic/emergency views exceeded the 1024 px
  viewport by roughly 171-194 px in the 2026-10-04 read-only Playwright probe.
- KNOWN ISSUE (infrastructure): Leantime is blocked by missing Docker/WSL;
  Antigravity lacks a verified supported installation source; Freebuff requires
  login/privacy approval; Mobile MCP has no connected ADB device.
- KNOWN ISSUE (infrastructure): the isolated RuFlo wrapper is pinned at 3.38.23
  but its current cached internal CLI resolves to 3.40.0; controlled local
  Ollama execution remains available, while a fresh pinned-stack proof is still
  required before expanding RuFlo use.
- KNOWN ISSUE (review gate): Qodo is installed but `LOGIN_REQUIRED` and inactive.

No P0 defect is recorded here without reproducible current evidence.
