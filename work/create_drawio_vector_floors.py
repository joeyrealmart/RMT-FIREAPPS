from collections import defaultdict
import copy
from pathlib import Path
import csv
import html
import uuid
import xml.etree.ElementTree as ET

import pdfplumber


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
CSV_PATH = ROOT / "outputs" / "mtb-mimic-list-plotted-landscape" / "all-floors-mimic-list-points.csv"
PDF_DIR = ROOT / "outputs" / "mtb-cad-preview"
PNG_DIR = ROOT / "outputs" / "mtb-uploaded-floor-pdfs"
OUT_DIR = ROOT / "outputs" / "mtb-drawio-editable-vector"
SCALE = 2.5  # 180 dpi render scale, keeps marker coordinates aligned with previous PNG outputs.

FLOORS = [
    ("basement", "Basement", "basement.pdf", "basement-1.png"),
    ("L1", "Level 1", "L1.pdf", "L1-1.png"),
    ("L2", "Level 2", "L2.pdf", "L2-1.png"),
    ("L3", "Level 3", "L3.pdf", "L3-1.png"),
    ("L4-5", "Level 4-5 Typical", "L4-5.pdf", "L4-5-1.png"),
    ("L6", "Level 6", "L6.pdf", "L6-1.png"),
    ("L7", "Level 7", "L7.pdf", "L7-1.png"),
    ("L8", "Level 8", "L8.pdf", "L8-1.png"),
    ("L9", "Level 9", "L9.pdf", "L9-1.png"),
    ("L10-23", "Level 10-23 Typical", "L10-23.pdf", "L10-23-1.png"),
    ("L24", "Level 24", "L24.pdf", "L24-1.png"),
    ("ROOF", "Roof", "ROOF.pdf", "ROOF-1.png"),
]

COLOURS = {
    "green": {"stroke": "#21b059", "fill": "#21b059", "name": "Green mimic marker"},
    "blue": {"stroke": "#2979ff", "fill": "#2979ff", "name": "Blue mimic marker"},
    "red": {"stroke": "#d63031", "fill": "#d63031", "name": "Red mimic marker"},
    "magenta": {"stroke": "#b94db9", "fill": "#b94db9", "name": "Purple/Pink mimic marker"},
    "yellow": {"stroke": "#f2bf26", "fill": "#f2bf26", "name": "Yellow/Orange mimic marker"},
}


def cell_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def add_geometry(cell, attrs):
    ET.SubElement(cell, "mxGeometry", {**attrs, "as": "geometry"})


def add_vertex(root, id_, value, style, x, y, w, h, parent="1"):
    cell = ET.SubElement(root, "mxCell", {"id": id_, "value": value, "style": style, "vertex": "1", "parent": parent})
    add_geometry(cell, {"x": f"{x:.2f}", "y": f"{y:.2f}", "width": f"{w:.2f}", "height": f"{h:.2f}"})
    return cell


def add_edge(root, id_, x1, y1, x2, y2, style, parent="1"):
    cell = ET.SubElement(root, "mxCell", {"id": id_, "value": "", "style": style, "edge": "1", "parent": parent})
    geom = ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
    ET.SubElement(geom, "mxPoint", {"x": f"{x1:.2f}", "y": f"{y1:.2f}", "as": "sourcePoint"})
    ET.SubElement(geom, "mxPoint", {"x": f"{x2:.2f}", "y": f"{y2:.2f}", "as": "targetPoint"})
    return cell


def transform_point(x, y_top, page_w, page_h, rotate):
    x *= SCALE
    y_top *= SCALE
    if rotate:
        return page_h * SCALE - y_top, x
    return x, y_top


def add_pdf_linework(root, page, rotate=True):
    page_w, page_h = page.width, page.height
    line_style = "endArrow=none;html=1;rounded=0;strokeColor=#1f2933;strokeWidth=1;locked=1;movable=0;resizable=0;connectable=0;"
    red_style = "endArrow=none;html=1;rounded=0;strokeColor=#ff3333;strokeWidth=1;locked=1;movable=0;resizable=0;connectable=0;"
    faint_style = "endArrow=none;html=1;rounded=0;strokeColor=#999999;strokeWidth=1;locked=1;movable=0;resizable=0;connectable=0;"

    def style_for(obj):
        color = obj.get("stroking_color")
        if isinstance(color, tuple) and len(color) >= 3 and color[0] > 0.7 and color[1] < 0.35:
            return red_style
        if obj.get("linewidth", 1) < 0.1:
            return faint_style
        return line_style

    for line in page.lines:
        p1 = transform_point(line["x0"], line["top"], page_w, page_h, rotate)
        p2 = transform_point(line["x1"], line["bottom"], page_w, page_h, rotate)
        add_edge(root, cell_id("floor-line"), p1[0] + 40, p1[1] + 80, p2[0] + 40, p2[1] + 80, style_for(line))

    for rect in page.rects:
        x0, y0 = transform_point(rect["x0"], rect["top"], page_w, page_h, rotate)
        x1, y1 = transform_point(rect["x1"], rect["bottom"], page_w, page_h, rotate)
        x, y = min(x0, x1) + 40, min(y0, y1) + 80
        w, h = abs(x1 - x0), abs(y1 - y0)
        rect_style = "rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#1f2933;strokeWidth=1;locked=1;movable=0;resizable=0;connectable=0;"
        add_vertex(root, cell_id("floor-rect"), "", rect_style, x, y, max(w, 1), max(h, 1))

    for curve in page.curves:
        pts = curve.get("pts") or []
        if len(pts) < 2:
            continue
        transformed = [transform_point(x, y, page_w, page_h, rotate) for x, y in pts]
        for a, b in zip(transformed, transformed[1:]):
            add_edge(root, cell_id("floor-curve"), a[0] + 40, a[1] + 80, b[0] + 40, b[1] + 80, style_for(curve))


def add_pdf_text(root, page, rotate=True):
    page_w, page_h = page.width, page.height
    text_style = "text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=16;fontColor=#111111;locked=1;movable=0;resizable=0;connectable=0;"
    for word in page.extract_words() or []:
        text = word.get("text", "").strip()
        if not text:
            continue
        x, y = transform_point(word["x0"], word["top"], page_w, page_h, rotate)
        # Keep labels readable in landscape by rotating them only when the source PDF was portrait.
        style = text_style + ("rotation=90;" if rotate else "")
        add_vertex(root, cell_id("floor-text"), html.escape(text), style, x + 40, y + 80, max(16, (word["x1"] - word["x0"]) * SCALE), 18)


def build_diagram(floor_code, title, pdf_path, png_path, rows):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        rotate = page.height > page.width
        canvas_w = page.height * SCALE if rotate else page.width * SCALE
        canvas_h = page.width * SCALE if rotate else page.height * SCALE

        model = ET.Element(
            "mxGraphModel",
            {
                "dx": "1800",
                "dy": "1000",
                "grid": "1",
                "gridSize": "10",
                "guides": "1",
                "tooltips": "1",
                "connect": "1",
                "arrows": "1",
                "fold": "1",
                "page": "1",
                "pageScale": "1",
                "pageWidth": str(int(canvas_w + 80)),
                "pageHeight": str(int(canvas_h + 160)),
                "math": "0",
                "shadow": "0",
            },
        )
        root = ET.SubElement(model, "root")
        ET.SubElement(root, "mxCell", {"id": "0"})
        ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})

        add_vertex(
            root,
            "title",
            html.escape(f"{title} - Editable Vector Floor Plan"),
            "rounded=0;whiteSpace=wrap;html=1;strokeColor=#0a1e3c;fillColor=#ffffff;fontColor=#0a1e3c;fontSize=24;fontStyle=1;align=left;spacingLeft=12;",
            40,
            20,
            560,
            44,
        )
        add_pdf_linework(root, page, rotate=rotate)
        add_pdf_text(root, page, rotate=rotate)

    # Markers were extracted against the earlier 180 DPI landscape PNG coordinate system.
    from PIL import Image

    png = Image.open(png_path).convert("RGB")
    if png.height > png.width:
        png = png.rotate(90, expand=True)
    scale_x = canvas_w / png.width
    scale_y = canvas_h / png.height
    for row in rows:
        colour = row["mimic_colour"]
        info = COLOURS.get(colour, COLOURS["red"])
        x = float(row["plotted_x"]) * scale_x + 40
        y = float(row["plotted_y"]) * scale_y + 80
        tag = row["review_tag"]
        radius = 26
        add_vertex(
            root,
            cell_id("marker"),
            html.escape(tag.split("-")[-1]),
            f"ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor={info['fill']};strokeColor={info['stroke']};strokeWidth=3;fontColor=#ffffff;fontSize=9;fontStyle=1;",
            x - radius / 2,
            y - radius / 2,
            radius,
            radius,
        )
        add_vertex(
            root,
            cell_id("label"),
            html.escape(tag),
            f"rounded=0;whiteSpace=wrap;html=1;strokeColor={info['stroke']};fillColor=#ffffff;fontColor={info['stroke']};fontSize=10;align=left;spacingLeft=4;",
            x + 16,
            y - 10,
            116,
            20,
        )

    legend_y = canvas_h + 92
    add_vertex(
        root,
        "legend-box",
        "Vector floor plan: sharp when zooming. Device markers are editable.",
        "rounded=0;whiteSpace=wrap;html=1;strokeColor=#0a1e3c;fillColor=#ffffff;fontSize=12;align=left;",
        40,
        legend_y,
        560,
        34,
    )
    return model


def write_drawio(path, diagrams):
    mxfile = ET.Element(
        "mxfile",
        {"host": "app.diagrams.net", "modified": "2026-07-10T00:00:00.000Z", "agent": "Codex", "version": "24.7.17", "type": "device"},
    )
    for name, model in diagrams:
        diagram = ET.Element("diagram", {"id": uuid.uuid4().hex[:12], "name": name, "compressed": "false", "noEdit": "0"})
        diagram.append(copy.deepcopy(model))
        mxfile.append(diagram)
    ET.ElementTree(mxfile).write(path, encoding="utf-8", xml_declaration=True)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    by_floor = defaultdict(list)
    for row in rows:
        by_floor[row["floor_code"]].append(row)

    index = [
        "# MTB Editable Draw.io Vector Floor Files",
        "",
        "Use these if the PNG-background draw.io files look blurry. The floor plans are rebuilt from PDF vector lines/text, so they stay sharp when zooming.",
        "",
    ]
    diagrams = []
    summary = []
    for floor_code, title, pdf_name, png_name in FLOORS:
        pdf_path = PDF_DIR / pdf_name
        png_path = PNG_DIR / png_name
        floor_rows = by_floor.get(floor_code, [])
        model = build_diagram(floor_code, title, pdf_path, png_path, floor_rows)
        diagrams.append((title, model))
        out_path = OUT_DIR / f"{floor_code}-editable-vector.drawio"
        write_drawio(out_path, [(title, model)])
        index.append(f"- [{title}]({out_path.name}) - {len(floor_rows)} editable markers")
        summary.append({"floor_code": floor_code, "floor_name": title, "markers": len(floor_rows), "drawio_file": out_path.name})

    all_path = OUT_DIR / "MTB-all-floors-editable-vector.drawio"
    write_drawio(all_path, diagrams)
    index.append("")
    index.append(f"Combined multi-page vector draw.io file: [{all_path.name}]({all_path.name})")
    (OUT_DIR / "index.md").write_text("\n".join(index) + "\n", encoding="utf-8")
    with (OUT_DIR / "drawio-vector-summary.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["floor_code", "floor_name", "markers", "drawio_file"])
        writer.writeheader()
        writer.writerows(summary)
    print(OUT_DIR)
    print(all_path)


if __name__ == "__main__":
    main()
