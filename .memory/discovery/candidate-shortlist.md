# Capability Discovery Shortlist

Only official documentation or project repositories were used. No candidate was installed during this audit.

## Libraries And Projects

| Candidate | License/cost | RMT use | Fit | Recommendation |
| --- | --- | --- | --- | --- |
| Dexie 4 | Apache-2.0, free, local | IndexedDB drafts, queue and evidence metadata | Already pinned and proven in isolated POC | **TEST FIRST**, then integrate narrowly |
| Workbox 7 | MIT, free, local | Static shell caching and background request queue | Already pinned/buildable but intentionally inactive | **TEST LATER** after Dexie semantics |
| pdfme | MIT, free, self-hosted | Template-based customer/internal PDF generation | Existing proof and evaluation | **TEST FIRST** with real report |
| PDF.js | Apache-2.0, free, local | Admin/reference viewing of source PDFs | Mature, but runtime technician backgrounds should remain optimized images/SVG | **KEEP FOR V1.1** |
| Appium | Apache-2.0, free, local | Real Android automation | Adds native/device coverage beyond Playwright but requires device setup/maintenance | **REVIEW AFTER PILOT** |
| JSON Forms | MIT, free | Schema-driven conditional forms | Capable but would introduce React/Angular/Vue renderer complexity into current vanilla app | **SKIP FOR V1** |
| `svg-pan-zoom` / `panzoom` | BSD/MIT-style open source | Touch pan/zoom for SVG/DOM | Current mimic already has working pin/touch logic; replacement risk exceeds benefit | **SKIP FOR V1** |
| Konva | MIT, free | Canvas scene graph/annotation | Powerful but duplicates current normalized pin layer | **KEEP FOR V2 ONLY** |
| Three-DXF viewer projects | Open source, varying maturity | Direct DXF viewing | More runtime complexity than clean background workflow | **SKIP FOR V1** |

Official sources:

- Dexie: `https://dexie.org/docs/Dexie.js`
- Workbox background sync: `https://developer.chrome.com/docs/workbox/modules/workbox-background-sync`
- PDF.js: `https://github.com/mozilla/pdf.js`
- pdfme: `https://github.com/pdfme/pdfme`
- Appium: `https://appium.io/docs/en/latest/`
- JSON Forms: `https://github.com/eclipsesource/jsonforms`
- Konva: `https://github.com/konvajs/konva`

## MCP/Agent/Skill Candidates

| Candidate | Use | Existing overlap | Recommendation |
| --- | --- | --- | --- |
| Mobile MCP | Physical-device control/evidence | Playwright emulation only | Keep; connect device for bounded physical tests |
| GitHub connector | Review/issue/PR context | Git CLI already sufficient locally | Optional, not needed for field pilot |
| CAD/AutoCAD MCP | Direct CAD assistance | Local DXF/Python pipeline and human AutoCAD cleanup | No verified mature candidate; do not install speculatively |
| Database MCP | Inspect future SQL data | Current JSON server and no production DB | Defer until backend choice |
| Security review skill/plugin | Auth/API threat review | Existing production-readiness audit | Useful before internet exposure; no new tool required tonight |
| RMT local skills | Business-rule guardrails | Already installed | Keep and improve as decisions evolve |

## API/Service Candidates

No paid API is needed for V1. The strongest direction is local/self-hosted libraries plus the chosen production backend. Potential future services:

- Managed PostgreSQL/object storage/auth: production hosting option, requires commercial and privacy decision.
- Error monitoring: consider hosted or self-hosted only after production architecture; self-hosted Sentry is operationally heavy for the current PC.
- Cloud CAD/drawing conversion: skip until clean-background workflow proves insufficient.
- Browser/device farms: paid and unnecessary before the first physical pilot.

## Drawing Solution Classification

| Need | Current solution | Recommendation |
| --- | --- | --- |
| Technician viewer | Image/SVG background plus normalized HTML pins | KEEP CURRENT |
| Zoom/pan | Current mimic controls | ENHANCE CURRENT; prove position retention |
| Pin overlay | Authoritative normalized pin records | KEEP CURRENT |
| Source PDF reference | External source plus optional Admin viewer | PDF.js only if needed |
| DXF/CAD | Offline Mimic Lab and human AutoCAD cleanup | KEEP OUT OF RUNTIME |
| Annotation/setup | Existing Admin pin tools and suggested pins | ENHANCE CURRENT |
| Offline background | Workbox/static cache proof | TEST LATER |

## Fire-Protection Domain Sources

No external procedure was promoted to an RMT requirement. Any future source review must record jurisdiction, standard/version, Malaysian applicability and Realmart SME approval. Manufacturer and customer-approved site SOPs remain authoritative.
