# Test Results

- TEST RESULT 2026-10-04: production `app.js` syntax passed.
- TEST RESULT 2026-10-04: preview server module syntax passed.
- TEST RESULT 2026-10-04: `git diff --check` passed with line-ending warnings.
- TEST RESULT (existing evidence): physical-correction focused automation recorded
  Jockey and Duty as `VERIFIED`, Standby negative as
  `MISMATCH_REVIEW_REQUIRED`, and one CO2 indication as `VERIFIED`.
- TEST RESULT (existing evidence): the focused correction report says the test
  restored its pre-test shared-store snapshot and left no duplicate MFAP records.
- PHYSICAL REQUIRED: focused browser results do not replace real two-phone Android
  confirmation.
- TEST RESULT 2026-10-04: Mem0 OSS + embedded Qdrant ingested 12 project memory
  documents and retrieved the shared-record authority decision using local Ollama
  embeddings.
- TEST RESULT 2026-10-04: RuFlo `3.38.23` executed one task through local Ollama
  model `qwen2.5:1.5b-instruct`; provider routing passed but its classification
  answer was incorrect, so the model is not an authority for project decisions.
- TEST RESULT 2026-10-04: Mobile MCP `1.0.8` completed an MCP initialize handshake;
  real-device testing is blocked because `adb devices` returned no device.
- TEST RESULT 2026-10-04: Edge-backed Playwright loaded RMT at HTTP 200 with login
  and form visible and zero console errors; 390 px horizontal overflow was found.
- TEST RESULT 2026-10-04: official Find Skills catalog query succeeded.
- TEST RESULT 2026-10-04: Mem0 re-index replaced the prior 12 project-document
  records before ingesting the current 12 files, preventing stale duplicate
  document memories from accumulating.
- TEST RESULT 2026-10-04: local Ollama worker
  `qwen2.5:1.5b-instruct` received retrieved RMT memory and correctly identified
  shared per-item server records as authoritative for multi-technician saves in
  12.11 seconds, with no cloud provider involved.
