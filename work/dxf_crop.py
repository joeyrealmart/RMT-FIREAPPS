import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dxf_preview import parse_dxf, collect_primitives, render


def in_box(point, box):
    x, y = point
    min_x, min_y, max_x, max_y = box
    return min_x <= x <= max_x and min_y <= y <= max_y


def crop(src, out, box):
    entities = parse_dxf(src)
    lines, circles, texts, counts = collect_primitives(entities)
    cropped_lines = [(a, b) for a, b in lines if in_box(a, box) or in_box(b, box)]
    cropped_circles = [(x, y, r) for x, y, r in circles if in_box((x, y), box)]
    cropped_texts = [(x, y, t) for x, y, t in texts if in_box((x, y), box)]
    info = render(cropped_lines, cropped_circles, cropped_texts, out)
    print(info)
    print({"lines": len(cropped_lines), "circles": len(cropped_circles), "texts": len(cropped_texts)})


if __name__ == "__main__":
    box = tuple(float(v) for v in sys.argv[3:7])
    crop(sys.argv[1], sys.argv[2], box)
