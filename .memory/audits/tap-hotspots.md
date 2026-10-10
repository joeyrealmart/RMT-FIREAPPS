# Tap Hotspots

Evidence combines `docs/reviews/technician-nav/RMT_TECHNICIAN_NAV_REVIEW.md`, current DOM inspection and existing focused QA.

| Flow | Current measured/minimum actions | Hotspot | Safe reduction |
| --- | ---: | --- | --- |
| Home to Fire Alarm | 2 taps | Acceptable | Keep |
| Home to configured pump system | 2 taps, sometimes 3 for child choice | Pump grouping is not always obvious | Persist selected pump child and expose configured labels only |
| System to another system | 1 tap when tabs visible; typically 2 after scrolling | Navigation is position-dependent | Persistent rail/drawer already proposed |
| Checklist to mimic | 1 tap when visible | Competes with other navigation actions | Keep one secondary Mimic action |
| Routine device PASS | Open pin, choose PASS, save | No structural excess confirmed | Keep PASS path minimal and Save & Next dominant |
| Routine device FAULT | Open pin, choose FAULT, add required notes/evidence, save | Necessary exception work | Expand fault-only fields after FAULT |
| N/A | Open pin, choose N/A, provide configured reason if required, save | Policy varies by template | Require only approved reason/evidence fields |
| Linked verification | Open linked card, choose result, optionally evidence/note, save side | Multiple full cards inline | Replace inline repetition with compact status rows plus one focused editor |
| Return to mimic | Automatic after normal Save; explicit for prerequisite reference | Previously caused navigation confusion | Preserve current explicit route and scroll/touch fix |

## Repeated Action Risks

- Reopening the system list after scrolling down a long SOP.
- Scanning repeated linked-verification cards to locate the assigned event.
- Reconfirming context already known from technician, job, site, system and device.
- Navigating around native checkbox/radio controls whose visual hit areas may be smaller than the surrounding label.

## Baseline For Future Comparison

- Home to system: 2 taps.
- Device routine PASS: 3 task actions after mimic context (pin, PASS, Save/Save & Next).
- Device routine FAULT: 4 base actions plus note/evidence interaction.
- Drawing reopen after Save: 0 in intended Save-to-mimic flow.
- Manual sync action: 0 online; current offline prototype uses explicit Retry Sync for proof only.
- Exact photo/camera taps and keyboard interactions require physical Android measurement.

These counts describe logical UI actions, not elapsed time.
