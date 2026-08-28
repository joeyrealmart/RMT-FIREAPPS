from collections import deque
from pathlib import Path
import csv

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
SRC_DIR = ROOT / "outputs" / "mtb-uploaded-floor-pdfs"
OUT_DIR = ROOT / "outputs" / "mtb-all-floor-colour-coded"

FLOORS = [
    ("basement", "Basement"),
    ("L1", "Level 1"),
    ("L2", "Level 2"),
    ("L3", "Level 3"),
    ("L4-5", "Level 4-5 Typical"),
    ("L6", "Level 6"),
    ("L7", "Level 7"),
    ("L8", "Level 8"),
    ("L9", "Level 9"),
    ("L10-23", "Level 10-23 Typical"),
    ("L24", "Level 24"),
    ("ROOF", "Roof"),
]

EXCLUDE_BOXES = {
    # Bottom table is a reference schedule for repeated levels, not a mimic plan.
    "L10-23": [(0.0, 0.52, 1.0, 1.0)],
    # The "You are here" fireman room block is a reference box, not a device area.
    "L1": [(0.12, 0.72, 0.46, 1.0)],
}

TYPE_STYLES = {
    "Smoke Detector": {"abbr": "SD", "rgb": (41, 121, 255)},
    "Fire Point / Zone Reference": {"abbr": "Z", "rgb": (245, 130, 32)},
    "CO2 System": {"abbr": "CO2", "rgb": (80, 80, 80)},
    "Break Glass / Call Point": {"abbr": "BG", "rgb": (242, 191, 38)},
    "Flow Switch": {"abbr": "FS", "rgb": (33, 176, 89)},
    "Unknown Red Symbol": {"abbr": "CHK", "rgb": (214, 48, 49)},
}


def load_font(size=16):
    candidates = [
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibri.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


def connected_components(mask):
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    components = []
    for y in range(height):
        xs = np.flatnonzero(mask[y] & ~seen[y])
        for x0 in xs:
            if seen[y, x0] or not mask[y, x0]:
                continue
            queue = deque([(x0, y)])
            seen[y, x0] = True
            min_x = max_x = x0
            min_y = max_y = y
            count = 0
            while queue:
                x, cy = queue.popleft()
                count += 1
                if x < min_x:
                    min_x = x
                if x > max_x:
                    max_x = x
                if cy < min_y:
                    min_y = cy
                if cy > max_y:
                    max_y = cy
                for nx in (x - 1, x, x + 1):
                    for ny in (cy - 1, cy, cy + 1):
                        if nx == x and ny == cy:
                            continue
                        if 0 <= nx < width and 0 <= ny < height and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            queue.append((nx, ny))
            components.append((min_x, min_y, max_x, max_y, count))
    return components


def mask_components(image, colour):
    arr = np.asarray(image.convert("RGB"))
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)

    if colour == "red":
        mask = (r > 185) & (g < 150) & (b < 150) & ((r - g) > 45) & ((r - b) > 45)
    elif colour == "green":
        mask = (g > 170) & (r < 130) & (b < 130) & ((g - r) > 40)
    elif colour == "yellow":
        mask = (r > 210) & (g > 160) & (b < 80)
    else:
        raise ValueError(colour)

    # Join thin CAD linework into one review marker per symbol.
    joined = Image.fromarray((mask * 255).astype("uint8")).filter(ImageFilter.MaxFilter(9))
    joined_mask = np.asarray(joined) > 0
    return connected_components(joined_mask)


def inside_excluded_area(component, source_name, image_size):
    min_x, min_y, max_x, max_y, _ = component
    cx = (min_x + max_x) / 2
    cy = (min_y + max_y) / 2
    page_w, page_h = image_size
    for left, top, right, bottom in EXCLUDE_BOXES.get(source_name, []):
        if page_w * left <= cx <= page_w * right and page_h * top <= cy <= page_h * bottom:
            return True
    return False


def red_centre_ratio(component, image):
    min_x, min_y, max_x, max_y, _ = component
    width = max_x - min_x + 1
    height = max_y - min_y + 1
    cx1 = int(min_x + width * 0.32)
    cx2 = int(min_x + width * 0.68)
    cy1 = int(min_y + height * 0.32)
    cy2 = int(min_y + height * 0.68)
    if cx2 <= cx1 or cy2 <= cy1:
        return 0
    arr = np.asarray(image.convert("RGB").crop((cx1, cy1, cx2, cy2)))
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    red = (r > 185) & (g < 150) & (b < 150) & ((r - g) > 45) & ((r - b) > 45)
    return red.sum() / red.size


def classify_component(component, colour, image_size, image):
    min_x, min_y, max_x, max_y, count = component
    width = max_x - min_x + 1
    height = max_y - min_y + 1
    page_w, page_h = image_size

    # Ignore the left-side printed legend and tiny dust.
    if min_x < page_w * 0.20 and width < page_w * 0.12:
        return None
    if count < 40 or width < 8 or height < 8:
        return None
    if width > page_w * 0.22 or height > page_h * 0.18:
        return None

    if colour == "green":
        return "Flow Switch"
    if colour == "yellow":
        return "Break Glass / Call Point"

    ratio = width / max(height, 1)
    if 0.65 <= ratio <= 1.45 and 26 <= width <= 95 and 26 <= height <= 95 and red_centre_ratio(component, image) > 0.035:
        return "Smoke Detector"
    if width >= 70 and height >= 35 and ratio >= 1.2:
        return "CO2 System"
    if width <= 60 and height <= 60:
        return "Fire Point / Zone Reference"
    return "Unknown Red Symbol"


def draw_marker(draw, x, y, tag, device_type, font):
    style = TYPE_STYLES[device_type]
    colour = style["rgb"]
    radius = 14
    draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=colour, outline="white", width=4)
    draw.ellipse([x - radius - 3, y - radius - 3, x + radius + 3, y + radius + 3], outline=colour, width=3)
    label = f"{style['abbr']}.{tag}"
    draw.rectangle([x + 18, y - 13, x + 18 + max(52, len(label) * 8), y + 8], fill="white", outline=colour, width=1)
    draw.text((x + 22, y - 11), label, fill=colour, font=font)


def add_title_and_legend(image, title):
    draw = ImageDraw.Draw(image)
    font = load_font(16)
    title_font = load_font(24)
    draw.rectangle([18, 18, 460, 72], fill="white", outline=(10, 30, 60), width=2)
    draw.text((32, 30), f"{title} - Colour Coded Review", fill=(10, 30, 60), font=title_font)

    x, y = 24, image.height - 198
    draw.rectangle([x - 8, y - 12, x + 330, y + 178], fill="white", outline=(10, 30, 60), width=2)
    draw.text((x, y - 2), "Legend / first-pass only", fill=(10, 30, 60), font=font)
    y += 28
    for device_type in [
        "Smoke Detector",
        "Fire Point / Zone Reference",
        "CO2 System",
        "Break Glass / Call Point",
        "Flow Switch",
        "Unknown Red Symbol",
    ]:
        style = TYPE_STYLES[device_type]
        draw.ellipse([x, y, x + 16, y + 16], fill=style["rgb"], outline="white", width=2)
        draw.text((x + 24, y - 1), f"{style['abbr']} - {device_type}", fill=(30, 40, 55), font=font)
        y += 24


def generate_floor(source_name, title):
    source = SRC_DIR / f"{source_name}-1.png"
    image = Image.open(source).convert("RGB")
    output = image.copy()
    draw = ImageDraw.Draw(output)
    font = load_font(14)
    rows = []
    seen_centres = []

    for colour in ("red", "green", "yellow"):
        for component in mask_components(image, colour):
            if inside_excluded_area(component, source_name, image.size):
                continue
            device_type = classify_component(component, colour, image.size, image)
            if not device_type:
                continue
            min_x, min_y, max_x, max_y, _ = component
            cx = int((min_x + max_x) / 2)
            cy = int((min_y + max_y) / 2)
            if any(abs(cx - sx) < 22 and abs(cy - sy) < 22 for sx, sy in seen_centres):
                continue
            seen_centres.append((cx, cy))
            tag_no = sum(1 for row in rows if row["device_type"] == device_type) + 1
            tag = f"{source_name.upper()}-{TYPE_STYLES[device_type]['abbr']}-{tag_no:02d}"
            draw_marker(draw, cx, cy, f"{tag_no:02d}", device_type, font)
            rows.append(
                {
                    "floor": title,
                    "device_tag": tag,
                    "device_type": device_type,
                    "image_x": cx,
                    "image_y": cy,
                    "status": "Needs review",
                }
            )

    add_title_and_legend(output, title)
    out_png = OUT_DIR / f"{source_name}-colour-coded-review.png"
    out_csv = OUT_DIR / f"{source_name}-device-first-pass.csv"
    output.save(out_png)
    with out_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["floor", "device_tag", "device_type", "image_x", "image_y", "status"])
        writer.writeheader()
        writer.writerows(rows)
    return out_png, out_csv, rows


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index = [
        "# MTB All Floor Colour-Coded Review",
        "",
        "First-pass device plotting from uploaded floor PDFs.",
        "",
        "Important: this is an automatic review layer. Please check wrong type, missed device, extra device, and location. CO2/panel-style symbols may need manual correction because the PDF text is drawn as artwork, not searchable text.",
        "",
    ]
    all_rows = []
    for source_name, title in FLOORS:
        out_png, out_csv, rows = generate_floor(source_name, title)
        index.append(f"- [{title}]({out_png.name}) - {len(rows)} first-pass markers, CSV: [{out_csv.name}]({out_csv.name})")
        all_rows.extend(rows)

    combined_csv = OUT_DIR / "all-floors-device-first-pass.csv"
    with combined_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["floor", "device_tag", "device_type", "image_x", "image_y", "status"])
        writer.writeheader()
        writer.writerows(all_rows)
    index.append("")
    index.append(f"Combined CSV: [{combined_csv.name}]({combined_csv.name})")
    (OUT_DIR / "index.md").write_text("\n".join(index) + "\n", encoding="utf-8")
    print(OUT_DIR)
    print(f"Total markers: {len(all_rows)}")


if __name__ == "__main__":
    main()
