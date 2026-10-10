"""Build the source-faithful LTK clean CAD review candidates.

Revision 3 remains the source-supported primitive pool. This pass rejects
isolated scan fragments, consolidates collinear geometry and emits a small,
editable CAD set on the unchanged source canvas. The Monday CAD pilot is used
only as a visual-density reference; none of its geometry is copied.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "outputs" / "rmt-mimic-lab" / "LTK"
MONDAY = ROOT / "outputs" / "mimic-cad-pilot" / "ltk"

LAYERS = {
    "RMT-WALL": 7,
    "RMT-PARTITION": 8,
    "RMT-DOOR": 5,
    "RMT-STAIR": 3,
    "RMT-BEAM": 9,
    "RMT-TEXT": 2,
    "RMT-REFERENCE": 4,
}

CONFIG = {
    "main-panel": {
        "displayName": "Main Panel / Overall Building",
        "monday": "LTK_MAIN_PANEL_OVERALL.png",
        "axisMin": 62,
        "isolatedMin": 255,
        "supportMin": 34,
        "snap": 9,
        "mergeGap": 22,
        "stairs": [(680, 735, 965, 900), (1435, 565, 1640, 930)],
        "beams": [(1090, 185, 1510, 390)],
        "doors": [],
        "labels": [
            (785, 345, "VENDOR"), (785, 402, "LOCKER"),
            (785, 483, "CANTEEN"), (785, 608, "STOCK"),
            (780, 687, "PACKING AREA"),
        ],
    },
    "feed-mill": {
        "displayName": "Feed Mill",
        "monday": "LTK_FEED_MILL.png",
        "axisMin": 58,
        "isolatedMin": 260,
        "supportMin": 32,
        "snap": 9,
        "mergeGap": 18,
        "stairs": [],
        "beams": [],
        "doors": [
            (690, 252, 43, -90, 0), (953, 252, 43, -90, 0),
            (1070, 252, 43, -90, 0), (1235, 252, 43, -90, 0),
            (702, 667, 44, 0, 90), (1110, 667, 44, 0, 90),
            (1360, 667, 44, 0, 90),
        ],
        "labels": [
            (950, 350, "ZONE 1"), (1285, 350, "ZONE 2"),
            (520, 458, "ZONE 5"), (520, 590, "ZONE 6"),
            (950, 590, "ZONE 4"), (1285, 590, "ZONE 3"),
        ],
    },
    "egg-production": {
        "displayName": "Egg Production",
        "monday": "LTK_EGG_PRODUCTION.png",
        "axisMin": 50,
        "isolatedMin": 210,
        "supportMin": 30,
        "snap": 9,
        "mergeGap": 18,
        "stairs": [(145, 820, 410, 1055)],
        "beams": [(140, 560, 1225, 700)],
        "doors": [],
        "labels": [
            (310, 755, "BLOCK 1"), (500, 755, "BLOCK 2"),
            (685, 755, "BLOCK 3"), (875, 755, "BLOCK 4"),
            (1065, 755, "BLOCK 5"), (350, 1000, "BLOCK 6"),
            (540, 1000, "BLOCK 7"), (730, 1000, "BLOCK 8"),
            (920, 1000, "BLOCK 9"),
        ],
    },
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_revision3_lines(path: Path, height: int) -> list[dict]:
    rows = path.read_text(encoding="ascii", errors="ignore").splitlines()
    pairs = list(zip(rows[0::2], rows[1::2]))
    entities: list[dict] = []
    current: dict | None = None
    for code, value in pairs:
        if code == "0":
            if current and current.get("type") == "LINE":
                try:
                    entities.append({
                        "x1": float(current["10"]), "y1": height - float(current["20"]),
                        "x2": float(current["11"]), "y2": height - float(current["21"]),
                    })
                except KeyError:
                    pass
            current = {"type": value}
        elif current is not None:
            current[code] = value
    if current and current.get("type") == "LINE":
        try:
            entities.append({
                "x1": float(current["10"]), "y1": height - float(current["20"]),
                "x2": float(current["11"]), "y2": height - float(current["21"]),
            })
        except KeyError:
            pass
    return entities


def length(line: dict) -> float:
    return math.hypot(line["x2"] - line["x1"], line["y2"] - line["y1"])


def axis_kind(line: dict) -> str:
    dx, dy = abs(line["x2"] - line["x1"]), abs(line["y2"] - line["y1"])
    if dy <= 3:
        return "h"
    if dx <= 3:
        return "v"
    return "d"


def midpoint(line: dict) -> tuple[float, float]:
    return ((line["x1"] + line["x2"]) / 2, (line["y1"] + line["y2"]) / 2)


def in_regions(line: dict, regions: list[tuple[int, int, int, int]]) -> bool:
    x, y = midpoint(line)
    return any(x1 <= x <= x2 and y1 <= y <= y2 for x1, y1, x2, y2 in regions)


def cluster(values: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float, float]]:
    groups: list[list[tuple[float, float]]] = []
    for value, weight in sorted(values):
        if not groups or value - groups[-1][-1][0] > tolerance:
            groups.append([(value, weight)])
        else:
            groups[-1].append((value, weight))
    result = []
    for group in groups:
        total = sum(weight for _, weight in group)
        result.append((min(value for value, _ in group), max(value for value, _ in group), sum(value * weight for value, weight in group) / total))
    return result


def snap_axis(lines: list[dict], tolerance: float) -> list[dict]:
    h_values = [(line["y1"], max(length(line), 1)) for line in lines if axis_kind(line) == "h"]
    v_values = [(line["x1"], max(length(line), 1)) for line in lines if axis_kind(line) == "v"]
    h_groups, v_groups = cluster(h_values, tolerance), cluster(v_values, tolerance)

    def snapped(value: float, groups) -> float:
        for lower, upper, center in groups:
            if lower - tolerance <= value <= upper + tolerance:
                return round(center, 2)
        return value

    result = []
    for item in lines:
        line = dict(item)
        kind = axis_kind(line)
        if kind == "h":
            fixed = snapped((line["y1"] + line["y2"]) / 2, h_groups)
            line.update(y1=fixed, y2=fixed)
        elif kind == "v":
            fixed = snapped((line["x1"] + line["x2"]) / 2, v_groups)
            line.update(x1=fixed, x2=fixed)
        result.append(line)
    return result


def merge_axis(lines: list[dict], gap: float) -> list[dict]:
    merged: list[dict] = []
    for kind in ("h", "v"):
        groups: dict[float, list[tuple[float, float]]] = {}
        for line in lines:
            if axis_kind(line) != kind:
                continue
            fixed = round(line["y1"] if kind == "h" else line["x1"], 1)
            start, end = sorted((line["x1"], line["x2"]) if kind == "h" else (line["y1"], line["y2"]))
            groups.setdefault(fixed, []).append((start, end))
        for fixed, intervals in groups.items():
            current_start = current_end = None
            for start, end in sorted(intervals):
                if current_start is None:
                    current_start, current_end = start, end
                elif start <= current_end + gap:
                    current_end = max(current_end, end)
                else:
                    merged.append(make_axis(kind, fixed, current_start, current_end))
                    current_start, current_end = start, end
            if current_start is not None:
                merged.append(make_axis(kind, fixed, current_start, current_end))
    merged.extend(dict(line) for line in lines if axis_kind(line) == "d")
    return merged


def make_axis(kind: str, fixed: float, start: float, end: float) -> dict:
    return {"x1": start, "y1": fixed, "x2": end, "y2": fixed} if kind == "h" else {"x1": fixed, "y1": start, "x2": fixed, "y2": end}


def intersects(a: dict, b: dict, tolerance: float = 10) -> bool:
    ak, bk = axis_kind(a), axis_kind(b)
    if ak == "h" and bk == "v":
        return min(a["x1"], a["x2"]) - tolerance <= b["x1"] <= max(a["x1"], a["x2"]) + tolerance and min(b["y1"], b["y2"]) - tolerance <= a["y1"] <= max(b["y1"], b["y2"]) + tolerance
    if ak == "v" and bk == "h":
        return intersects(b, a, tolerance)
    return False


def simplify(lines: list[dict], config: dict) -> list[dict]:
    snapped = merge_axis(snap_axis(lines, config["snap"]), config["mergeGap"])
    axis = [line for line in snapped if axis_kind(line) in ("h", "v")]
    major = [line for line in axis if length(line) >= config["axisMin"]]
    kept: list[dict] = []
    for line in snapped:
        line_length = length(line)
        detail = in_regions(line, config["stairs"])
        if axis_kind(line) == "d":
            if line_length >= 90:
                kept.append(line)
            continue
        connected = sum(intersects(line, other) for other in major if other is not line)
        if detail and line_length >= 18:
            kept.append(line)
        elif line_length >= config["isolatedMin"]:
            kept.append(line)
        elif line_length >= config["axisMin"] and connected:
            kept.append(line)
        elif line_length >= config["supportMin"] and connected >= 2:
            kept.append(line)

    unique: dict[tuple, dict] = {}
    for line in kept:
        kind = axis_kind(line)
        key = (kind,) + tuple(round(line[name], 1) for name in ("x1", "y1", "x2", "y2"))
        unique[key] = line
    result = list(unique.values())
    for line in result:
        if in_regions(line, config["stairs"]):
            line["layer"] = "RMT-STAIR"
        elif in_regions(line, config["beams"]):
            line["layer"] = "RMT-BEAM"
        elif length(line) >= config["isolatedMin"]:
            line["layer"] = "RMT-WALL"
        else:
            line["layer"] = "RMT-PARTITION"
    return result


def arc_points(arc: tuple, count: int = 18) -> list[tuple[float, float]]:
    cx, cy, radius, start, end = arc
    return [(cx + radius * math.cos(math.radians(start + (end - start) * index / count)), cy + radius * math.sin(math.radians(start + (end - start) * index / count))) for index in range(count + 1)]


def render_png(width: int, height: int, lines: list[dict], arcs: list[tuple], labels: list[tuple], target: Path) -> Image.Image:
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=max(12, round(min(width, height) * 0.012)))
    for line in lines:
        stroke = "#172033"
        stroke_width = 4 if line["layer"] == "RMT-WALL" else 3
        draw.line((line["x1"], line["y1"], line["x2"], line["y2"]), fill=stroke, width=stroke_width)
    for arc in arcs:
        points = arc_points(arc)
        draw.line(points, fill="#172033", width=3)
        draw.line(((arc[0], arc[1]), points[0]), fill="#172033", width=3)
    for x, y, label in labels:
        draw.text((x, y), label, fill="#334155", font=font, anchor="mm")
    image.save(target, optimize=True)
    return image


def write_svg(width: int, height: int, lines: list[dict], arcs: list[tuple], labels: list[tuple], target: Path) -> None:
    items = [f'<rect width="{width}" height="{height}" fill="white"/>']
    for line in lines:
        stroke_width = 4 if line["layer"] == "RMT-WALL" else 3
        items.append(f'<line x1="{line["x1"]:.2f}" y1="{line["y1"]:.2f}" x2="{line["x2"]:.2f}" y2="{line["y2"]:.2f}" stroke="#172033" stroke-width="{stroke_width}"/>')
    for arc in arcs:
        points = " ".join(f"{x:.2f},{y:.2f}" for x, y in arc_points(arc))
        items.append(f'<polyline points="{points}" fill="none" stroke="#172033" stroke-width="3"/>')
        start = arc_points(arc)[0]
        items.append(f'<line x1="{arc[0]:.2f}" y1="{arc[1]:.2f}" x2="{start[0]:.2f}" y2="{start[1]:.2f}" stroke="#172033" stroke-width="3"/>')
    for x, y, label in labels:
        items.append(f'<text x="{x}" y="{y}" text-anchor="middle" font-family="Arial" font-size="16" fill="#334155">{label}</text>')
    target.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="Clean CAD reconstruction">{"".join(items)}</svg>\n', encoding="utf-8")


def dxf_header() -> list[str]:
    rows = ["0", "SECTION", "2", "HEADER", "0", "ENDSEC", "0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LAYER", "70", str(len(LAYERS))]
    for layer, color in LAYERS.items():
        rows.extend(["0", "LAYER", "2", layer, "70", "0", "62", str(color), "6", "CONTINUOUS"])
    rows.extend(["0", "ENDTAB", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"])
    return rows


def write_dxf(height: int, lines: list[dict], arcs: list[tuple], labels: list[tuple], target: Path) -> Counter:
    rows = dxf_header()
    counts: Counter = Counter()
    for line in lines:
        layer = line["layer"]
        counts[layer] += 1
        rows.extend(["0", "LINE", "8", layer, "10", f'{line["x1"]:.3f}', "20", f'{height-line["y1"]:.3f}', "30", "0", "11", f'{line["x2"]:.3f}', "21", f'{height-line["y2"]:.3f}', "31", "0"])
    for cx, cy, radius, start, end in arcs:
        counts["RMT-DOOR"] += 2
        dxf_start, dxf_end = (-end) % 360, (-start) % 360
        rows.extend(["0", "ARC", "8", "RMT-DOOR", "10", f"{cx:.3f}", "20", f"{height-cy:.3f}", "30", "0", "40", f"{radius:.3f}", "50", f"{dxf_start:.3f}", "51", f"{dxf_end:.3f}"])
        start_point = arc_points((cx, cy, radius, start, end))[0]
        rows.extend(["0", "LINE", "8", "RMT-DOOR", "10", f"{cx:.3f}", "20", f"{height-cy:.3f}", "30", "0", "11", f"{start_point[0]:.3f}", "21", f"{height-start_point[1]:.3f}", "31", "0"])
    for x, y, label in labels:
        counts["RMT-TEXT"] += 1
        rows.extend(["0", "TEXT", "8", "RMT-TEXT", "10", str(x), "20", str(height-y), "30", "0", "40", "16", "1", label, "7", "STANDARD"])
    rows.extend(["0", "ENDSEC", "0", "EOF"])
    target.write_text("\n".join(rows) + "\n", encoding="ascii")
    return counts


def labeled_panel(image: Image.Image, label: str, target_size: tuple[int, int]) -> Image.Image:
    panel = Image.new("RGB", target_size, "white")
    fitted = image.copy()
    fitted.thumbnail((target_size[0], target_size[1] - 42))
    panel.paste(fitted, ((target_size[0] - fitted.width) // 2, 42 + (target_size[1] - 42 - fitted.height) // 2))
    ImageDraw.Draw(panel).text((16, 14), label, fill="#172033")
    return panel


def comparison(source: Image.Image, monday: Image.Image, revision3: Image.Image, cad: Image.Image, target: Path) -> None:
    panel_size = (source.width, source.height + 42)
    combined = Image.new("RGB", (panel_size[0] * 4, panel_size[1]), "white")
    for index, (image, label) in enumerate(((source, "ORIGINAL SOURCE"), (monday, "MONDAY CLEAN REFERENCE - STYLE ONLY"), (revision3, "REVISION 3"), (cad, "NEW CAD REDRAW"))):
        combined.paste(labeled_panel(image, label, panel_size), (index * panel_size[0], 0))
    combined.save(target, optimize=True)


def source_overlay(source: Image.Image, cad: Image.Image, target: Path) -> None:
    source_rgb = source.convert("RGB")
    cad_gray = cad.convert("L")
    overlay = source_rgb.copy()
    mask = cad_gray.point(lambda value: 255 if value < 230 else 0)
    cyan = Image.new("RGB", source.size, "#0076bd")
    overlay.paste(cyan, mask=mask)
    overlay.save(target, optimize=True)


def pin_alignment(source: Image.Image, cad: Image.Image, target: Path) -> dict:
    anchors = [(0.15, 0.2), (0.5, 0.2), (0.85, 0.2), (0.15, 0.5), (0.5, 0.5), (0.85, 0.5), (0.15, 0.8), (0.5, 0.8), (0.85, 0.8)]
    combined = Image.new("RGB", (source.width * 2, source.height + 44), "white")
    combined.paste(source.convert("RGB"), (0, 44))
    combined.paste(cad.convert("RGB"), (source.width, 44))
    draw = ImageDraw.Draw(combined)
    draw.text((16, 14), "IDENTITY TRANSFORM CONTROL POINTS - NO AUTHORITATIVE LTK RUNTIME PIN RECORDS FOUND", fill="#172033")
    for index, (nx, ny) in enumerate(anchors, 1):
        x, y = nx * source.width, ny * source.height + 44
        for offset in (0, source.width):
            draw.ellipse((x + offset - 8, y - 8, x + offset + 8, y + 8), fill="#db2777", outline="white", width=2)
            draw.text((x + offset + 12, y - 7), str(index), fill="#db2777")
    combined.save(target, optimize=True)
    return {"authoritativePinCount": 0, "transformControlCount": len(anchors), "maxTransformDriftX": 0, "maxTransformDriftY": 0, "status": "IDENTITY_TRANSFORM_PASS_PIN_REGISTRY_PENDING"}


def build_floor(slug: str, config: dict) -> dict:
    folder = OUT / slug
    manifest = read_json(folder / "manifest.json")
    width, height = int(manifest["width"]), int(manifest["height"])
    source = Image.open(folder / "source-reference.png").convert("RGB")
    revision3 = Image.open(folder / "background-clean.png").convert("RGB")
    monday = Image.open(MONDAY / config["monday"]).convert("RGB")
    raw = parse_revision3_lines(folder / "background-clean.dxf", height)
    clean_lines = simplify(raw, config)
    clean = render_png(width, height, clean_lines, config["doors"], config["labels"], folder / "background-cad-redraw.png")
    write_svg(width, height, clean_lines, config["doors"], config["labels"], folder / "background-cad-redraw.svg")
    layer_counts = write_dxf(height, clean_lines, config["doors"], config["labels"], folder / "background-cad-redraw.dxf")
    source_overlay(source, clean, folder / "cad-source-overlay.png")
    comparison(source, monday, revision3, clean, folder / "cad-style-comparison.png")
    alignment = pin_alignment(source, clean, folder / "pin-alignment-overlay.png")
    bounds = {
        "minX": min(min(line["x1"], line["x2"]) for line in clean_lines),
        "minY": min(min(line["y1"], line["y2"]) for line in clean_lines),
        "maxX": max(max(line["x1"], line["x2"]) for line in clean_lines),
        "maxY": max(max(line["y1"], line["y2"]) for line in clean_lines),
    }
    transform = {"sourceWidth": width, "sourceHeight": height, "outputWidth": width, "outputHeight": height, "scaleX": 1, "scaleY": 1, "offsetX": 0, "offsetY": 0, "rotation": 0, "type": "IDENTITY"}
    qa = {
        "status": "REVIEW_REQUIRED", "sourceGeometryAuthority": True,
        "inputRevision3Entities": len(raw), "outputCadEntities": sum(layer_counts.values()),
        "entityCountsByLayer": dict(layer_counts), "bounds": bounds,
        "canvasAspectRatio": width / height, "transform": transform,
        "pinAlignment": alignment, "dxfEditableEntities": True,
        "runtimePinsIncluded": False, "sourceSha256": sha256(folder / "source-reference.png"),
    }
    write_json(folder / "transform.json", transform)
    write_json(folder / "qa.json", qa)
    write_json(folder / "manifest-cad-redraw.json", {
        "clientId": "LTK", "siteId": "LTK", "floorId": manifest["floorId"],
        "displayName": config["displayName"], "background": "background-cad-redraw.png",
        "backgroundSvg": "background-cad-redraw.svg", "backgroundDxf": "background-cad-redraw.dxf",
        "backgroundVersion": "clean-cad-reconstruction-v4-review", "width": width, "height": height,
        "coordinateTransform": transform, "containsRuntimePins": False,
        "sourceReference": "source-reference.png", "status": "REVIEW_REQUIRED",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    })
    return {"slug": slug, "displayName": config["displayName"], "rawEntities": len(raw), "cadEntities": sum(layer_counts.values()), "layerCounts": dict(layer_counts), "pinAlignment": alignment}


def main() -> None:
    missing = [str(MONDAY / config["monday"]) for config in CONFIG.values() if not (MONDAY / config["monday"]).exists()]
    if missing:
        raise FileNotFoundError(f"Monday clean style reference missing: {missing}")
    results = [build_floor(slug, config) for slug, config in CONFIG.items()]
    # Combined alignment review requested by Joey.
    alignment_images = [Image.open(OUT / slug / "pin-alignment-overlay.png").convert("RGB") for slug in CONFIG]
    max_width = max(image.width for image in alignment_images)
    total_height = sum(image.height for image in alignment_images)
    combined = Image.new("RGB", (max_width, total_height), "white")
    y = 0
    for image in alignment_images:
        combined.paste(image, (0, y)); y += image.height
    combined.save(OUT / "pin-alignment-comparison.png", optimize=True)
    write_json(OUT / "cad-redraw-summary.json", {
        "status": "READY_FOR_JOEY_REVIEW", "method": "clean-cad-reconstruction",
        "mondayReferenceLocated": True, "mondayReferencePath": str(MONDAY.relative_to(ROOT)).replace("\\", "/"),
        "geometryAuthority": "tools/rmt-mimic-lab/source/LTK/Mimic LTK.pdf",
        "productionIntegration": False, "floors": results,
    })
    review_data_path = OUT / "review" / "review-data.js"
    prefix = "window.RMT_MIMIC_LAB_DATA = "
    review_data = json.loads(review_data_path.read_text(encoding="utf-8").strip().removeprefix(prefix).removesuffix(";"))
    result_by_slug = {item["slug"]: item for item in results}
    for floor in review_data["floors"]:
        result = result_by_slug[floor["slug"]]
        base = f'../{floor["slug"]}'
        floor.update({
            "cadBackground": f"{base}/background-cad-redraw.png",
            "cadComparison": f"{base}/cad-style-comparison.png",
            "cadOverlay": f"{base}/cad-source-overlay.png",
            "pinAlignment": f"{base}/pin-alignment-overlay.png",
            "cadEntityCount": result["cadEntities"],
        })
    review_data_path.write_text(prefix + json.dumps(review_data) + ";\n", encoding="utf-8")
    print(json.dumps({"ok": True, "results": results}, indent=2))


if __name__ == "__main__":
    main()
