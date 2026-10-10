# RMT Skill Candidates

Assessment date: 2026-10-07

Discovery method: existing RMT skills, official Vercel `skills.sh` search API, then source/license/activity checks. No skill was installed.

## Existing RMT Skills: Highest Priority

These project-owned skills already express the rules generic skills are most likely to miss.

| Rank | Skill | Exact RMT job | Decision |
| ---: | --- | --- | --- |
| 1 | `rmt-core` | Protect frozen scope, revisions, authoritative shared records, ownership, Admin approval, and release discipline | V1 NOW, mandatory for production changes |
| 2 | `rmt-qa-release` | Select focused QA, preserve fixtures, perform release hygiene, distinguish automated from physical evidence | V1 NOW |
| 3 | `rmt-technician-ui` | Android/desktop field flow, PASS/FAULT, evidence, Save & Next, touch and performance without weakening logic | V1 NOW |
| 4 | `rmt-offline-sync` | Dexie queue, idempotency, reconnect, conflicts, evidence durability and ownership | V1 NOW when offline work is explicitly approved |
| 5 | `rmt-linked-verification` | Pump/suppression side ownership, reconciliation, mismatch and offline side drafts | V1 NOW |
| 6 | `rmt-reporting` | Submission, Admin review, report snapshots, sign-off and evidence integrity | V1 NOW |
| 7 | `rmt-mimic` | Source-backed clean backgrounds and pin-preservation QA; no invented geometry | V1 NOW for Mimic Lab only |
| 8 | `graphify` + `ponytail` | Narrow repository scope and avoid repeatedly loading unrelated WIP | V1 NOW |

## V1 Now: External Candidates

These are candidate instructions, not new reasoning engines. Their value is in better checklists and repeatability; deterministic tests remain authoritative.

| Priority | Skill | Catalog evidence | RMT job | Risk/overlap | Recommendation |
| ---: | --- | --- | --- | --- | --- |
| 1 | `mattpocock/skills@code-review` | ~676K catalog installs; source MIT and active | Structured diff review after a bounded implementation: regressions, missing tests, state mistakes | Overlaps Codex/Qodo; a weak local model may still miss defects | INSTALL-NOW CANDIDATE, but use on diffs only |
| 2 | `currents-dev/playwright-best-practices-skill@playwright-best-practices` | ~90K installs; MIT; active | Improve QA isolation, locators, waiting, trace/network assertions, and test determinism | Existing QA is mature; do not rewrite passing suites wholesale | INSTALL-NOW CANDIDATE |
| 3 | `addyosmani/web-quality-skills@accessibility` | ~59K installs; MIT; active | Touch targets, focus, labels, contrast, keyboard and responsive checks for Technician/Admin | Must not override field workflow or physical Android evidence | INSTALL-NOW CANDIDATE |
| 4 | `getsentry/skills@security-review` | ~19K installs; Apache-2.0; active | Read-only threat checklist for auth, API boundaries, secrets, evidence links and server exposure | Advisory only; generic web security cannot select RMT architecture | INSTALL-NOW CANDIDATE after inspecting its exact permissions/content |
| 5 | `anthropics/skills@webapp-testing` | ~171K installs; reputable source | General browser test planning and artifact capture | Heavy overlap with existing Playwright skills; repository has no top-level SPDX license metadata | KEEP AVAILABLE; choose this **or** Currents, not both initially |

Source pages: [Matt Pocock skills](https://github.com/mattpocock/skills), [Currents Playwright skill](https://github.com/currents-dev/playwright-best-practices-skill), [Addy Osmani web-quality skills](https://github.com/addyosmani/web-quality-skills), [Sentry skills](https://github.com/getsentry/skills), [Anthropic skills](https://github.com/anthropics/skills).

## V1 Later

| Candidate | Exact future RMT job | Why later |
| --- | --- | --- |
| `supabase/agent-skills@supabase-postgres-best-practices` | Schema/index/RLS review if Supabase/Postgres is explicitly chosen | Backend decision is not approved; installing now biases architecture |
| `better-auth/skills@better-auth-security-best-practices` | Authentication review only if Better Auth is selected | Framework-specific and source license metadata needs review |
| `earthtojake/text-to-cad@dxf` / `cad-viewer` | Isolated Mimic Lab DXF inspection/rendering | Never geometry authority; not needed for current `ORIGINAL + CLEAR` V1 approach |
| `wshobson/agents@database-migration` | Migration checklist after production database selection | Generic and lower-trust than official database-specific guidance |

## V2 Candidates

| Capability | Best current route | Candidate status |
| --- | --- | --- |
| Private company knowledge/RAG | Existing Mem0 + embedded Qdrant + Ollama, with curated Realmart/manual sources | V2 CANDIDATE; strengthen source/version/access controls before adding another skill |
| Production Postgres/RLS | Official database vendor skill after hosting choice | V2/V1.1 CANDIDATE |
| Drawing interpretation | Mimic Lab deterministic extraction plus human CAD review; optional DXF skills | V2 CANDIDATE; never auto-write master pins |
| Automatic report summaries | Structured RMT report data plus local/server model with Admin approval | V2 CANDIDATE; preserve technician wording and evidence |
| Fault trends/predictive maintenance | Query normalized inspection/defect history after production data quality exists | V2 CANDIDATE; no current data basis for prediction |
| Voice/multilingual assistance | Browser/device speech and controlled translation with original text retained | V2 CANDIDATE; privacy and field reliability evaluation required |
| Quotation assistance | Approved defect records + Realmart rate library + Admin approval | V2 CANDIDATE; no autonomous pricing |

## Rejected Results

| Search result/type | Reason |
| --- | --- |
| `alinaqi/maggy@pwa-development`, `jwynia/agent-skills@pwa-development` | Low adoption/unknown rigor; generic PWA guidance is weaker than existing Workbox/Dexie POC plus `rmt-offline-sync` |
| `jwynia/agent-skills@pdf-generator` and small report-generator skills | Low adoption and unclear license/quality; existing pdfme evaluation and RMT reporting contract are safer |
| `eachlabs/skills@floor-plan-generation` | Generative floor plans violate the no-invented-geometry rule |
| Firecrawl results for “fire protection inspection” | Name collision: web crawler, not fire-protection domain knowledge |
| Generic fire-alarm/sprinkler AI skills | No credible, maintained, Malaysia-aware skill was found in the official catalog search |
| Large agent-orchestration skills | Duplicate current routing/RuFlo controls and add coordination cost |

## Fire-Protection Knowledge Classification

- **Software tool:** none from the skill search is approved as a fire-system procedure authority.
- **Design/calculation tool:** out of scope for V1 maintenance workflow and requires qualified engineering validation.
- **Reference knowledge:** manufacturer manuals, customer-approved SOPs and Realmart configuration may be curated later.
- **Standard/code reference:** Malaysian authority/customer requirements and licensed standards must be validated by Realmart; international standards are not automatically applicable.
- **AI agent:** no candidate may create operating, activation, isolation, discharge, restoration or test procedures.

## Suggested Install Commands (Not Executed)

```text
npx skills add mattpocock/skills --skill code-review
npx skills add currents-dev/playwright-best-practices-skill --skill playwright-best-practices
npx skills add addyosmani/web-quality-skills --skill accessibility
npx skills add getsentry/skills --skill security-review
```

Before any installation: inspect each `SKILL.md`, pin the source commit where practical, install project-local first, and test in an isolated worktree.
