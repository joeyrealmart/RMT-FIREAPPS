from pathlib import Path
from PIL import Image, JpegImagePlugin


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
SRC_DIR = ROOT / "outputs" / "mtb-mimic-list-plotted-landscape"
OUT = SRC_DIR / "MTB-mimic-list-plotted-landscape-review.pdf"

ORDER = [
    "basement",
    "L1",
    "L2",
    "L3",
    "L4-5",
    "L6",
    "L7",
    "L8",
    "L9",
    "L10-23",
    "L24",
    "ROOF",
]


def main():
    pages = []
    for code in ORDER:
        path = SRC_DIR / f"{code}-mimic-list-landscape.png"
        if not path.exists():
            continue
        image = Image.open(path).convert("RGB")
        pages.append(image)
    if not pages:
        raise SystemExit("No pages found")
    pages[0].save(OUT, save_all=True, append_images=pages[1:], resolution=150.0)
    print(OUT)


if __name__ == "__main__":
    main()
