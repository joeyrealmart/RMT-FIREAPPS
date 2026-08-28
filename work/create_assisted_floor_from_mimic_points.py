from pathlib import Path
import copy
import csv
import html
import uuid
import xml.etree.ElementTree as ET


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
POINTS_CSV = ROOT / "outputs" / "mtb-mimic-list-plotted-landscape" / "all-floors-mimic-list-points.csv"
BLANK_DIR = ROOT / "outputs" / "mtb-drawio-blank-outline"
OUT_DIR = ROOT / "outputs" / "mtb-assisted-from-mimic"

FLOORS = [
    ("L1", "Level 1", "L1-blank-outline.drawio"),
    ("L2", "Level 2", "L2-blank-outline.drawio"),
    ("L3", "Level 3", "L3-blank-outline.drawio"),
    ("L4-5", "Level 4-5 Typical", "L4-5-blank-outline.drawio"),
    ("L6", "Level 6", "L6-blank-outline.drawio"),
    ("L7", "Level 7", "L7-blank-outline.drawio"),
    ("L8", "Level 8", "L8-blank-outline.drawio"),
    ("L9", "Level 9", "L9-blank-outline.drawio"),
    ("L10-23", "Level 10-23 Typical", "L10-23-blank-outline.drawio"),
    ("L24", "Level 24", "L24-blank-outline.drawio"),
    ("ROOF", "Roof", "ROOF-blank-outline.drawio"),
]

COLOUR_STYLE = {
    "green": {"fill": "#008a00", "stroke": "#005700", "prefix": "UNKNOWN"},
    "blue": {"fill": "#1ba1e2", "stroke": "#006EAF", "prefix": "MCP"},
    "red": {"fill": "#d80073", "stroke": "#A50040", "prefix": "HR"},
    "magenta": {"fill": "#6a00ff", "stroke": "#3700CC", "prefix": "SD"},
    "yellow": {"fill": "#f0a30a", "stroke": "#BD7000", "prefix": "UNKNOWN"},
}

PALETTE = [
    ("SD", "Smoke Detector", "magenta"),
    ("MCP", "Manual Call Point", "blue"),
    ("HR", "Hose Reel", "red"),
    ("KS", "Exit Sign / Keluar", "green"),
    ("EL", "Emergency Light", "green"),
    ("WC", "Wet Chemical", "yellow"),
    ("WR", "Wet Riser", "magenta"),
    ("FS", "Flow Switch", "yellow"),
    ("FI", "Fire Intercom / FI", "yellow"),
]


def cell_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def group_cell(root, x, y, w, h):
    group_id = cell_id("device")
    cell = ET.SubElement(root, "mxCell", {"id": group_id, "value": "", "style": "group", "vertex": "1", "connectable": "0", "parent": "1"})
    ET.SubElement(cell, "mxGeometry", {"x": f"{x:.2f}", "y": f"{y:.2f}", "width": f"{w:.2f}", "height": f"{h:.2f}", "as": "geometry"})
    return group_id


def vertex(root, parent, value, style, x, y, w, h):
    cell = ET.SubElement(root, "mxCell", {"id": cell_id("part"), "value": value, "style": style, "vertex": "1", "parent": parent})
    ET.SubElement(cell, "mxGeometry", {"x": f"{x:.2f}", "y": f"{y:.2f}", "width": f"{w:.2f}", "height": f"{h:.2f}", "as": "geometry"})


def add_device(root, x, y, number, label, colour, label_width=120):
    style = COLOUR_STYLE[colour]
    group_id = group_cell(root, x - 15, y - 15, 40 + label_width, 30)
    circle_style = (
        "ellipse;whiteSpace=wrap;html=1;aspect=fixed;fontFamily=Helvetica;fontSize=12;"
        f"fontColor=#ffffff;fontStyle=0;align=center;verticalAlign=middle;fillColor={style['fill']};strokeColor={style['stroke']};"
    )
    label_style = "rounded=1;whiteSpace=wrap;html=1;"
    vertex(root, group_id, str(number), circle_style, 0, 0, 30, 30)
    vertex(root, group_id, html.escape(label), label_style, 35.4, 3, label_width, 25)


def diagram_root(tree):
    graph = tree.find(".//mxGraphModel")
    if graph is None:
        raise SystemExit("No mxGraphModel found")
    root = graph.find("root")
    if root is None:
        raise SystemExit("No root found")
    return root


def graph_model(tree):
    graph = tree.find(".//mxGraphModel")
    if graph is None:
        raise SystemExit("No mxGraphModel found")
    return graph


def read_points():
    by_floor = {}
    with POINTS_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            by_floor.setdefault(row["floor_code"], []).append(row)
    return by_floor


def add_note(root, x, y, floor_code):
    note_id = group_cell(root, x, y, 500, 124)
    note_style = (
        "rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;"
        "fontFamily=Helvetica;fontSize=12;align=left;verticalAlign=top;spacing=8;"
    )
    text = (
        f"{floor_code} assisted first pass from mimic list.<br>"
        "Move marker group to correct position.<br>"
        "Rename label to final tag, e.g. L1.SD.1-Z??.<br>"
        "Use UNKNOWN if device type or zone is not confirmed yet.<br>"
        "Delete wrong markers. Copy/paste from palette for missing devices."
    )
    vertex(root, note_id, text, note_style, 0, 0, 500, 124)


def add_palette(root, x, y, floor_code):
    title_id = group_cell(root, x, y, 410, 30)
    vertex(root, title_id, "Copy/Paste Device Palette", "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;", 0, 0, 410, 30)
    for idx, (abbr, name, colour) in enumerate(PALETTE):
        py = y + 42 + idx * 40
        add_device(root, x + 15, py + 15, idx + 1, f"{floor_code}.{abbr}.?-Z??", colour, label_width=110)
        label_id = group_cell(root, x + 175, py, 230, 30)
        vertex(root, label_id, name, "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#cccccc;", 0, 0, 230, 30)


def review_label(floor_code, colour, number):
    prefix = COLOUR_STYLE[colour]["prefix"]
    return f"{floor_code}.{prefix}.{number}-Z??"


def write_drawio(path, diagrams):
    mxfile = ET.Element(
        "mxfile",
        {"host": "app.diagrams.net", "modified": "2026-07-10T00:00:00.000Z", "agent": "Codex", "version": "24.7.17", "type": "device"},
    )
    for name, graph in diagrams:
        diagram = ET.Element("diagram", {"id": uuid.uuid4().hex[:12], "name": name, "compressed": "false", "noEdit": "0"})
        diagram.append(copy.deepcopy(graph))
        mxfile.append(diagram)
    ET.ElementTree(mxfile).write(path, encoding="utf-8", xml_declaration=True)


def write_floor_csv(path, floor_code, rows):
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["review_label", "mimic_colour", "x", "y", "status"])
        writer.writeheader()
        local_counts = {}
        for row in rows:
            colour = row["mimic_colour"]
            if colour not in COLOUR_STYLE:
                continue
            local_counts[colour] = local_counts.get(colour, 0) + 1
            writer.writerow(
                {
                    "review_label": review_label(floor_code, colour, local_counts[colour]),
                    "mimic_colour": colour,
                    "x": row["plotted_x"],
                    "y": row["plotted_y"],
                    "status": "Assisted first pass from mimic list - rename/check manually",
                }
            )


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    by_floor = read_points()
    all_diagrams = []
    summary_rows = []
    index_lines = [
        "# Assisted Draw.io From Mimic List",
        "",
        "These files use Joey's Basement marker/group style and place first-pass markers from the scanned mimic list.",
        "",
        "Use these as correction starting points, not final app data yet. Rename labels, move markers, delete wrong points, and add missing devices.",
        "",
    ]

    for floor_code, floor_name, blank_file in FLOORS:
        rows = by_floor.get(floor_code, [])
        tree = ET.parse(BLANK_DIR / blank_file)
        root = diagram_root(tree)
        counts = {}
        for row in rows:
            colour = row["mimic_colour"]
            if colour not in COLOUR_STYLE:
                continue
            counts[colour] = counts.get(colour, 0) + 1
            label = review_label(floor_code, colour, counts[colour])
            add_device(root, float(row["plotted_x"]), float(row["plotted_y"]), counts[colour], label, colour)

        add_note(root, 40, 1540, floor_code)
        add_palette(root, 570, 1540, floor_code)

        out_file = OUT_DIR / f"{floor_code}-assisted-from-mimic.drawio"
        tree.write(out_file, encoding="utf-8", xml_declaration=True)
        write_floor_csv(OUT_DIR / f"{floor_code}-assisted-from-mimic-points.csv", floor_code, rows)
        all_diagrams.append((floor_name, copy.deepcopy(graph_model(tree))))
        total = sum(counts.values())
        index_lines.append(f"- [{floor_name}]({out_file.name}) - {total} first-pass markers")
        summary_rows.append(
            {
                "floor_code": floor_code,
                "floor_name": floor_name,
                "total": total,
                **{f"{colour}_count": counts.get(colour, 0) for colour in COLOUR_STYLE},
            }
        )

    combined = OUT_DIR / "MTB-assisted-all-floors-from-mimic.drawio"
    write_drawio(combined, all_diagrams)
    index_lines.append("")
    index_lines.append(f"Combined all-floor assisted file: [{combined.name}]({combined.name})")
    (OUT_DIR / "index.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")

    with (OUT_DIR / "assisted-marker-summary.csv").open("w", newline="", encoding="utf-8") as f:
        fields = ["floor_code", "floor_name", "total"] + [f"{colour}_count" for colour in COLOUR_STYLE]
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(summary_rows)

    print(OUT_DIR)
    print(combined)


if __name__ == "__main__":
    main()
