from pathlib import Path
import csv
import re
import sys

sys.path.insert(0, str(Path(__file__).parent))
from dxf_preview import parse_dxf, collect_primitives


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
SRC = ROOT / "MIMIC-R1 2000.dxf"
OUT_DIR = ROOT / "outputs" / "mtb-mimic-list-extracted"

FLOOR_BOXES = [
    ("L1", "Level 1", 2060, -360, 2420, -150),
    ("L2", "Level 2", 2395, -360, 2765, -150),
    ("L3", "Level 3", 1900, -160, 2225, 35),
    ("L4-5", "Level 4-5 Typical", 2220, -160, 2465, 35),
    ("L6", "Level 6", 2485, -160, 2785, 35),
    ("L7", "Level 7", 1900, 25, 2225, 215),
    ("L8", "Level 8", 2210, 25, 2465, 215),
    ("L9", "Level 9", 2500, 25, 2785, 215),
    ("L10", "Level 10 Typical", 1900, 1010, 2175, 1218),
    ("L11", "Level 11 Typical", 1900, 850, 2175, 1010),
    ("L12", "Level 12 Typical", 1900, 690, 2175, 850),
    ("L13", "Level 13 Typical", 1900, 535, 2175, 690),
    ("L14", "Level 14 Typical", 1900, 380, 2175, 535),
    ("L15", "Level 15 Typical", 1900, 215, 2175, 380),
    ("L16", "Level 16 Typical", 2165, 1010, 2435, 1218),
    ("L17", "Level 17 Typical", 2165, 850, 2435, 1010),
    ("L18", "Level 18 Typical", 2165, 690, 2435, 850),
    ("L19", "Level 19 Typical", 2165, 535, 2435, 690),
    ("L20", "Level 20 Typical", 2165, 380, 2435, 535),
    ("L21", "Level 21 Typical", 2165, 215, 2435, 380),
    ("L22", "Level 22 Typical", 2440, 535, 2720, 690),
    ("L23", "Level 23 Typical", 2440, 380, 2720, 535),
    ("L24", "Level 24", 2440, 215, 2720, 380),
]

DEVICE_PATTERNS = [
    ("Wet Chemical System", re.compile(r"\bWCC\b|WET\s*CHEM", re.I)),
    ("Emergency Light", re.compile(r"\bEL\b|EMERGENCY\s*LIGHT", re.I)),
    ("Smoke Detector", re.compile(r"\bS\b|SMOKE", re.I)),
    ("Hose Reel", re.compile(r"\bH\b|HOSE\s*REEL", re.I)),
    ("Wet Riser", re.compile(r"\bWR\b|WET\s*RISER", re.I)),
    ("Fireman Intercom", re.compile(r"\bPA\b|FIREMAN\s*INTERCOM", re.I)),
    ("Flow Switch", re.compile(r"\bFS\b|FLOW\s*SWITCH", re.I)),
    ("CO2 System", re.compile(r"\bCO2\b", re.I)),
    ("Fire Alarm Panel", re.compile(r"\bMFAP\b|\bFAP\b|MAIN\s*FIRE\s*ALARM", re.I)),
    ("FM200 Panel", re.compile(r"\bFM\s*200\b|\bFM200\b", re.I)),
]


def clean_text(value):
    value = value.replace("\\P", " ").replace("\\~", " ")
    value = re.sub(r"\{[^;]*;", "", value)
    value = value.replace("}", "")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def in_box(x, y, box):
    _, _, min_x, min_y, max_x, max_y = box
    return min_x <= x <= max_x and min_y <= y <= max_y


def floor_for(x, y):
    for floor_code, floor_name, min_x, min_y, max_x, max_y in FLOOR_BOXES:
        if min_x <= x <= max_x and min_y <= y <= max_y:
            return floor_code, floor_name, (min_x, min_y, max_x, max_y)
    return "", "", None


def device_type_from_text(text):
    for label, pattern in DEVICE_PATTERNS:
        if pattern.search(text):
            return label
    if re.search(r"\bZ\.?\s*\d+|\bZ\d+\b", text, re.I):
        return "Fire Point / Zone Reference"
    return ""


def normalise_tag(text, floor_code, device_type):
    compact = re.sub(r"[^A-Za-z0-9.]+", ".", text.upper()).strip(".")
    if device_type == "Fire Point / Zone Reference":
        match = re.search(r"Z\.?\s*(\d+)", text, re.I)
        if match:
            return f"{floor_code}.Z{match.group(1)}"
    if compact.startswith(floor_code.upper() + "."):
        return compact
    return f"{floor_code}.{compact}" if floor_code else compact


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    entities = parse_dxf(str(SRC))
    _, _, texts, _ = collect_primitives(entities)
    rows = []
    raw_rows = []
    seen = set()
    for x, y, text in texts:
        text = clean_text(text)
        floor_code, floor_name, box = floor_for(x, y)
        raw_rows.append({"x": x, "y": y, "floor": floor_code, "text": text})
        if not floor_code:
            continue
        device_type = device_type_from_text(text)
        if not device_type:
            continue
        tag = normalise_tag(text, floor_code, device_type)
        key = (floor_code, tag, round(x, 3), round(y, 3))
        if key in seen:
            continue
        seen.add(key)
        min_x, min_y, max_x, max_y = box
        rows.append(
            {
                "floor_code": floor_code,
                "floor_name": floor_name,
                "device_tag": tag,
                "device_type": device_type,
                "source_text": text,
                "cad_x": f"{x:.4f}",
                "cad_y": f"{y:.4f}",
                "floor_x_pct": f"{(x - min_x) / (max_x - min_x):.6f}",
                "floor_y_pct_from_bottom": f"{(y - min_y) / (max_y - min_y):.6f}",
                "status": "Extracted from mimic list/DXF - needs review",
            }
        )

    for name, data in [
        ("mimic-list-device-master.csv", rows),
        ("mimic-list-all-text.csv", raw_rows),
    ]:
        with (OUT_DIR / name).open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(data[0].keys()) if data else ["empty"])
            writer.writeheader()
            writer.writerows(data)

    print(OUT_DIR)
    print(f"device rows: {len(rows)}")


if __name__ == "__main__":
    main()
