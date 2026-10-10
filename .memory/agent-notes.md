# Agent Notes

- AGENT NOTE: Current documentation has stale HEAD references; use Git plus current
  human instruction as authority until docs are refreshed deliberately.
- AGENT NOTE: Docker and WSL are absent. Leantime remains blocked; Qdrant uses an
  embedded local path until a server deployment is justified.
- AGENT NOTE: Ollama `0.34.4` is healthy with `qwen2.5:1.5b-instruct` and
  `nomic-embed-text` installed locally.
- AGENT NOTE: Freebuff was installed from its official npm/GitHub project but needs
  login and has external data-processing implications; do not expose proprietary
  RMT code until Joey approves that boundary.
- AGENT NOTE: No authoritative Antigravity CLI installation source was confirmed,
  so no similarly named third-party package was installed.
- AGENT NOTE: The project has 4498 Graphify nodes at baseline query time.
- AGENT NOTE: The isolated RuFlo npm wrapper is `ruflo@3.38.23`, but a fresh
  `npx` invocation resolved its internal `@claude-flow/cli` to `3.40.0` and
  auto-started a daemon. The daemon was stopped. Use the previously verified
  controlled local route until the wrapper/CLI version boundary is pinned and
  revalidated; do not represent the mixed invocation as a 3.38.23 proof.
