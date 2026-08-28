from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
SRC = ROOT / "outputs" / "mtb-mimic-pages"
OUT = ROOT / "outputs" / "mtb-mimic-list-extracted" / "mimic-pages-contact-sheet.png"


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    images = sorted(SRC.glob("mtb-*.png"))
    thumbs = []
    for path in images:
        image = Image.open(path).convert("RGB")
        image.thumbnail((360, 260))
        thumbs.append((path.name, image.copy()))

    width = 3 * 410
    height = ((len(thumbs) + 2) // 3) * 320
    sheet = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for idx, (name, image) in enumerate(thumbs):
        col = idx % 3
        row = idx // 3
        x = col * 410 + 20
        y = row * 320 + 20
        sheet.paste(image, (x, y + 24))
        draw.text((x, y), name, fill=(10, 30, 60), font=font)
        draw.rectangle([x, y + 24, x + image.width, y + 24 + image.height], outline=(10, 30, 60), width=2)
    sheet.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
