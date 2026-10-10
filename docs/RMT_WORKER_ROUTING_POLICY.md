# RMT FIREAPPS Worker Routing Policy

Updated: 2026-09-17

## Routing

| Work | Default worker | Codex boundary |
| --- | --- | --- |
| Mimic rendering, OpenCV cleanup, DXF/PNG/SVG export | Local Python/CAD tooling | Only difficult Mimic Factory engine defects |
| Browser journeys, screenshots, DOM measurements | Playwright / RMT-UX-LAB | Only evidenced production defects |
| Summaries, manifests, classification, test matrices | RuFlo + local Ollama | No Codex fallback |
| Static code discovery | Graphify | Codex only after affected files are scoped |
| Production integration, concurrency, migrations, security | Codex with relevant RMT skills | Smallest compatible change with focused QA |

OmniRoute may route isolated Mimic Factory work only after its installation and provenance are verified. It must never edit production RMT files. Until then, deterministic workers run directly.

## Required Evidence For Codex

An item may enter `RMT_CODEX_HEAVY_QUEUE.md` only with an ID, severity, reproduction evidence, Graphify scope, relevant skills, and an explanation of why deterministic/local workers cannot safely resolve it.

## Protected Areas

Wetex frozen scope and fixture data, Photo Timestamp WIP, Technician and Admin workflows, shared records, annual rotation, linked verification, reporting, and the production pin/device engine remain protected unless the specific task authorizes them.

No worker commits or pushes without Joey's approval.
