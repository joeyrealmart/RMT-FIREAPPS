from collections import defaultdict
import copy
from pathlib import Path
import base64
import csv
import html
import uuid
import xml.etree.ElementTree as ET

from PIL import Image


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
CSV_PATH = ROOT / "outputs" / "mtb-mimic-list-plotted-landscape" / "all-floors-mimic-list-points.csv"
BACKGROUND_DIR = ROOT / "outputs" / "mtb-uploaded-floor-pdfs"
HD_BACKGROUND_DIR = ROOT / "outputs" / "mtb-uploaded-floor-pdfs-hd"
OUT_DIR = ROOT / "outputs" / "mtb-drawio-editable"
HD_OUT_DIR = ROOT / "outputs" / "mtb-drawio-editable-hd"

FLOORS = [
    ("basement", "Basement", "basement-1.png"),
    ("L1", "Level 1", "L1-1.png"),
    ("L2", "Level 2", "L2-1.png"),
    ("L3", "Level 3", "L3-1.png"),
    ("L4-5", "Level 4-5 Typical", "L4-5-1.png"),
    ("L6", "Level 6", "L6-1.png"),
    ("L7", "Level 7", "L7-1.png"),
    ("L8", "Level 8", "L8-1.png"),
    ("L9", "Level 9", "L9-1.png"),
    ("L10-23", "Level 10-23 Typical", "L10-23-1.png"),
    ("L24", "Level 24", "L24-1.png"),
    ("ROOF", "Roof", "ROOF-1.png"),
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


def data_uri(path):
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{data}"


def rotate_landscape(src_path, out_path):
    image = Image.open(src_path).convert("RGB")
    if image.height > image.width:
        image = image.rotate(90, expand=True)
    image.save(out_path)
    return image.size


def add_cell(root, cell):
    root.append(cell)
    return cell


def mx_cell(root, id_, value="", style="", vertex="1", parent="1", x=0, y=0, w=10, h=10):
    cell = ET.Element(
        "mxCell",
        {
            "id": id_,
            "value": value,
            "style": style,
            "vertex": vertex,
            "parent": parent,
        },
    )
    ET.SubElement(
        cell,
        "mxGeometry",
        {"x": f"{x:.2f}", "y": f"{y:.2f}", "width": f"{w:.2f}", "height": f"{h:.2f}", "as": "geometry"},
    )
    add_cell(root, cell)
    return cell


def build_diagram(floor_code, title, background_path, image_w, image_h, rows, scale_x=1.0, scale_y=1.0):
    mx_graph_model = ET.Element(
        "mxGraphModel",
        {
            "dx": "1600",
            "dy": "900",
            "grid": "1",
            "gridSize": "10",
            "guides": "1",
            "tooltips": "1",
            "connect": "1",
            "arrows": "1",
            "fold": "1",
            "page": "1",
            "pageScale": "1",
            "pageWidth": str(int(image_w + 80)),
            "pageHeight": str(int(image_h + 120)),
            "math": "0",
            "shadow": "0",
        },
    )
    root = ET.SubElement(mx_graph_model, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})

    image_style = (
        "shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=1;"
        f"image={data_uri(background_path)};locked=1;connectable=0;movable=0;resizable=0;rotatable=0;"
    )
    mx_cell(root, "background", "", image_style, x=40, y=80, w=image_w, h=image_h)

    title_style = (
        "rounded=0;whiteSpace=wrap;html=1;strokeColor=#0a1e3c;fillColor=#ffffff;"
        "fontColor=#0a1e3c;fontSize=24;fontStyle=1;align=left;spacingLeft=12;"
    )
    mx_cell(root, "title", html.escape(f"{title} - Editable Mimic Device Points"), title_style, x=40, y=20, w=560, h=44)

    legend_x = 40
    legend_y = image_h + 92
    legend_style = "rounded=0;whiteSpace=wrap;html=1;strokeColor=#0a1e3c;fillColor=#ffffff;fontSize=12;align=left;"
    mx_cell(root, "legend-box", "Legend: movable markers from scanned mimic list. Keep background locked.", legend_style, x=legend_x, y=legend_y, w=520, h=34)

    for idx, (colour, info) in enumerate(COLOURS.items()):
        x = 590 + idx * 170
        y = legend_y + 6
        marker_style = (
            f"ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor={info['fill']};"
            f"strokeColor={info['stroke']};fontColor=#ffffff;fontSize=10;fontStyle=1;"
        )
        mx_cell(root, f"legend-{colour}-dot", colour[:1].upper(), marker_style, x=x, y=y, w=22, h=22)
        label_style = "text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=12;"
        mx_cell(root, f"legend-{colour}-label", html.escape(info["name"]), label_style, x=x + 28, y=y, w=130, h=22)

    for row in rows:
        colour = row["mimic_colour"]
        info = COLOURS.get(colour, COLOURS["red"])
        x = float(row["plotted_x"]) * scale_x + 40
        y = float(row["plotted_y"]) * scale_y + 80
        tag = row["review_tag"]
        radius = 26
        marker_style = (
            f"ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor={info['fill']};"
            f"strokeColor={info['stroke']};strokeWidth=3;fontColor=#ffffff;fontSize=9;fontStyle=1;"
        )
        short = tag.split("-")[-1]
        mx_cell(root, cell_id("marker"), html.escape(short), marker_style, x=x - radius / 2, y=y - radius / 2, w=radius, h=radius)

        label_style = (
            f"rounded=0;whiteSpace=wrap;html=1;strokeColor={info['stroke']};fillColor=#ffffff;"
            f"fontColor={info['stroke']};fontSize=10;align=left;spacingLeft=4;"
        )
        mx_cell(root, cell_id("label"), html.escape(tag), label_style, x=x + 16, y=y - 10, w=116, h=20)

    return mx_graph_model


def write_drawio(path, diagrams):
    mxfile = ET.Element(
        "mxfile",
        {
            "host": "app.diagrams.net",
            "modified": "2026-07-10T00:00:00.000Z",
            "agent": "Codex",
            "version": "24.7.17",
            "type": "device",
        },
    )
    for name, graph_model in diagrams:
        diagram = ET.Element("diagram", {"id": uuid.uuid4().hex[:12], "name": name, "compressed": "false", "noEdit": "0"})
        diagram.append(copy.deepcopy(graph_model))
        mxfile.append(diagram)
    ET.ElementTree(mxfile).write(path, encoding="utf-8", xml_declaration=True)


def generate(out_dir, background_dir, suffix="", use_hd=False):
    out_dir.mkdir(parents=True, exist_ok=True)
    bg_dir = out_dir / "backgrounds"
    bg_dir.mkdir(parents=True, exist_ok=True)

    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    by_floor = defaultdict(list)
    for row in rows:
        by_floor[row["floor_code"]].append(row)

    index_lines = [
        "# MTB Editable Draw.io Floor Files",
        "",
        "Open `.drawio` files in diagrams.net / draw.io. The floor plan is locked as the background; device points and labels are editable.",
        "",
    ]
    all_diagrams = []
    summary_rows = []

    for floor_code, title, background_name in FLOORS:
        source_bg = background_dir / background_name
        if not source_bg.exists() and use_hd:
            source_bg = background_dir / background_name.replace("-1.png", "-1.png")
        old_bg = BACKGROUND_DIR / background_name
        old_landscape = Image.open(old_bg).convert("RGB")
        if old_landscape.height > old_landscape.width:
            old_landscape = old_landscape.rotate(90, expand=True)
        editable_bg = bg_dir / f"{floor_code}-background-landscape.png"
        image_w, image_h = rotate_landscape(source_bg, editable_bg)
        scale_x = image_w / old_landscape.width
        scale_y = image_h / old_landscape.height
        floor_rows = by_floor.get(floor_code, [])
        diagram = build_diagram(floor_code, title, editable_bg, image_w, image_h, floor_rows, scale_x, scale_y)
        all_diagrams.append((title, diagram))

        out_path = out_dir / f"{floor_code}-editable{suffix}.drawio"
        write_drawio(out_path, [(title, diagram)])
        index_lines.append(f"- [{title}]({out_path.name}) - {len(floor_rows)} editable markers")
        summary_rows.append({"floor_code": floor_code, "floor_name": title, "markers": len(floor_rows), "drawio_file": out_path.name})

    all_path = out_dir / f"MTB-all-floors-editable{suffix}.drawio"
    write_drawio(all_path, all_diagrams)
    index_lines.append("")
    index_lines.append(f"Combined multi-page draw.io file: [{all_path.name}]({all_path.name})")
    (out_dir / "index.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")

    with (out_dir / "drawio-file-summary.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["floor_code", "floor_name", "markers", "drawio_file"])
        writer.writeheader()
        writer.writerows(summary_rows)

    print(out_dir)
    print(all_path)


def main():
    generate(OUT_DIR, BACKGROUND_DIR)
    if HD_BACKGROUND_DIR.exists():
        generate(HD_OUT_DIR, HD_BACKGROUND_DIR, "-HD", use_hd=True)


if __name__ == "__main__":
    main()
