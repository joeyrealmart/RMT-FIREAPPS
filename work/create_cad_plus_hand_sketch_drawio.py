from pathlib import Path
import copy
import csv
import html
import shutil
import uuid
import xml.etree.ElementTree as ET


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
CAD_DIR = ROOT / "outputs" / "mtb-cad-blocks-drawio"
HAND_DIR = ROOT / "outputs" / "_archive-old-generated-files" / "mtb-assisted-from-mimic"
OUT_DIR = ROOT / "outputs" / "mtb-cad-plus-hand-sketch"

FLOORS = [
    ("L1", "Level 1", "L1-cad-blocks.drawio", "L1-assisted-from-mimic-points.csv"),
    ("L2", "Level 2", "L2-cad-blocks.drawio", "L2-assisted-from-mimic-points.csv"),
    ("L3", "Level 3", "L3-cad-blocks.drawio", "L3-assisted-from-mimic-points.csv"),
    ("L4-5", "Level 4-5 Typical", "L4-5-cad-blocks.drawio", "L4-5-assisted-from-mimic-points.csv"),
    ("L6", "Level 6", "L6-cad-blocks.drawio", "L6-assisted-from-mimic-points.csv"),
    ("L7", "Level 7", "L7-cad-blocks.drawio", "L7-assisted-from-mimic-points.csv"),
    ("L8", "Level 8", "L8-cad-blocks.drawio", "L8-assisted-from-mimic-points.csv"),
    ("L9", "Level 9", "L9-cad-blocks.drawio", "L9-assisted-from-mimic-points.csv"),
    ("L10", "Level 10 Typical", "L10-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L11", "Level 11 Typical", "L11-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L12", "Level 12 Typical", "L12-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L13", "Level 13 Typical", "L13-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L14", "Level 14 Typical", "L14-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L15", "Level 15 Typical", "L15-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L16", "Level 16 Typical", "L16-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L17", "Level 17 Typical", "L17-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L18", "Level 18 Typical", "L18-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L19", "Level 19 Typical", "L19-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L20", "Level 20 Typical", "L20-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L21", "Level 21 Typical", "L21-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L22", "Level 22 Typical", "L22-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L23", "Level 23 Typical", "L23-cad-blocks.drawio", "L10-23-assisted-from-mimic-points.csv"),
    ("L24", "Level 24", "L24-cad-blocks.drawio", "L24-assisted-from-mimic-points.csv"),
]

STYLE = {
    "MCP": {"fill": "#1ba1e2", "stroke": "#006EAF"},
    "FS": {"fill": "#f0a30a", "stroke": "#BD7000"},
    "SD": {"fill": "#6a00ff", "stroke": "#3700CC"},
    "HR": {"fill": "#d80073", "stroke": "#A50040"},
    "UNKNOWN": {"fill": "#777777", "stroke": "#444444"},
}

DISTANCE_THRESHOLD = 38


def cell_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def graph_model(tree):
    graph = tree.find(".//mxGraphModel")
    if graph is None:
        raise SystemExit("No mxGraphModel found")
    return graph


def diagram_root(tree):
    root = tree.find(".//mxGraphModel/root")
    if root is None:
        raise SystemExit("No mxGraphModel/root found")
    return root


def group_cell(root, x, y, w, h):
    group_id = cell_id("hand-device")
    cell = ET.SubElement(root, "mxCell", {"id": group_id, "value": "", "style": "group", "vertex": "1", "connectable": "0", "parent": "1"})
    ET.SubElement(cell, "mxGeometry", {"x": f"{x:.2f}", "y": f"{y:.2f}", "width": f"{w:.2f}", "height": f"{h:.2f}", "as": "geometry"})
    return group_id


def vertex(root, parent, value, style, x, y, w, h):
    cell = ET.SubElement(root, "mxCell", {"id": cell_id("hand-part"), "value": value, "style": style, "vertex": "1", "parent": parent})
    ET.SubElement(cell, "mxGeometry", {"x": f"{x:.2f}", "y": f"{y:.2f}", "width": f"{w:.2f}", "height": f"{h:.2f}", "as": "geometry"})


def add_device(root, x, y, number, label, abbr, label_width=145):
    style = STYLE.get(abbr, STYLE["UNKNOWN"])
    group_id = group_cell(root, x - 15, y - 15, 46 + label_width, 30)
    circle_style = (
        "ellipse;whiteSpace=wrap;html=1;aspect=fixed;fontFamily=Helvetica;fontSize=11;"
        f"fontColor=#ffffff;fontStyle=1;align=center;verticalAlign=middle;fillColor={style['fill']};strokeColor={style['stroke']};"
    )
    label_style = "rounded=1;whiteSpace=wrap;html=1;fontSize=11;fillColor=#fffbe6;strokeColor=#d6b656;"
    vertex(root, group_id, f"H{number}", circle_style, 0, 0, 30, 30)
    vertex(root, group_id, html.escape(label), label_style, 35.4, 3, label_width, 25)


def existing_centers(root):
    centers = []
    for cell in root.findall("mxCell"):
        if cell.attrib.get("style") != "group":
            continue
        geom = cell.find("mxGeometry")
        if geom is None:
            continue
        try:
            x = float(geom.attrib.get("x", "0")) + 15
            y = float(geom.attrib.get("y", "0")) + 15
        except ValueError:
            continue
        centers.append((x, y))
    return centers


def is_near_existing(x, y, centers):
    for ex, ey in centers:
        if ((x - ex) ** 2 + (y - ey) ** 2) ** 0.5 < DISTANCE_THRESHOLD:
            return True
    return False


def read_hand_rows(path, target_floor):
    rows = []
    if not path.exists():
        return rows
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            parts = row["review_label"].split(".")
            abbr = parts[1] if len(parts) >= 3 else "UNKNOWN"
            if abbr not in STYLE:
                abbr = "UNKNOWN"
            rows.append(
                {
                    "floor_code": target_floor,
                    "source_label": row["review_label"],
                    "abbr": abbr,
                    "x": float(row["x"]),
                    "y": float(row["y"]),
                }
            )
    return rows


def write_drawio(path, diagrams):
    mxfile = ET.Element(
        "mxfile",
        {"host": "app.diagrams.net", "modified": "2026-07-13T00:00:00.000Z", "agent": "Codex", "version": "24.7.17", "type": "device"},
    )
    for name, graph in diagrams:
        diagram = ET.Element("diagram", {"id": uuid.uuid4().hex[:12], "name": name, "compressed": "false", "noEdit": "0"})
        diagram.append(copy.deepcopy(graph))
        mxfile.append(diagram)
    ET.ElementTree(mxfile).write(path, encoding="utf-8", xml_declaration=True)


def main():
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    all_diagrams = []
    master_rows = []
    summary_rows = []
    index = [
        "# MTB CAD + Hand-Sketch Device Review",
        "",
        "This version starts with AutoCAD block devices and adds hand-sketch/mimic-list devices where no nearby CAD marker exists.",
        "",
        "Hand-sketch added markers have a pale yellow label and circle number starting with `H`.",
        "",
    ]

    for floor_code, floor_name, cad_file, hand_file in FLOORS:
        tree = ET.parse(CAD_DIR / cad_file)
        root = diagram_root(tree)
        centers = existing_centers(root)
        added = 0
        skipped = 0
        counts = {}
        for row in read_hand_rows(HAND_DIR / hand_file, floor_code):
            if is_near_existing(row["x"], row["y"], centers):
                skipped += 1
                continue
            abbr = row["abbr"]
            counts[abbr] = counts.get(abbr, 0) + 1
            added += 1
            label = f"{floor_code}.{abbr}.HS{counts[abbr]}-Z??"
            add_device(root, row["x"], row["y"], added, label, abbr)
            centers.append((row["x"], row["y"]))
            master_rows.append(
                {
                    "review_label": label,
                    "floor_code": floor_code,
                    "device_abbr": abbr,
                    "source": "hand-sketch/mimic-list",
                    "source_label": row["source_label"],
                    "drawio_x": f"{row['x']:.2f}",
                    "drawio_y": f"{row['y']:.2f}",
                    "status": "Added from hand sketch because no nearby CAD marker was found",
                }
            )
        out_file = OUT_DIR / f"{floor_code}-cad-plus-hand-sketch.drawio"
        tree.write(out_file, encoding="utf-8", xml_declaration=True)
        all_diagrams.append((floor_name, copy.deepcopy(graph_model(tree))))
        index.append(f"- [{floor_name}]({out_file.name}) - added {added}, skipped near-CAD {skipped}")
        summary_rows.append({"floor_code": floor_code, "floor_name": floor_name, "hand_added": added, "hand_skipped_near_cad": skipped, **counts})

    combined = OUT_DIR / "MTB-cad-plus-hand-sketch-all-floors.drawio"
    write_drawio(combined, all_diagrams)
    index.append("")
    index.append(f"Combined file: [{combined.name}]({combined.name})")
    index.append("")
    index.append("Added marker CSV: [hand-sketch-added-device-master.csv](hand-sketch-added-device-master.csv)")
    (OUT_DIR / "index.md").write_text("\n".join(index) + "\n", encoding="utf-8")

    with (OUT_DIR / "hand-sketch-added-device-master.csv").open("w", newline="", encoding="utf-8") as f:
        fields = ["review_label", "floor_code", "device_abbr", "source", "source_label", "drawio_x", "drawio_y", "status"]
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(master_rows)

    fields = sorted({key for row in summary_rows for key in row.keys()})
    with (OUT_DIR / "cad-plus-hand-summary.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(summary_rows)

    print(OUT_DIR)
    print(combined)
    print(f"hand markers added: {len(master_rows)}")


if __name__ == "__main__":
    main()
