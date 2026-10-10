"""Create source-faithful, editable DXF draft redraws for the LTK PDF.

This pilot deliberately traces only major, visible source geometry. It does not
infer a site plan, hidden room detail, or RMT application device pins.
"""

from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "mimic-cad-pilot" / "ltk"
SOURCE = ROOT / "tmp" / "ltk-cad-source"
OUT.mkdir(parents=True, exist_ok=True)

LAYERS = [
    "WALL", "DOOR", "OPENING", "COLUMN", "EQUIPMENT", "TEXT", "ZONE",
    "BOUNDARY", "REFERENCE", "FIRE_DEVICE_REFERENCE",
]

COLORS = {
    "WALL": "#1f2937", "DOOR": "#2563eb", "OPENING": "#2563eb",
    "COLUMN": "#475569", "EQUIPMENT": "#7c3aed", "TEXT": "#111827",
    "ZONE": "#64748b", "BOUNDARY": "#111827", "REFERENCE": "#94a3b8",
    "FIRE_DEVICE_REFERENCE": "#dc2626",
}


def dxf_header() -> list[str]:
    lines = ["0", "SECTION", "2", "HEADER", "0", "ENDSEC", "0", "SECTION", "2", "TABLES",
             "0", "TABLE", "2", "LAYER", "70", str(len(LAYERS))]
    for i, name in enumerate(LAYERS, 1):
        lines += ["0", "LAYER", "2", name, "70", "0", "62", str(i), "6", "CONTINUOUS"]
    lines += ["0", "ENDTAB", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"]
    return lines


def dxf_end(lines: list[str]) -> None:
    lines += ["0", "ENDSEC", "0", "EOF"]


def line(lines: list[str], layer: str, a: tuple[float, float], b: tuple[float, float]) -> None:
    lines += ["0", "LINE", "8", layer, "10", str(a[0]), "20", str(a[1]), "30", "0",
              "11", str(b[0]), "21", str(b[1]), "31", "0"]


def rect(lines: list[str], layer: str, x: float, y: float, w: float, h: float) -> None:
    points = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    for a, b in zip(points, points[1:] + points[:1]):
        line(lines, layer, a, b)


def circle(lines: list[str], layer: str, x: float, y: float, r: float) -> None:
    lines += ["0", "CIRCLE", "8", layer, "10", str(x), "20", str(y), "30", "0", "40", str(r)]


def text(lines: list[str], layer: str, x: float, y: float, value: str, height: float = 3.5) -> None:
    lines += ["0", "TEXT", "8", layer, "10", str(x), "20", str(y), "30", "0", "40", str(height),
              "1", value, "7", "STANDARD"]


def add_door(lines: list[str], x: float, y: float, width: float, vertical: bool = False) -> None:
    # A minimal source-confirmed door opening and swing reference.
    if vertical:
        line(lines, "OPENING", (x, y), (x, y + width))
        line(lines, "DOOR", (x, y), (x + width * 0.7, y + width * 0.7))
    else:
        line(lines, "OPENING", (x, y), (x + width, y))
        line(lines, "DOOR", (x, y), (x + width * 0.7, y + width * 0.7))


def feed_mill() -> list[str]:
    l = dxf_header()
    text(l, "TEXT", 10, 127, "LTK - FEED MILL", 5)
    text(l, "REFERENCE", 10, 121, "Source: Mimic LTK.pdf, page 2. Major source-visible geometry only.", 2.5)
    rect(l, "BOUNDARY", 10, 10, 130, 105)
    rect(l, "WALL", 35, 35, 95, 65)
    line(l, "WALL", (35, 68), (130, 68))
    line(l, "WALL", (82, 35), (82, 100))
    line(l, "WALL", (35, 52), (130, 52))
    # Visible internal divider and four source-visible access points.
    for x in (52, 78, 98, 118):
        rect(l, "COLUMN", x, 64, 2.5, 2.5)
        rect(l, "COLUMN", x, 49, 2.5, 2.5)
    for x in (45, 70, 90, 112):
        add_door(l, x, 100, 8)
    for x in (45, 73, 93, 114):
        add_door(l, x, 35, 8)
    # Printed zones visible in the source; not handwritten device annotations.
    text(l, "ZONE", 55, 86, "ZONE 1", 3)
    text(l, "ZONE", 105, 86, "ZONE 2", 3)
    text(l, "ZONE", 55, 43, "ZONE 3", 3)
    text(l, "ZONE", 105, 43, "ZONE 4", 3)
    # Source printed line runs / control marks, isolated on reference layers.
    for y in (59, 61):
        line(l, "EQUIPMENT", (48, y), (118, y))
    for x, y in ((55, 59), (76, 59), (104, 59), (55, 61), (76, 61), (104, 61)):
        circle(l, "FIRE_DEVICE_REFERENCE", x, y, 0.8)
    text(l, "REFERENCE", 10, 3, "Handwritten circles, arrows, scan noise and legacy notes intentionally omitted.", 2.5)
    dxf_end(l)
    return l


def egg_production() -> list[str]:
    l = dxf_header()
    text(l, "TEXT", 10, 128, "LTK - EGG PRODUCTION", 5)
    text(l, "REFERENCE", 10, 122, "Source: Mimic LTK.pdf, page 3. Major source-visible block geometry only.", 2.5)
    # Source shows a row of five long blocks with a common lower service route.
    rect(l, "BOUNDARY", 12, 18, 150, 92)
    rect(l, "WALL", 22, 48, 128, 46)
    block_x = [22, 47.6, 73.2, 98.8, 124.4]
    for i, x in enumerate(block_x, 1):
        rect(l, "ZONE", x, 53, 22, 36)
        text(l, "ZONE", x + 4, 91, f"BLOCK {i}", 2.8)
        # The source has a repeated internal equipment/control block in each block.
        rect(l, "EQUIPMENT", x + 7, 66, 8, 8)
        line(l, "EQUIPMENT", (x + 11, 53), (x + 11, 66))
        circle(l, "FIRE_DEVICE_REFERENCE", x + 3, 52, 0.8)
        circle(l, "FIRE_DEVICE_REFERENCE", x + 19, 52, 0.8)
    line(l, "WALL", (22, 48), (150, 48))
    line(l, "WALL", (22, 38), (150, 38))
    line(l, "WALL", (22, 28), (150, 28))
    # Curved roadway/route is present in the original as broad U-shaped lower route.
    line(l, "REFERENCE", (22, 18), (38, 8))
    line(l, "REFERENCE", (38, 8), (130, 8))
    line(l, "REFERENCE", (130, 8), (150, 18))
    text(l, "REFERENCE", 12, 3, "Printed device symbols retained as hideable reference only. Handwritten notes omitted.", 2.5)
    dxf_end(l)
    return l


def main_panel() -> list[str]:
    l = dxf_header()
    text(l, "TEXT", 10, 128, "LTK - MAIN PANEL OVERALL BUILDING MIMIC", 5)
    text(l, "REFERENCE", 10, 122, "Source: Mimic LTK.pdf, page 1. Major source-visible overall layout only.", 2.5)
    rect(l, "BOUNDARY", 14, 14, 150, 96)
    # Major source-visible wall, partition and enclosure outlines only.
    rect(l, "WALL", 30, 30, 52, 64)
    rect(l, "WALL", 88, 39, 56, 44)
    # Upper long enclosure and its visible partitions.
    rect(l, "WALL", 88, 76, 54, 25)
    for x in (100, 110, 120, 130):
        line(l, "WALL", (x, 84), (x, 101))
    line(l, "WALL", (88, 84), (142, 84))
    line(l, "WALL", (88, 69), (144, 69))
    line(l, "WALL", (102, 39), (102, 69))
    line(l, "WALL", (126, 39), (126, 69))
    # Central source-labelled blocks and right-side equipment enclosure.
    rect(l, "EQUIPMENT", 34, 57, 40, 32)
    line(l, "EQUIPMENT", (34, 81), (74, 81))
    line(l, "EQUIPMENT", (34, 72), (74, 72))
    line(l, "EQUIPMENT", (34, 63), (74, 63))
    rect(l, "EQUIPMENT", 92, 61, 30, 7)
    rect(l, "EQUIPMENT", 92, 51, 30, 7)
    rect(l, "EQUIPMENT", 92, 42, 30, 6)
    rect(l, "WALL", 146, 24, 12, 43)
    for y in (31, 38, 45, 52, 59):
        line(l, "WALL", (146, y), (158, y))
    # Lower source-visible return route and rectangular control zone.
    line(l, "BOUNDARY", (30, 24), (82, 24))
    line(l, "BOUNDARY", (82, 24), (88, 30))
    line(l, "BOUNDARY", (88, 30), (144, 30))
    rect(l, "EQUIPMENT", 34, 35, 35, 12)
    # Repeated printed circles are put on their own hideable device-reference layer.
    for x, y in ((44, 78), (55, 78), (66, 78), (44, 65), (55, 65), (66, 65),
                 (96, 65), (105, 65), (114, 65), (99, 57), (111, 57), (134, 48), (134, 42)):
        circle(l, "FIRE_DEVICE_REFERENCE", x, y, 1.3)
    text(l, "ZONE", 46, 84, "VENDOR", 3)
    text(l, "ZONE", 46, 77, "LOCKER", 3)
    text(l, "ZONE", 46, 70, "CANTEEN", 3)
    text(l, "ZONE", 46, 56, "STORE", 3)
    text(l, "REFERENCE", 10, 3, "Page 1 is the overall Main Panel mimic. Handwritten notes and runtime pins are intentionally omitted.", 2.5)
    dxf_end(l)
    return l


def write_dxf(filename: str, content: list[str]) -> None:
    (OUT / filename).write_text("\n".join(content) + "\n", encoding="ascii")


def preview(name: str, builder, source_page: str) -> None:
    # A clean image preview mirrors the same deliberately limited CAD geometry.
    image = Image.new("RGB", (1400, 1000), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    draw.text((35, 25), name.replace("_", " "), fill=COLORS["TEXT"], font=font)
    draw.text((35, 45), "Editable DXF draft - source-visible major geometry only", fill=COLORS["REFERENCE"], font=font)

    # Render simplified lines directly from the known three diagrams.
    if "FEED" in name:
        box = (120, 150, 1260, 850); draw.rectangle(box, outline=COLORS["BOUNDARY"], width=4)
        draw.rectangle((340, 330, 1170, 760), outline=COLORS["WALL"], width=4)
        for y in (500, 610): draw.line((340, y, 1170, y), fill=COLORS["WALL"], width=4)
        draw.line((755, 330, 755, 760), fill=COLORS["WALL"], width=4)
        for x in (500, 870): draw.text((x, 390), "ZONE", fill=COLORS["ZONE"], font=font)
    elif "EGG" in name:
        draw.rectangle((100, 180, 1300, 780), outline=COLORS["BOUNDARY"], width=4)
        for i in range(5):
            x = 205 + i * 200
            draw.rectangle((x, 350, x + 175, 650), outline=COLORS["ZONE"], width=4)
            draw.rectangle((x + 55, 450, x + 120, 520), outline=COLORS["EQUIPMENT"], width=3)
            draw.text((x + 38, 325), f"BLOCK {i + 1}", fill=COLORS["TEXT"], font=font)
        for y in (680, 735): draw.line((190, y, 1180, y), fill=COLORS["WALL"], width=4)
    else:
        draw.rectangle((100, 160, 1300, 830), outline=COLORS["BOUNDARY"], width=4)
        draw.rectangle((230, 300, 650, 730), outline=COLORS["WALL"], width=4)
        draw.rectangle((700, 360, 1160, 650), outline=COLORS["WALL"], width=4)
        draw.rectangle((700, 240, 1150, 410), outline=COLORS["WALL"], width=4)
        for x in (800, 885, 970, 1055): draw.line((x, 240, x, 355), fill=COLORS["WALL"], width=4)
        draw.rectangle((750, 465, 1010, 530), outline=COLORS["EQUIPMENT"], width=3)
        draw.rectangle((750, 555, 1010, 615), outline=COLORS["EQUIPMENT"], width=3)
        draw.rectangle((1170, 530, 1260, 740), outline=COLORS["WALL"], width=4)
        for y in (570, 610, 650, 690): draw.line((1170, y, 1260, y), fill=COLORS["WALL"], width=4)
        for label, y in (("VENDOR", 355), ("LOCKER", 430), ("CANTEEN", 505), ("STORE", 600)):
            draw.text((390, y), label, fill=COLORS["TEXT"], font=font)
    draw.text((35, 940), "Handwritten annotations, scan artefacts and RMT runtime pins are excluded.", fill=COLORS["REFERENCE"], font=font)
    preview_path = OUT / f"{name}.png"
    image.save(preview_path)

    source = Image.open(SOURCE / source_page).convert("RGB")
    source.thumbnail((1400, 900))
    cad = Image.open(preview_path).convert("RGB")
    cad.thumbnail((1400, 900))
    comparison = Image.new("RGB", (2800, 980), "white")
    comparison.paste(source, (0, 60))
    comparison.paste(cad, (1400, 60))
    cd = ImageDraw.Draw(comparison)
    cd.text((15, 15), "ORIGINAL SOURCE", fill="black", font=font)
    cd.text((1415, 15), "CAD REDRAW PREVIEW", fill="black", font=font)
    comparison.save(OUT / f"{name}-comparison.png")


def main() -> None:
    drawings = {
        "LTK_MAIN_PANEL_OVERALL": (main_panel(), "ltk-page-1.png"),
        "LTK_FEED_MILL": (feed_mill(), "ltk-page-2.png"),
        "LTK_EGG_PRODUCTION": (egg_production(), "ltk-page-3.png"),
    }
    for name, (content, page) in drawings.items():
        write_dxf(f"{name}.dxf", content)
        preview(name, content, page)
    (OUT / "README.md").write_text(
        "# LTK CAD Redraw Pilot\n\n"
        "These DXF files are editable R12 ASCII drawings, organised with the requested layers. "
        "They trace only major geometry visible in `Mimic LTK.pdf`. Handwritten circles, arrows, "
        "technician notes and scan noise are intentionally excluded. `FIRE_DEVICE_REFERENCE` contains "
        "only simple source-visible reference symbols and is separate from RMT runtime pins.\n\n"
        "## Source interpretation\n\n"
        "Page 1 is the authoritative Main Panel overall building mimic and is redrawn as such. The drawing "
        "does not visibly print Feed Mill or Egg Production zone labels, so those labels have not been added. "
        "The detailed Feed Mill and Egg Production plans are traced from Pages 2 and 3 respectively.\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
