# Mimic And Drawing Audit

## Current Strengths

- Background assets and normalized interactive pins are separate.
- Scheduled service scope filters normal technician markers.
- Locked assigned pins remain visible and explain prerequisite state.
- Save returns to mimic; scroll/swipe is distinguished from a real pin tap.
- Mimic factory/review assets preserve identity transforms and exclude runtime pins.

## Verified Browser Evidence

- Assigned marker rendering is present in the current field probe.
- Phone mimic has no horizontal overflow at 360/390/430 px.
- Tablet landscape mimic overflows: 1,195 px document width in a 1,024 px viewport.
- Existing QA covers floor selection, marker presence, swipe-versus-tap and background asset integrity.

## Not Fully Verified In This Audit

- Exact zoom and pan restoration after device Save on physical Android.
- Pin hit behavior under real pinch/scroll gestures and poor device performance.
- Offline availability of large backgrounds/evidence without the isolated Workbox proof activated.
- Multi-floor state retention after browser process termination.

## Recommendation

**KEEP AND ENHANCE CURRENT.** Do not replace the pin engine or remap pins. For V1:

1. Fix tablet-landscape containment.
2. Preserve floor, zoom and pan in session state, then validate physically.
3. Keep status representation to a small set: not started/locked, active or pending, PASS, FAULT, pending sync.
4. Keep clean background replacement behind transform/alignment review.
5. Use PDF.js only as an Admin/reference viewer if source PDFs must be viewed; technician runtime should continue using optimized backgrounds.

Konva, DXF viewers and a new annotation engine are not justified for V1 because the current normalized pin layer already works.
