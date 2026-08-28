from pathlib import Path
import copy
import csv
import html
import re
import sys
import uuid
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).parent))
from dxf_preview import as_float, first, parse_dxf


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
DXF = ROOT / "MIMIC-R1 2000.dxf"
BLANK_DIR = ROOT / "outputs" / "mtb-drawio-blank-outline"
OUT_DIR = ROOT / "outputs" / "mtb-cad-blocks-drawio"

FLOOR_BOXES = [
    ("L1", "Level 1", "L1-blank-outline.drawio", 2060, -360, 2420, -150),
    ("L2", "Level 2", "L2-blank-outline.drawio", 2395, -360, 2765, -150),
    ("L3", "Level 3", "L3-blank-outline.drawio", 1900, -160, 2225, 35),
    ("L4-5", "Level 4-5 Typical", "L4-5-blank-outline.drawio", 2220, -160, 2465, 35),
    ("L6", "Level 6", "L6-blank-outline.drawio", 2485, -160, 2785, 35),
    ("L7", "Level 7", "L7-blank-outline.drawio", 1900, 25, 2225, 215),
    ("L8", "Level 8", "L8-blank-outline.drawio", 2210, 25, 2465, 215),
    ("L9", "Level 9", "L9-blank-outline.drawio", 2500, 25, 2785, 215),
    ("L10", "Level 10 Typical", "L10-23-blank-outline.drawio", 1900, 1010, 2175, 1218),
    ("L11", "Level 11 Typical", "L10-23-blank-outline.drawio", 1900, 850, 2175, 1010),
    ("L12", "Level 12 Typical", "L10-23-blank-outline.drawio", 1900, 690, 2175, 850),
    ("L13", "Level 13 Typical", "L10-23-blank-outline.drawio", 1900, 535, 2175, 690),
    ("L14", "Level 14 Typical", "L10-23-blank-outline.drawio", 1900, 380, 2175, 535),
    ("L15", "Level 15 Typical", "L10-23-blank-outline.drawio", 1900, 215, 2175, 380),
    ("L16", "Level 16 Typical", "L10-23-blank-outline.drawio", 2165, 1010, 2435, 1218),
    ("L17", "Level 17 Typical", "L10-23-blank-outline.drawio", 2165, 850, 2435, 1010),
    ("L18", "Level 18 Typical", "L10-23-blank-outline.drawio", 2165, 690, 2435, 850),
    ("L19", "Level 19 Typical", "L10-23-blank-outline.drawio", 2165, 535, 2435, 690),
    ("L20", "Level 20 Typical", "L10-23-blank-outline.drawio", 2165, 380, 2435, 535),
    ("L21", "Level 21 Typical", "L10-23-blank-outline.drawio", 2165, 215, 2435, 380),
    ("L22", "Level 22 Typical", "L10-23-blank-outline.drawio", 2440, 535, 2720, 690),
    ("L23", "Level 23 Typical", "L10-23-blank-outline.drawio", 2440, 380, 2720, 535),
    ("L24", "Level 24", "L24-blank-outline.drawio", 2440, 215, 2720, 380),
]

DEVICE_TYPE_BY_BLOCK = {
    "BG": ("MCP", "Manual Call Point", "blue"),
    "BG & BELL": ("MCP", "Manual Call Point + Bell", "blue"),
    "BREAKGLASS": ("MCP", "Manual Call Point", "blue"),
    "FS": ("FS", "Flow Switch", "yellow"),
    "HOSE REEL": ("HR", "Hose Reel", "red"),
    "SD": ("SD", "Smoke Detector", "magenta"),
    "SMOKE DETECTOR": ("SD", "Smoke Detector", "magenta"),
    "SD-CEILING": ("SD", "Smoke Detector", "magenta"),
    "SD IN DUCT": ("SD", "Smoke Detector In Duct", "magenta"),
    "SD IN DUCT 1": ("SD", "Smoke Detector In Duct", "magenta"),
    "DUCT SD": ("SD", "Duct Smoke Detector", "magenta"),
    "HD": ("HD", "Heat Detector", "orange"),
    "HD-CEILING": ("HD", "Heat Detector", "orange"),
    "CO2": ("CO2", "CO2 System / Panel", "gray"),
    "CO2-EXT": ("CO2", "CO2 Extinguisher", "gray"),
    "CO2 PANEL": ("CO2", "CO2 Panel", "gray"),
    "MFAP": ("FAP", "Main Fire Alarm Panel", "navy"),
    "FAP": ("FAP", "Fire Alarm Panel", "navy"),
    "FM200": ("FM200", "FM200 System", "cyan"),
    "WET CHEMICAL": ("WCC", "Wet Chemical", "green"),
    "WET CHEMICAL PANEL": ("WCC", "Wet Chemical Panel", "green"),
    "WET RISER PUMP": ("WR", "Wet Riser Pump", "green"),
    "WR PUMP PANEL": ("WR", "Wet Riser Pump Panel", "green"),
    "INTERCOM": ("FI", "Fireman Intercom", "purple"),
    "MFIP": ("FI", "Fireman Intercom Panel", "purple"),
}

STYLE = {
    "blue": {"fill": "#1ba1e2", "stroke": "#006EAF"},
    "yellow": {"fill": "#f0a30a", "stroke": "#BD7000"},
    "red": {"fill": "#d80073", "stroke": "#A50040"},
    "magenta": {"fill": "#6a00ff", "stroke": "#3700CC"},
    "orange": {"fill": "#fa6800", "stroke": "#c94f00"},
    "gray": {"fill": "#666666", "stroke": "#333333"},
    "navy": {"fill": "#0a1e3c", "stroke": "#00102a"},
    "cyan": {"fill": "#00aba9", "stroke": "#007a78"},
    "green": {"fill": "#008a00", "stroke": "#005700"},
    "purple": {"fill": "#8e44ad", "stroke": "#5e2d73"},
    "unknown": {"fill": "#777777", "stroke": "#444444"},
}

PALETTE = [
    ("MCP", "Manual Call Point / Break Glass", "blue"),
    ("FS", "Flow Switch", "yellow"),
    ("SD", "Smoke Detector", "magenta"),
    ("HD", "Heat Detector", "orange"),
    ("HR", "Hose Reel", "red"),
    ("CO2", "CO2 System / Extinguisher", "gray"),
    ("FAP", "Fire Alarm Panel", "navy"),
    ("WCC", "Wet Chemical", "green"),
    ("WR", "Wet Riser", "green"),
    ("FI", "Fireman Intercom", "purple"),
    ("UNKNOWN", "Not Confirmed", "unknown"),
]


def cell_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def norm(value):
    return re.sub(r"\s+", " ", value.strip().upper())


def floor_for(x, y):
    for floor_code, floor_name, blank_file, min_x, min_y, max_x, max_y in FLOOR_BOXES:
        if min_x <= x <= max_x and min_y <= y <= max_y:
            return {
                "floor_code": floor_code,
                "floor_name": floor_name,
                "blank_file": blank_file,
                "min_x": min_x,
                "min_y": min_y,
                "max_x": max_x,
                "max_y": max_y,
            }
    return None


def type_for_block(block):
    block = norm(block)
    if block in DEVICE_TYPE_BY_BLOCK:
        return DEVICE_TYPE_BY_BLOCK[block]
    if "SMOKE" in block:
        return ("SD", "Smoke Detector", "magenta")
    if "BREAK" in block or block == "BG":
        return ("MCP", "Manual Call Point", "blue")
    if "HOSE" in block:
        return ("HR", "Hose Reel", "red")
    if "CO2" in block:
        return ("CO2", "CO2 System / Extinguisher", "gray")
    if "WET CHEM" in block:
        return ("WCC", "Wet Chemical", "green")
    if "FS" == block or "FLOW" in block:
        return ("FS", "Flow Switch", "yellow")
    return (None, None, None)


def read_cad_blocks():
    rows = []
    for kind, data in parse_dxf(str(DXF)):
        if kind != "INSERT":
            continue
        block_name = norm(first(data, "2"))
        abbr, device_type, colour = type_for_block(block_name)
        if not abbr:
            continue
        x = as_float(first(data, "10"))
        y = as_float(first(data, "20"))
        floor = floor_for(x, y)
        if not floor:
            continue
        rows.append(
            {
                "floor_code": floor["floor_code"],
                "floor_name": floor["floor_name"],
                "blank_file": floor["blank_file"],
                "device_abbr": abbr,
                "device_type": device_type,
                "colour": colour,
                "block_name": block_name,
                "cad_x": x,
                "cad_y": y,
                "x_pct": (x - floor["min_x"]) / max(1, floor["max_x"] - floor["min_x"]),
                "y_pct_from_bottom": (y - floor["min_y"]) / max(1, floor["max_y"] - floor["min_y"]),
            }
        )
    rows.sort(key=lambda r: (r["floor_code"], r["device_abbr"], -r["cad_y"], r["cad_x"], r["block_name"]))
    return rows


def diagram_root(tree):
    root = tree.find(".//mxGraphModel/root")
    if root is None:
        raise SystemExit("No mxGraphModel/root found")
    return root


def graph_model(tree):
    graph = tree.find(".//mxGraphModel")
    if graph is None:
        raise SystemExit("No mxGraphModel found")
    return graph


def outline_bounds(root):
    xs = []
    ys = []
    for cell in root.findall("mxCell"):
        style = cell.attrib.get("style", "")
        if "outline" not in cell.attrib.get("id", "") and "locked=1" not in style:
            continue
        geom = cell.find("mxGeometry")
        if geom is None:
            continue
        if cell.attrib.get("edge") == "1":
            for point in geom.findall("mxPoint"):
                xs.append(float(point.attrib["x"]))
                ys.append(float(point.attrib["y"]))
        elif cell.attrib.get("vertex") == "1":
            x = float(geom.attrib.get("x", "0"))
            y = float(geom.attrib.get("y", "0"))
            w = float(geom.attrib.get("width", "0"))
            h = float(geom.attrib.get("height", "0"))
            xs.extend([x, x + w])
            ys.extend([y, y + h])
    if not xs or not ys:
        return 40, 80, 1600, 1400
    return min(xs), min(ys), max(xs), max(ys)


def group_cell(root, x, y, w, h):
    group_id = cell_id("device")
    cell = ET.SubElement(root, "mxCell", {"id": group_id, "value": "", "style": "group", "vertex": "1", "connectable": "0", "parent": "1"})
    ET.SubElement(cell, "mxGeometry", {"x": f"{x:.2f}", "y": f"{y:.2f}", "width": f"{w:.2f}", "height": f"{h:.2f}", "as": "geometry"})
    return group_id


def vertex(root, parent, value, style, x, y, w, h):
    cell = ET.SubElement(root, "mxCell", {"id": cell_id("part"), "value": value, "style": style, "vertex": "1", "parent": parent})
    ET.SubElement(cell, "mxGeometry", {"x": f"{x:.2f}", "y": f"{y:.2f}", "width": f"{w:.2f}", "height": f"{h:.2f}", "as": "geometry"})


def add_device(root, x, y, number, label, colour, label_width=130):
    style = STYLE[colour]
    group_id = group_cell(root, x - 15, y - 15, 46 + label_width, 30)
    circle_style = (
        "ellipse;whiteSpace=wrap;html=1;aspect=fixed;fontFamily=Helvetica;fontSize=12;"
        f"fontColor=#ffffff;fontStyle=0;align=center;verticalAlign=middle;fillColor={style['fill']};strokeColor={style['stroke']};"
    )
    label_style = "rounded=1;whiteSpace=wrap;html=1;fontSize=11;"
    vertex(root, group_id, str(number), circle_style, 0, 0, 30, 30)
    vertex(root, group_id, html.escape(label), label_style, 35.4, 3, label_width, 25)


def add_note(root, x, y, floor_code):
    note_id = group_cell(root, x, y, 560, 138)
    note_style = (
        "rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;"
        "fontFamily=Helvetica;fontSize=12;align=left;verticalAlign=top;spacing=8;"
    )
    text = (
        f"{floor_code} generated from AutoCAD block references.<br>"
        "Move marker group if location is not precise.<br>"
        "Rename/check labels using Floor.Type.No-Zone format, e.g. L1.MCP.1-Z??.<br>"
        "Keep Z?? until zone is confirmed. Delete wrong markers and copy/paste palette for missing devices."
    )
    vertex(root, note_id, text, note_style, 0, 0, 560, 138)


def add_palette(root, x, y, floor_code):
    title_id = group_cell(root, x, y, 450, 30)
    vertex(root, title_id, "Copy/Paste Device Palette", "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;", 0, 0, 450, 30)
    for idx, (abbr, name, colour) in enumerate(PALETTE):
        py = y + 42 + idx * 38
        add_device(root, x + 15, py + 15, idx + 1, f"{floor_code}.{abbr}.?-Z??", colour, label_width=120)
        label_id = group_cell(root, x + 185, py, 250, 30)
        vertex(root, label_id, name, "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#cccccc;fontSize=11;", 0, 0, 250, 30)


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
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = read_cad_blocks()
    by_floor = {}
    for row in rows:
        by_floor.setdefault(row["floor_code"], []).append(row)

    all_diagrams = []
    summary_rows = []
    master_rows = []
    index = [
        "# MTB Draw.io From AutoCAD Blocks",
        "",
        "Generated from `MIMIC-R1 2000.dxf` INSERT block references, not from scanned colour dots.",
        "",
        "Use this as the cleaner review set. Locations and labels still need final checking before app import.",
        "",
        "Tag format: `Floor.Type.RunningNo-Z??`. Keep `Z??` until zone is confirmed.",
        "",
    ]

    for floor_code, floor_name, blank_file, *_ in FLOOR_BOXES:
        floor_rows = by_floor.get(floor_code, [])
        tree = ET.parse(BLANK_DIR / blank_file)
        root = diagram_root(tree)
        min_x, min_y, max_x, max_y = outline_bounds(root)
        counts = {}
        for row in floor_rows:
            abbr = row["device_abbr"]
            counts[abbr] = counts.get(abbr, 0) + 1
            label = f"{floor_code}.{abbr}.{counts[abbr]}-Z??"
            x = min_x + row["x_pct"] * (max_x - min_x)
            y = max_y - row["y_pct_from_bottom"] * (max_y - min_y)
            add_device(root, x, y, counts[abbr], label, row["colour"])
            master_rows.append(
                {
                    "review_label": label,
                    "floor_code": floor_code,
                    "floor_name": floor_name,
                    "device_abbr": abbr,
                    "device_type": row["device_type"],
                    "cad_block_name": row["block_name"],
                    "cad_x": f"{row['cad_x']:.4f}",
                    "cad_y": f"{row['cad_y']:.4f}",
                    "drawio_x": f"{x:.2f}",
                    "drawio_y": f"{y:.2f}",
                    "status": "Extracted from AutoCAD block - check location/type/zone",
                }
            )

        add_note(root, 40, 1540, floor_code)
        add_palette(root, 640, 1540, floor_code)
        out_file = OUT_DIR / f"{floor_code}-cad-blocks.drawio"
        tree.write(out_file, encoding="utf-8", xml_declaration=True)
        all_diagrams.append((floor_name, copy.deepcopy(graph_model(tree))))
        total = len(floor_rows)
        index.append(f"- [{floor_name}]({out_file.name}) - {total} CAD block markers")
        summary_rows.append({"floor_code": floor_code, "floor_name": floor_name, "total": total, **counts})

    combined = OUT_DIR / "MTB-cad-blocks-all-floors.drawio"
    write_drawio(combined, all_diagrams)
    index.append("")
    index.append(f"Combined all-floor file: [{combined.name}]({combined.name})")
    index.append("")
    index.append("Review CSV: [cad-block-device-master.csv](cad-block-device-master.csv)")
    (OUT_DIR / "index.md").write_text("\n".join(index) + "\n", encoding="utf-8")

    with (OUT_DIR / "cad-block-device-master.csv").open("w", newline="", encoding="utf-8") as f:
        fields = [
            "review_label",
            "floor_code",
            "floor_name",
            "device_abbr",
            "device_type",
            "cad_block_name",
            "cad_x",
            "cad_y",
            "drawio_x",
            "drawio_y",
            "status",
        ]
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(master_rows)

    summary_fields = sorted({key for row in summary_rows for key in row.keys()})
    with (OUT_DIR / "cad-block-summary.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=summary_fields)
        writer.writeheader()
        writer.writerows(summary_rows)

    print(OUT_DIR)
    print(combined)
    print(f"markers: {len(master_rows)}")


if __name__ == "__main__":
    main()
