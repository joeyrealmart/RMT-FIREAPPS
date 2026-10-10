"""Build deterministic, review-only LTK mimic backgrounds from the source PDF.

The source pages are the only geometry authority. The extractor removes coloured
markup, finds long source linework, and emits the same detected segments to PNG,
SVG, and DXF. It never writes production mimic, pin, or device data.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

PROJECT_PYTHON = Path(__file__).resolve().parents[2] / ".tools" / "python"
if PROJECT_PYTHON.exists():
    sys.path.insert(0, str(PROJECT_PYTHON))

import cv2

ROOT = Path(__file__).resolve().parents[2]
SOURCE_PDF = ROOT / "tools" / "rmt-mimic-lab" / "source" / "LTK" / "Mimic LTK.pdf"
OUT = ROOT / "outputs" / "rmt-mimic-lab" / "LTK"
TMP = ROOT / "tools" / "rmt-mimic-lab" / "tmp" / "ltk-pages"

PAGES = [
    {"page": 1, "role": "MAIN_PANEL_OVERALL_BUILDING", "floorId": "MAIN_PANEL", "slug": "main-panel", "displayName": "Main Panel / Overall Building", "drawingRegion": [500, 185, 1695, 1115], "exclusionRegions": [], "diagonalRegions": []},
    {"page": 2, "role": "FEED_MILL_DETAIL", "floorId": "FEED_MILL", "slug": "feed-mill", "displayName": "Feed Mill", "drawingRegion": [350, 145, 1500, 840], "exclusionRegions": [], "diagonalRegions": []},
    {"page": 3, "role": "EGG_PRODUCTION_DETAIL", "floorId": "EGG_PRODUCTION", "slug": "egg-production", "displayName": "Egg Production", "drawingRegion": [145, 115, 1310, 1350], "exclusionRegions": [[450, 50, 980, 410], [980, 50, 1323, 410]], "diagonalRegions": [[145, 1050, 1310, 1350]]},
    {"page": 4, "role": "DEVICE_SCHEDULE_REFERENCE", "floorId": None, "slug": None, "displayName": "Reference / Device Schedule"},
]

PROTECTED_PRODUCTION_FILES = [
    ROOT / "outputs" / "fire-inspection-mvp" / "app.js",
    ROOT / "outputs" / "fire-inspection-mvp" / "assets" / "mimics" / "index.json",
]

LEGACY_GENERATED_FILES = [
    "analysis/device-legend.json",
    "analysis/geometry-review.json",
    "analysis/pin-review.json",
    "main-panel/background.dxf",
    "main-panel/background.png",
    "main-panel/background.svg",
    "main-panel/pins.json",
    "feed-mill/background.dxf",
    "feed-mill/background.png",
    "feed-mill/background.svg",
    "feed-mill/pins.json",
    "egg-production/background.dxf",
    "egg-production/background.png",
    "egg-production/background.svg",
    "egg-production/pins.json",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str | None:
    if not path.exists():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def production_checksums() -> dict[str, str | None]:
    return {str(path.relative_to(ROOT)).replace("\\", "/"): sha256(path) for path in PROTECTED_PRODUCTION_FILES}


def remove_legacy_generated_files() -> None:
    for relative in LEGACY_GENERATED_FILES:
        target = OUT / relative
        if target.exists():
            target.unlink()


def render_source_pages() -> None:
    TMP.mkdir(parents=True, exist_ok=True)
    if not SOURCE_PDF.exists():
        raise FileNotFoundError(f"Missing authoritative source PDF: {SOURCE_PDF}")
    for old in TMP.glob("ltk-page-*.png"):
        old.unlink()
    subprocess.run(["pdftoppm", "-r", "160", "-png", str(SOURCE_PDF), str(TMP / "ltk-page")], check=True)


def fill_small_gaps(values: np.ndarray, max_gap: int = 5) -> np.ndarray:
    result = values.copy()
    indexes = np.flatnonzero(values)
    if indexes.size < 2:
        return result
    gaps = np.diff(indexes)
    for position in np.flatnonzero((gaps > 1) & (gaps <= max_gap + 1)):
        result[indexes[position] : indexes[position + 1] + 1] = True
    return result


def runs(values: np.ndarray, minimum: int) -> list[tuple[int, int]]:
    padded = np.pad(values.astype(np.int8), (1, 1))
    changes = np.diff(padded)
    starts = np.flatnonzero(changes == 1)
    ends = np.flatnonzero(changes == -1) - 1
    return [(int(start), int(end)) for start, end in zip(starts, ends) if end - start + 1 >= minimum]


def merge_axis_segments(raw: list[tuple[int, int, int]], axis: str) -> list[dict[str, float | str]]:
    groups: list[list[tuple[int, int, int]]] = []
    for fixed, start, end in sorted(raw):
        match = None
        for group in reversed(groups[-80:]):
            previous_fixed, previous_start, previous_end = group[-1]
            overlap = max(0, min(end, previous_end) - max(start, previous_start) + 1)
            shorter = max(1, min(end - start + 1, previous_end - previous_start + 1))
            if fixed - previous_fixed <= 4 and overlap / shorter >= 0.72:
                match = group
                break
        if match is None:
            groups.append([(fixed, start, end)])
        else:
            match.append((fixed, start, end))

    segments: list[dict[str, float | str]] = []
    for group in groups:
        fixed = float(np.median([item[0] for item in group]))
        start = float(np.median([item[1] for item in group]))
        end = float(np.median([item[2] for item in group]))
        thickness = max(1.0, float(max(item[0] for item in group) - min(item[0] for item in group) + 1))
        if axis == "horizontal":
            segments.append({"kind": axis, "x1": start, "y1": fixed, "x2": end, "y2": fixed, "width": min(5.0, thickness)})
        else:
            segments.append({"kind": axis, "x1": fixed, "y1": start, "x2": fixed, "y2": end, "width": min(5.0, thickness)})
    return segments


def axis_segments(binary: np.ndarray, minimum_length: int = 18) -> list[dict[str, float | str]]:
    height, width = binary.shape
    horizontal_raw: list[tuple[int, int, int]] = []
    vertical_raw: list[tuple[int, int, int]] = []
    horizontal_min = max(minimum_length, round(width * 0.010))
    vertical_min = max(minimum_length, round(height * 0.010))
    for y in range(height):
        for start, end in runs(fill_small_gaps(binary[y, :]), horizontal_min):
            horizontal_raw.append((y, start, end))
    for x in range(width):
        for start, end in runs(fill_small_gaps(binary[:, x]), vertical_min):
            vertical_raw.append((x, start, end))
    return merge_axis_segments(horizontal_raw, "horizontal") + merge_axis_segments(vertical_raw, "vertical")


def segment_length(segment: dict[str, float | str]) -> float:
    return float(np.hypot(float(segment["x2"]) - float(segment["x1"]), float(segment["y2"]) - float(segment["y1"])))


def segments_intersect(a: dict[str, float | str], b: dict[str, float | str], tolerance: float = 7.0) -> bool:
    if a["kind"] == b["kind"]:
        return False
    horizontal = a if a["kind"] == "horizontal" else b
    vertical = b if a["kind"] == "horizontal" else a
    return (
        float(horizontal["x1"]) - tolerance <= float(vertical["x1"]) <= float(horizontal["x2"]) + tolerance
        and float(vertical["y1"]) - tolerance <= float(horizontal["y1"]) <= float(vertical["y2"]) + tolerance
    )


def parallel_cluster_size(segment: dict[str, float | str], segments: list[dict[str, float | str]]) -> int:
    fixed = float(segment["y1"] if segment["kind"] == "horizontal" else segment["x1"])
    start = float(segment["x1"] if segment["kind"] == "horizontal" else segment["y1"])
    end = float(segment["x2"] if segment["kind"] == "horizontal" else segment["y2"])
    matches = 0
    for other in segments:
        if other is segment or other["kind"] != segment["kind"]:
            continue
        other_fixed = float(other["y1"] if other["kind"] == "horizontal" else other["x1"])
        if abs(other_fixed - fixed) > 42:
            continue
        other_start = float(other["x1"] if other["kind"] == "horizontal" else other["y1"])
        other_end = float(other["x2"] if other["kind"] == "horizontal" else other["y2"])
        overlap = max(0.0, min(end, other_end) - max(start, other_start))
        shorter = max(1.0, min(end - start, other_end - other_start))
        if overlap / shorter >= 0.45:
            matches += 1
    return matches


def filter_supported_segments(segments: list[dict[str, float | str]], region_width: int, region_height: int) -> tuple[list[dict[str, float | str]], int]:
    long_horizontal = max(58.0, region_width * 0.045)
    long_vertical = max(58.0, region_height * 0.045)
    connected_horizontal = max(30.0, region_width * 0.022)
    connected_vertical = max(30.0, region_height * 0.022)
    kept: list[dict[str, float | str]] = []
    removed = 0
    for segment in segments:
        length = segment_length(segment)
        long_limit = long_horizontal if segment["kind"] == "horizontal" else long_vertical
        intersects = any(segments_intersect(segment, other, tolerance=5.0) for other in segments)
        cluster_size = parallel_cluster_size(segment, segments)
        connected_limit = connected_horizontal if segment["kind"] == "horizontal" else connected_vertical
        # Long source lines are retained. Medium source lines require a real
        # orthogonal connection. Short lines require a parallel structural
        # cluster, which preserves stair treads without retaining isolated
        # letters, symbols or old device crosses.
        if length >= long_limit or (length >= connected_limit and intersects) or cluster_size >= 2:
            kept.append(segment)
        else:
            removed += 1
    return kept, removed


def component_axis_segments(mask: np.ndarray, axis: str, offset_x: int, offset_y: int) -> list[dict[str, float | str]]:
    count, _, stats, _ = cv2.connectedComponentsWithStats((mask > 0).astype(np.uint8), connectivity=8)
    segments: list[dict[str, float | str]] = []
    for index in range(1, count):
        x, y, width, height, area = [int(value) for value in stats[index]]
        if area < 10:
            continue
        if axis == "horizontal":
            if width < 18 or width < height * 1.8:
                continue
            fixed = offset_y + y + (height - 1) / 2
            segments.append({"kind": axis, "x1": float(offset_x + x), "y1": fixed, "x2": float(offset_x + x + width - 1), "y2": fixed, "width": 3.0})
        else:
            if height < 18 or height < width * 1.8:
                continue
            fixed = offset_x + x + (width - 1) / 2
            segments.append({"kind": axis, "x1": fixed, "y1": float(offset_y + y), "x2": fixed, "y2": float(offset_y + y + height - 1), "width": 3.0})
    return segments


def merge_collinear_segments(segments: list[dict[str, float | str]], fixed_tolerance: float = 6.0, gap_tolerance: float = 14.0) -> list[dict[str, float | str]]:
    merged: list[dict[str, float | str]] = []
    for kind in ("horizontal", "vertical"):
        candidates = [dict(segment) for segment in segments if segment["kind"] == kind]
        candidates.sort(key=lambda segment: (float(segment["y1"] if kind == "horizontal" else segment["x1"]), float(segment["x1"] if kind == "horizontal" else segment["y1"])))
        for segment in candidates:
            fixed = float(segment["y1"] if kind == "horizontal" else segment["x1"])
            start = float(segment["x1"] if kind == "horizontal" else segment["y1"])
            end = float(segment["x2"] if kind == "horizontal" else segment["y2"])
            match = None
            for existing in reversed(merged[-80:]):
                if existing["kind"] != kind:
                    continue
                existing_fixed = float(existing["y1"] if kind == "horizontal" else existing["x1"])
                existing_start = float(existing["x1"] if kind == "horizontal" else existing["y1"])
                existing_end = float(existing["x2"] if kind == "horizontal" else existing["y2"])
                if abs(existing_fixed - fixed) <= fixed_tolerance and start <= existing_end + gap_tolerance and end >= existing_start - gap_tolerance:
                    match = existing
                    break
            if match is None:
                merged.append(segment)
                continue
            combined_fixed = (float(match["y1"] if kind == "horizontal" else match["x1"]) + fixed) / 2
            combined_start = min(float(match["x1"] if kind == "horizontal" else match["y1"]), start)
            combined_end = max(float(match["x2"] if kind == "horizontal" else match["y2"]), end)
            if kind == "horizontal":
                match.update({"x1": combined_start, "y1": combined_fixed, "x2": combined_end, "y2": combined_fixed})
            else:
                match.update({"x1": combined_fixed, "y1": combined_start, "x2": combined_fixed, "y2": combined_end})
    return merged


def snap_small_intersection_gaps(segments: list[dict[str, float | str]], tolerance: float = 8.0) -> list[dict[str, float | str]]:
    result = [dict(segment) for segment in segments]
    horizontals = [segment for segment in result if segment["kind"] == "horizontal"]
    verticals = [segment for segment in result if segment["kind"] == "vertical"]
    for horizontal in horizontals:
        for vertical in verticals:
            x = float(vertical["x1"])
            y = float(horizontal["y1"])
            hx1, hx2 = sorted((float(horizontal["x1"]), float(horizontal["x2"])))
            vy1, vy2 = sorted((float(vertical["y1"]), float(vertical["y2"])))
            if hx1 - tolerance <= x <= hx2 + tolerance and vy1 - tolerance <= y <= vy2 + tolerance:
                horizontal["x1"], horizontal["x2"] = min(hx1, x), max(hx2, x)
                vertical["y1"], vertical["y2"] = min(vy1, y), max(vy2, y)
    return result


def remove_compact_device_symbols(segments: list[dict[str, float | str]]) -> tuple[list[dict[str, float | str]], int]:
    centers: list[tuple[float, float]] = []
    horizontals = [segment for segment in segments if segment["kind"] == "horizontal" and segment_length(segment) <= 50]
    verticals = [segment for segment in segments if segment["kind"] == "vertical" and segment_length(segment) <= 50]
    for horizontal in horizontals:
        for vertical in verticals:
            if not segments_intersect(horizontal, vertical, tolerance=2.0):
                continue
            center_x = float(vertical["x1"])
            center_y = float(horizontal["y1"])
            horizontal_mid = (float(horizontal["x1"]) + float(horizontal["x2"])) / 2
            vertical_mid = (float(vertical["y1"]) + float(vertical["y2"])) / 2
            if abs(center_x - horizontal_mid) <= 8 and abs(center_y - vertical_mid) <= 8:
                centers.append((center_x, center_y))
    # Old printed device symbols occur as repeated compact crosses along the
    # same source row. Requiring a repeated row avoids classifying an isolated
    # stair or genuine wall intersection as a device mark.
    centers = [center for center in centers if sum(abs(center[1] - other[1]) <= 60 for other in centers) >= 3]
    if not centers:
        return segments, 0
    retained: list[dict[str, float | str]] = []
    removed = 0
    for segment in segments:
        midpoint_x = (float(segment["x1"]) + float(segment["x2"])) / 2
        midpoint_y = (float(segment["y1"]) + float(segment["y2"])) / 2
        compact = segment_length(segment) <= 60
        if compact and any(abs(midpoint_x - cx) <= 30 and abs(midpoint_y - cy) <= 30 for cx, cy in centers):
            removed += 1
        else:
            retained.append(segment)
    return retained, removed


def long_diagonal_segments(binary: np.ndarray, structural: np.ndarray, offset_x: int, offset_y: int, allowed_regions: list[list[int]]) -> list[dict[str, float | str]]:
    if not allowed_regions:
        return []
    residual = cv2.bitwise_and(binary, cv2.bitwise_not(cv2.dilate(structural, np.ones((5, 5), dtype=np.uint8))))
    lines = cv2.HoughLinesP(residual, 1, np.pi / 180, threshold=65, minLineLength=max(70, round(min(binary.shape) * 0.08)), maxLineGap=8)
    if lines is None:
        return []
    result: list[dict[str, float | str]] = []
    for line in lines[:, 0, :]:
        x1, y1, x2, y2 = [int(value) for value in line]
        dx, dy = x2 - x1, y2 - y1
        angle = abs(np.degrees(np.arctan2(dy, dx))) % 180
        if min(angle, abs(180 - angle), abs(90 - angle)) < 12:
            continue
        global_x1, global_y1, global_x2, global_y2 = offset_x + x1, offset_y + y1, offset_x + x2, offset_y + y2
        midpoint_x, midpoint_y = (global_x1 + global_x2) / 2, (global_y1 + global_y2) / 2
        if not any(rx1 <= midpoint_x <= rx2 and ry1 <= midpoint_y <= ry2 for rx1, ry1, rx2, ry2 in allowed_regions):
            continue
        result.append({"kind": "diagonal", "x1": float(global_x1), "y1": float(global_y1), "x2": float(global_x2), "y2": float(global_y2), "width": 3.0})
    return result[:24]


def extract_segments(source: Image.Image, drawing_region: list[int], exclusion_regions: list[list[int]], diagonal_regions: list[list[int]]) -> tuple[list[dict[str, float | str]], dict[str, int], Image.Image]:
    rgb_u8 = np.asarray(source.convert("RGB"), dtype=np.uint8)
    rgb = rgb_u8.astype(np.int16)
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    coloured_markup = ((maximum - minimum) > 38) & (maximum > 105)
    gray = cv2.cvtColor(rgb_u8, cv2.COLOR_RGB2GRAY)
    clean_gray = gray.copy()
    clean_gray[coloured_markup] = 255
    for ex1, ey1, ex2, ey2 in exclusion_regions:
        clean_gray[ey1:ey2, ex1:ex2] = 255
    x1, y1, x2, y2 = drawing_region
    region = clean_gray[y1:y2, x1:x2]
    _, binary = cv2.threshold(region, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Morphology keeps source-supported wall/partition/stair strokes while
    # suppressing handwriting, labels, arrows and scan speckle.
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(16, round(region.shape[1] * 0.012)), 1))
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(16, round(region.shape[0] * 0.012))))
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horizontal_kernel)
    vertical = cv2.morphologyEx(binary, cv2.MORPH_OPEN, vertical_kernel)
    structural = cv2.bitwise_or(horizontal, vertical)
    structural = cv2.morphologyEx(structural, cv2.MORPH_CLOSE, np.ones((3, 3), dtype=np.uint8))

    raw_segments = component_axis_segments(horizontal, "horizontal", x1, y1) + component_axis_segments(vertical, "vertical", x1, y1)
    raw_segments = merge_collinear_segments(raw_segments)
    segments, removed_unsupported = filter_supported_segments(raw_segments, region.shape[1], region.shape[0])
    segments, removed_device_symbols = remove_compact_device_symbols(segments)
    segments = snap_small_intersection_gaps(merge_collinear_segments(segments))
    diagonals = long_diagonal_segments(binary, structural, x1, y1, diagonal_regions)
    segments.extend(diagonals)

    mask_canvas = np.zeros_like(gray)
    mask_canvas[y1:y2, x1:x2] = structural
    mask_preview = Image.fromarray(255 - mask_canvas).convert("RGB")
    return segments, {
        "sourceDarkPixels": int((binary > 0).sum()),
        "removedColouredPixels": int(coloured_markup.sum()),
        "excludedAnnotationRegions": len(exclusion_regions),
        "removedUnsupportedSegments": removed_unsupported,
        "removedDeviceSymbolSegments": removed_device_symbols,
        "morphologyKernelHorizontal": int(horizontal_kernel.shape[1]),
        "morphologyKernelVertical": int(vertical_kernel.shape[0]),
        "horizontalSegments": sum(segment["kind"] == "horizontal" for segment in segments),
        "verticalSegments": sum(segment["kind"] == "vertical" for segment in segments),
        "diagonalSegments": len(diagonals),
    }, mask_preview


def render_clean_png(width: int, height: int, segments: list[dict[str, float | str]], target: Path) -> Image.Image:
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    for segment in segments:
        draw.line((segment["x1"], segment["y1"], segment["x2"], segment["y2"]), fill="#172033", width=max(1, round(float(segment["width"]))))
    image.save(target, optimize=True)
    return image


def write_svg(width: int, height: int, segments: list[dict[str, float | str]], target: Path) -> None:
    lines = [f'<line x1="{segment["x1"]:.2f}" y1="{segment["y1"]:.2f}" x2="{segment["x2"]:.2f}" y2="{segment["y2"]:.2f}" stroke="#172033" stroke-width="{float(segment["width"]):.2f}" />' for segment in segments]
    target.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="Source-extracted LTK navigation linework"><rect width="{width}" height="{height}" fill="white" />' + "".join(lines) + "</svg>\n", encoding="utf-8")


def write_dxf(height: int, segments: list[dict[str, float | str]], target: Path) -> None:
    rows = ["0", "SECTION", "2", "HEADER", "0", "ENDSEC", "0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LAYER", "70", "1", "0", "LAYER", "2", "SOURCE_GEOMETRY", "70", "0", "62", "7", "6", "CONTINUOUS", "0", "ENDTAB", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"]
    for segment in segments:
        rows.extend(["0", "LINE", "8", "SOURCE_GEOMETRY", "10", f'{float(segment["x1"]):.4f}', "20", f'{height - float(segment["y1"]):.4f}', "30", "0", "11", f'{float(segment["x2"]):.4f}', "21", f'{height - float(segment["y2"]):.4f}', "31", "0"])
    rows.extend(["0", "ENDSEC", "0", "EOF"])
    target.write_text("\n".join(rows) + "\n", encoding="ascii")


def comparison(source: Image.Image, clean: Image.Image, target: Path) -> None:
    combined = Image.new("RGB", (source.width * 2, source.height), "#e2e8f0")
    combined.paste(source.convert("RGB"), (0, 0))
    combined.paste(clean, (source.width, 0))
    combined.save(target, optimize=True)


def revision_comparison(source: Image.Image, revision_2: Image.Image, revision_3: Image.Image, target: Path) -> None:
    header = 44
    combined = Image.new("RGB", (source.width * 3, source.height + header), "white")
    draw = ImageDraw.Draw(combined)
    for index, label in enumerate(("ORIGINAL SOURCE", "REVISION 2 - RAW EXTRACTION", "REVISION 3 - CLEAN REDRAW")):
        draw.text((index * source.width + 18, 14), label, fill="#172033")
    combined.paste(source.convert("RGB"), (0, header))
    combined.paste(revision_2.convert("RGB"), (source.width, header))
    combined.paste(revision_3.convert("RGB"), (source.width * 2, header))
    combined.save(target, optimize=True)


def preserve_revision_2(floor_dir: Path) -> tuple[Image.Image | None, int | None]:
    manifest_path = floor_dir / "manifest.json"
    revision_2_png = floor_dir / "background-revision-2.png"
    if manifest_path.exists():
        previous = json.loads(manifest_path.read_text(encoding="utf-8"))
        if previous.get("backgroundVersion") == "deterministic-extraction-v2" and not revision_2_png.exists():
            for suffix in ("png", "svg", "dxf"):
                shutil.copy2(floor_dir / f"background-clean.{suffix}", floor_dir / f"background-revision-2.{suffix}")
            shutil.copy2(manifest_path, floor_dir / "manifest-revision-2.json")
    if revision_2_png.exists():
        revision_2_manifest = floor_dir / "manifest-revision-2.json"
        previous_count = None
        if revision_2_manifest.exists():
            previous_count = json.loads(revision_2_manifest.read_text(encoding="utf-8")).get("geometry", {}).get("segmentCount")
        return Image.open(revision_2_png).convert("RGB"), previous_count
    return None, None


def overlay(source: Image.Image, clean: Image.Image, target: Path) -> None:
    clean_array = np.asarray(clean)
    geometry = np.any(clean_array < 245, axis=2)
    overlay_array = np.asarray(source.convert("RGB")).copy()
    overlay_array[geometry] = np.array([0, 118, 189], dtype=np.uint8)
    Image.fromarray(overlay_array).save(target, optimize=True)


def copy_review_ui() -> None:
    review = OUT / "review"
    review.mkdir(parents=True, exist_ok=True)
    template = ROOT / "tools" / "rmt-mimic-lab" / "review"
    for name in ("index.html", "review.js", "review.css"):
        shutil.copy2(template / name, review / name)


def main() -> None:
    before = production_checksums()
    remove_legacy_generated_files()
    render_source_pages()
    now = utc_now()
    analysis_dir = OUT / "analysis"
    analysis_dir.mkdir(parents=True, exist_ok=True)
    floor_payload = []
    floor_results = []

    for page in PAGES[:3]:
        floor_dir = OUT / page["slug"]
        floor_dir.mkdir(parents=True, exist_ok=True)
        revision_2, revision_2_segment_count = preserve_revision_2(floor_dir)
        source = Image.open(TMP / f'ltk-page-{page["page"]}.png').convert("RGB")
        source.save(floor_dir / "source-reference.png", optimize=True)
        segments, metrics, structure_mask = extract_segments(source, page["drawingRegion"], page["exclusionRegions"], page["diagonalRegions"])
        structure_mask.save(floor_dir / "structure-mask.png", optimize=True)
        clean = render_clean_png(source.width, source.height, segments, floor_dir / "background-clean.png")
        write_svg(source.width, source.height, segments, floor_dir / "background-clean.svg")
        write_dxf(source.height, segments, floor_dir / "background-clean.dxf")
        comparison(source, clean, floor_dir / "before-after.png")
        if revision_2 is not None:
            revision_comparison(source, revision_2, clean, floor_dir / "revision-comparison.png")
        overlay(source, clean, floor_dir / "overlay-review.png")
        manifest = {
            "clientId": "LTK", "siteId": "LTK", "floorId": page["floorId"], "displayName": page["displayName"],
            "sourcePage": page["page"], "sourceRole": page["role"], "background": "background-clean.png",
            "backgroundSvg": "background-clean.svg", "backgroundDxf": "background-clean.dxf",
            "backgroundVersion": "deterministic-reconstruction-v3", "width": source.width, "height": source.height,
            "coordinateTransform": {"type": "IDENTITY", "crop": None, "rotation": 0, "scaleX": 1, "scaleY": 1},
            "sourceDrawingRegion": page["drawingRegion"], "excludedAnnotationRegions": page["exclusionRegions"],
            "sourceReference": "source-reference.png", "createdAt": now, "updatedAt": now,
            "containsRuntimePins": False, "geometry": {"segmentCount": len(segments), "revision2SegmentCount": revision_2_segment_count, **metrics},
        }
        review_status = {
            "status": "REVIEW_REQUIRED", "sourceGeometryAuthority": True,
            "automatedChecks": {"sourceCanvasPreserved": True, "runtimePinsExcluded": True, "colouredAnnotationsRemoved": True, "vectorRasterSameSegments": True, "revision2Archived": revision_2 is not None},
            "humanReview": ["Confirm all major building sections remain represented.", "Confirm every retained diagonal is source geometry rather than annotation.", "Confirm doors and curves against the source; uncertain arcs are not reconstructed.", "Confirm clustered short lines retained as stairs are genuine source geometry.", "Confirm no annotation line was mistaken for building geometry."],
        }
        write_json(floor_dir / "manifest.json", manifest)
        write_json(floor_dir / "review-status.json", review_status)
        floor_results.append({"slug": page["slug"], "manifest": manifest, "review": review_status})
        floor_payload.append({"slug": page["slug"], "displayName": page["displayName"], "source": f'../{page["slug"]}/source-reference.png', "revision2": f'../{page["slug"]}/background-revision-2.png', "background": f'../{page["slug"]}/background-clean.svg', "beforeAfter": f'../{page["slug"]}/before-after.png', "revisionComparison": f'../{page["slug"]}/revision-comparison.png', "overlayReview": f'../{page["slug"]}/overlay-review.png', "status": review_status["status"], "segmentCount": len(segments), "revision2SegmentCount": revision_2_segment_count, "version": "Revision 3"})

    source_pages = OUT / "source-pages"
    source_pages.mkdir(parents=True, exist_ok=True)
    for page in PAGES:
        shutil.copy2(TMP / f'ltk-page-{page["page"]}.png', source_pages / f'page-{page["page"]}.png')
    copy_review_ui()
    (OUT / "review" / "review-data.js").write_text("window.RMT_MIMIC_LAB_DATA = " + json.dumps({"client": "LTK", "floors": floor_payload}) + ";\n", encoding="utf-8")
    write_json(analysis_dir / "mimic-analysis.json", {"client": "LTK", "source": {"file": str(SOURCE_PDF.relative_to(ROOT)).replace("\\", "/"), "pageCount": 4, "sha256": sha256(SOURCE_PDF)}, "pages": PAGES, "floors": floor_results, "generatedAt": now})
    write_json(analysis_dir / "transformation-metadata.json", {"method": "deterministic-opencv-structural-reconstruction-v3", "styleReference": "outputs/mimic-cad-pilot/ltk (appearance only; geometry rejected)", "operations": ["render PDF at 160 DPI", "remove saturated coloured markup and known title/legend regions", "OpenCV Otsu threshold inside the source drawing region", "classify connected horizontal and vertical source components", "merge collinear source-supported components and bridge only small intersection gaps", "retain source-derived diagonals only inside confirmed navigation regions for human review", "retain clustered short stair lines", "suppress compact legacy device symbols, isolated text strokes and unsupported fragments", "emit one shared segment set to PNG/SVG/DXF", "create Original vs Revision 2 vs Revision 3 comparison"], "prohibited": ["invent geometry", "copy CAD-pilot geometry", "infer labels", "write runtime pins", "change device master"], "coordinateTransform": {"type": "IDENTITY", "crop": None, "rotation": 0, "scaleX": 1, "scaleY": 1}, "approvalRequiredBeforeIntegration": True, "generatedAt": now})
    after = production_checksums()
    write_json(analysis_dir / "production-checksums.json", {"before": before, "after": after, "unchanged": before == after})
    if before != after:
        raise RuntimeError("Production pin/device-bearing files changed during isolated Mimic Lab build")
    (OUT / "README.md").write_text("# LTK deterministic Revision 3 review package\n\nPages 1-3 are source-derived clean redraw candidates for human review. Each floor includes Original vs Revision 2 vs Revision 3 comparison. Page 4 remains reference-only. No runtime pins, device IDs, labels, or production data are generated or changed.\n", encoding="utf-8")
    print(json.dumps({"ok": True, "floors": [item["slug"] for item in floor_results], "productionChecksumsUnchanged": True}, indent=2))


if __name__ == "__main__":
    main()
