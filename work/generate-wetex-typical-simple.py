from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "rmt-fire-local-data" / "mimic-library" / "WETEX" / "clean" / "wetex-floor-06-simple.png"
WIDTH, HEIGHT = 1190, 842


def font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def draw_stair(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], label: str = "STAIR") -> None:
    x1, y1, x2, y2 = box
    draw.rectangle(box, outline="#111827", width=3, fill="#fff7d6")
    step_count = 6
    step_h = max(4, (y2 - y1) // step_count)
    for i in range(1, step_count):
        y = y1 + i * step_h
        draw.line((x1, y, x2, y), fill="#d97706", width=2)
    draw.text((x1 + 4, y1 + 4), label, fill="#92400e", font=font(12))


def draw_door(draw: ImageDraw.ImageDraw, hinge: tuple[int, int], size: int = 28, orient: str = "right") -> None:
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


def main() -> None:
    image = Image.new("RGB", (WIDTH, HEIGHT), "white")
    draw = ImageDraw.Draw(image)

    wall = "#111827"
    partition = "#475467"
    light = "#e5e7eb"

    # Header and clean canvas border.
    draw.rectangle((0, 0, WIDTH - 1, HEIGHT - 1), outline="#d9e2ef", width=2)
    draw.text((24, 20), "WETEX Typical Floor L5-L8 - Simplified Mimic", fill="#111827", font=font(24))
    draw.text((24, 52), "Building outline, main partitions, stair and door positions only", fill="#667085", font=font(15))

    # Main building envelope, traced from the WETEX typical floor but simplified.
    outer = [
        (86, 176), (245, 176), (245, 300), (430, 300), (430, 308),
        (560, 308), (560, 316), (848, 322), (802, 430), (775, 590),
        (600, 616), (86, 616), (86, 176)
    ]
    draw.line(outer, fill=wall, width=5, joint="curve")

    # Left services / room block.
    draw.rectangle((105, 205, 245, 318), outline=partition, width=3)
    draw.rectangle((125, 230, 215, 282), outline=partition, width=3)
    draw.rectangle((105, 318, 292, 616), outline=partition, width=3)
    draw.line((210, 318, 210, 616), fill=partition, width=3)
    for y in (365, 414, 463, 512, 562):
        draw.line((105, y, 210, y), fill=partition, width=2)
    draw.rectangle((220, 370, 292, 565), outline=partition, width=3)
    draw.line((248, 370, 248, 565), fill=light, width=8)

    # Central corridor and core partitions.
    draw.line((292, 300, 292, 616), fill=wall, width=4)
    draw.line((292, 300, 430, 300), fill=wall, width=4)
    draw.line((430, 300, 430, 480), fill=partition, width=3)
    draw.line((430, 480, 600, 480), fill=partition, width=3)
    draw.line((600, 316, 600, 616), fill=partition, width=3)
    draw.line((292, 520, 600, 520), fill=partition, width=3)
    draw.rectangle((300, 330, 390, 455), outline=partition, width=3)
    draw.rectangle((455, 330, 555, 445), outline=partition, width=3)
    draw.rectangle((455, 520, 565, 615), outline=partition, width=3)

    # Right side open area / angled outer zone.
    draw.line((600, 480, 742, 480), fill=partition, width=3)
    draw.line((742, 480, 742, 594), fill=partition, width=3)
    draw.line((742, 594, 600, 616), fill=partition, width=3)
    draw.line((748, 340, 848, 322), fill=partition, width=3)
    draw.line((748, 340, 710, 460), fill=partition, width=3)
    draw.line((710, 460, 742, 480), fill=partition, width=3)

    # Stairs shown as app-friendly yellow blocks.
    draw_stair(draw, (86, 176, 140, 226), "ST")
    draw_stair(draw, (250, 305, 292, 360), "ST")
    draw_stair(draw, (515, 307, 560, 365), "ST")
    draw_stair(draw, (812, 330, 848, 386), "ST")
    draw_stair(draw, (470, 560, 515, 616), "ST")
    draw_stair(draw, (100, 588, 155, 616), "ST")

    # Main door/opening indications.
    for hinge, orient in [
        ((245, 210), "right"), ((245, 282), "right"), ((292, 360), "right"),
        ((430, 350), "left"), ((560, 360), "right"), ((600, 430), "right"),
        ((742, 520), "left"), ((210, 365), "left"), ((210, 512), "left"),
        ((455, 520), "down"), ((515, 560), "left")
    ]:
        draw_door(draw, hinge, 28, orient)

    # Minimal labels to orient technicians.
    labels = [
        ((150, 250), "POOL / ROOM"), ((122, 344), "ROOMS"), ((228, 462), "LOBBY"),
        ((318, 360), "CORE"), ((475, 375), "OFFICE"), ((625, 405), "OPEN AREA"),
        ((665, 535), "OPEN AREA")
    ]
    for (x, y), text in labels:
        draw.text((x, y), text, fill="#667085", font=font(15))

    # Light grey coordinate grid bands, just enough to help pin alignment without visual noise.
    for x in range(100, 901, 100):
        draw.line((x, 100, x, 650), fill="#f3f4f6", width=1)
    for y in range(150, 651, 100):
        draw.line((60, y, 900, y), fill="#f3f4f6", width=1)

    # Re-draw outline over grid.
    draw.line(outer, fill=wall, width=5, joint="curve")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
