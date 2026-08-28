from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from dxf_preview import parse_dxf, collect_primitives
from make_level1_clean import BOX, MARKERS, TYPE_COLORS

OUT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\outputs\mtb-cad-preview\MTB-Level1-color-coded-preview.png")
SRC = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\MIMIC-R1 2000.dxf")

RGB = {
    "Wet Chemical System": (218, 70, 180),
    "Emergency Light": (242, 191, 38),
    "Smoke Detector": (41, 121, 255),
    "Hose Reel": (214, 48, 49),
    "Wet Riser": (128, 20, 28),
    "Flow Switch": (33, 176, 89),
    "Fireman Intercom": (126, 87, 194),
    "Fire Point / Zone Reference": (245, 130, 32),
    "CO2 System": (80, 80, 80),
}


def in_box(point):
    x, y = point
    min_x, min_y, max_x, max_y = BOX
    return min_x <= x <= max_x and min_y <= y <= max_y


def main():
    entities = parse_dxf(str(SRC))
    lines, circles, texts, _ = collect_primitives(entities)
    cropped_lines = [(a, b) for a, b in lines if in_box(a) or in_box(b)]
    cropped_circles = [(x, y, r) for x, y, r in circles if in_box((x, y))]
    cropped_texts = [(x, y, t) for x, y, t in texts if in_box((x, y))]

    min_x, min_y, max_x, max_y = BOX
    margin = 70
    width = 2400
    height = 1050
    scale = min((width - margin * 2) / (max_x - min_x), (height - margin * 2) / (max_y - min_y))

    def tx(point):
        x, y = point
        return margin + (x - min_x) * scale, height - margin - (y - min_y) * scale

    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()

    for a, b in cropped_lines:
        draw.line([tx(a), tx(b)], fill=(25, 35, 50), width=2)
    for x, y, r in cropped_circles:
        cx, cy = tx((x, y))
        rr = max(2, r * scale)
        draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=(25, 35, 50), width=2)
    for x, y, text in cropped_texts:
        px, py = tx((x, y))
        draw.text((px, py), text, fill=(31, 82, 147), font=font)

    for tag, label, x, y in MARKERS:
        px, py = tx((x, y))
        color = RGB.get(label, (60, 60, 60))
        draw.ellipse([px - 12, py - 12, px + 12, py + 12], fill=color, outline=(255, 255, 255), width=4)
        draw.ellipse([px - 15, py - 15, px + 15, py + 15], outline=color, width=3)
        draw.text((px + 18, py - 14), tag, fill=color, font=font)
        draw.text((px + 18, py + 1), label, fill=(70, 70, 70), font=font)

    legend_x, legend_y = 80, 820
    draw.text((legend_x, legend_y - 42), "Color Legend", fill=(10, 30, 60), font=font)
    for idx, (label, color) in enumerate(RGB.items()):
        y = legend_y + idx * 28
        draw.ellipse([legend_x, y, legend_x + 18, y + 18], fill=color, outline=(255, 255, 255), width=2)
        draw.text((legend_x + 28, y + 3), label, fill=(25, 35, 50), font=font)

    image.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
