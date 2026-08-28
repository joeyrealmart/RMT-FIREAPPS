from __future__ import annotations

from pathlib import Path
from shutil import copyfile

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
MIMIC_ROOT = ROOT / "outputs" / "rmt-fire-local-data" / "mimic-library"


def font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def title(draw: ImageDraw.ImageDraw, text: str, subtitle: str, size: tuple[int, int]) -> None:
    w, h = size
    draw.rectangle((0, 0, w - 1, h - 1), outline="#d9e2ef", width=2)
    draw.text((24, 20), text, fill="#111827", font=font(24))
    draw.text((24, 52), subtitle, fill="#667085", font=font(15))


def stair(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], label: str = "ST") -> None:
    x1, y1, x2, y2 = box
    draw.rectangle(box, outline="#111827", width=3, fill="#fff7d6")
    count = 6
    for i in range(1, count):
        y = y1 + (y2 - y1) * i // count
        draw.line((x1, y, x2, y), fill="#d97706", width=2)
    draw.text((x1 + 5, y1 + 5), label, fill="#92400e", font=font(12))


def door(draw: ImageDraw.ImageDraw, hinge: tuple[int, int], size: int = 30, orient: str = "right") -> None:
    x, y = hinge
    color = "#2563eb"
    if orient == "right":
        draw.arc((x, y - size, x + size, y), 180, 270, fill=color, width=2)
        draw.line((x, y, x + size, y), fill=color, width=2)
    elif orient == "left":
        draw.arc((x - size, y - size, x, y), 270, 360, fill=color, width=2)
        draw.line((x, y, x - size, y), fill=color, width=2)
    elif orient == "down":
        draw.arc((x, y, x + size, y + size), 180, 270, fill=color, width=2)
        draw.line((x, y, x, y + size), fill=color, width=2)
    else:
        draw.arc((x - size, y - size, x, y), 0, 90, fill=color, width=2)
        draw.line((x, y, x, y - size), fill=color, width=2)


def grid(draw: ImageDraw.ImageDraw, x1: int, y1: int, x2: int, y2: int, step: int) -> None:
    for x in range(x1, x2 + 1, step):
        draw.line((x, y1, x, y2), fill="#f3f4f6", width=1)
    for y in range(y1, y2 + 1, step):
        draw.line((x1, y, x2, y), fill="#f3f4f6", width=1)


def label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, size: int = 15) -> None:
    draw.text(xy, text, fill="#667085", font=font(size))


def save_wetex_typical() -> Path:
    # The hand-tuned typical floor created earlier is the master for L5-L8.
    src = MIMIC_ROOT / "WETEX" / "clean" / "wetex-floor-06-simple.png"
    if not src.exists():
        import subprocess
        subprocess.run([
            str(ROOT / ".." / ".." / ".." / ".." / ".cache" / "codex-runtimes" / "codex-primary-runtime" / "dependencies" / "python" / "python.exe"),
            str(ROOT / "work" / "generate-wetex-typical-simple.py"),
        ], check=False)
    return src


def wetex_simple(index: int, name: str, variant: str) -> Path:
    w, h = 1190, 842
    image = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(image)
    title(d, f"WETEX {name} - Simplified Mimic", "Building outline, partitions, stairs and doors only", (w, h))
    grid(d, 70, 110, 930, 700, 100)
    wall, part = "#111827", "#475467"

    if variant == "lg":
        outer = [(80, 205), (785, 205), (850, 155), (935, 190), (935, 640), (710, 670), (120, 660), (80, 205)]
        d.line(outer, fill=wall, width=5)
        d.rectangle((120, 245, 360, 600), outline=part, width=3)
        d.rectangle((390, 250, 575, 600), outline=part, width=3)
        d.rectangle((610, 240, 805, 610), outline=part, width=3)
        d.line((120, 380, 805, 380), fill=part, width=3)
        d.line((120, 500, 805, 500), fill=part, width=3)
        stair(d, (145, 545, 235, 620)); stair(d, (800, 245, 875, 335)); stair(d, (610, 600, 700, 650))
        label(d, (185, 305), "CAR PARK / OPEN"); label(d, (430, 315), "SERVICE"); label(d, (650, 315), "ROOMS")
        for p in [((360, 380), "right"), ((575, 380), "right"), ((805, 500), "left"), ((390, 500), "left")]:
            door(d, p[0], orient=p[1])
    elif variant == "ground":
        outer = [(130, 135), (630, 135), (630, 285), (780, 300), (785, 620), (310, 650), (150, 530), (130, 135)]
        d.line(outer, fill=wall, width=5)
        d.rectangle((175, 180, 380, 330), outline=part, width=3)
        d.rectangle((400, 185, 600, 340), outline=part, width=3)
        d.rectangle((235, 380, 500, 600), outline=part, width=3)
        d.line((500, 380, 760, 380), fill=part, width=3)
        d.line((500, 505, 780, 505), fill=part, width=3)
        stair(d, (150, 430, 225, 520)); stair(d, (570, 135, 630, 225)); stair(d, (700, 520, 770, 610))
        label(d, (230, 245), "LOBBY"); label(d, (450, 250), "SHOP"); label(d, (330, 470), "CORE"); label(d, (590, 450), "OPEN AREA")
        for p in [((380, 300), "right"), ((500, 505), "left"), ((600, 300), "right")]:
            door(d, p[0], orient=p[1])
    elif variant in {"l1", "l2", "l3"}:
        offset = {"l1": 0, "l2": 20, "l3": -15}[variant]
        outer = [(115, 155), (470, 155), (470, 245), (830, 255), (890, 390 + offset), (780, 645), (220, 650), (115, 520), (115, 155)]
        d.line(outer, fill=wall, width=5)
        d.rectangle((150, 200, 325, 560), outline=part, width=3)
        d.rectangle((350, 245, 520, 560), outline=part, width=3)
        d.rectangle((545, 270, 740, 560), outline=part, width=3)
        d.line((150, 375, 760, 375), fill=part, width=3)
        d.line((150, 485, 820, 485), fill=part, width=3)
        stair(d, (115, 155, 180, 230)); stair(d, (450, 245, 520, 315)); stair(d, (735, 550, 810, 630))
        label(d, (200, 285), "ROOMS"); label(d, (395, 330), "CORE"); label(d, (600, 330), "OPEN AREA"); label(d, (560, 520), "CORRIDOR")
        for p in [((325, 375), "right"), ((520, 375), "right"), ((740, 485), "left"), ((350, 485), "left")]:
            door(d, p[0], orient=p[1])
    elif variant == "l9":
        outer = [(110, 155), (520, 155), (520, 250), (850, 250), (850, 640), (250, 660), (110, 525), (110, 155)]
        d.line(outer, fill=wall, width=5)
        d.rectangle((150, 210, 340, 600), outline=part, width=3)
        d.rectangle((370, 260, 560, 600), outline=part, width=3)
        d.rectangle((590, 285, 790, 590), outline=part, width=3)
        d.line((150, 410, 790, 410), fill=part, width=3)
        stair(d, (115, 155, 180, 230)); stair(d, (500, 250, 560, 330)); stair(d, (760, 520, 830, 610))
        label(d, (210, 310), "ROOMS"); label(d, (420, 335), "CORE"); label(d, (650, 365), "OPEN AREA")
        for p in [((340, 410), "right"), ((560, 410), "right"), ((790, 520), "left")]:
            door(d, p[0], orient=p[1])
    else:
        outer = [(285, 125), (525, 125), (525, 245), (750, 245), (750, 615), (285, 615), (285, 125)]
        d.line(outer, fill=wall, width=5)
        d.rectangle((325, 165, 495, 300), outline=part, width=3)
        d.rectangle((325, 350, 520, 570), outline=part, width=3)
        d.rectangle((560, 300, 720, 570), outline=part, width=3)
        stair(d, (650, 500, 720, 585)); stair(d, (285, 125, 350, 205))
        label(d, (365, 220), "ROOM"); label(d, (365, 450), "PLANT / OPEN"); label(d, (595, 405), "ROOF AREA")
        door(d, (520, 350), 32, "right")

    out = MIMIC_ROOT / "WETEX" / "clean" / f"wetex-floor-{index:02d}-simple.png"
    image.save(out)
    return out


def uob_simple(page: int, name: str) -> Path:
    w, h = 1684, 1190
    image = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(image)
    title(d, f"UOB {name} - Simplified Mimic", "Building outline, partitions, stair and door positions only", (w, h))
    grid(d, 140, 150, 1350, 960, 120)
    wall, part = "#111827", "#475467"

    if page == 1:
        outer = [(210, 180), (920, 180), (920, 365), (1110, 365), (1110, 800), (830, 950), (285, 950), (210, 180)]
        d.line(outer, fill=wall, width=6)
        d.rectangle((360, 220, 690, 860), outline=part, width=4)
        d.rectangle((725, 250, 990, 760), outline=part, width=4)
        d.line((360, 420, 990, 420), fill=part, width=4)
        d.line((360, 625, 990, 625), fill=part, width=4)
        stair(d, (245, 720, 390, 910), "STAIR")
        stair(d, (880, 365, 1030, 505), "STAIR")
        label(d, (475, 330), "GROUND AREA", 22); label(d, (785, 540), "CORE", 22)
        for p in [((690, 420), "right"), ((725, 625), "left"), ((990, 500), "right")]:
            door(d, p[0], 48, p[1])
    elif page == 2:
        outer = [(255, 220), (950, 220), (1010, 390), (1010, 850), (760, 960), (340, 850), (255, 220)]
        d.line(outer, fill=wall, width=6)
        d.rectangle((360, 280, 610, 780), outline=part, width=4)
        d.rectangle((650, 280, 930, 780), outline=part, width=4)
        d.line((360, 500, 930, 500), fill=part, width=4)
        stair(d, (780, 225, 940, 370), "STAIR")
        stair(d, (360, 760, 520, 920), "STAIR")
        label(d, (440, 395), "ROOMS", 22); label(d, (720, 395), "CORE", 22); label(d, (640, 650), "OPEN AREA", 22)
        for p in [((610, 500), "right"), ((650, 500), "left"), ((930, 600), "right")]:
            door(d, p[0], 48, p[1])
    else:
        outer = [(240, 210), (950, 210), (1030, 350), (1030, 830), (760, 955), (320, 855), (240, 210)]
        d.line(outer, fill=wall, width=6)
        d.rectangle((340, 270, 600, 780), outline=part, width=4)
        d.rectangle((640, 275, 930, 780), outline=part, width=4)
        d.line((340, 455, 930, 455), fill=part, width=4)
        d.line((340, 635, 930, 635), fill=part, width=4)
        stair(d, (780, 210, 940, 360), "STAIR")
        stair(d, (340, 760, 500, 920), "STAIR")
        label(d, (430, 365), "ROOMS", 22); label(d, (715, 360), "CORE", 22); label(d, (655, 600), "OPEN AREA", 22)
        for p in [((600, 455), "right"), ((640, 635), "left"), ((930, 560), "right")]:
            door(d, p[0], 48, p[1])

    out = MIMIC_ROOT / "UOB" / "clean" / f"page-{page:03d}-simple.png"
    image.save(out)
    return out


def make_sheet(paths: list[Path], out: Path, thumb_w: int = 360) -> None:
    thumbs: list[Image.Image] = []
    for p in paths:
        img = Image.open(p).convert("RGB")
        ratio = thumb_w / img.width
        thumb = img.resize((thumb_w, int(img.height * ratio)))
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
    sheet.save(out)


def main() -> None:
    outputs: list[Path] = []
    outputs.extend([
        uob_simple(1, "Ground Floor"),
        uob_simple(2, "1st Floor"),
        uob_simple(3, "2nd Floor"),
    ])
    outputs.extend([
        wetex_simple(1, "LG", "lg"),
        wetex_simple(2, "Ground", "ground"),
        wetex_simple(3, "L1", "l1"),
        wetex_simple(4, "L2", "l2"),
        wetex_simple(5, "L3", "l3"),
    ])
    typical = save_wetex_typical()
    outputs.append(typical)
    copyfile(typical, MIMIC_ROOT / "WETEX" / "clean" / "wetex-floor-07-simple.png")
    copyfile(typical, MIMIC_ROOT / "WETEX" / "clean" / "wetex-floor-08-simple.png")
    copyfile(typical, MIMIC_ROOT / "WETEX" / "clean" / "wetex-floor-09-simple.png")
    outputs.extend([
        MIMIC_ROOT / "WETEX" / "clean" / "wetex-floor-07-simple.png",
        MIMIC_ROOT / "WETEX" / "clean" / "wetex-floor-08-simple.png",
        MIMIC_ROOT / "WETEX" / "clean" / "wetex-floor-09-simple.png",
        wetex_simple(10, "L9", "l9"),
        wetex_simple(11, "Rooftop", "roof"),
    ])

    make_sheet([p for p in outputs if "\\UOB\\" in str(p) or "/UOB/" in str(p)], MIMIC_ROOT / "UOB" / "clean" / "uob-simple-contact-sheet.png")
    make_sheet([p for p in outputs if "\\WETEX\\" in str(p) or "/WETEX/" in str(p)], MIMIC_ROOT / "WETEX" / "clean" / "wetex-simple-contact-sheet.png")
    for p in outputs:
        print(p)


if __name__ == "__main__":
    main()
