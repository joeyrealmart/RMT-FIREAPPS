from collections import deque
from pathlib import Path
import csv
import math

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
MIMIC_DIR = ROOT / "outputs" / "mtb-mimic-pages"
FLOOR_DIR = ROOT / "outputs" / "mtb-uploaded-floor-pdfs"
OUT_DIR = ROOT / "outputs" / "mtb-mimic-list-plotted-landscape"

FLOORS = [
    ("basement", "Basement", ["mtb-01.png", "mtb-02.png"], "basement-1.png"),
    ("L1", "Level 1", ["mtb-03.png"], "L1-1.png"),
    ("L2", "Level 2", ["mtb-04.png"], "L2-1.png"),
    ("L3", "Level 3", ["mtb-05.png"], "L3-1.png"),
    ("L4-5", "Level 4-5 Typical", ["mtb-06.png"], "L4-5-1.png"),
    ("L6", "Level 6", ["mtb-07.png"], "L6-1.png"),
    ("L7", "Level 7", ["mtb-08.png"], "L7-1.png"),
    ("L8", "Level 8", ["mtb-09.png"], "L8-1.png"),
    ("L9", "Level 9", ["mtb-10.png"], "L9-1.png"),
    ("L10-23", "Level 10-23 Typical", ["mtb-11.png"], "L10-23-1.png"),
    ("L24", "Level 24", ["mtb-12.png"], "L24-1.png"),
    ("ROOF", "Roof", ["mtb-13.png"], "ROOF-1.png"),
]

COLOUR_STYLES = {
    "green": {"label": "Green mimic marker", "rgb": (34, 176, 89)},
    "blue": {"label": "Blue mimic marker", "rgb": (41, 121, 255)},
    "red": {"label": "Red mimic marker", "rgb": (214, 48, 49)},
    "magenta": {"label": "Purple/Pink mimic marker", "rgb": (185, 77, 185)},
    "yellow": {"label": "Yellow/Orange mimic marker", "rgb": (242, 191, 38)},
}


def load_font(size):
    for path in [r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\calibri.ttf"]:
        try:
            return ImageFont.truetype(path, size)
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
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)
                for nx in (x - 1, x, x + 1):
                    for ny in (cy - 1, cy, cy + 1):
                        if 0 <= nx < width and 0 <= ny < height and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            queue.append((nx, ny))
            components.append((min_x, min_y, max_x, max_y, count))
    return components


def largest_linework_bbox(image):
    arr = np.asarray(image.convert("RGB"))
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    # Dark linework/text, excluding very pale scan background.
    mask = ((r + g + b) < 585) & (np.maximum.reduce([r, g, b]) < 235)
    # Avoid CamScanner mark and bottom title dominating the bbox.
    h, w = mask.shape
    mask[int(h * 0.88) :, :] = False
    mask[:, : int(w * 0.02)] = False
    mask[:, int(w * 0.98) :] = False
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return (0, 0, w, h)
    min_x = int(xs.min())
    max_x = int(xs.max())
    min_y = int(ys.min())
    max_y = int(ys.max())
    pad_x = int(w * 0.015)
    pad_y = int(h * 0.015)
    return (
        max(0, min_x - pad_x),
        max(0, min_y - pad_y),
        min(w - 1, max_x + pad_x),
        min(h - 1, max_y + pad_y),
    )


def colour_masks(image):
    arr = np.asarray(image.convert("RGB"))
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    return {
        "green": (g > 120) & (g > r * 1.25) & (g > b * 1.12),
        "blue": (b > 125) & (b > r * 1.18) & (b > g * 1.05),
        "red": (r > 145) & (r > g * 1.25) & (r > b * 1.20),
        "magenta": (r > 135) & (b > 115) & (g < 105) & (np.abs(r - b) < 70),
        "yellow": (r > 165) & (g > 125) & (b < 105) & (r > b * 1.55) & (g > b * 1.25),
    }


def extract_mimic_markers(image, source_name):
    scale_down = 0.5
    small = image.resize((int(image.width * scale_down), int(image.height * scale_down)))
    bbox = largest_linework_bbox(small)
    left, top, right, bottom = bbox
    markers = []
    masks = colour_masks(small)
    for colour, mask in masks.items():
        # Only use colours inside the mimic drawing bbox.
        clipped = np.zeros_like(mask)
        clipped[top:bottom + 1, left:right + 1] = mask[top:bottom + 1, left:right + 1]
        joined = Image.fromarray((clipped * 255).astype("uint8")).filter(ImageFilter.MaxFilter(3))
        for min_x, min_y, max_x, max_y, count in connected_components(np.asarray(joined) > 0):
            width = max_x - min_x + 1
            height = max_y - min_y + 1
            if count < 12 or width < 4 or height < 4:
                continue
            if width > 22 or height > 22:
                continue
            ratio = width / max(1, height)
            if ratio < 0.45 or ratio > 2.25:
                continue
            cx = (min_x + max_x) / 2
            cy = (min_y + max_y) / 2
            x_pct = (cx - left) / max(1, right - left)
            y_pct = (cy - top) / max(1, bottom - top)
            if not (-0.03 <= x_pct <= 1.03 and -0.03 <= y_pct <= 1.03):
                continue
            markers.append(
                {
                    "source_page": source_name,
                    "colour": colour,
                    "source_x": round(cx / scale_down, 2),
                    "source_y": round(cy / scale_down, 2),
                    "source_x_pct": x_pct,
                    "source_y_pct": y_pct,
                    "source_bbox": tuple(v / scale_down for v in bbox),
                }
            )
    markers.sort(key=lambda item: (item["colour"], item["source_y"], item["source_x"]))
    return markers, bbox


def rotate_landscape(image):
    if image.height > image.width:
        return image.rotate(90, expand=True), True
    return image, False


def map_to_target(marker, target_bbox, rotated, original_size):
    left, top, right, bottom = target_bbox
    x = left + marker["source_x_pct"] * (right - left)
    y = top + marker["source_y_pct"] * (bottom - top)
    if not rotated:
        return x, y
    original_w, original_h = original_size
    return original_h - y, x


def draw_marker(draw, x, y, colour, idx, font):
    style = COLOUR_STYLES[colour]
    rgb = style["rgb"]
    radius = 12
    draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=rgb, outline="white", width=4)
    draw.ellipse([x - radius - 3, y - radius - 3, x + radius + 3, y + radius + 3], outline=rgb, width=3)
    text = f"{colour[:1].upper()}{idx:02d}"
    draw.rectangle([x + 16, y - 11, x + 58, y + 9], fill="white", outline=rgb, width=1)
    draw.text((x + 20, y - 10), text, fill=rgb, font=font)


def draw_title_legend(image, title):
    draw = ImageDraw.Draw(image)
    title_font = load_font(24)
    font = load_font(15)
    draw.rectangle([18, 18, 560, 72], fill="white", outline=(10, 30, 60), width=2)
    draw.text((32, 30), f"{title} - Mimic List Plotted", fill=(10, 30, 60), font=title_font)
    x, y = 24, image.height - 160
    draw.rectangle([x - 8, y - 12, x + 350, y + 132], fill="white", outline=(10, 30, 60), width=2)
    draw.text((x, y), "From scanned mimic list", fill=(10, 30, 60), font=font)
    y += 26
    for colour, style in COLOUR_STYLES.items():
        draw.ellipse([x, y, x + 16, y + 16], fill=style["rgb"], outline="white", width=2)
        draw.text((x + 24, y - 1), style["label"], fill=(30, 40, 55), font=font)
        y += 22


def distance(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def generate_floor(floor_code, title, mimic_pages, target_name):
    target_original = Image.open(FLOOR_DIR / target_name).convert("RGB")
    target_bbox = largest_linework_bbox(target_original)
    target, rotated = rotate_landscape(target_original.copy())
    output = target.copy()
    draw = ImageDraw.Draw(output)
    font = load_font(13)
    rows = []
    colour_counts = {}
    placed = []

    source_bboxes = []
    for page_name in mimic_pages:
        mimic = Image.open(MIMIC_DIR / page_name).convert("RGB")
        markers, source_bbox = extract_mimic_markers(mimic, page_name)
        source_bboxes.append((page_name, source_bbox))
        for marker in markers:
            x, y = map_to_target(marker, target_bbox, rotated, target_original.size)
            # Merge duplicate coloured points between duplicate mimic pages.
            if any(marker["colour"] == p["colour"] and distance((x, y), p["point"]) < 16 for p in placed):
                continue
            colour_counts[marker["colour"]] = colour_counts.get(marker["colour"], 0) + 1
            idx = colour_counts[marker["colour"]]
            draw_marker(draw, x, y, marker["colour"], idx, font)
            placed.append({"colour": marker["colour"], "point": (x, y)})
            rows.append(
                {
                    "floor_code": floor_code,
                    "floor_name": title,
                    "review_tag": f"{floor_code}-{marker['colour'].upper()}-{idx:02d}",
                    "mimic_colour": marker["colour"],
                    "device_type": COLOUR_STYLES[marker["colour"]]["label"],
                    "source_page": marker["source_page"],
                    "source_x": marker["source_x"],
                    "source_y": marker["source_y"],
                    "plotted_x": round(x, 2),
                    "plotted_y": round(y, 2),
                    "status": "From scanned mimic list - type/location needs review",
                }
            )

    draw_title_legend(output, title)
    out_png = OUT_DIR / f"{floor_code}-mimic-list-landscape.png"
    out_csv = OUT_DIR / f"{floor_code}-mimic-list-points.csv"
    output.save(out_png)
    with out_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "floor_code",
                "floor_name",
                "review_tag",
                "mimic_colour",
                "device_type",
                "source_page",
                "source_x",
                "source_y",
                "plotted_x",
                "plotted_y",
                "status",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)
    return out_png, out_csv, rows, source_bboxes


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index = [
        "# MTB Mimic List Plotted To Floor PDFs - Landscape",
        "",
        "These review drawings use coloured points extracted from the scanned mimic list pages, then plotted onto the clean floor-plan PDF backgrounds.",
        "",
        "Important: the scanned mimic list uses handwritten labels, so the app device type/tag still needs floor-by-floor review. This output is now based on the mimic list, not guessed from the clean PDF symbols.",
        "",
    ]
    all_rows = []
    for floor_code, title, mimic_pages, target_name in FLOORS:
        out_png, out_csv, rows, _ = generate_floor(floor_code, title, mimic_pages, target_name)
        index.append(f"- [{title}]({out_png.name}) - {len(rows)} mimic-list markers, CSV: [{out_csv.name}]({out_csv.name})")
        all_rows.extend(rows)

    combined = OUT_DIR / "all-floors-mimic-list-points.csv"
    with combined.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "floor_code",
                "floor_name",
                "review_tag",
                "mimic_colour",
                "device_type",
                "source_page",
                "source_x",
                "source_y",
                "plotted_x",
                "plotted_y",
                "status",
            ],
        )
        writer.writeheader()
        writer.writerows(all_rows)
    index.append("")
    index.append(f"Combined CSV: [{combined.name}]({combined.name})")
    (OUT_DIR / "index.md").write_text("\n".join(index) + "\n", encoding="utf-8")
    print(OUT_DIR)
    print(f"Total mimic-list markers: {len(all_rows)}")


if __name__ == "__main__":
    main()
