from pathlib import Path
import csv
import re
import xml.etree.ElementTree as ET


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
SRC = ROOT / "outputs" / "mtb-drawio-blank-outline" / "basement-blank-outline-EDIT.drawio"
OUT_DIR = ROOT / "outputs" / "mtb-drawio-blank-outline" / "extracted"


SYSTEM_ID_PREFIXES = ("outline", "outline-rect", "label")


def style_value(style, key):
    for part in (style or "").split(";"):
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        if k == key:
            return v
    return ""


def clean_value(value):
    value = value or ""
    value = re.sub(r"<[^>]+>", " ", value)
    value = value.replace("&nbsp;", " ")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def infer_device_type(value, style):
    text = value.upper()
    fill = style_value(style, "fillColor").lower()
    stroke = style_value(style, "strokeColor").lower()
    colour = fill or stroke
    if "CO2" in text:
        return "CO2 System"
    if "WCC" in text or "WET" in text:
        return "Wet Chemical System"
    if "MCP" in text or "MANUAL CALL" in text or "CALL" in text:
        return "Manual Call Point"
    if "KS" in text or "KELUAR" in text or "EXIT" in text:
        return "Exit Sign"
    if "HR" in text or ".H" in text or "HOSEREEL" in text or "HOSE" in text:
        return "Hose Reel"
    if "WR" in text:
        return "Wet Riser"
    if "EL" in text or "EMERGENCY LIGHT" in text:
        return "Emergency Light"
    if "SD" in text or ".S" in text or text == "S":
        return "Smoke Detector"
    if "WC" in text:
        return "Wet Chemical System"
    if "FS" in text:
        return "Flow Switch"
    if "PA" in text:
        return "Fireman Intercom"
    if "MFAP" in text or "FAP" in text:
        return "Fire Alarm Panel"
    if "green" in colour or colour in {"#00ff00", "#21b059"}:
        return "Flow Switch / Green Marker"
    if "blue" in colour or colour in {"#0000ff", "#2979ff"}:
        return "Blue Marker"
    if "red" in colour or colour in {"#ff0000", "#d63031"}:
        return "Red Marker"
    if "yellow" in colour or colour in {"#ffff00", "#f2bf26"}:
        return "Yellow Marker"
    return "Manual Draw.io Object"


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tree = ET.parse(SRC)
    root = tree.getroot()
    rows = []
    for cell in root.iter("mxCell"):
        cell_id = cell.attrib.get("id", "")
        if cell_id == "0" or cell_id == "1" or cell_id.startswith(SYSTEM_ID_PREFIXES):
            continue
        if cell.attrib.get("vertex") != "1":
            continue
        style = cell.attrib.get("style", "")
        if "locked=1" in style:
            continue
        geom = cell.find("mxGeometry")
        if geom is None:
            continue
        value = clean_value(cell.attrib.get("value", ""))
        x = float(geom.attrib.get("x", "0"))
        y = float(geom.attrib.get("y", "0"))
        w = float(geom.attrib.get("width", "0"))
        h = float(geom.attrib.get("height", "0"))
        rows.append(
            {
                "floor_code": "basement",
                "floor_name": "Basement",
                "object_id": cell_id,
                "label": value,
                "device_type": infer_device_type(value, style),
                "x": f"{x:.2f}",
                "y": f"{y:.2f}",
                "center_x": f"{x + w / 2:.2f}",
                "center_y": f"{y + h / 2:.2f}",
                "width": f"{w:.2f}",
                "height": f"{h:.2f}",
                "fill_color": style_value(style, "fillColor"),
                "stroke_color": style_value(style, "strokeColor"),
                "style": style,
                "status": "Extracted from Joey edited draw.io",
            }
        )
    out_csv = OUT_DIR / "basement-blank-outline-EDIT-devices.csv"
    with out_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "floor_code",
                "floor_name",
                "object_id",
                "label",
                "device_type",
                "x",
                "y",
                "center_x",
                "center_y",
                "width",
                "height",
                "fill_color",
                "stroke_color",
                "style",
                "status",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)
    print(out_csv)
    print(f"manual objects: {len(rows)}")

    grouped = extract_grouped_devices(root)
    grouped_csv = OUT_DIR / "basement-device-master-from-edit.csv"
    with grouped_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "floor_code",
                "floor_name",
                "device_tag",
                "device_type",
                "x",
                "y",
                "marker_color",
                "source_group_id",
                "status",
            ],
        )
        writer.writeheader()
        writer.writerows(grouped)
    print(grouped_csv)
    print(f"grouped devices: {len(grouped)}")


def extract_grouped_devices(root):
    cells = {}
    children = {}
    for cell in root.iter("mxCell"):
        cell_id = cell.attrib.get("id", "")
        cells[cell_id] = cell
        parent = cell.attrib.get("parent")
        if parent:
            children.setdefault(parent, []).append(cell)

    def geom_xy(cell):
        geom = cell.find("mxGeometry")
        if geom is None:
            return 0.0, 0.0, 0.0, 0.0
        return (
            float(geom.attrib.get("x", "0")),
            float(geom.attrib.get("y", "0")),
            float(geom.attrib.get("width", "0")),
            float(geom.attrib.get("height", "0")),
        )

    abs_cache = {}

    def absolute_xy(cell_id):
        if cell_id in abs_cache:
            return abs_cache[cell_id]
        cell = cells.get(cell_id)
        if cell is None:
            return 0.0, 0.0
        x, y, _, _ = geom_xy(cell)
        parent_id = cell.attrib.get("parent")
        if parent_id and parent_id not in {"0", "1"}:
            px, py = absolute_xy(parent_id)
            x += px
            y += py
        abs_cache[cell_id] = (x, y)
        return x, y

    devices = []
    for group_id, group in cells.items():
        if group.attrib.get("vertex") != "1":
            continue
        style = group.attrib.get("style", "")
        if "group" not in style:
            continue
        gx, gy = absolute_xy(group_id)
        label = ""
        marker = None
        for child in children.get(group_id, []):
            child_style = child.attrib.get("style", "")
            child_value = clean_value(child.attrib.get("value", ""))
            if child_value and not child_value.isdigit():
                label = child_value
            if "ellipse" in child_style:
                marker = child
        if not label.upper().startswith("B."):
            continue
        marker_color = ""
        mx = gx
        my = gy
        if marker is not None:
            marker_style = marker.attrib.get("style", "")
            marker_color = style_value(marker_style, "fillColor") or style_value(marker_style, "strokeColor")
            marker_geom = marker.find("mxGeometry")
            if marker_geom is not None:
                child_x, child_y, child_w, child_h = geom_xy(marker)
                mx = gx + child_x + child_w / 2
                my = gy + child_y + child_h / 2
        devices.append(
            {
                "floor_code": "basement",
                "floor_name": "Basement",
                "device_tag": label,
                "device_type": infer_device_type(label, ""),
                "x": f"{mx:.2f}",
                "y": f"{my:.2f}",
                "marker_color": marker_color,
                "source_group_id": group_id,
                "status": "Grouped device extracted from Joey edited draw.io",
            }
        )
    devices.sort(key=lambda row: (row["device_type"], row["device_tag"]))
    return devices


if __name__ == "__main__":
    main()
