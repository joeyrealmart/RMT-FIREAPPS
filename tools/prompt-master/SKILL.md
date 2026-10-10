---
name: rmt-prompt-master
description: Compile bounded, testable prompts for RMT FIREAPPS development work. Development tooling only; it never changes production code or decides business rules.
---

# RMT Prompt Master

Use this helper to turn a request into one focused execution prompt. It follows the upstream Prompt Master approach: identify target tool, intent, constraints, success criteria and stop conditions, then remove non-essential wording.

## Mandatory RMT rules

- V1 before V2.
- Never invent mimic geometry; original customer/source drawings are authoritative.
- Mimic backgrounds and runtime pins remain separate.
- Preserve technician original findings; AI suggestions never silently replace technician wording.
- Admin has final approval.
- Preserve offline functionality and current Photo Timestamp Evidence WIP.
- Do not overwrite unrelated working files.
- Prefer focused changes over broad rewrites.
- Run focused QA before broad regressions.
- Physical Android testing is the release truth gate.
- Do not commit or push unless explicitly instructed.
- Report changed files, tests, failures and remaining physical tests.
- Stop and ask before destructive migration.

## Prompt contract

Produce prompts with these sections:

1. Objective
2. Current context and authoritative inputs
3. Allowed files and protected areas
4. Required behaviour
5. Explicit exclusions
6. Verification
7. Stop conditions
8. Required final report

Ask no more than three questions only when an answer is necessary to prevent a destructive or unsafe decision.
