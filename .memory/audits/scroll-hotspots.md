# Scroll Hotspots

Source: read-only Playwright probe on 2026-10-04. All API writes were blocked. These are browser-emulated measurements, not physical Android results.

| Screen | Viewport | Document height | Approx. viewport lengths | Important controls below fold | Field impact | Recommendation |
| --- | --- | ---: | ---: | --- | --- | --- |
| Active job/system list | 360x800 | 4,304 px | 5.4 | Yes | System choice and completion state are separated vertically | Keep current system rail/cards; collapse non-current secondary sections |
| Fire Alarm system | 360x800 | 6,726 px | 8.4 | Yes | Panel SOP, stages and linked cards create a long mixed workspace | Show one current stage; move linked work to a compact summary with explicit open action |
| Pump system | 360x800 | 10,834 px | 13.5 | Yes | Highest repeated scrolling burden | Progressive disclosure by configured pump/test step; sticky stage and save action |
| Gas/CO2 system | 360x800 | 6,976 px | 8.7 | Yes | SOP and linked cards compete | Keep approved sequence but render one active step/group |
| Emergency light | 360x800 | 1,830 px | 2.3 | Some | Manageable | Keep mimic-first behavior |
| Fire Alarm mimic | 360x800 | 1,849 px | 2.3 | No critical save control | Reasonable | Preserve current map-first workspace |
| Pump system | 768x1024 | 8,955 px | 8.7 | Yes | Tablet is not using width to reduce navigation burden | Consider tablet split view only after prototype testing |
| Fire Alarm mimic | 1024x768 | 1,194 px, width 1,195 px | 1.6 | N/A | Horizontal overflow in landscape | Fix workspace sizing/containment before tablet pilot |

## Findings

- Phone width no longer overflows at 360, 390 or 430 px in this route.
- The problem is vertical composition, not generally undersized system cards.
- Pump is the dominant scrolling hotspot across every measured viewport.
- Current linked-verification cards appear inline with system work and materially lengthen Fire Alarm and Pump pages.
- Normal background renders showed no scroll jump in the established scroll-preservation QA; avoid reintroducing global scroll restoration.

## Measurement Limit

Scroll gestures were not converted into an artificial count because swipe distance differs by device and user. Document-to-viewport ratios are the stable baseline.
