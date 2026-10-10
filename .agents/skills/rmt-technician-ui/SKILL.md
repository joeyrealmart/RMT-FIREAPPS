---
name: rmt-technician-ui
description: Implement or review the RMT FIREAPPS technician experience on Android and desktop while preserving inspection logic. Use for assigned jobs, system stages, mimic-first inspection, PASS/FAULT, evidence, Save & Next, completion, touch, or performance work.
---

# RMT Technician UI

- Preserve the golden path: assigned job -> system check -> service-scope mimic -> device -> result/evidence -> save -> mimic -> completion/submission.
- Keep admin controls and diagnostics out of the normal technician flow.
- Preserve dependency locks, frozen `plannedDeviceIds`, revision checks, technician attribution, and submitted-job read-only behavior.
- Prefer one focused workspace, large touch targets, minimal typing, stable scroll, and lazy rendering.
- A swipe over a marker must not activate it; a genuine tap must.
- Validate real DOM visibility, Android overflow, session restore, and performance rather than relying only on existence assertions.

