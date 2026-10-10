import csv
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


SOURCE = Path("outputs/mimic-cleanup-pilot/avillion-main-building-level-1/avillion-main-building-page-1.png")
OUT = Path("outputs/mimic-cleanup-pilot/avillion-main-building-level-1")
FLOOR_NAME = "Avillion Main Building Level 1"


PINS = [
    {"tag": "SD1", "source_label": "SD1", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 145, "y_px": 398, "location_guess": "Lift/stair room at far left", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD2", "source_label": "SD2", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 500, "y_px": 337, "location_guess": "Main corridor left side", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD3", "source_label": "SD3", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 720, "y_px": 340, "location_guess": "Main corridor center", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD4", "source_label": "SD4", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 914, "y_px": 339, "location_guess": "Main corridor near BG1/HR1", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD5", "source_label": "SD5", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 949, "y_px": 278, "location_guess": "Corridor near right stair", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD6", "source_label": "SD6", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 778, "y_px": 118, "location_guess": "Upper room left side", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD7", "source_label": "SD7", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 956, "y_px": 135, "location_guess": "Upper room right side", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD8", "source_label": "SD8", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 792, "y_px": 535, "location_guess": "Karaoke/toilet corridor", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD9", "source_label": "SD9", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 770, "y_px": 464, "location_guess": "Room beside Karaoke", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD10", "source_label": "SD10", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 637, "y_px": 464, "location_guess": "Room beside male toilet", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD11", "source_label": "SD11", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 635, "y_px": 602, "location_guess": "Room beside female toilet", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD12", "source_label": "SD12", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 763, "y_px": 604, "location_guess": "Lower room beside Karaoke", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD13", "source_label": "SD13", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 1008, "y_px": 629, "location_guess": "Small room below Karaoke", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD14", "source_label": "SD14", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 1323, "y_px": 535, "location_guess": "Kitchen left/open area", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD15", "source_label": "SD15", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 1496, "y_px": 456, "location_guess": "Kitchen upper/center area", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD16", "source_label": "SD16", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 1515, "y_px": 548, "location_guess": "Kitchen center area", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD17", "source_label": "SD17", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 1694, "y_px": 548, "location_guess": "Kitchen right area", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD18", "source_label": "SD18", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 1180, "y_px": 856, "location_guess": "Pump room", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "SD19", "source_label": "SD19", "device_type": "Smoke Detector", "system": "Fire Alarm", "x_px": 646, "y_px": 826, "location_guess": "S/L room at lower-left diagonal block", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "EL1", "source_label": "EL1", "device_type": "Emergency Light", "system": "Emergency Light / Exit Sign", "x_px": 776, "y_px": 177, "location_guess": "Upper room", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "EL2", "source_label": "EL3?", "device_type": "Emergency Light", "system": "Emergency Light / Exit Sign", "x_px": 1117, "y_px": 791, "location_guess": "SSB room / pump room area", "confidence": "needs_review", "notes": "Source handwriting appears duplicated/unclear as EL3; proposed as EL2 only to keep EL1-EL4 unique."},
    {"tag": "EL3", "source_label": "EL3", "device_type": "Emergency Light", "system": "Emergency Light / Exit Sign", "x_px": 876, "y_px": 517, "location_guess": "Karaoke", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "EL4", "source_label": "EL4", "device_type": "Emergency Light", "system": "Emergency Light / Exit Sign", "x_px": 1504, "y_px": 495, "location_guess": "Kitchen center area", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "HR1", "source_label": "HR1", "device_type": "Hose Reel", "system": "Hose Reel", "x_px": 1011, "y_px": 406, "location_guess": "Outside Karaoke near corridor", "confidence": "verified_from_scan", "notes": ""},
    {"tag": "BG1", "source_label": "BG1", "device_type": "Manual Call Point", "system": "Fire Alarm", "x_px": 968, "y_px": 406, "location_guess": "Outside Karaoke near corridor", "confidence": "verified_from_scan", "notes": ""},
]


TYPE_COLORS = {
    "Smoke Detector": (37, 99, 235),
    "Emergency Light": (245, 158, 11),
    "Hose Reel": (14, 165, 233),
    "Manual Call Point": (220, 38, 38),
}


def load_font(size, bold=False):
    candidates = [
        "arialbd.ttf" if bold else "arial.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_label(draw, xy, text, font, anchor="mm"):
    x, y = xy
    bbox = draw.textbbox((x, y), text, font=font, anchor=anchor)
    pad_x = 14
    pad_y = 8
    box = (
        bbox[0] - pad_x,
        bbox[1] - pad_y,
        bbox[2] + pad_x,
        bbox[3] + pad_y,
    )
    draw.rounded_rectangle(
        box,
        radius=8,
        fill=(248, 250, 252),
        outline=(203, 213, 225),
        width=2,
    )
    draw.text((x, y), text, fill=(15, 23, 42), font=font, anchor=anchor)


def build_service_background(clean, output_path):
    service = clean.copy()
    draw = ImageDraw.Draw(service)
    title_font = load_font(30, bold=True)
    label_font = load_font(24, bold=True)
    small_font = load_font(20, bold=True)

    erase_boxes = [
        (1200, 12, 1505, 68),    # handwritten swimming pool label
        (125, 388, 245, 475),     # handwritten L/L label
        (390, 450, 650, 548),     # handwritten Toilet (M)
        (390, 565, 650, 675),     # handwritten Toilet (F)
        (805, 492, 1025, 604),    # handwritten Karaoke label
        (1325, 590, 1630, 715),   # handwritten Kitchen label
        (500, 760, 650, 875),     # handwritten S/L label
        (965, 715, 1195, 835),    # handwritten SSB room label
        (975, 815, 1225, 930),    # handwritten Pump Room label
        (590, 1236, 1215, 1302),  # cropped old level/count notes and title area
    ]
    for box in erase_boxes:
        draw.rectangle(box, fill=(255, 255, 255))

    # Cover remaining old handwritten room labels with clean typed landmarks.
    draw_label(draw, (1395, 44), "SWIMMING POOL", small_font)
    draw_label(draw, (795, 192), "ROOM", label_font)
    draw_label(draw, (181, 455), "LIFT / STAIR", small_font)
    draw_label(draw, (535, 509), "TOILET (M)", small_font)
    draw_label(draw, (535, 625), "TOILET (F)", small_font)
    draw_label(draw, (907, 560), "KARAOKE", label_font)
    draw_label(draw, (1500, 650), "KITCHEN", label_font)
    draw_label(draw, (573, 831), "S/L", small_font)
    draw_label(draw, (1064, 787), "SSB ROOM", small_font)
    draw_label(draw, (1108, 883), "PUMP ROOM", small_font)
    draw_label(draw, (902, 1262), "AVILLION MAIN BUILDING - LEVEL 1", title_font)

    # Reinforce the main technician path without adding architectural detail.
    route_color = (37, 99, 235)
    draw.line([(1080, 415), (1080, 610), (1230, 770), (1325, 900)], fill=route_color, width=5)
    draw.polygon([(1325, 900), (1298, 882), (1315, 874)], fill=route_color)
    draw.line([(1160, 780), (910, 700), (690, 815)], fill=route_color, width=4)
    draw.polygon([(690, 815), (718, 815), (706, 792)], fill=route_color)

    service.save(output_path)
    return service


def draw_hatched_box(draw, box, spacing=28, fill=(31, 41, 55), width=4):
    left, top, right, bottom = box
    draw.rectangle(box, outline=fill, width=width)
    x = left - (bottom - top)
    while x < right:
        draw.line([(x, bottom), (x + (bottom - top), top)], fill=fill, width=2)
        x += spacing
    draw.line([(left, top), (right, bottom)], fill=fill, width=2)
    draw.line([(left, bottom), (right, top)], fill=fill, width=2)


def draw_stairs(draw, box, direction="vertical", fill=(31, 41, 55)):
    left, top, right, bottom = box
    draw.rectangle(box, outline=fill, width=4)
    if direction == "vertical":
        steps = 6
        for index in range(1, steps):
            y = top + (bottom - top) * index / steps
            draw.line([(left, y), (right, y)], fill=fill, width=3)
        draw.line([(left + 18, top + 10), (right - 18, bottom - 10)], fill=fill, width=2)
    else:
        steps = 7
        for index in range(1, steps):
            x = left + (right - left) * index / steps
            draw.line([(x, top), (x, bottom)], fill=fill, width=3)
        draw.line([(left + 10, bottom - 16), (right - 10, top + 16)], fill=fill, width=2)


def build_service_redraw_background(size, output_path):
    width, height = size
    bg = Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(bg)
    wall = (17, 24, 39)
    soft_wall = (30, 41, 59)
    route = (37, 99, 235)
    area_fill = (248, 250, 252)
    title_font = load_font(30, bold=True)
    label_font = load_font(24, bold=True)
    small_font = load_font(20, bold=True)

    def room_rect(box, label=None, label_xy=None):
        draw.rectangle(box, fill=area_fill, outline=wall, width=5)
        if label:
            draw_label(draw, label_xy or ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2), label, label_font)

    def line(points, fill=wall, width_px=5):
        draw.line(points, fill=fill, width=width_px, joint="curve")

    # Top-left lift and stair block.
    room_rect((75, 300, 335, 492))
    draw_hatched_box(draw, (235, 350, 325, 492), spacing=26, fill=soft_wall, width=4)
    draw_stairs(draw, (145, 245, 235, 348), "vertical", soft_wall)
    line([(75, 300), (75, 185), (145, 185), (145, 245)], wall, 5)
    line([(145, 245), (238, 300), (640, 300)], wall, 5)
    draw_label(draw, (190, 520), "LIFT / STAIR", small_font)

    # Main upper room and corridor.
    room_rect((640, 105, 1080, 300), "ROOM", (815, 205))
    line([(335, 300), (640, 300)], wall, 5)
    line([(1080, 300), (1115, 300), (1115, 385)], wall, 5)
    draw_stairs(draw, (1045, 300, 1118, 410), "vertical", soft_wall)
    line([(335, 492), (335, 695), (420, 695)], wall, 5)

    # Toilet and karaoke block.
    room_rect((420, 490, 1080, 700))
    line([(600, 490), (600, 700)], wall, 4)
    line([(420, 595), (600, 595)], wall, 4)
    line([(760, 490), (760, 700)], wall, 4)
    line([(900, 490), (900, 700)], wall, 4)
    line([(600, 595), (900, 595)], wall, 4)
    # Simple door gaps.
    draw.rectangle((442, 548, 495, 610), fill="white")
    draw.rectangle((710, 485, 775, 520), fill="white")
    draw.rectangle((820, 675, 872, 705), fill="white")
    draw.rectangle((1018, 655, 1085, 705), fill="white")
    draw_label(draw, (535, 542), "TOILET (M)", small_font)
    draw_label(draw, (535, 640), "TOILET (F)", small_font)
    draw_label(draw, (955, 600), "KARAOKE", label_font)

    # Main corridor / road reference.
    line([(1132, 395), (1132, 680), (1290, 885)], wall, 5)
    line([(1190, 395), (1190, 640), (1365, 920)], wall, 5)
    line([(1164, 440), (1164, 615), (1315, 842)], route, 5)
    draw.polygon([(1315, 842), (1285, 830), (1305, 806)], fill=route)

    # Kitchen and swimming pool side.
    line([(1285, 360), (1360, 360), (1360, 430), (1440, 430), (1440, 650), (1825, 650)], wall, 5)
    line([(1825, 360), (1825, 650)], wall, 5)
    line([(1295, 650), (1465, 650)], wall, 5)
    line([(1450, 600), (1665, 600)], wall, 4)
    line([(1715, 590), (1825, 590)], wall, 4)
    draw_label(draw, (1545, 675), "KITCHEN", label_font)
    line([(1220, 5), (1220, 86), (1295, 86), (1295, 145), (1575, 145), (1575, 270), (1848, 270), (1848, 40), (1780, 40), (1780, 5)], wall, 5)
    draw_label(draw, (1500, 52), "SWIMMING POOL", small_font)

    # Lower service block: S/L, SSB and pump room.
    line([(590, 815), (740, 740), (890, 780), (1060, 700), (1215, 825)], wall, 5)
    line([(590, 815), (520, 900), (610, 1000), (880, 840)], wall, 5)
    line([(880, 840), (1085, 1045), (1230, 960), (1448, 1085), (1090, 1265), (610, 1000)], wall, 5)
    line([(1060, 700), (1185, 870), (1085, 1045)], wall, 5)
    draw_hatched_box(draw, (980, 1010, 1400, 1230), spacing=32, fill=soft_wall, width=4)
    draw_label(draw, (610, 890), "S/L", small_font)
    draw_label(draw, (1088, 815), "SSB ROOM", small_font)
    draw_label(draw, (1145, 915), "PUMP ROOM", small_font)

    # Access route to lower block.
    line([(1070, 780), (875, 725), (665, 850)], route, 4)
    draw.polygon([(665, 850), (695, 850), (680, 825)], fill=route)

    # Keep the map title inside the same coordinate space but away from active pins.
    draw_label(draw, (920, 1282), "AVILLION MAIN BUILDING - LEVEL 1", title_font)

    bg.save(output_path)
    return bg


def marker_type_class(device_type):
    normalized = device_type.lower()
    if "smoke" in normalized:
        return "type-smoke"
    if "emergency" in normalized:
        return "type-emergency-light"
    if "hose" in normalized:
        return "type-hose-reel"
    if "call" in normalized or "break" in normalized:
        return "type-mcp"
    return "type-other"


def marker_short_code(device_type):
    normalized = device_type.lower()
    if "smoke" in normalized:
        return "SD"
    if "emergency" in normalized:
        return "EL"
    if "hose" in normalized:
        return "HR"
    if "call" in normalized or "break" in normalized:
        return "BG"
    return "OT"


def write_html_preview(pin_records):
    marker_html = []
    for pin in pin_records:
        label = pin["tag"] if pin["confidence"] != "needs_review" else f"{pin['tag']}?"
        marker_html.append(
            f"""<button class="marker pending {marker_type_class(pin['device_type'])}" """
            f"""style="left:{pin['x_pct']}%;top:{pin['y_pct']}%;" """
            f"""data-label="{label}" title="{pin['tag']} - {pin['device_type']}">"""
            f"""{marker_short_code(pin['device_type'])}</button>"""
        )
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Avillion Level 1 RMT Pin Preview</title>
  <style>
    :root {{
      --blue: #06245a;
      --amber: #f7b500;
      --type-smoke: #2563eb;
      --type-mcp: #dc2626;
      --type-emergency-light: #f59e0b;
      --type-hose-reel: #0ea5e9;
    }}
    body {{
      margin: 0;
      padding: 18px;
      background: #eef4fb;
      color: #172033;
      font-family: Arial, sans-serif;
    }}
    .pilot {{
      max-width: 1200px;
      margin: 0 auto;
    }}
    .pilot h1 {{
      margin: 0 0 8px;
      font-size: 22px;
    }}
    .pilot p {{
      margin: 0 0 14px;
      color: #475569;
    }}
    .map-stage {{
      position: relative;
      overflow: auto;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      background: white;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
    }}
    .map-canvas {{
      position: relative;
      width: 100%;
      min-width: 900px;
    }}
    .map-canvas img {{
      display: block;
      width: 100%;
      pointer-events: none;
      user-select: none;
    }}
    #markersLayer {{
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 2;
      pointer-events: none;
    }}
    .marker {{
      position: absolute;
      transform: translate(-50%, -50%);
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border: 3px solid #fff;
      border-radius: 50%;
      color: #fff;
      box-shadow: 0 5px 12px rgba(22, 32, 51, 0.28);
      font-size: 12px;
      font-weight: 900;
      pointer-events: auto;
      z-index: 1;
    }}
    .marker::after {{
      content: attr(data-label);
      position: absolute;
      left: 50%;
      top: calc(100% + 4px);
      transform: translateX(-50%);
      min-width: max-content;
      padding: 3px 6px;
      border: 1px solid rgba(6, 36, 90, 0.18);
      border-radius: 4px;
      color: var(--blue);
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 3px 8px rgba(22, 32, 51, 0.14);
      font-size: 10px;
      line-height: 1.1;
      white-space: nowrap;
      pointer-events: none;
    }}
    .marker.pending {{ background: var(--amber); }}
    .marker.type-smoke {{ background: var(--type-smoke); }}
    .marker.type-mcp {{ background: var(--type-mcp); }}
    .marker.type-emergency-light {{ background: var(--type-emergency-light); }}
    .marker.type-hose-reel {{ background: var(--type-hose-reel); }}
    .marker.type-other {{ background: var(--amber); }}
  </style>
</head>
<body>
  <main class="pilot">
    <h1>Avillion Main Building - Level 1</h1>
    <p>Isolated preview using RMT-style normalized pin positions over the cleaned mimic background. Not imported into production.</p>
    <section class="map-stage">
      <div class="map-canvas">
        <img src="avillion-main-building-level-1-cleaned-background.png" alt="Avillion Main Building Level 1 cleaned mimic background">
        <div id="markersLayer">
          {"".join(marker_html)}
        </div>
      </div>
    </section>
  </main>
</body>
</html>
"""
    (OUT / "avillion-main-building-level-1-rmt-pin-preview.html").write_text(html, encoding="utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    img = Image.open(SOURCE).convert("RGB")

    # Level 1 was scanned sideways. Rotate to landscape for phone/tablet viewing.
    rotated = img.rotate(90, expand=True, fillcolor="white")
    crop_box = (120, 130, rotated.width - 110, rotated.height - 140)
    reference = rotated.crop(crop_box)
    reference.save(OUT / "avillion-main-building-level-1-original-reference.png")

    cleaned_color = Image.new("RGB", reference.size, "white")
    in_pixels = reference.load()
    out_pixels = cleaned_color.load()
    width, height = reference.size

    for y in range(height):
        for x in range(width):
            red, green, blue = in_pixels[x, y]
            high = max(red, green, blue)
            low = min(red, green, blue)
            saturation = high - low
            if saturation > 35 and high > 90:
                out_pixels[x, y] = (255, 255, 255)
            else:
                out_pixels[x, y] = (red, green, blue)

    gray = ImageOps.grayscale(cleaned_color)
    gray = ImageOps.autocontrast(gray, cutoff=1)
    gray = gray.filter(ImageFilter.MedianFilter(size=3))
    line_mask = gray.point(lambda pixel: 0 if pixel < 165 else 255, mode="1").convert("L")
    line_mask = line_mask.filter(ImageFilter.MedianFilter(size=3))

    clean = Image.new("RGB", line_mask.size, "white")
    clean.paste((20, 24, 32), mask=ImageOps.invert(line_mask))
    clean.save(OUT / "avillion-main-building-level-1-auto-clean-background.png")
    build_service_background(clean, OUT / "avillion-main-building-level-1-source-derived-background.png")
    service_background = build_service_redraw_background(clean.size, OUT / "avillion-main-building-level-1-cleaned-background.png")

    grid = reference.copy()
    draw = ImageDraw.Draw(grid)
    for pct in range(0, 101, 10):
        x = round(width * pct / 100)
        y = round(height * pct / 100)
        draw.line([(x, 0), (x, height)], fill=(220, 0, 0), width=1)
        draw.line([(0, y), (width, y)], fill=(220, 0, 0), width=1)
        draw.text((x + 3, 3), f"{pct}%", fill=(220, 0, 0))
        draw.text((3, y + 3), f"{pct}%", fill=(220, 0, 0))
    grid.save(OUT / "avillion-main-building-level-1-grid-reference.png")

    pin_records = []
    for pin in PINS:
        record = dict(pin)
        record["floor"] = FLOOR_NAME
        record["x_pct"] = round(pin["x_px"] / width * 100, 2)
        record["y_pct"] = round(pin["y_px"] / height * 100, 2)
        pin_records.append(record)

    csv_path = OUT / "avillion-main-building-level-1-pins.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=[
                "tag",
                "source_label",
                "device_type",
                "system",
                "floor",
                "x_px",
                "y_px",
                "x_pct",
                "y_pct",
                "location_guess",
                "confidence",
                "notes",
            ],
        )
        writer.writeheader()
        writer.writerows(pin_records)

    json_path = OUT / "avillion-main-building-level-1-pins.json"
    json_path.write_text(json.dumps(pin_records, indent=2), encoding="utf-8")

    preview = service_background.convert("RGBA")
    overlay = Image.new("RGBA", preview.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)
    try:
        font = ImageFont.truetype("arial.ttf", 24)
        small_font = ImageFont.truetype("arial.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
        small_font = ImageFont.load_default()

    for pin in pin_records:
        x = pin["x_px"]
        y = pin["y_px"]
        color = TYPE_COLORS.get(pin["device_type"], (99, 102, 241))
        fill = color + (235,)
        outline = (255, 255, 255, 255)
        draw.ellipse((x - 14, y - 14, x + 14, y + 14), fill=fill, outline=outline, width=4)
        label = pin["tag"] if pin["confidence"] != "needs_review" else f"{pin['tag']}?"
        text_bbox = draw.textbbox((0, 0), label, font=font)
        label_w = text_bbox[2] - text_bbox[0] + 14
        label_h = text_bbox[3] - text_bbox[1] + 10
        label_x = x + 17
        label_y = y - label_h // 2
        draw.rounded_rectangle(
            (label_x, label_y, label_x + label_w, label_y + label_h),
            radius=5,
            fill=(255, 255, 255, 235),
            outline=color + (255,),
            width=2,
        )
        draw.text((label_x + 7, label_y + 5), label, fill=(15, 23, 42, 255), font=font)

    legend_x = 28
    legend_y = 24
    legend_items = [
        ("Smoke Detector", "SD"),
        ("Emergency Light", "EL"),
        ("Hose Reel", "HR"),
        ("Manual Call Point", "BG"),
    ]
    draw.rounded_rectangle(
        (legend_x - 14, legend_y - 14, legend_x + 380, legend_y + 122),
        radius=8,
        fill=(255, 255, 255, 235),
        outline=(203, 213, 225, 255),
        width=2,
    )
    draw.text((legend_x, legend_y), "Avillion Main Building - Level 1", fill=(15, 23, 42, 255), font=font)
    for idx, (device_type, short_code) in enumerate(legend_items):
        y = legend_y + 34 + idx * 22
        color = TYPE_COLORS[device_type]
        draw.ellipse((legend_x, y, legend_x + 14, y + 14), fill=color + (235,), outline=(255, 255, 255, 255), width=2)
        draw.text((legend_x + 23, y - 3), f"{short_code} - {device_type}", fill=(51, 65, 85, 255), font=small_font)

    preview = Image.alpha_composite(preview, overlay).convert("RGB")
    preview.save(OUT / "avillion-main-building-level-1-cleaned-with-pins-preview.png")
    write_html_preview(pin_records)

    readme = f"""# Avillion Main Building Level 1 - Mimic Cleanup Pilot

Source PDF: C:/Users/Joey/Downloads/MIMIC AVILLION MAIN BUILDING.pdf

This pilot keeps the original PDF untouched. The cleaned background is for review only and is not imported into the production mimic engine or device master.

## Files

- avillion-main-building-level-1-original-reference.png - rotated/cropped source reference.
- avillion-main-building-level-1-auto-clean-background.png - automatic line cleanup from the scan.
- avillion-main-building-level-1-source-derived-background.png - source-derived cleanup with typed landmarks for comparison.
- avillion-main-building-level-1-cleaned-background.png - final service-mimic redraw with typed landmarks and no old device IDs/dots.
- avillion-main-building-level-1-cleaned-with-pins-preview.png - static review preview with RMT-style pins overlaid.
- avillion-main-building-level-1-rmt-pin-preview.html - browser preview using RMT-style marker classes and normalized pin percentages.
- avillion-main-building-level-1-pins.csv - editable extracted pin list.
- avillion-main-building-level-1-pins.json - structured extracted pin list.
- avillion-main-building-level-1-grid-reference.png - coordinate grid for manual correction.

## Coordinate Basis

Coordinates are based on the cleaned/reference image size: {width} x {height} px.
The app-ready coordinates are also stored as percentages in x_pct and y_pct.

## Extraction Notes

- Extracted devices: 19 smoke detectors, 4 emergency lights, 1 hose reel and 1 manual call point.
- The final cleaned background keeps the same 2092 x 1369 coordinate space as the reference image, so normalized pin coordinates should remain usable.
- No existing Avillion Main Building Level 1 production pin/master data was found in the current RMT FIREAPPS output folder. The preview uses the extracted draft pins in the same x_pct/y_pct overlay style used by the RMT marker system.
- EL2 requires review: the source handwriting near the SSB/pump room area appears duplicated/unclear as EL3.
- Suggested manual review before import: EL2 label/position, SD18 near Pump Room, SD19 near S/L room. No bulk coordinate rewrite is recommended from this pilot.
- All pins are draft review data. Do not import as official master data until verified.
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")

    print(f"reference={width}x{height}")
    print(f"pins={len(pin_records)}")
    print(f"output={OUT.resolve()}")


if __name__ == "__main__":
    main()
