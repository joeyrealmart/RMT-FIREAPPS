# RMT Mimic Style Lessons

Updated: 2026-09-17

## Authorities

- Original customer PDF/DWG/DXF: sole authority for geometry, orientation, proportions, labels, and landmarks.
- Earlier Monday LTK output: visual-simplicity reference only. Its generic geometry must never be copied as source truth.
- Production pin/device records: separate authoritative layer. A background build must not generate, move, or embed runtime pins.

## Approved Direction

- Clean white background and restrained dark linework.
- Fewer, longer editable CAD primitives in place of duplicated scan edges and disconnected fragments.
- Preserve source-confirmed walls, partitions, openings, doors, stairs, useful beams, corridors, and fixed navigation landmarks.
- Remove handwriting, arrows, dimensions, title blocks, hatching, old device marks, decorative borders, scan noise, and unrelated engineering notes.
- Keep only source-confirmed labels that materially help technician navigation.
- Preserve source canvas, aspect ratio, origin, scale, and rotation whenever possible.

## What Failed

- Raw line extraction retained too many broken scan strokes and text fragments.
- A visually clean generic redraw can look attractive while inventing or omitting geometry. It cannot be used as geometry authority.
- Entity-count reduction alone does not prove correctness. Every major section still needs source comparison and human review.

## LTK Clean CAD Pass

- Main Panel: 182 Revision 3 entities reduced to 88 editable entities.
- Feed Mill: 79 reduced to 61 editable entities.
- Egg Production: 264 reduced to 86 editable entities.
- Outputs retain identity transforms and exclude runtime pins.
- No authoritative LTK runtime pin registry was found, so real pin-to-landmark alignment remains a human/data prerequisite even though transform drift is zero.

## Release Gate

All generated backgrounds remain `REVIEW_REQUIRED`. Do not process other clients or integrate a background into production until Joey approves the LTK CAD style and confirms source geometry/landmark alignment.
