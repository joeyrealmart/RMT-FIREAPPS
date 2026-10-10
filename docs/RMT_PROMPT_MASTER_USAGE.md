# RMT Prompt Master Usage

`tools/prompt-master/SKILL.md` is a development-only prompt compiler/checker inspired by the upstream Prompt Master structure. It is not an autonomous RMT agent and cannot decide production business logic.

## Codex implementation task

```text
Objective: Add a feature-flagged offline draft adapter for technician inspection saves.
Authoritative context: Existing shared-record server API and revision checks remain authoritative.
Allowed files: tools/offline-prototypes/ only until the adapter QA passes.
Protected: Wetex fixture, Photo Timestamp Evidence WIP, pin coordinates, report generator.
Required: Survive refresh, preserve operation IDs, expose conflicts instead of overwrite.
Exclude: Production migration, service worker, report changes, commits and pushes.
Verify: Focused persistence and duplicate-prevention QA.
Stop: If existing draft data cannot be read without destructive conversion.
Report: Files, tests, failures and physical Android follow-up.
```

## Bug fix

```text
Objective: Reproduce and fix only the reported technician issue.
Grounding: Physical Android observation is authoritative; identify the exact handler/render path first.
Allowed files: The smallest directly related production and QA files.
Required: Add a regression that proves the visible behaviour, then rerun the affected suite.
Exclude: UI redesign, unrelated storage changes, commits and pushes.
Stop: If the fix requires changing critical SOP content or frozen schedule data.
```

## Mimic/CAD task

```text
Objective: Produce an editable redraw of the supplied source drawing.
Authority: The original drawing is the sole geometry authority.
Required: Preserve visible footprint and labels; keep CAD layers and runtime pins separate.
Exclude: Invented rooms, inferred geometry, pin remapping, production integration.
Verify: Original-versus-redraw comparison and a list of uncertain areas.
```

## QA task

```text
Objective: Validate the stated workflow without mutating physical-test data.
Required: State test preconditions, isolate mutable fixtures, restore server snapshots in finally blocks.
Verify: State records, DOM behaviour and server API result where relevant.
Exclude: Changing production code merely to satisfy stale assertions.
```

## RuFlo/Ollama LIGHT task

```text
Role: documentation or QA review only.
Scope: Read specified docs/files and return a concise, grounded summary.
Exclude: Production edits, package installs, credentials, commits, pushes and autonomous follow-up.
Output: Findings, assumptions, unresolved questions and recommended next bounded task.
```
