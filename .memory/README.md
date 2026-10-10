# RMT FIREAPPS Project Memory

This directory is the provider-independent project memory for RMT FIREAPPS V1.

## Authority

1. Current human instruction
2. CONFIRMED requirement
3. Approved DECISION
4. Verified current code
5. Old documentation
6. AGENT NOTE

## Classes

- `CONFIRMED`: human-approved requirement.
- `DECISION`: approved technical or design decision.
- `COMPLETED`: implemented and verified.
- `CURRENT WORK`: active development.
- `KNOWN ISSUE`: verified unresolved issue.
- `TEST RESULT`: an actually executed test.
- `FAILED APPROACH`: an attempted approach that did not work.
- `AGENT NOTE`: an unverified finding awaiting review.
- `DEPRECATED`: information that must no longer be followed.

## Security

Never store passwords, API keys, access tokens, private keys, production
credentials, customer secrets, or raw customer evidence here. Machine-local
secrets belong in ignored environment/configuration files.

## Workflow

At task start, read `requirements.md`, `decisions.md`, `current-work.md`,
`known-issues.md`, `failed-approaches.md`, and relevant test results. Worker
findings enter `agent-notes.md` first and are promoted only after verification.

