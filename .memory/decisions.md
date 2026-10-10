# Decisions

- DECISION: Shared per-item server records are authoritative; whole-job snapshots
  are legacy fallback/migration only.
- DECISION: Online revision protection remains authoritative; offline merge is not
  represented as solved until the approved offline architecture is integrated.
- DECISION: Mimic backgrounds are navigation assets; interactive pins remain a
  separate authoritative layer.
- DECISION: Technician work is system/stage driven, with mimic as the field-device
  workspace and configured prerequisites/completion gates.
- DECISION: Flow Switch and other interface devices use configurable primary and
  secondary relationships rather than device-type hard-coding.
- DECISION: Infrastructure services are isolated from RMT production runtime.
- DECISION: Local/light workers may summarize and classify; Codex remains final
  integrator for production architecture and difficult engineering.
- DECISION: Qodo is advisory and currently `LOGIN_REQUIRED`; it must not auto-fix,
  commit, push, merge, or decide business requirements.

