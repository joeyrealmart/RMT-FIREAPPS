---
name: rmt-mimic
description: Work on RMT FIREAPPS mimic backgrounds, manifests, review assets, and pin-preservation QA. Use for RMT-MIMIC-LAB, floor-plan cleanup, background replacement, or mimic review; never redesign the production pin engine.
---

# RMT Mimic

- Keep two layers: clean navigation background and existing authoritative interactive pins.
- Source drawings are geometry authority. Never invent rooms, doors, stairs, lifts, labels, equipment, or relationships.
- Preserve original canvas/aspect ratio and normalized pin coordinates unless human review approves a transform.
- Do not store pins in background manifests or bake runtime pins into images.
- Deterministic processing may remove scan noise, handwriting, dimensions, arrows, and obsolete device marks while preserving building geometry and useful printed labels.
- Mark ambiguity `REVIEW_REQUIRED`; do not guess.
- Verify source/reference, PNG, SVG, DXF, overlay, manifest, review status, and unchanged production pin/device checksums.

