from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math
import sys


def read_pairs(path):
    lines = Path(path).read_text(errors="ignore").splitlines()
    for i in range(0, len(lines) - 1, 2):
        yield lines[i].strip(), lines[i + 1].rstrip("\n")


def as_float(value, default=0.0):
    try:
        return float(value.strip())
    except Exception:
        return default


def parse_dxf(path):
    pairs = list(read_pairs(path))
    entities = []
    in_entities = False
    i = 0
    while i < len(pairs):
        code, value = pairs[i]
        if code == "0" and value == "SECTION" and i + 1 < len(pairs) and pairs[i + 1] == ("2", "ENTITIES"):
            in_entities = True
            i += 2
            continue
        if in_entities and code == "0" and value == "ENDSEC":
            break
        if not in_entities or code != "0":
            i += 1
            continue

        kind = value
        data = []
        i += 1
        while i < len(pairs) and pairs[i][0] != "0":
            data.append(pairs[i])
            i += 1
        entities.append((kind, data))
    return entities


def first(data, group, default=""):
    for code, value in data:
        if code == group:
            return value
    return default


def all_values(data, group):
    return [value for code, value in data if code == group]


def collect_primitives(entities):
    lines = []
    circles = []
    texts = []
    counts = {}

    for kind, data in entities:
        counts[kind] = counts.get(kind, 0) + 1
        if kind == "LINE":
            x1 = as_float(first(data, "10"))
            y1 = as_float(first(data, "20"))
            x2 = as_float(first(data, "11"))
            y2 = as_float(first(data, "21"))
            lines.append(((x1, y1), (x2, y2)))
        elif kind == "LWPOLYLINE":
            xs = [as_float(v) for v in all_values(data, "10")]
            ys = [as_float(v) for v in all_values(data, "20")]
            pts = list(zip(xs, ys))
            for a, b in zip(pts, pts[1:]):
                lines.append((a, b))
            if first(data, "70", "0").strip() in {"1", "129"} and len(pts) > 2:
                lines.append((pts[-1], pts[0]))
        elif kind == "CIRCLE":
            x = as_float(first(data, "10"))
            y = as_float(first(data, "20"))
            r = abs(as_float(first(data, "40")))
            circles.append((x, y, r))
        elif kind == "ARC":
            x = as_float(first(data, "10"))
            y = as_float(first(data, "20"))
            r = abs(as_float(first(data, "40")))
            start = math.radians(as_float(first(data, "50")))
            end = math.radians(as_float(first(data, "51")))
            if end < start:
                end += math.tau
            steps = max(8, int(abs(end - start) * 12))
            pts = [(x + math.cos(start + (end - start) * n / steps) * r,
                    y + math.sin(start + (end - start) * n / steps) * r) for n in range(steps + 1)]
            for a, b in zip(pts, pts[1:]):
                lines.append((a, b))
        elif kind in {"TEXT", "MTEXT"}:
            text = first(data, "1").strip()
            if text:
                texts.append((as_float(first(data, "10")), as_float(first(data, "20")), text[:40]))

    return lines, circles, texts, counts


def render(lines, circles, texts, out_png):
    points = []
    for a, b in lines:
        points.extend([a, b])
    for x, y, r in circles:
        points.extend([(x - r, y - r), (x + r, y + r)])
    for x, y, _ in texts:
        points.append((x, y))
    if not points:
        raise SystemExit("No drawable entities found")

    min_x = min(p[0] for p in points)
    max_x = max(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)
    margin = 50
    width = 2400
    height = max(900, int(width * (max_y - min_y) / max(1, max_x - min_x)))
    scale = min((width - margin * 2) / max(1, max_x - min_x), (height - margin * 2) / max(1, max_y - min_y))

    def tx(p):
        x, y = p
        return (margin + (x - min_x) * scale, height - margin - (y - min_y) * scale)

    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)
    for a, b in lines:
        draw.line([tx(a), tx(b)], fill=(20, 28, 40), width=2)
    for x, y, r in circles:
        cx, cy = tx((x, y))
        rr = max(2, r * scale)
        draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=(180, 30, 30), width=2)
    font = ImageFont.load_default()
    for x, y, text in texts[:700]:
        px, py = tx((x, y))
        draw.text((px, py), text, fill=(0, 65, 140), font=font)
    img.save(out_png)
    return {
        "bounds": [min_x, min_y, max_x, max_y],
        "image": [width, height],
        "lines": len(lines),
        "circles": len(circles),
        "texts": len(texts),
    }


def main():
    src = sys.argv[1]
    out = sys.argv[2]
    entities = parse_dxf(src)
    lines, circles, texts, counts = collect_primitives(entities)
    info = render(lines, circles, texts, out)
    print("entities", counts)
    print("render", info)


if __name__ == "__main__":
    main()
