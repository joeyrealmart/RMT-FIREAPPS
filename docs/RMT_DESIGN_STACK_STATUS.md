# RMT Design Stack Status

Updated: 2026-09-18

All active execution is local/free. No paid provider or cloud-model fallback is configured for this package.

| Tool | Status | Evidence / use |
| --- | --- | --- |
| Graphify 0.9.62 | VERIFIED_ACTIVE | Repository scope queried before review packaging; local graph only. |
| Prompt Master | VERIFIED_ACTIVE | Local helper at `tools/prompt-master/SKILL.md`; reserved for HEAVY task briefs and not required for Round 3. |
| Ponytail | VERIFIED_ACTIVE | Local skill under `.agents/skills/ponytail/`; progressive context rules remain active. |
| RMT Agent Skills | VERIFIED_ACTIVE | Domain guardrails under `.agents/skills/`. |
| RuFlo 3.38.23 + Ollama | VERIFIED_ACTIVE | Local `qwen2.5:1.5b-instruct` critique completed with no cloud fallback. |
| Local Playwright | VERIFIED_ACTIVE | Captures and desktop/mobile browser QA completed using Microsoft Edge. |
| Microsoft Playwright MCP 0.0.81 | VERIFIED_ACTIVE | Official `@playwright/mcp` package installed in `tools/rmt-design-stack/playwright-mcp/`; local server starts on `127.0.0.1`. |
| Taste Skill 1.1.0 | VERIFIED_REFERENCE_ONLY | Verified `senlindesign/taste-skill`; installed project-locally and used as capture/design-evidence guidance. |
| UI UX Pro Max | VERIFIED_ACTIVE | Verified `nextlevelbuilder/ui-ux-pro-max-skill`; local design-system search used with low variance/motion and high density. |
| Design Motion Principles | VERIFIED_REFERENCE_ONLY | Verified reference from `black12-ag/claude-skill`; restraint and reduced-motion guidance only, with no production animation work. |
| Awesome Claude Design | VERIFIED_REFERENCE_ONLY | Verified `rohitg00/awesome-claude-design`; retained as a local reference catalog, not an execution engine. |
| Glyph MCP | UNVERIFIED | Several unrelated projects use this name (code symbols, charts, diagrams, fonts). Nothing was installed or configured. |

## Local Paths

- Skills: `tools/rmt-design-stack/skills/`
- References: `tools/rmt-design-stack/references/`
- Playwright MCP: `tools/rmt-design-stack/playwright-mcp/`
- Round 3 source: `tools/rmt-ux-lab/visual-review-v3/`
- Round 3 output: `outputs/rmt-ux-lab/visual-review-v3/`

## Design Direction Used

- Dense operational layout rather than marketing-page spacing.
- Realmart red used as a controlled accent; navy/white provide structure.
- One dominant action per field state.
- Minimum 44px touch targets on mobile proposals.
- Sync, pending, conflict, and mismatch states remain visible near the work they affect.
- Motion stays minimal and must respect reduced-motion preferences if implemented later.

The design tools are advisory. Existing RMT business rules, evidence, shared records, scope, dependencies, and approval remain authoritative.
