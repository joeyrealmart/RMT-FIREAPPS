# RMT-MIMIC-LAB

An isolated deterministic source-to-review prototype for customer mimic
documents. Revision 3 reconstructs clean source-supported navigation linework
instead of reproducing every scan stroke. It is not loaded by RMT FIREAPPS and
does not write device masters, runtime pins, or production mimic assets.

## Safety rules

- The source PDF is authoritative.
- Background geometry and device pins remain separate.
- Unclear IDs, symbols, geometry, and labels are retained as review items.
- The extractor does not generate candidate pins, device IDs, or labels.
- Nothing in this folder is an automated production import.

## LTK pilot

Place `Mimic LTK.pdf` at `tools/rmt-mimic-lab/source/LTK/`, then run:

```powershell
python tools/rmt-mimic-lab/build_ltk_lab.py
```

Run `node tools/rmt-mimic-lab/serve-lab.mjs`, then open
`http://127.0.0.1:8031/`. The review screen works without the production
application and compares Original, Revision 2 raw extraction, Revision 3 clean
redraw, overlay, and editable DXF/SVG deliverables.

The earlier `outputs/mimic-cad-pilot/ltk/` images are appearance references
only. Their hard-coded geometry is not imported. The source PDF remains the
only geometry authority, and every Revision 3 result remains `REVIEW_REQUIRED`.

## Architecture influences

Agent-CAD's useful pattern is a clear separation between document intake,
explicit geometry, validation, and editable DXF delivery. DraftEase is useful
as a future optional computer-vision tracing path for clean scans. Neither
project code is copied or installed here.
