from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from dxf_preview import parse_dxf, collect_primitives, render


SRC = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\MIMIC-R1 2000.dxf")
OUT_DIR = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\outputs\mtb-floor-review")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Boxes are based on the clean right-side CAD blocks, not the plotted sheet.
# Format: output name, display title, min_x, min_y, max_x, max_y
FLOORS = [
    ("level-01", "Level 1", 2060, -360, 2420, -150),
    ("level-02", "Level 2", 2395, -360, 2765, -150),
    ("level-03", "Level 3", 1900, -160, 2225, 35),
    ("level-04-05-typical", "Typical Level 4 & Level 5", 2220, -160, 2465, 35),
    ("level-06", "Level 6", 2485, -160, 2785, 35),
    ("level-07", "Level 7", 1900, 25, 2225, 215),
    ("level-08", "Level 8", 2210, 25, 2465, 215),
    ("level-09", "Level 9", 2500, 25, 2785, 215),
    ("level-10-typical", "Typical Level 10", 1900, 1010, 2175, 1218),
    ("level-11-typical", "Typical Level 11", 1900, 850, 2175, 1010),
    ("level-12-typical", "Typical Level 12", 1900, 690, 2175, 850),
    ("level-13-typical", "Typical Level 13", 1900, 535, 2175, 690),
    ("level-14-typical", "Typical Level 14", 1900, 380, 2175, 535),
    ("level-15-typical", "Typical Level 15", 1900, 215, 2175, 380),
    ("level-16-typical", "Typical Level 16", 2165, 1010, 2435, 1218),
    ("level-17-typical", "Typical Level 17", 2165, 850, 2435, 1010),
    ("level-18-typical", "Typical Level 18", 2165, 690, 2435, 850),
    ("level-19-typical", "Typical Level 19", 2165, 535, 2435, 690),
    ("level-20-typical", "Typical Level 20", 2165, 380, 2435, 535),
    ("level-21-typical", "Typical Level 21", 2165, 215, 2435, 380),
    ("level-22-typical", "Typical Level 22", 2440, 535, 2720, 690),
    ("level-23-typical", "Typical Level 23", 2440, 380, 2720, 535),
    ("level-24", "Level 24", 2440, 215, 2720, 380),
]


def in_box(point, box):
    x, y = point
    min_x, min_y, max_x, max_y = box
    return min_x <= x <= max_x and min_y <= y <= max_y


def crop_primitives(lines, circles, texts, box):
    cropped_lines = [(a, b) for a, b in lines if in_box(a, box) or in_box(b, box)]
    cropped_circles = [(x, y, r) for x, y, r in circles if in_box((x, y), box)]
    cropped_texts = [(x, y, t) for x, y, t in texts if in_box((x, y), box)]
    return cropped_lines, cropped_circles, cropped_texts


def main():
    entities = parse_dxf(str(SRC))
    lines, circles, texts, _ = collect_primitives(entities)
    index_lines = ["# MTB Floor Review Pack", "", "Generated from `MIMIC-R1 2000.dxf`.", ""]
    for name, title, *box_values in FLOORS:
        box = tuple(float(v) for v in box_values)
        cropped = crop_primitives(lines, circles, texts, box)
        out_png = OUT_DIR / f"{name}.png"
        try:
            info = render(*cropped, str(out_png))
            index_lines.append(f"- [{title}]({out_png.name}) - {info['lines']} lines, {info['texts']} text labels")
        except SystemExit:
            index_lines.append(f"- {title} - no drawable entities found")
    (OUT_DIR / "index.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")
    print(OUT_DIR)


if __name__ == "__main__":
    main()
