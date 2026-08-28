from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
WETEX = ROOT / "outputs" / "rmt-fire-local-data" / "mimic-library" / "WETEX"


def line_runs(mask: np.ndarray, min_len: int) -> np.ndarray:
    h, w = mask.shape
    keep = np.zeros_like(mask, dtype=bool)

    for y in range(h):
        row = mask[y]
        x = 0
        while x < w:
            if not row[x]:
                x += 1
                continue
            start = x
            while x < w and row[x]:
                x += 1
            if x - start >= min_len:
                keep[y, start:x] = True

    for x in range(w):
        col = mask[:, x]
        y = 0
        while y < h:
            if not col[y]:
                y += 1
                continue
            start = y
            while y < h and col[y]:
                y += 1
            if y - start >= min_len:
                keep[start:y, x] = True

    return keep


def diagonal_runs(mask: np.ndarray, min_len: int) -> np.ndarray:
    h, w = mask.shape
    keep = np.zeros_like(mask, dtype=bool)

    for offset in range(-h + 1, w):
        diag = np.diagonal(mask, offset=offset)
        coords = [(i, i + offset) if offset >= 0 else (i - offset, i) for i in range(len(diag))]
        run_start = None
        for i, value in enumerate(diag):
            if value and run_start is None:
                run_start = i
            if (not value or i == len(diag) - 1) and run_start is not None:
                end = i + 1 if value and i == len(diag) - 1 else i
                if end - run_start >= min_len:
                    for j in range(run_start, end):
                        y, x = coords[j]
                        if 0 <= y < h and 0 <= x < w:
                            keep[y, x] = True
                run_start = None

    flipped = np.fliplr(mask)
    flipped_keep = np.zeros_like(mask, dtype=bool)
    for offset in range(-h + 1, w):
        diag = np.diagonal(flipped, offset=offset)
        coords = [(i, i + offset) if offset >= 0 else (i - offset, i) for i in range(len(diag))]
        run_start = None
        for i, value in enumerate(diag):
            if value and run_start is None:
                run_start = i
            if (not value or i == len(diag) - 1) and run_start is not None:
                end = i + 1 if value and i == len(diag) - 1 else i
                if end - run_start >= min_len:
                    for j in range(run_start, end):
                        y, xf = coords[j]
                        x = w - 1 - xf
                        if 0 <= y < h and 0 <= x < w:
                            flipped_keep[y, x] = True
                run_start = None
    return keep | flipped_keep


def clean_structure(src: Path, dest: Path) -> None:
    image = Image.open(src).convert("RGB")
    arr = np.asarray(image).astype(np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    maxc = arr.max(axis=2)
    minc = arr.min(axis=2)
    saturation = maxc - minc
    luminance = (0.299 * r + 0.587 * g + 0.114 * b)

    # Keep mostly neutral dark drafting lines. This removes many blue/green/red/yellow notes.
    mask = (luminance < 170) & (saturation < 45)

    # Slightly thicken before line-run extraction, so broken scan lines still connect.
    thick = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8), "L").filter(ImageFilter.MinFilter(3))
    mask = np.asarray(thick) < 128

    structure = line_runs(mask, 18) | diagonal_runs(mask, 22)

    # Keep a little immediate neighborhood around accepted line pixels.
    structure_img = Image.fromarray(np.where(structure, 0, 255).astype(np.uint8), "L")
    structure_img = structure_img.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))

    out = Image.new("RGB", image.size, "white")
    out.paste(Image.merge("RGB", (structure_img, structure_img, structure_img)))

    draw = ImageDraw.Draw(out)
    draw.rectangle((0, 0, image.width - 1, image.height - 1), outline="#d9e2ef", width=2)
    draw.text((18, 16), f"Pin-safe structure clean - {src.stem}", fill="#667085")

    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest)


def make_sheet(paths: list[Path], dest: Path) -> None:
    thumbs = []
    for p in paths:
        img = Image.open(p).convert("RGB")
        thumb = img.resize((360, int(img.height * 360 / img.width)))
        canvas = Image.new("RGB", (thumb.width, thumb.height + 34), "white")
        canvas.paste(thumb, (0, 0))
        d = ImageDraw.Draw(canvas)
        d.rectangle((0, thumb.height, thumb.width - 1, thumb.height + 33), fill="#f8fafc", outline="#d9e2ef")
        d.text((8, thumb.height + 10), p.name, fill="#162033")
        thumbs.append(canvas)

    cols, gap = 3, 16
    rows = (len(thumbs) + cols - 1) // cols
    cell_w, cell_h = max(t.width for t in thumbs), max(t.height for t in thumbs)
    sheet = Image.new("RGB", (cols * cell_w + (cols + 1) * gap, rows * cell_h + (rows + 1) * gap), "#eef3f8")
    for i, thumb in enumerate(thumbs):
        sheet.paste(thumb, (gap + (i % cols) * (cell_w + gap), gap + (i // cols) * (cell_h + gap)))
    sheet.save(dest)


def main() -> None:
    outputs = []
    for src in sorted((WETEX / "floors").glob("wetex-floor-*.png")):
        dest = WETEX / "clean" / f"{src.stem}-structure.png"
        clean_structure(src, dest)
        outputs.append(dest)
        print(dest)
    make_sheet(outputs, WETEX / "clean" / "wetex-structure-contact-sheet.png")


if __name__ == "__main__":
    main()
