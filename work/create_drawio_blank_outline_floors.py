from pathlib import Path
import copy
import csv
import uuid
import xml.etree.ElementTree as ET

import pdfplumber


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
PDF_DIR = ROOT / "outputs" / "mtb-cad-preview"
OUT_DIR = ROOT / "outputs" / "mtb-drawio-blank-outline"
SCALE = 2.5

FLOORS = [
    ("basement", "Basement", "basement.pdf"),
    ("L1", "Level 1", "L1.pdf"),
    ("L2", "Level 2", "L2.pdf"),
    ("L3", "Level 3", "L3.pdf"),
    ("L4-5", "Level 4-5 Typical", "L4-5.pdf"),
    ("L6", "Level 6", "L6.pdf"),
    ("L7", "Level 7", "L7.pdf"),
    ("L8", "Level 8", "L8.pdf"),
    ("L9", "Level 9", "L9.pdf"),
    ("L10-23", "Level 10-23 Typical", "L10-23.pdf"),
    ("L24", "Level 24", "L24.pdf"),
    ("ROOF", "Roof", "ROOF.pdf"),
]


def cell_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def is_black_line(obj):
    colour = obj.get("stroking_color")
    if colour is None:
        return True
    if isinstance(colour, tuple) and len(colour) >= 3:
        r, g, b = colour[:3]
        return r < 0.25 and g < 0.25 and b < 0.25
    return True


def transform_point(x, y_top, page_w, page_h, rotate):
    x *= SCALE
    y_top *= SCALE
    if rotate:
        return page_h * SCALE - y_top, x
    return x, y_top


def add_edge(root, x1, y1, x2, y2, style):
    cell = ET.SubElement(root, "mxCell", {"id": cell_id("outline"), "value": "", "style": style, "edge": "1", "parent": "1"})
    geom = ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
    ET.SubElement(geom, "mxPoint", {"x": f"{x1:.2f}", "y": f"{y1:.2f}", "as": "sourcePoint"})
    ET.SubElement(geom, "mxPoint", {"x": f"{x2:.2f}", "y": f"{y2:.2f}", "as": "targetPoint"})


def add_rect(root, x, y, w, h, style):
    cell = ET.SubElement(root, "mxCell", {"id": cell_id("outline-rect"), "value": "", "style": style, "vertex": "1", "parent": "1"})
    ET.SubElement(
        cell,
        "mxGeometry",
        {"x": f"{x:.2f}", "y": f"{y:.2f}", "width": f"{w:.2f}", "height": f"{h:.2f}", "as": "geometry"},
    )


def add_label(root, text, x, y, w, h):
    cell = ET.SubElement(
        root,
        "mxCell",
        {
            "id": cell_id("label"),
            "value": text,
            "style": "rounded=0;whiteSpace=wrap;html=1;strokeColor=#0a1e3c;fillColor=#ffffff;fontColor=#0a1e3c;fontSize=24;fontStyle=1;align=left;spacingLeft=12;",
            "vertex": "1",
            "parent": "1",
        },
    )
    ET.SubElement(cell, "mxGeometry", {"x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry"})


def add_floor_linework(root, page):
    page_w, page_h = page.width, page.height
    rotate = page.height > page.width
    style = "endArrow=none;html=1;rounded=0;strokeColor=#111111;strokeWidth=1;locked=1;movable=0;resizable=0;connectable=0;"

    for line in page.lines:
        if not is_black_line(line):
            continue
        # Keep architectural linework; ignore tiny dust strokes.
        if max(abs(line["x1"] - line["x0"]), abs(line["bottom"] - line["top"])) < 2:
            continue
        p1 = transform_point(line["x0"], line["top"], page_w, page_h, rotate)
        p2 = transform_point(line["x1"], line["bottom"], page_w, page_h, rotate)
        add_edge(root, p1[0] + 40, p1[1] + 80, p2[0] + 40, p2[1] + 80, style)

    for rect in page.rects:
        if not is_black_line(rect):
            continue
        x0, y0 = transform_point(rect["x0"], rect["top"], page_w, page_h, rotate)
        x1, y1 = transform_point(rect["x1"], rect["bottom"], page_w, page_h, rotate)
        add_rect(root, min(x0, x1) + 40, min(y0, y1) + 80, max(abs(x1 - x0), 1), max(abs(y1 - y0), 1), "rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#111111;strokeWidth=1;locked=1;movable=0;resizable=0;connectable=0;")

    for curve in page.curves:
        if not is_black_line(curve):
            continue
        pts = curve.get("pts") or []
        if len(pts) < 2:
            continue
        transformed = [transform_point(x, y, page_w, page_h, rotate) for x, y in pts]
        for a, b in zip(transformed, transformed[1:]):
            if max(abs(a[0] - b[0]), abs(a[1] - b[1])) < 2:
                continue
            add_edge(root, a[0] + 40, a[1] + 80, b[0] + 40, b[1] + 80, style)

    return (page_h * SCALE, page_w * SCALE) if rotate else (page_w * SCALE, page_h * SCALE)


def build_diagram(title, pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        canvas_w, canvas_h = (page.height * SCALE, page.width * SCALE) if page.height > page.width else (page.width * SCALE, page.height * SCALE)
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
        add_label(root, f"{title} - Blank Floor Outline", 40, 20, 520, 44)
        add_floor_linework(root, page)
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
    diagrams = []
    rows = []
    index = [
        "# MTB Blank Outline Draw.io Files",
        "",
        "These files remove device markers, coloured symbols, and text. They keep only the black floor/building linework so devices can be entered manually.",
        "",
    ]
    for floor_code, title, pdf_name in FLOORS:
        model = build_diagram(title, PDF_DIR / pdf_name)
        diagrams.append((title, model))
        out = OUT_DIR / f"{floor_code}-blank-outline.drawio"
        write_drawio(out, [(title, model)])
        index.append(f"- [{title}]({out.name})")
        rows.append({"floor_code": floor_code, "floor_name": title, "drawio_file": out.name})

    all_path = OUT_DIR / "MTB-all-floors-blank-outline.drawio"
    write_drawio(all_path, diagrams)
    index.append("")
    index.append(f"Combined multi-page blank outline file: [{all_path.name}]({all_path.name})")
    (OUT_DIR / "index.md").write_text("\n".join(index) + "\n", encoding="utf-8")
    with (OUT_DIR / "blank-outline-summary.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["floor_code", "floor_name", "drawio_file"])
        writer.writeheader()
        writer.writerows(rows)
    print(OUT_DIR)
    print(all_path)


if __name__ == "__main__":
    main()
