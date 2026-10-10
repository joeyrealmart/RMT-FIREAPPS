# Baseline

Recorded: 2026-10-04 (Asia/Singapore)

## Git

- Branch: `review/technician-navigation`
- HEAD: `c2566578be019bf369f86be593a8b05b34ccf2ef`
- Upstream: `origin/review/technician-navigation`
- Ahead/behind at capture: `0/0`
- Remote: `https://github.com/joeyrealmart/RMT-FIREAPPS.git`
- Working tree: dirty; 15 tracked files modified and 1187 untracked paths.
- Production diff at capture: 3402 insertions, 329 deletions across 15 tracked files.

This baseline is descriptive only. Existing WIP must not be reset, stashed,
cleaned, reverted, or overwritten.

## Build/static checks

- TEST RESULT: `node --check outputs/fire-inspection-mvp/app.js` passed.
- TEST RESULT: `node --check work/serve-fire-inspection-mvp.mjs` passed.
- TEST RESULT: `git diff --check` passed (line-ending warnings only).
- No RMT server was listening on port 8026 at baseline capture.

## Tool inventory snapshot

- Codex CLI: INSTALLED (`0.159.2`).
- Git: INSTALLED (`2.53.0.windows.3`).
- Node/npm/npx: INSTALLED (`24.21.0` / `11.19.0` / `11.19.0`).
- Python: bundled Codex Python available (`3.12.14`); not on user PATH.
- ADB: INSTALLED (`1.0.41`, platform tools `36.0.0-13206524`).
- Ollama: INSTALLED (`0.34.4`) with local `qwen2.5:1.5b-instruct` and
  `nomic-embed-text` models.
- RuFlo: INSTALLED/CONFIGURED (`3.38.23`); local Ollama execution verified.
- Playwright: INSTALLED (`@playwright/mcp 0.0.81`); Edge-backed RMT check passed.
- Qodo: INSTALLED (`1.0.3`) but LOGIN_REQUIRED and not an active gate.
- Docker/Docker Compose: NOT INSTALLED.
- Leantime: BLOCKED; Docker and WSL are not installed.
- Mem0: INSTALLED in isolated RMT infrastructure (`2.2.1`).
- Qdrant: INSTALLED as embedded project-scoped client storage (`1.19.1`), not a server.
- Antigravity: NOT INSTALLED / exact supported product integration unverified.
- Freebuff: INSTALLED (`0.2.13`) but `LOGIN_REQUIRED`; not authorized for RMT code.
- Find Skills: INSTALLED through the built-in official skill-installer catalog.
- Mobile MCP: INSTALLED/CONFIGURED (`1.0.8`); stdio handshake passed, device test blocked.
