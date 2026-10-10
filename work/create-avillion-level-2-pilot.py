import csv
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


SOURCE = Path("outputs/mimic-cleanup-pilot/avillion-main-building-level-1/avillion-main-building-page-2.png")
OUT = Path("outputs/mimic-cleanup-pilot/avillion-main-building-level-2")
FLOOR_NAME = "Avillion Main Building Level 2"


# Extracted draft markers from the source drawing. They are not production master data.
PINS = [
    ("SD1", "Smoke Detector", "Fire Alarm", 94, 320, "Lift/stair block"),
    ("SD2", "Smoke Detector", "Fire Alarm", 432, 257, "Upper main corridor"),
    ("EL1", "Emergency Light", "Emergency Light / Exit Sign", 523, 257, "Upper main corridor"),
    ("EL2", "Emergency Light", "Emergency Light / Exit Sign", 638, 256, "Upper main corridor"),
    ("SD3", "Smoke Detector", "Fire Alarm", 436, 153, "Upper room"),
    ("EL3", "Emergency Light", "Emergency Light / Exit Sign", 553, 220, "Upper room doorway"),
    ("SD4", "Smoke Detector", "Fire Alarm", 772, 258, "Upper main corridor"),
    ("SD5", "Smoke Detector", "Fire Alarm", 833, 165, "Upper room"),
    ("HR1", "Hose Reel", "Hose Reel", 880, 237, "Near central stair"),
    ("BG1", "Manual Call Point", "Fire Alarm", 865, 300, "Near central stair"),
    ("KS1", "Exit Sign", "Emergency Light / Exit Sign", 440, 390, "Small room off corridor"),
    ("KS2", "Exit Sign", "Emergency Light / Exit Sign", 464, 519, "Small room off corridor"),
    ("KS3", "Exit Sign", "Emergency Light / Exit Sign", 541, 624, "Diagonal service corridor"),
    ("SD6", "Smoke Detector", "Fire Alarm", 640, 378, "Central room"),
    ("SD7", "Smoke Detector", "Fire Alarm", 802, 384, "Central room"),
    ("SD8", "Smoke Detector", "Fire Alarm", 546, 514, "Room beside KS2"),
    ("SD10", "Smoke Detector", "Fire Alarm", 640, 603, "Lower central room"),
    ("SD11", "Smoke Detector", "Fire Alarm", 648, 478, "Lower central room"),
    ("EL4", "Emergency Light", "Emergency Light / Exit Sign", 752, 478, "Lower central room"),
    ("SD12", "Smoke Detector", "Fire Alarm", 868, 582, "Main corridor"),
    ("SD23", "Smoke Detector", "Fire Alarm", 1182, 250, "Restaurant"),
    ("EL6", "Emergency Light", "Emergency Light / Exit Sign", 1318, 244, "Restaurant"),
    ("SD24", "Smoke Detector", "Fire Alarm", 1414, 242, "Restaurant"),
    ("SD25", "Smoke Detector", "Fire Alarm", 1165, 435, "Restaurant"),
    ("SD26", "Smoke Detector", "Fire Alarm", 1160, 531, "Restaurant"),
    ("EL7", "Emergency Light", "Emergency Light / Exit Sign", 1298, 531, "Restaurant"),
    ("SD27", "Smoke Detector", "Fire Alarm", 1397, 531, "Restaurant"),
    ("SD9", "Smoke Detector", "Fire Alarm", 544, 720, "Diagonal service corridor"),
    ("BG2", "Manual Call Point", "Fire Alarm", 608, 755, "Diagonal service corridor"),
    ("SD14", "Smoke Detector", "Fire Alarm", 671, 749, "Diagonal service corridor"),
    ("HR2", "Hose Reel", "Hose Reel", 669, 783, "Diagonal service corridor"),
    ("SD15", "Smoke Detector", "Fire Alarm", 716, 790, "Diagonal service corridor"),
    ("EL5", "Emergency Light", "Emergency Light / Exit Sign", 702, 847, "Diagonal service corridor"),
    ("SD20", "Smoke Detector", "Fire Alarm", 761, 904, "Lower diagonal room"),
    ("SD13", "Smoke Detector", "Fire Alarm", 789, 717, "Main lower access"),
    ("SD16", "Smoke Detector", "Fire Alarm", 900, 840, "Staff canteen access"),
    ("SD18", "Smoke Detector", "Fire Alarm", 1115, 940, "Staff canteen"),
    ("SD17", "Smoke Detector", "Fire Alarm", 930, 1000, "Staff canteen"),
    ("SD19", "Smoke Detector", "Fire Alarm", 851, 1004, "Lower service access"),
    ("KS4", "Exit Sign", "Emergency Light / Exit Sign", 938, 1069, "Lower exit/stair"),
    ("SD21", "Smoke Detector", "Fire Alarm", 570, 890, "Lower diagonal room"),
    ("SD22", "Smoke Detector", "Fire Alarm", 659, 975, "Lower diagonal room"),
]

TYPE_COLORS = {
    "Smoke Detector": (37, 99, 235),
    "Emergency Light": (245, 158, 11),
    "Exit Sign": (20, 150, 90),
    "Hose Reel": (14, 165, 233),
    "Manual Call Point": (220, 38, 38),
}


def load_font(size, bold=False):
    names = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
    ]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def draw_label(draw, center, text, font):
    x, y = center
    bbox = draw.textbbox((x, y), text, font=font, anchor="mm")
    box = (bbox[0] - 12, bbox[1] - 7, bbox[2] + 12, bbox[3] + 7)
    draw.rounded_rectangle(box, radius=7, fill=(248, 250, 252), outline=(203, 213, 225), width=2)
    draw.text((x, y), text, fill=(15, 23, 42), font=font, anchor="mm")


def marker_short(device_type):
    return {
        "Smoke Detector": "SD",
        "Emergency Light": "EL",
        "Exit Sign": "KS",
        "Hose Reel": "HR",
        "Manual Call Point": "BG",
    }[device_type]


def build_clean_background(clean, path):
    canvas = clean.copy()
    draw = ImageDraw.Draw(canvas)
    title = load_font(30, True)
    label = load_font(24, True)
    small = load_font(20, True)

    # Remove all remaining handwritten area names and old count notes, without changing walls.
    for box in [
        (42, 300, 160, 415), (408, 350, 500, 430), (430, 465, 550, 550),
        (1070, 360, 1510, 485), (800, 720, 1270, 1000), (620, 915, 900, 1125),
        (450, 740, 570, 850), (0, 1090, 300, 1369), (1510, 1000, 2092, 1369),
        (570, 1160, 1300, 1369),
    ]:
        draw.rectangle(box, fill="white")

    draw_label(draw, (113, 380), "LIFT / STAIR", small)
    draw_label(draw, (460, 430), "SERVICE ROOM", small)
    draw_label(draw, (1275, 430), "RESTAURANT", label)
    draw_label(draw, (1030, 905), "STAFF CANTEEN", label)
    draw_label(draw, (690, 1050), "TOILETS", small)
    draw_label(draw, (920, 1260), "AVILLION MAIN BUILDING - LEVEL 2", title)

    # Simple directional route, preserving the source circulation path.
    route = (37, 99, 235)
    draw.line([(790, 580), (1080, 580), (1260, 580)], fill=route, width=5)
    draw.polygon([(1260, 580), (1234, 565), (1234, 595)], fill=route)
    draw.line([(870, 610), (750, 700), (650, 840)], fill=route, width=4)
    draw.polygon([(650, 840), (677, 833), (668, 862)], fill=route)
    canvas.save(path)
    return canvas


def build_service_redraw(size, path):
    """Create a clean guide layout in the same coordinate space as the source."""
    canvas = Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(canvas)
    wall, fill, route = (17, 24, 39), (248, 250, 252), (37, 99, 235)
    title, label, small = load_font(30, True), load_font(24, True), load_font(20, True)

    def rect(box, width=5):
        draw.rectangle(box, fill=fill, outline=wall, width=width)

    def line(points, width=5, color=wall):
        draw.line(points, fill=color, width=width, joint="curve")

    def stairs(box, horizontal=False):
        left, top, right, bottom = box
        rect(box, 4)
        steps = 7
        for index in range(1, steps):
            if horizontal:
                x = left + (right - left) * index / steps
                line([(x, top), (x, bottom)], 2, wall)
            else:
                y = top + (bottom - top) * index / steps
                line([(left, y), (right, y)], 2, wall)

    # Upper room and the long access corridor.
    rect((370, 92, 920, 252))
    rect((35, 252, 1550, 596))
    line([(35, 350), (920, 350)], 4)
    line([(1100, 252), (1100, 596)], 4)
    stairs((160, 252, 255, 420))
    line([(255, 350), (360, 350), (360, 596)], 4)
    stairs((920, 252, 1015, 342))
    draw_label(draw, (650, 170), "UPPER ROOM", label)
    draw_label(draw, (130, 388), "LIFT / STAIR", small)

    # Small service rooms beside the corridor.
    rect((360, 350, 580, 596), 4)
    line([(580, 350), (580, 596)], 4)
    rect((580, 350, 920, 596), 4)
    line([(580, 416), (920, 416)], 4)
    line([(580, 556), (920, 556)], 4)
    draw_label(draw, (468, 452), "SERVICE ROOM", small)

    # Restaurant wing and its access route.
    rect((1100, 252, 1550, 596))
    line([(1100, 552), (1550, 552)], 4)
    line([(1468, 252), (1468, 596)], 4)
    draw.ellipse((1150, 360, 1320, 500), outline=wall, width=4)
    draw.arc((1200, 324, 1380, 520), 70, 290, fill=wall, width=4)
    draw_label(draw, (1310, 420), "RESTAURANT", label)

    # Main corridor and directional route.
    line([(720, 550), (1265, 550)], 5)
    line([(720, 596), (1265, 596)], 5)
    line([(780, 573), (1210, 573)], 5, route)
    draw.polygon([(1210, 573), (1180, 557), (1180, 589)], fill=route)

    # Diagonal lower service branch with stair and toilets.
    polygon = [(525, 650), (855, 600), (1000, 790), (1270, 935), (980, 1120), (670, 1010), (500, 810)]
    draw.polygon(polygon, fill=fill, outline=wall)
    line(polygon + [polygon[0]], 5)
    stairs((505, 770, 600, 860), True)
    line([(610, 735), (780, 905)], 4)
    line([(670, 900), (920, 1120)], 4)
    line([(720, 990), (875, 900)], 4)
    line([(530, 840), (700, 1010)], 4)
    draw_label(draw, (670, 980), "TOILETS", small)
    draw_label(draw, (1030, 880), "STAFF CANTEEN", label)
    draw_label(draw, (575, 765), "SERVICE STAIR", small)
    line([(870, 610), (760, 700), (645, 825)], 4, route)
    draw.polygon([(645, 825), (670, 815), (660, 844)], fill=route)

    draw_label(draw, (980, 1280), "AVILLION MAIN BUILDING - LEVEL 2", title)
    canvas.save(path)
    return canvas


def write_html(records):
    buttons = []
    for pin in records:
        code = marker_short(pin["device_type"])
        buttons.append(
            f'<button class="marker {code.lower()}" style="left:{pin["x_pct"]}%;top:{pin["y_pct"]}%;" '
            f'title="{pin["tag"]} - {pin["device_type"]}">{code}<span>{pin["tag"]}</span></button>'
        )
    html = f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Avillion Level 2 RMT Pin Preview</title><style>
body{{margin:0;padding:16px;background:#eef4fb;font-family:Arial;color:#172033}} main{{max-width:1200px;margin:auto}} .map{{position:relative;overflow:auto;background:#fff;border:1px solid #cbd5e1;border-radius:10px}} .canvas{{position:relative;min-width:900px}} img{{width:100%;display:block;pointer-events:none}} .layer{{position:absolute;inset:0;pointer-events:none}} .marker{{position:absolute;transform:translate(-50%,-50%);width:34px;height:34px;border:3px solid white;border-radius:50%;color:white;font-weight:bold;font-size:11px;pointer-events:auto;box-shadow:0 4px 10px #0004}} .marker span{{position:absolute;top:35px;left:50%;transform:translateX(-50%);padding:3px 5px;background:#fff;color:#06245a;border:1px solid #cbd5e1;border-radius:4px;font-size:10px;white-space:nowrap}} .sd{{background:#2563eb}} .el{{background:#f59e0b}} .ks{{background:#14965a}} .hr{{background:#0ea5e9}} .bg{{background:#dc2626}}
</style></head><body><main><h1>Avillion Main Building - Level 2</h1><p>Isolated preview only. Existing RMT pin behavior is not modified.</p><section class="map"><div class="canvas"><img src="avillion-main-building-level-2-cleaned-background.png" alt="Cleaned Level 2 mimic"><div class="layer">{''.join(buttons)}</div></div></section></main></body></html>'''
    (OUT / "avillion-main-building-level-2-rmt-pin-preview.html").write_text(html, encoding="utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    image = Image.open(SOURCE).convert("RGB")
    rotated = image.rotate(90, expand=True, fillcolor="white")
    reference = rotated.crop((120, 130, rotated.width - 110, rotated.height - 140))
    reference.save(OUT / "avillion-main-building-level-2-original-reference.png")
    width, height = reference.size

    decolored = Image.new("RGB", reference.size, "white")
    source_px, target_px = reference.load(), decolored.load()
    for y in range(height):
        for x in range(width):
            red, green, blue = source_px[x, y]
            saturation = max(red, green, blue) - min(red, green, blue)
            target_px[x, y] = (255, 255, 255) if saturation > 35 and max(red, green, blue) > 90 else (red, green, blue)
    gray = ImageOps.grayscale(decolored)
    gray = ImageOps.autocontrast(gray, cutoff=1).filter(ImageFilter.MedianFilter(size=3))
    mask = gray.point(lambda value: 0 if value < 165 else 255, mode="1").convert("L")
    clean = Image.new("RGB", reference.size, "white")
    clean.paste((20, 24, 32), mask=ImageOps.invert(mask))
    clean.save(OUT / "avillion-main-building-level-2-auto-clean-background.png")
    build_clean_background(clean, OUT / "avillion-main-building-level-2-source-derived-background.png")
    final = build_service_redraw(reference.size, OUT / "avillion-main-building-level-2-cleaned-background.png")

    grid = reference.copy()
    grid_draw = ImageDraw.Draw(grid)
    for pct in range(0, 101, 10):
        x, y = round(width * pct / 100), round(height * pct / 100)
        grid_draw.line([(x, 0), (x, height)], fill=(220, 0, 0), width=1)
        grid_draw.line([(0, y), (width, y)], fill=(220, 0, 0), width=1)
        grid_draw.text((x + 3, 3), f"{pct}%", fill=(220, 0, 0))
        grid_draw.text((3, y + 3), f"{pct}%", fill=(220, 0, 0))
    grid.save(OUT / "avillion-main-building-level-2-grid-reference.png")

    records = []
    for tag, device_type, system, x_px, y_px, location in PINS:
        records.append({
            "tag": tag, "source_label": tag, "device_type": device_type, "system": system,
            "floor": FLOOR_NAME, "x_px": x_px, "y_px": y_px,
            "x_pct": round(x_px / width * 100, 2), "y_pct": round(y_px / height * 100, 2),
            "location_guess": location, "confidence": "verified_from_scan",
            "notes": "Draft extracted pin. Verify before production import.",
        })
    # Source labels use KS but its full type is not written out on the drawing.
    for record in records:
        if record["tag"].startswith("KS"):
            record["confidence"] = "needs_review"
            record["notes"] = "Source uses KS shorthand; interpreted as Exit Sign for preview. Confirm device type before import."

    fields = list(records[0])
    with (OUT / "avillion-main-building-level-2-pins.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(records)
    (OUT / "avillion-main-building-level-2-pins.json").write_text(json.dumps(records, indent=2), encoding="utf-8")

    preview = final.convert("RGBA")
    overlay = Image.new("RGBA", preview.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = load_font(22, True)
    for record in records:
        x, y = record["x_px"], record["y_px"]
        color = TYPE_COLORS[record["device_type"]]
        draw.ellipse((x - 14, y - 14, x + 14, y + 14), fill=color + (235,), outline=(255, 255, 255, 255), width=4)
        text = record["tag"] + ("?" if record["confidence"] == "needs_review" else "")
        box = draw.textbbox((x + 20, y), text, font=font, anchor="lm")
        draw.rounded_rectangle((box[0] - 6, box[1] - 5, box[2] + 6, box[3] + 5), radius=5, fill=(255, 255, 255, 235), outline=color + (255,), width=2)
        draw.text((x + 20, y), text, fill=(15, 23, 42, 255), font=font, anchor="lm")
    preview = Image.alpha_composite(preview, overlay).convert("RGB")
    preview.save(OUT / "avillion-main-building-level-2-cleaned-with-pins-preview.png")
    write_html(records)

    readme = f'''# Avillion Main Building Level 2 - Mimic Cleanup Pilot\n\nOriginal source remains untouched: C:/Users/Joey/Downloads/MIMIC AVILLION MAIN BUILDING.pdf\n\nThis isolated pilot does not import into the RMT FIREAPPS production mimic engine or master device list.\n\n## Deliverables\n\n- `avillion-main-building-level-2-original-reference.png` - rotated/cropped source reference.\n- `avillion-main-building-level-2-cleaned-background.png` - technician-friendly background.\n- `avillion-main-building-level-2-cleaned-with-pins-preview.png` - static RMT-style overlay preview.\n- `avillion-main-building-level-2-rmt-pin-preview.html` - interactive visual-only pin preview.\n- `avillion-main-building-level-2-pins.csv` and `.json` - extracted draft pins and normalized coordinates.\n- `avillion-main-building-level-2-grid-reference.png` - manual coordinate-review grid.\n\n## Coordinate Basis\n\nAll primary images use {width} x {height} pixels. `x_pct` and `y_pct` preserve the normalized overlay approach used by the current RMT marker layer.\n\n## Review Items\n\n- 42 draft device markers were extracted: 27 smoke detectors, 7 emergency lights, 4 `KS` shorthand signs, 2 hose reels, and 2 manual call points.\n- Every `KS` item is flagged `needs_review`: this pilot interprets the source shorthand as Exit Sign, but that must be confirmed during field verification.\n- Pin data is draft/reference data only; do not import into master devices until human-verified.\n'''
    (OUT / "README.md").write_text(readme, encoding="utf-8")
    print(f"reference={width}x{height}")
    print(f"pins={len(records)}")
    print(f"output={OUT.resolve()}")


if __name__ == "__main__":
    main()
