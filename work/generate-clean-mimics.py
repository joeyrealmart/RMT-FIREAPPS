from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
MIMIC_ROOT = ROOT / "outputs" / "rmt-fire-local-data" / "mimic-library"


def simplify_mimic(src: Path, dest: Path) -> None:
    image = Image.open(src).convert("RGB")
    arr = np.asarray(image).astype(np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    maxc = arr.max(axis=2)
    minc = arr.min(axis=2)
    saturation = maxc - minc
    luminance = (0.299 * r + 0.587 * g + 0.114 * b)

    # Keep neutral drafting lines, remove most colored labels/icons and pale scan background.
    neutral_dark = (luminance < 185) & (saturation < 55)
    very_dark = luminance < 80
    mask = neutral_dark | very_dark

    bw = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8), mode="L")

    # Light cleanup: connect faint outline strokes and remove tiny speckles.
    bw = bw.filter(ImageFilter.MinFilter(3))
    bw = bw.filter(ImageFilter.MaxFilter(3))

    # Add a small title block so the clean layer is clearly not the original document.
    output = Image.new("RGB", image.size, "white")
    output.paste(ImageOps.colorize(bw, black="#111827", white="#ffffff"))
    draw = ImageDraw.Draw(output)
    label = f"Clean outline layer - {src.stem}"
    draw.rectangle((12, 12, min(image.width - 12, 500), 48), fill="white", outline="#d9e2ef")
    draw.text((24, 24), label, fill="#475467")

    dest.parent.mkdir(parents=True, exist_ok=True)
    output.save(dest)


def make_contact_sheet(images: list[Path], dest: Path, thumb_width: int = 320) -> None:
    thumbs = []
    for path in images:
        img = Image.open(path).convert("RGB")
        ratio = thumb_width / img.width
        thumb = img.resize((thumb_width, max(1, int(img.height * ratio))))
        canvas = Image.new("RGB", (thumb.width, thumb.height + 34), "white")
        canvas.paste(thumb, (0, 0))
        draw = ImageDraw.Draw(canvas)
        draw.rectangle((0, thumb.height, thumb.width - 1, thumb.height + 33), fill="#f8fafc", outline="#d9e2ef")
        draw.text((8, thumb.height + 10), path.name, fill="#162033")
        thumbs.append(canvas)

    if not thumbs:
        return

    cols = 3
    gap = 16
    rows = (len(thumbs) + cols - 1) // cols
    cell_w = max(t.width for t in thumbs)
    cell_h = max(t.height for t in thumbs)
    sheet = Image.new("RGB", (cols * cell_w + (cols + 1) * gap, rows * cell_h + (rows + 1) * gap), "#eef3f8")
    for index, thumb in enumerate(thumbs):
        x = gap + (index % cols) * (cell_w + gap)
        y = gap + (index // cols) * (cell_h + gap)
        sheet.paste(thumb, (x, y))
    dest.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(dest)


def main() -> None:
    jobs: list[tuple[Path, Path]] = []
    for src in sorted((MIMIC_ROOT / "UOB" / "pages").glob("page-*.png")):
        jobs.append((src, MIMIC_ROOT / "UOB" / "clean" / f"{src.stem}-clean.png"))
    for src in sorted((MIMIC_ROOT / "WETEX" / "floors").glob("wetex-floor-*.png")):
        jobs.append((src, MIMIC_ROOT / "WETEX" / "clean" / f"{src.stem}-clean.png"))

    outputs = []
    for src, dest in jobs:
        simplify_mimic(src, dest)
        outputs.append(dest)
        print(f"{src} -> {dest}")

    make_contact_sheet(
        [p for p in outputs if "\\UOB\\" in str(p) or "/UOB/" in str(p)],
        MIMIC_ROOT / "UOB" / "clean" / "uob-clean-contact-sheet.png",
    )
    make_contact_sheet(
        [p for p in outputs if "\\WETEX\\" in str(p) or "/WETEX/" in str(p)],
        MIMIC_ROOT / "WETEX" / "clean" / "wetex-clean-contact-sheet.png",
    )


if __name__ == "__main__":
    main()
