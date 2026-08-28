from __future__ import annotations

import csv
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import unquote
from xml.sax.saxutils import escape as xml_escape

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image as ReportImage,
    KeepTogether,
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "outputs" / "rmt-fire-local-data"
MIMIC_ROOT = DATA_ROOT / "mimic-library"
MASTER_PATH = DATA_ROOT / "device-master" / "wetex-wetex-device-master.json"
MANIFEST_PATH = MIMIC_ROOT / "mimic-library-app-data.json"
RUN_DIR = DATA_ROOT / "inspection-runs"
TMP_DIR = ROOT / "tmp" / "pdfs" / "wetex-demo"
OUT_DIR = ROOT / "output" / "pdf"
RUN_JSON = RUN_DIR / "wetex-demo-inspection-run.json"
ACTIVITY_CSV = RUN_DIR / "wetex-demo-staff-activity.csv"
RESULT_CSV = RUN_DIR / "wetex-demo-inspection-results.csv"
CUSTOMER_PDF = OUT_DIR / "wetex-customer-demo-inspection-report.pdf"
BACKEND_PDF = OUT_DIR / "wetex-backend-staff-tracking-demo-report.pdf"
REPORT_DATE = "7 August 2026"
INSPECTOR = "Demo Technician"
SUPERVISOR = "Demo Supervisor"
SITE_GPS = "2.05042, 102.56891"


TYPE_COLORS = {
    "Main Fire Alarm Panel": "#0f172a",
    "Sprinkler Panel": "#15803d",
    "Wet Riser Panel": "#0f766e",
    "CO2 System": "#64748b",
    "Flow Switch": "#0891b2",
    "Hose Reel": "#0ea5e9",
    "Manual Call Point": "#dc2626",
    "Smoke Detector": "#2563eb",
    "Heat Detector": "#ef4444",
    "Emergency Light": "#f59e0b",
    "Exit Sign": "#16a34a",
}

TYPE_CODES = {
    "Main Fire Alarm Panel": "MFAP",
    "Sprinkler Panel": "SPP",
    "Wet Riser Panel": "WRP",
    "CO2 System": "CO2",
    "Flow Switch": "FS",
    "Hose Reel": "HR",
    "Manual Call Point": "MCP",
    "Smoke Detector": "SD",
    "Heat Detector": "HD",
    "Emergency Light": "EL",
    "Exit Sign": "EX",
}

ACTIVE_TYPES = {
    "Main Fire Alarm Panel",
    "Sprinkler Panel",
    "Wet Riser Panel",
    "CO2 System",
}

FLOOR_ORDER = {
    "WETEX-01 / LG": 1,
    "WETEX-02 / Ground": 2,
    "WETEX-03 / L1": 3,
    "WETEX-04 / L2": 4,
    "WETEX-05 / L3": 5,
    "WETEX-06 / L5": 6,
    "WETEX-07 / L6": 7,
    "WETEX-08 / L7": 8,
    "WETEX-09 / L8": 9,
    "WETEX - L9 (Existing 08)": 10,
    "WETEX - Rooftop (Existing 09)": 11,
}

CHECKLISTS = {
    "Main Fire Alarm Panel": [
        "Panel normal before test",
        "Power supply, standby battery and charger checked",
        "Panel lamp/buzzer/mimic indication tested",
        "Panel reset to normal after test",
    ],
    "Sprinkler Panel": [
        "Pump/starter panel power and indicators normal",
        "Valve position and system pressure checked",
        "Manual/auto operation verified where permitted",
        "Selector restored to AUTO after test",
    ],
    "Wet Riser Panel": [
        "Panel power and indicators normal",
        "Valve position and pressure checked",
        "Manual/auto operation verified where permitted",
        "Selector restored to AUTO after test",
    ],
    "CO2 System": [
        "Client/FM informed before test",
        "Discharge isolation confirmed before alarm simulation",
        "Alarm/strobe/tripping output checked without discharge",
        "System restored to normal after test",
    ],
    "Flow Switch": [
        "Flow switch body and wiring condition checked",
        "Flow signal received at fire alarm panel",
        "Zone/location indication correct",
    ],
    "Hose Reel": [
        "Hose reel cabinet and signage visible",
        "Hose/nozzle/valve condition checked",
        "Access clear from obstruction",
        "Auto operation tested where permitted",
    ],
    "Manual Call Point": [
        "Call point visible and accessible",
        "Glass/reset element condition checked",
        "Activation received at fire alarm panel",
        "Point reset after test",
    ],
    "Smoke Detector": [
        "Detector condition and cleanliness checked",
        "Test signal received at fire alarm panel",
        "Zone/address and mimic indication correct",
    ],
    "Heat Detector": [
        "Detector condition checked",
        "Heat test signal received at fire alarm panel",
        "Zone/address and mimic indication correct",
    ],
    "Emergency Light": [
        "Fitting condition checked",
        "Charging indicator checked",
        "Emergency operation tested",
        "Battery backup condition acceptable",
    ],
    "Exit Sign": [
        "Sign visible and not obstructed",
        "Lamp/LED illumination checked",
        "Arrow/wording correct",
        "Battery/charger indicator acceptable",
    ],
}

FIRE_ALARM_SOP = [
    ("1", "Client / FM informed", "Confirmed", "FM Young - alarm test window approved 09:00-12:00"),
    ("2", "Panel status photo before test", "Completed", "Photo recorded with timestamp"),
    ("3", "Set Silence / Alarm Test mode", "Completed", "Panel placed in test/silence mode"),
    ("4", "Switch off all tripping outputs", "Completed", "Lift, A/C and smoke control relay isolation confirmed by supervisor"),
    ("5", "Check panel power and battery", "Completed", "AC normal / battery 26.8V / charger normal"),
    ("6", "Test selected MCP / detector points", "Completed", "All selected points logged with start/end time"),
    ("7", "Test sounder only within approved window", "Completed", "Short bell test permitted by FM"),
    ("8", "Reset and restore all isolations", "Completed", "Final panel normal photo recorded"),
]

CO2_SOP = [
    ("1", "Client / FM informed", "Completed", "Protected area and no-discharge test explained"),
    ("2", "Protected room checked", "Completed", "No occupant, no hot work, room safe"),
    ("3", "Before panel/status photo", "Completed", "Photo recorded"),
    ("4", "Isolate gas discharge switch", "Completed", "Isolation switch photo recorded"),
    ("5", "Remove discharge cable safely", "Completed", "Cable removed and insulated"),
    ("6", "Remove actuator/solenoid head", "Completed", "Photo recorded"),
    ("7", "Supervisor confirmation before alarm test", "Red Flag", "Supervisor PIN not entered before technician attempted next step"),
    ("8", "Alarm simulation", "Blocked", "App should block until Step 7 is completed"),
    ("9", "Restore final normal", "Pending", "Do not close until supervisor confirms restoration"),
]

PUMP_SOP = [
    ("1", "Client / FM informed", "Completed", "Water system test allowed"),
    ("2", "Panel photo before test", "Completed", "SPP/WRP before photo recorded"),
    ("3", "Check water supply / tank", "Completed", "Tank and incoming supply sufficient"),
    ("4", "Check suction/delivery valves", "Completed", "Valve fully open, photo recorded"),
    ("5", "Check incoming 3-phase supply", "Completed", "R-Y 415V / Y-B 414V / B-R 416V"),
    ("6", "Manual / auto test", "Completed", "Operation tested, readings logged"),
    ("7", "Selector returned to AUTO", "Completed", "Final photo recorded"),
    ("8", "Final pressure and panel normal", "Completed", "Supervisor close-out recorded"),
]

CO2_ROOM_DETAILS = {
    "GRD.CO2.1": {
        "room": "TNB Room",
        "agent": "CO2",
        "panelVoltage": "26.49 VDC",
        "dischargeVoltage": "Not continued",
        "cylinders": "3",
        "year": "2023",
        "remark": "Supervisor gate missing. Alarm simulation must stop before discharge output test.",
    },
    "GRD.CO2.2": {
        "room": "Genset Room",
        "agent": "CO2",
        "panelVoltage": "24.60 VDC",
        "dischargeVoltage": "23.75 VDC",
        "cylinders": "3",
        "year": "2016",
        "remark": "No discharge. Panel restored normal after test.",
    },
    "LG.CO2.1": {
        "room": "Transformer Room",
        "agent": "CO2",
        "panelVoltage": "24.84 VDC",
        "dischargeVoltage": "21.70 VDC",
        "cylinders": "5",
        "year": "2023",
        "remark": "No discharge. Isolation and final normal photo recorded.",
    },
    "LG.CO2.2": {
        "room": "Consumer LV Room",
        "agent": "CO2",
        "panelVoltage": "28.15 VDC",
        "dischargeVoltage": "23.41 VDC",
        "cylinders": "3",
        "year": "2016",
        "remark": "No discharge. Manual key switch and flashing light checked.",
    },
    "LG.CO2.3": {
        "room": "Consumer Transformer Room",
        "agent": "CO2",
        "panelVoltage": "24.00 VDC",
        "dischargeVoltage": "23.67 VDC",
        "cylinders": "3",
        "year": "2016",
        "remark": "No discharge. Discharge circuit proof recorded.",
    },
    "R.CO2.1": {
        "room": "Rooftop SSB",
        "agent": "CO2",
        "panelVoltage": "27.58 VDC",
        "dischargeVoltage": "23.75 VDC",
        "cylinders": "1",
        "year": "To confirm",
        "remark": "No discharge. Rooftop protected room restored normal.",
    },
}

PUMP_SYSTEM_DETAILS = {
    "LG.SPP.1": {
        "systemName": "Automatic Sprinkler System",
        "panelName": "Sprinkler pump panel",
        "tank": "Sprinkler water storage tank and incoming supply checked",
        "readings": [
            ("Jockey", "140 PSI", "160 PSI"),
            ("Duty", "110 PSI", "Manual stop"),
            ("Standby", "80 PSI", "Manual stop"),
        ],
        "remark": "Selector returned to AUTO. Final pressure and panel normal recorded.",
    },
    "LG.WRP.1": {
        "systemName": "Wet Riser System",
        "panelName": "Wet riser pump panel",
        "tank": "Wet riser water storage tank and supply checked",
        "readings": [
            ("Jockey", "150 PSI", "235 PSI"),
            ("Duty", "130 PSI", "230 PSI"),
            ("Standby", "100 PSI", "230 PSI"),
        ],
        "remark": "Selector returned to AUTO. Final panel normal recorded.",
    },
}

HOSE_REEL_PRESSURE_READINGS = [
    ("Duty", "150 PSI", "Manual stop"),
    ("Standby", "100 PSI", "Manual stop"),
]


styles = getSampleStyleSheet()
TITLE = ParagraphStyle(
    "RmtTitle",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=20,
    leading=24,
    textColor=colors.HexColor("#09245a"),
    alignment=TA_LEFT,
    spaceAfter=6,
)
H1 = ParagraphStyle(
    "RmtH1",
    parent=styles["Heading1"],
    fontName="Helvetica-Bold",
    fontSize=14,
    leading=17,
    textColor=colors.HexColor("#09245a"),
    spaceBefore=8,
    spaceAfter=5,
)
H2 = ParagraphStyle(
    "RmtH2",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=11,
    leading=14,
    textColor=colors.HexColor("#0f172a"),
    spaceBefore=7,
    spaceAfter=4,
)
BODY = ParagraphStyle(
    "RmtBody",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=8.6,
    leading=11,
    textColor=colors.HexColor("#162033"),
)
SMALL = ParagraphStyle(
    "RmtSmall",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=7.2,
    leading=9,
    textColor=colors.HexColor("#334155"),
)
TINY = ParagraphStyle(
    "RmtTiny",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=6.4,
    leading=8,
    textColor=colors.HexColor("#334155"),
)
CENTER = ParagraphStyle(
    "RmtCenter",
    parent=BODY,
    alignment=TA_CENTER,
)
CALLOUT = ParagraphStyle(
    "RmtCallout",
    parent=BODY,
    fontName="Helvetica-Bold",
    textColor=colors.HexColor("#7f1d1d"),
    backColor=colors.HexColor("#fee2e2"),
    borderColor=colors.HexColor("#fecaca"),
    borderPadding=6,
    borderRadius=3,
    spaceBefore=5,
    spaceAfter=5,
)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def p(text: str, style: ParagraphStyle = BODY) -> Paragraph:
    return Paragraph(xml_escape(str(text)), style)


def table_text(value, style: ParagraphStyle = SMALL) -> Paragraph:
    return Paragraph(xml_escape(str(value)), style)


def make_table(data, widths=None, font_size=7.2, header=True, long=False):
    header_style = ParagraphStyle(
        f"Header{font_size}",
        fontName="Helvetica-Bold",
        fontSize=font_size,
        leading=font_size + 2,
        textColor=colors.white,
    )
    body_style = ParagraphStyle(
        f"Body{font_size}",
        fontName="Helvetica",
        fontSize=font_size,
        leading=font_size + 2,
        textColor=colors.HexColor("#162033"),
    )
    converted = []
    for row_index, row in enumerate(data):
        row_style = header_style if header and row_index == 0 else body_style
        converted.append([table_text(cell, row_style) for cell in row])
    table_class = LongTable if long else Table
    table = table_class(converted, colWidths=widths, repeatRows=1 if header else 0)
    table_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#09245a") if header else colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d9e2ef")),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        for row_index in range(1, len(data)):
            table_style.append(
                (
                    "BACKGROUND",
                    (0, row_index),
                    (-1, row_index),
                    colors.HexColor("#f8fafc") if row_index % 2 == 0 else colors.white,
                )
            )
    table.setStyle(TableStyle(table_style))
    return table


def font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def slug(value: str) -> str:
    out = "".join(char.lower() if char.isalnum() else "-" for char in str(value))
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-") or "item"


def url_to_path(url: str) -> Path:
    prefix = "/local-data/mimic-library/"
    if not url.startswith(prefix):
        return MIMIC_ROOT / url
    return MIMIC_ROOT / unquote(url[len(prefix):])


def floor_sort_key(name: str) -> tuple[int, str]:
    return (FLOOR_ORDER.get(name, 999), name)


def tag_sort_key(device: dict) -> tuple:
    floor = floor_sort_key(device.get("floor", ""))
    tag = str(device.get("tag", ""))
    parts = tag.replace(",", ".").split(".")
    device_code = parts[1] if len(parts) > 1 else ""
    try:
        number = int(parts[2]) if len(parts) > 2 else 0
    except ValueError:
        number = 0
    return (*floor, device_code, number, tag)


def minutes_for_type(device_type: str) -> int:
    if device_type in ACTIVE_TYPES:
        return {"CO2 System": 18}.get(device_type, 20)
    if device_type == "Hose Reel":
        return 7
    if device_type == "Flow Switch":
        return 6
    if device_type == "Manual Call Point":
        return 4
    if device_type in {"Smoke Detector", "Heat Detector"}:
        return 3
    return 2


def select_scope(devices: list[dict]) -> list[dict]:
    active = [device for device in devices if device.get("type") in ACTIVE_TYPES]
    passive = [device for device in devices if device.get("type") not in ACTIVE_TYPES]

    selected: list[dict] = []
    selected.extend(sorted(active, key=tag_sort_key))

    by_floor: dict[str, list[dict]] = defaultdict(list)
    for device in passive:
        by_floor[device.get("floor", "")].append(device)

    for floor_name in sorted(by_floor, key=floor_sort_key):
        floor_devices = sorted(by_floor[floor_name], key=tag_sort_key)
        target = max(2, math.ceil(len(floor_devices) * 0.10))
        step = max(1, len(floor_devices) // target)
        picked = floor_devices[::step][:target]
        selected.extend(picked)

    must_include_tags = {"GRD.FS.2", "L2.HR.3", "L5.SD.4", "L6.MCP.7", "L8.EX.10", "L9.EL.8"}
    by_tag = {device.get("tag"): device for device in devices}
    for tag in sorted(must_include_tags):
        if tag in by_tag and by_tag[tag] not in selected:
            selected.append(by_tag[tag])

    unique = {}
    for device in selected:
        unique[device["tag"]] = device
    return sorted(unique.values(), key=tag_sort_key)


def result_for(device: dict) -> dict:
    tag = device.get("tag", "")
    defects = {
        "GRD.FS.2": (
            "P1",
            "Fail",
            "Flow switch signal not received at MFAP during demo test.",
            "Check wiring/module and retest water flow indication.",
            "before+after",
        ),
        "L2.HR.3": (
            "P2",
            "Fail",
            "Hose reel nozzle missing from cabinet.",
            "Supply replacement nozzle and update quotation.",
            "before-only",
        ),
        "L5.SD.4": (
            "P2",
            "Fail",
            "Smoke detector response slow/dirty during test.",
            "Clean chamber or replace detector head, then retest.",
            "before+after",
        ),
        "L8.EX.10": (
            "P2",
            "Fail",
            "Exit sign illumination dim.",
            "Replace LED strip/driver and retest emergency mode.",
            "before+after",
        ),
        "L9.EL.8": (
            "P2",
            "Fail",
            "Emergency light battery did not hold during test.",
            "Replace battery pack and retest backup duration.",
            "before-only",
        ),
    }
    if tag in defects:
        priority, status, finding, action, photo_rule = defects[tag]
        return {
            "priority": priority,
            "status": status,
            "finding": finding,
            "action": action,
            "photoRule": photo_rule,
        }
    return {
        "priority": "-",
        "status": "Pass",
        "finding": "Checked and tested normal in WETEX demo run.",
        "action": "-",
        "photoRule": "none",
    }


def make_demo_photo(path: Path, title: str, lines: list[str], color: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGB", (1000, 740), "#f8fafc")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 1000, 92), fill=color)
    draw.text((34, 24), "RMT FIRE INSPECTION APPS - DEMO PHOTO", fill="white", font=font(28))
    draw.rounded_rectangle((42, 126, 958, 510), radius=16, fill="white", outline="#d9e2ef", width=3)
    draw.text((76, 158), title, fill="#0f172a", font=font(34))
    y = 222
    for line in lines:
        draw.text((80, y), line, fill="#334155", font=font(24))
        y += 44
    draw.rounded_rectangle((76, 545, 924, 660), radius=14, fill="#e9f1ff", outline="#bfdbfe", width=2)
    draw.text((105, 578), "Timestamp, site, staff, GPS and device tag are burned into each photo.", fill="#09245a", font=font(23))
    image.save(path, quality=88, optimize=True)


def build_evidence(row: dict, start_time: datetime, status_color: str) -> dict:
    tag = row["tag"]
    rule = row["photoRule"]
    if rule == "none":
        return {"before": "", "after": ""}
    common = [
        f"Site: WETEX",
        f"Floor: {row['floor']}",
        f"Device: {tag} - {row['type']}",
        f"Inspected by: {INSPECTOR}",
        f"Date/time: {start_time.strftime('%Y-%m-%d %H:%M')}",
        f"GPS: {SITE_GPS}",
    ]
    before_path = TMP_DIR / "evidence" / f"{slug(tag)}-before.jpg"
    make_demo_photo(before_path, "Before / defect proof", common + [f"Finding: {row['finding']}"], status_color)
    after_path = ""
    if rule == "before+after":
        after_time = start_time + timedelta(minutes=minutes_for_type(row["type"]))
        after = TMP_DIR / "evidence" / f"{slug(tag)}-after.jpg"
        make_demo_photo(
            after,
            "After / follow-up proof",
            common[:4] + [f"Date/time: {after_time.strftime('%Y-%m-%d %H:%M')}", f"GPS: {SITE_GPS}", "Action pending supervisor/quotation approval"],
            "#0d4aa3",
        )
        after_path = str(after)
    return {"before": str(before_path), "after": after_path}


def build_critical_tracking(results: list[dict]) -> dict:
    active_rows = [
        row
        for row in results
        if row.get("type") in {"CO2 System", "Sprinkler Panel", "Wet Riser Panel", "Main Fire Alarm Panel"}
    ]
    co2_rows = [row for row in active_rows if row.get("type") == "CO2 System"]
    pump_rows = [row for row in active_rows if row.get("type") in {"Sprinkler Panel", "Wet Riser Panel"}]
    panel_rows = [row for row in active_rows if row.get("type") == "Main Fire Alarm Panel"]

    co2_tests = []
    for index, row in enumerate(sorted(co2_rows, key=tag_sort_key), start=1):
        is_hold = row["tag"] == "GRD.CO2.1"
        room_detail = CO2_ROOM_DETAILS.get(row["tag"], {})
        co2_tests.append(
            {
                "tag": row["tag"],
                "floor": row["floor"],
                "location": row["location"],
                "room": room_detail.get("room", row["location"] or row["tag"]),
                "agent": room_detail.get("agent", "CO2 / clean agent"),
                "panelVoltage": room_detail.get("panelVoltage", "24 VDC normal"),
                "dischargeVoltage": room_detail.get("dischargeVoltage", "24 VDC output checked"),
                "cylinders": room_detail.get("cylinders", "To confirm"),
                "year": room_detail.get("year", "To confirm"),
                "startTime": row["startTime"],
                "endTime": row["endTime"],
                "status": "Hold - supervisor PIN missing before alarm simulation" if is_hold else "Completed - no discharge",
                "priority": "Critical" if is_hold else "OK",
                "isolationSwitch": "Confirmed isolated",
                "dischargeCable": "Removed and insulated",
                "actuator": "Removed / safe position",
                "supervisorGate": "Missing before simulation" if is_hold else "Confirmed by supervisor",
                "delayReading": "Not continued - app should block" if is_hold else f"{21 + index} sec",
                "finalNormal": "Pending supervisor close-out" if is_hold else "Normal restored",
                "evidence": "Before/status photo required, isolation photo, final normal photo",
                "backendRule": "Do not allow next step until supervisor confirmation is entered." if is_hold else "No discharge, restore normal and record final photo.",
                "customerRemark": room_detail.get("remark", "No discharge. System restored normal after test."),
            }
        )

    pump_tests = []
    for row in sorted(pump_rows, key=tag_sort_key):
        detail = PUMP_SYSTEM_DETAILS.get(row["tag"], {})
        panel_type = detail.get("panelName") or ("Sprinkler pump panel" if row["type"] == "Sprinkler Panel" else "Wet riser pump panel")
        pump_tests.append(
            {
                "tag": row["tag"],
                "system": panel_type,
                "systemName": detail.get("systemName", panel_type.title()),
                "floor": row["floor"],
                "location": row["location"],
                "startTime": row["startTime"],
                "endTime": row["endTime"],
                "status": "Completed - panel normal",
                "priority": "OK",
                "waterSupply": detail.get("tank", "Tank and incoming supply sufficient"),
                "valves": "Suction/delivery valves fully open",
                "power": "3-phase checked: R-Y 415V / Y-B 414V / B-R 416V",
                "readings": detail.get("readings", [("Jockey", "110 PSI", "140 PSI"), ("Duty", "95 PSI", "Manual stop"), ("Standby", "80 PSI", "Manual stop")]),
                "cutInOut": ", ".join(f"{name} {cut_in}/{cut_out}" for name, cut_in, cut_out in detail.get("readings", [("Jockey", "110 PSI", "140 PSI"), ("Duty", "95 PSI", "Manual stop"), ("Standby", "80 PSI", "Manual stop")])),
                "selector": "Returned to AUTO",
                "finalNormal": detail.get("remark", "Final pressure and panel normal confirmed"),
            }
        )

    panel_tests = []
    for row in sorted(panel_rows, key=tag_sort_key):
        panel_tests.append(
            {
                "tag": row["tag"],
                "system": "Main Fire Alarm Panel",
                "floor": row["floor"],
                "startTime": row["startTime"],
                "endTime": row["endTime"],
                "status": "Completed - panel normal",
                "priority": "OK",
                "power": "AC normal / battery 26.8V / charger normal",
                "tripping": "Isolation and restoration recorded",
                "finalNormal": "Panel reset normal",
            }
        )

    summary = []
    for item in co2_tests:
        summary.append(
            {
                "system": "CO2 / Gas Discharge",
                "tag": item["tag"],
                "floor": item["floor"],
                "status": item["status"],
                "priority": item["priority"],
                "startTime": item["startTime"],
                "endTime": item["endTime"],
                "requiredAction": item["backendRule"],
            }
        )
    for item in pump_tests:
        summary.append(
            {
                "system": item["system"],
                "tag": item["tag"],
                "floor": item["floor"],
                "status": item["status"],
                "priority": item["priority"],
                "startTime": item["startTime"],
                "endTime": item["endTime"],
                "requiredAction": "Keep pump selectors in AUTO and final normal photo before closure.",
            }
        )
    for item in panel_tests:
        summary.append(
            {
                "system": item["system"],
                "tag": item["tag"],
                "floor": item["floor"],
                "status": item["status"],
                "priority": item["priority"],
                "startTime": item["startTime"],
                "endTime": item["endTime"],
                "requiredAction": "Panel must be reset normal and all tripping restored before leaving.",
            }
        )

    return {
        "summary": sorted(summary, key=lambda row: (row["priority"] != "Critical", row["system"], row["tag"])),
        "co2Tests": co2_tests,
        "pumpTests": pump_tests,
        "panelTests": panel_tests,
    }


def build_run() -> dict:
    master = load_json(MASTER_PATH)
    devices = master.get("devices", [])
    scope = select_scope(devices)
    installed_counts = Counter(device.get("type", "Unknown") for device in devices)
    scope_counts = Counter(device.get("type", "Unknown") for device in scope)
    activity: list[dict] = []
    results: list[dict] = []

    now = datetime(2026, 8, 7, 8, 26)

    def add_event(kind: str, detail: str, floor: str = "-", tag: str = "-", flag: str = "-", minutes: int = 0):
        nonlocal now
        event = {
            "time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "kind": kind,
            "floor": floor,
            "tag": tag,
            "detail": detail,
            "gps": SITE_GPS,
            "staff": INSPECTOR,
            "flag": flag,
        }
        activity.append(event)
        now += timedelta(minutes=minutes)

    add_event("Check-in", "Arrived at WETEX and checked in with GPS.", minutes=4)
    add_event("Briefing", "FM informed, permit-to-test and alarm window confirmed.", minutes=8)
    add_event("App scope", "Monthly scope generated: 10% passive devices plus 100% active systems.", minutes=2)

    current_floor = ""
    for sequence, device in enumerate(scope, 1):
        floor = device.get("floor", "-")
        if floor != current_floor:
            add_event("Floor start", f"Opened mimic floor {floor}.", floor=floor, minutes=2)
            current_floor = floor

        start = now
        tag = device.get("tag", "")
        result = result_for(device)
        duration = minutes_for_type(device.get("type", ""))
        fast_flag = ""
        if tag == "L6.MCP.7":
            duration = 1
            fast_flag = "Review: completed unusually fast"
        add_event("Device start", f"Started {tag} - {device.get('type')}.", floor=floor, tag=tag)
        add_event("Checklist tick", f"Answered checklist for {tag}.", floor=floor, tag=tag, flag=fast_flag, minutes=duration)
        end = now

        row = {
            "sequence": sequence,
            "tag": tag,
            "type": device.get("type", ""),
            "floor": floor,
            "location": device.get("location") or "Location to be refined by admin",
            "xPercent": device.get("xPercent"),
            "yPercent": device.get("yPercent"),
            "pin": f"{device.get('xPercent', '-')}, {device.get('yPercent', '-')}",
            "status": result["status"],
            "priority": result["priority"],
            "finding": result["finding"],
            "action": result["action"],
            "startTime": start.strftime("%Y-%m-%d %H:%M:%S"),
            "endTime": end.strftime("%Y-%m-%d %H:%M:%S"),
            "durationMinutes": int((end - start).total_seconds() // 60),
            "gps": SITE_GPS,
            "inspectedBy": INSPECTOR,
            "answers": CHECKLISTS.get(device.get("type", ""), ["General condition checked"]),
            "evidence": {},
            "trackingFlag": fast_flag,
            "photoRule": result["photoRule"],
        }
        row["evidence"] = build_evidence(row, start, "#dc2626" if row["status"] == "Fail" else "#0d4aa3")
        results.append(row)
        add_event("Device saved", f"Saved {tag} result as {row['status']}.", floor=floor, tag=tag, flag=row["priority"] if row["status"] == "Fail" else "-", minutes=1)

    add_event("SOP hold", "CO2 alarm simulation attempted before supervisor PIN; app should block continuation.", floor="WETEX-02 / Ground", tag="GRD.CO2.1", flag="Critical")
    add_event("Supervisor review", "Supervisor reviewed red flags, failed items and missing evidence before customer report.", flag="Required", minutes=18)
    add_event("Check-out", "Technician checked out from WETEX.", minutes=0)

    defects = [row for row in results if row["status"] == "Fail"]
    missing_evidence = [
        {
            "tag": row["tag"],
            "issue": "After photo missing for failed item",
            "required": "Add after-repair/close-out photo before closing quotation or repair",
            "priority": "P1" if row["priority"] == "P1" else "P2",
        }
        for row in defects
        if row["photoRule"] == "before-only"
    ]
    mos_flags = [
        {
            "priority": "Critical",
            "system": "CO2 System",
            "issue": "Supervisor confirmation missing before alarm simulation step.",
            "tag": "GRD.CO2.1",
            "required": "Supervisor PIN/sign-off before alarm simulation. App should block next step.",
        }
    ]
    speed_flags = [
        {
            "priority": "Review",
            "tag": row["tag"],
            "issue": f"Device completed in {row['durationMinutes']} minute(s).",
            "required": "Supervisor to confirm test was genuinely performed.",
        }
        for row in results
        if row["trackingFlag"]
    ]

    started = datetime.strptime(activity[0]["time"], "%Y-%m-%d %H:%M:%S")
    ended = datetime.strptime(activity[-1]["time"], "%Y-%m-%d %H:%M:%S")
    total_minutes = int((ended - started).total_seconds() // 60)
    critical_tracking = build_critical_tracking(results)

    run = {
        "runId": "WETEX-DEMO-20260807-001",
        "clientName": "WETEX",
        "siteName": "WETEX",
        "serviceType": "Monthly maintenance demo - 10% passive + 100% active",
        "date": REPORT_DATE,
        "inspector": INSPECTOR,
        "supervisor": SUPERVISOR,
        "gps": SITE_GPS,
        "startedAt": activity[0]["time"],
        "endedAt": activity[-1]["time"],
        "totalMinutes": total_minutes,
        "installedDeviceCount": len(devices),
        "scopeDeviceCount": len(results),
        "passCount": len([row for row in results if row["status"] == "Pass"]),
        "failCount": len(defects),
        "installedCounts": dict(installed_counts),
        "scopeCounts": dict(scope_counts),
        "results": results,
        "activity": activity,
        "redFlags": {
            "mosSequence": mos_flags,
            "missingEvidence": missing_evidence,
            "speedReview": speed_flags,
            "faults": [
                {
                    "priority": row["priority"],
                    "tag": row["tag"],
                    "system": row["type"],
                    "floor": row["floor"],
                    "issue": row["finding"],
                    "action": row["action"],
                }
                for row in defects
            ],
        },
        "criticalTracking": critical_tracking,
        "sopAudit": {
            "fireAlarm": FIRE_ALARM_SOP,
            "co2": CO2_SOP,
            "pump": PUMP_SOP,
        },
        "reportUrls": {
            "customer": "/reports/wetex-customer-demo-inspection-report.pdf",
            "backend": "/reports/wetex-backend-staff-tracking-demo-report.pdf",
        },
    }
    return run


def write_run_files(run: dict) -> None:
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    RUN_JSON.write_text(json.dumps(run, indent=2), encoding="utf-8")
    with ACTIVITY_CSV.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=["time", "staff", "kind", "floor", "tag", "detail", "gps", "flag"])
        writer.writeheader()
        writer.writerows(run["activity"])
    with RESULT_CSV.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(
            stream,
            fieldnames=[
                "sequence",
                "tag",
                "type",
                "floor",
                "location",
                "pin",
                "status",
                "priority",
                "finding",
                "action",
                "startTime",
                "endTime",
                "durationMinutes",
                "gps",
                "inspectedBy",
                "trackingFlag",
            ],
        )
        writer.writeheader()
        for row in run["results"]:
            writer.writerow({key: row.get(key, "") for key in writer.fieldnames})


def floor_image_map() -> dict[str, Path]:
    manifest = load_json(MANIFEST_PATH)
    mapping = {}
    for floor in manifest.get("floors", []):
        if floor.get("companyName") == "WETEX":
            src = floor.get("cleanSrc") or floor.get("src")
            if src:
                mapping[floor.get("title")] = url_to_path(src)
    return mapping


def create_pin_map(floor_name: str, source: Path, rows: list[dict], suffix: str) -> Path:
    image = Image.open(source).convert("RGB")
    draw = ImageDraw.Draw(image)
    radius = max(10, image.width // 95)
    label_font = font(max(12, image.width // 110))
    for row in rows:
        try:
            x = float(row.get("xPercent", 0)) * image.width / 100
            y = float(row.get("yPercent", 0)) * image.height / 100
        except (TypeError, ValueError):
            continue
        color = "#dc2626" if row.get("status") == "Fail" else TYPE_COLORS.get(row.get("type"), "#64748b")
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color, outline="white", width=3)
        label = row.get("tag", "")
        short = TYPE_CODES.get(row.get("type"), label.split(".")[1] if "." in label else "DEV")
        draw.rounded_rectangle((x + radius + 3, y - radius, x + radius + 90, y + radius), radius=5, fill="white", outline="#d9e2ef")
        draw.text((x + radius + 8, y - radius + 3), short[:6], fill="#0f172a", font=label_font)
    draw.rounded_rectangle((14, 14, min(image.width - 14, 780), 62), radius=8, fill="white", outline="#d9e2ef")
    draw.text((28, 28), f"{floor_name} - WETEX demo inspected pins", fill="#0f172a", font=font(20))
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    out = TMP_DIR / f"{slug(floor_name)}-{suffix}.png"
    image.save(out, optimize=True)
    return out


def fit_image(path: Path | str, max_width: float, max_height: float) -> ReportImage:
    with Image.open(path) as image:
        width, height = image.size
    scale = min(max_width / width, max_height / height)
    return ReportImage(str(path), width=width * scale, height=height * scale)


def mimic_map_card(floor_name: str, image_path: Path) -> Table:
    card = Table(
        [
            [p(floor_name, H2)],
            [fit_image(image_path, 82 * mm, 72 * mm)],
        ],
        colWidths=[86 * mm],
    )
    card.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d9e2ef")),
                ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#f8fafc")),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return card


def append_customer_mimic_reference(story: list, rows_by_floor: dict, floor_sources: dict[str, Path]) -> None:
    cards = []
    for floor_name in sorted(rows_by_floor, key=floor_sort_key):
        if floor_name not in floor_sources:
            continue
        image_path = create_pin_map(floor_name, floor_sources[floor_name], rows_by_floor[floor_name], "customer")
        cards.append(mimic_map_card(floor_name, image_path))

    story.append(PageBreak())
    story.append(p("Mimic Map Reference", TITLE))
    story.append(p("Four floor references are grouped per page. These maps only indicate the checked areas; detailed audit maps remain in the backend copy.", BODY))
    if not cards:
        story.append(Spacer(1, 5))
        story.append(p("No inspected mimic maps available for this run.", BODY))
        return

    for index in range(0, len(cards), 4):
        if index:
            story.append(PageBreak())
            story.append(p("Mimic Map Reference - Continued", H1))
        page_cards = cards[index:index + 4]
        while len(page_cards) < 4:
            page_cards.append(Spacer(1, 1))
        grid = Table(
            [
                [page_cards[0], page_cards[1]],
                [page_cards[2], page_cards[3]],
            ],
            colWidths=[89 * mm, 89 * mm],
            rowHeights=[103 * mm, 103 * mm],
        )
        grid.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        story.append(Spacer(1, 5))
        story.append(grid)


def footer(canvas, doc):
    canvas.saveState()
    width, _height = doc.pagesize
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.setFont("Helvetica", 7)
    canvas.drawString(14 * mm, 8 * mm, "RMT Fire Inspection Apps - WETEX demo report - not an actual signed service record")
    canvas.drawRightString(width - 14 * mm, 8 * mm, f"Page {doc.page}")
    canvas.restoreState()


def kpi(title: str, value: str, note: str):
    return Paragraph(
        f"<font size='17'><b>{xml_escape(value)}</b></font><br/>"
        f"<font size='8'><b>{xml_escape(title)}</b></font><br/>"
        f"<font size='7'>{xml_escape(note)}</font>",
        CENTER,
    )


def result_counts_by_type(run: dict):
    rows = run["results"]
    data = [["System / Device Type", "Installed", "In Scope", "Pass", "Fail", "Quick Status"]]
    by_type = defaultdict(list)
    for row in rows:
        by_type[row["type"]].append(row)
    for device_type in sorted(run["installedCounts"]):
        scoped = by_type.get(device_type, [])
        fail = len([row for row in scoped if row["status"] == "Fail"])
        status = "Attention" if fail else ("Checked" if scoped else "Not in monthly sample")
        data.append([
            device_type,
            run["installedCounts"].get(device_type, 0),
            len(scoped),
            len(scoped) - fail,
            fail,
            status,
        ])
    return data


def defect_rows(run: dict, limit: int | None = None):
    data = [["Priority", "Tag", "System", "Floor", "Finding", "Recommended Action"]]
    defects = [row for row in run["results"] if row["status"] == "Fail"]
    visible = defects[:limit] if limit else defects
    for row in visible:
        data.append([row["priority"], row["tag"], row["type"], row["floor"], row["finding"], row["action"]])
    return data


def critical_summary_rows(run: dict):
    data = [["Priority", "System", "Tag", "Floor", "Critical Status", "Required Action"]]
    for row in run.get("criticalTracking", {}).get("summary", []):
        data.append(
            [
                row.get("priority", "-"),
                row.get("system", "-"),
                row.get("tag", "-"),
                row.get("floor", "-"),
                row.get("status", "-"),
                row.get("requiredAction", "-"),
            ]
        )
    if len(data) == 1:
        data.append(["-", "Critical Systems", "-", "-", "No critical active system captured in this run.", "-"])
    return data


def critical_customer_rows(run: dict):
    tracking = run.get("criticalTracking", {})
    co2_tests = tracking.get("co2Tests", [])
    pump_tests = tracking.get("pumpTests", [])
    panel_tests = tracking.get("panelTests", [])
    co2_hold = [row for row in co2_tests if row.get("priority") == "Critical"]
    pump_hold = [row for row in pump_tests if row.get("priority") == "Critical"]
    panel_hold = [row for row in panel_tests if row.get("priority") == "Critical"]
    return [
        ["Critical System", "Checked", "Status", "Attention / Remark"],
        [
            "CO2 / Gas Discharge",
            len(co2_tests),
            "Hold" if co2_hold else "Completed",
            "; ".join(f"{row['tag']} - {row['supervisorGate']}" for row in co2_hold) or "No discharge. Final normal photos recorded.",
        ],
        [
            "Pump / Water System",
            len(pump_tests),
            "Hold" if pump_hold else "Completed",
            "; ".join(f"{row['tag']} - {row['status']}" for row in pump_hold) or "Sprinkler and wet riser panels recorded with AUTO/final normal close-out.",
        ],
        [
            "Main Fire Alarm Panel",
            len(panel_tests),
            "Hold" if panel_hold else "Completed",
            "; ".join(f"{row['tag']} - {row['status']}" for row in panel_hold) or "Panel reset normal and tripping restoration recorded.",
        ],
    ]


def count_result(run: dict, device_type: str, status: str | None = None) -> int:
    rows = [row for row in run["results"] if row["type"] == device_type]
    if status:
        rows = [row for row in rows if row["status"] == status]
    return len(rows)


def critical_method_table(rows: list[list[str]], long: bool = False):
    return make_table(
        [["No", "Check / Test Item", "Result", "Reading / Value", "Remark / Action"]] + rows,
        [10 * mm, 72 * mm, 20 * mm, 34 * mm, 44 * mm],
        font_size=6.2,
        long=long,
    )


def pressure_reading_table(title: str, rows: list[tuple[str, str, str]]):
    data = [["Pump", "Cut In", "Cut Out / Stop", "Remark"]]
    for pump, cut_in, cut_out in rows:
        data.append([pump, cut_in, cut_out, "Recorded during demo report run"])
    return [p(title, H2), make_table(data, [34 * mm, 34 * mm, 34 * mm, 76 * mm], font_size=6.8)]


def customer_system_snapshot(title: str, rows: list[list[str]]):
    return [
        p(title, H2),
        make_table(
            [["Item", "Detail", "Result", "Remark"]] + rows,
            [36 * mm, 52 * mm, 24 * mm, 66 * mm],
            font_size=6.6,
        ),
    ]


def append_customer_mfap_section(story: list, run: dict) -> None:
    panel_tests = run.get("criticalTracking", {}).get("panelTests", [])
    panel = panel_tests[0] if panel_tests else {}
    story.append(PageBreak())
    story.append(p("Critical Systems Full Report", TITLE))
    story.append(
        p(
            "The customer copy keeps the quick summary at the front, but critical systems are shown in full because a skipped step can create false discharge, pump failure, or incorrect alarm operation.",
            BODY,
        )
    )
    story.append(p("Main Fire Alarm Control Panel", H1))
    story.extend(
        customer_system_snapshot(
            "System Snapshot",
            [
                ["System type", "Addressable / semi-addressable / conventional", "To confirm", "First-time site setup field to be completed by admin"],
                ["Model / brand", "Panel master record", "To confirm", "Will print here once entered in device master"],
                ["Zone using / spare zone", "Zone count and spare capacity", "To confirm", "Useful for future addition and quotation"],
                ["MFAP tag", panel.get("tag", "GRD.MFAP.1"), panel.get("status", "Checked"), panel.get("finalNormal", "Panel reset normal")],
            ],
        )
    )
    rows = [
        ["1", "Check power supply, standby battery and charger of master control panel", "Pass", panel.get("power", "AC normal / battery 26.8 VDC"), "Voltage/photo proof recorded"],
        ["2", "Check and test control panel setting, mimic panel and bulbs test", "Pass", "Yes", "Panel indication matched tested devices"],
        ["3", "Before device test, confirm Silence / Alarm Test mode", "Pass", "Silence/Test mode", "Avoid nuisance alarm during servicing"],
        ["4", "Switch off all tripping outputs before alarm test", "Pass", panel.get("tripping", "Tripping isolation recorded"), "Lift, A/C, roller shutter, smoke spill, pressurizing fan to be confirmed with FM"],
        ["5", "Test manual break glass call points in monthly scope", "Pass", f"{count_result(run, 'Manual Call Point')} tested", "Per-device results remain in device register"],
        ["6", "Test smoke / heat detectors in monthly scope", "Attention", f"{count_result(run, 'Smoke Detector') + count_result(run, 'Heat Detector')} tested", "Failed detector items shown in defect section"],
        ["7", "Test fire alarm bells / indication where permitted", "Pass", "Short test window", "Client/FM permission required before sounder test"],
        ["8", "Check pump, flow switch and gas release indications at MFAP", "Attention", "Flow switch fail found", "See defect and water/gas system sections"],
        ["9", "Reset panel and restore all isolations", "Pass", panel.get("finalNormal", "Panel reset normal"), "Final normal photo required before leaving site"],
    ]
    story.append(critical_method_table(rows))


def append_customer_hose_reel_section(story: list, run: dict) -> None:
    hose_rows = [row for row in run["results"] if row["type"] == "Hose Reel"]
    failed = [row for row in hose_rows if row["status"] == "Fail"]
    story.append(PageBreak())
    story.append(p("Hose Reel System / Hose Reel Pump", H1))
    story.extend(
        customer_system_snapshot(
            "System Snapshot",
            [
                ["Total hose reels in master", str(run["installedCounts"].get("Hose Reel", 0)), "Info", "Device master count"],
                ["Checked this visit", str(len(hose_rows)), "Attention" if failed else "Pass", "Monthly random scope plus forced defect sample"],
                ["Defect count", str(len(failed)), "Attention" if failed else "Pass", "; ".join(f"{row['tag']} - {row['finding']}" for row in failed) or "No hose reel defect in checked sample"],
                ["Pump readings", "Duty / standby pressure", "Recorded", "Cut-in values shown below"],
            ],
        )
    )
    rows = [
        ["1", "Check hose reel water tank and incoming water supply", "Pass", "Sufficient", "Tank/supply available before pump test"],
        ["2", "Check suction and delivery gate valves of pumps at open position", "Pass", "Fully open", "Photo proof required for pump room"],
        ["3", "Check power supply of pump starter panel", "Pass", "R-Y 415V / Y-B 414V / B-R 416V", "Measure all phases before testing"],
        ["4", "Check general setting of pump starter panel", "Pass", "Auto/manual selector normal", "Do not proceed if panel fault present"],
        ["5", "Test run duty pump on manual mode of operation", "Pass", "Manual run OK", "Record sound/vibration/pressure"],
        ["6", "Test run duty pump on auto mode of operation", "Pass", "Auto run OK", "Cut-in reading recorded"],
        ["7", "Check starting battery and charger for standby pump", "Pass", "Battery/charger normal", "Record voltage during actual app workflow"],
        ["8", "Check standby diesel engine fuel and lubrication oil", "Pass", "Fuel/oil checked", "High/low fuel to be captured with photo"],
        ["9", "Test run standby pump on manual mode of operation", "Pass", "Manual run OK", "Record abnormal noise/leakage"],
        ["10", "Test run standby pump on auto mode of operation", "Pass", "Auto run OK", "Cut-in reading recorded"],
        ["11", "Check system piping, valves and fittings", "Pass", "No visible leak", "Remark any corrosion/leakage"],
        ["12", "Check all hose reel, rubber hose and nozzle", "Attention" if failed else "Pass", f"{len(failed)} defect", "; ".join(f"{row['tag']} - {row['finding']}" for row in failed) or "Checked sample normal"],
        ["13", "Test hose reel on auto mode of operation where permitted", "Pass", "Auto mode OK", "Flow test to be approved by client/FM"],
    ]
    story.append(critical_method_table(rows, long=True))
    story.append(Spacer(1, 4))
    story.extend(pressure_reading_table("Pump Cut-In / Cut-Out Reading", HOSE_REEL_PRESSURE_READINGS))
    if hose_rows:
        data = [["No", "Tag", "Floor / Location", "Hose", "Nozzle", "Valve / Key", "Remarks"]]
        for index, row in enumerate(sorted(hose_rows, key=tag_sort_key), start=1):
            data.append([
                index,
                row["tag"],
                f"{row['floor']} / {row['location']}",
                "Pass",
                "Fail" if row["status"] == "Fail" else "Pass",
                "Pass",
                row["finding"] if row["status"] == "Fail" else "Checked normal",
            ])
        story.append(Spacer(1, 4))
        story.append(p("Checked Hose Reel Location Detail", H2))
        story.append(make_table(data, [9 * mm, 22 * mm, 54 * mm, 18 * mm, 20 * mm, 24 * mm, 31 * mm], font_size=5.8, long=True))


def append_customer_co2_section(story: list, run: dict) -> None:
    co2_tests = run.get("criticalTracking", {}).get("co2Tests", [])
    story.append(PageBreak())
    story.append(p("CO2 / FM200 / Gas Release System Full Report", H1))
    story.append(
        p(
            "For gas systems, this customer report shows the no-discharge test records. The backend app must block alarm simulation until isolation, discharge cable removal, actuator safety and supervisor confirmation are completed.",
            BODY,
        )
    )
    overview = [["Room / Area", "Tag", "Panel V", "Supervisor Gate", "Delay", "Output", "Cylinder", "Result / Remark"]]
    for row in sorted(co2_tests, key=tag_sort_key):
        overview.append([
            row.get("room", row.get("location", "-")),
            row.get("tag", "-"),
            row.get("panelVoltage", "-"),
            row.get("supervisorGate", "-"),
            row.get("delayReading", "-"),
            row.get("dischargeVoltage", "-"),
            f"{row.get('cylinders', '-')} cyl / {row.get('year', '-')}",
            row.get("customerRemark", row.get("status", "-")),
        ])
    if len(overview) == 1:
        overview.append(["No gas system captured", "-", "-", "-", "-", "-", "-", "-"])
    story.append(make_table(overview, [28 * mm, 18 * mm, 19 * mm, 27 * mm, 23 * mm, 23 * mm, 24 * mm, 38 * mm], font_size=5.4, long=True))
    story.append(Spacer(1, 5))
    rows = [
        ["1", "Check power supply, standby battery and charger of master control panel", "Pass", "Panel V recorded per room", "Voltage shown in room table"],
        ["2", "Check and test control panel setting and bulbs test", "Pass", "Yes", "Lamp/buzzer indication checked"],
        ["3", "Check panel control / CPU operation", "Pass", "CPU normal", "Do not continue if panel fault present"],
        ["4", "Isolate gas discharge switch", "Pass", "Confirmed isolated", "Critical photo proof before simulation"],
        ["5", "Check pilot cylinder meter indication", "Pass", "Pass", "Pressure/indicator to be captured when available"],
        ["6", "Remove discharge cable safely", "Pass", "Removed and insulated", "Do not short circuit"],
        ["7", "Remove pyrocharge / solenoid head where applicable", "Pass", "Removed / safe position", "Photo proof required"],
        ["8", "Supervisor confirmation before alarm simulation", "Attention", "One hold item", "GRD.CO2.1 attempted without supervisor PIN"],
        ["9", "Turn knob to Test Alarm for 2-zone test", "Blocked/Pass", "See room table", "Blocked where supervisor gate is missing"],
        ["10", "Record gas release delay timing", "Pass/Hold", "20-30 sec target", "No actual discharge in maintenance test"],
        ["11", "Check tripping devices such as fan or fire curtain", "Pass", "Alarm mode checked", "Confirm with client/FM before test"],
        ["12", "Check alarm bell and flashing light indication", "Pass", "Bell/light checked", "Record any faulty lamp/bell"],
        ["13", "Check 24 VDC supply at discharge output", "Pass/Hold", "Output V recorded", "Only after safe isolation and approval"],
        ["14", "Check manual key switch / manual puller", "Pass", "Checked", "Manual puller condition checked without pulling"],
        ["15", "Reset panel to normal and wait 10 sec before reconnecting discharge cable", "Pass/Hold", "Final normal", "Hold item requires supervisor close-out"],
        ["16", "Record cylinder year of manufacture and number of cylinders", "Recorded", "See room table", "Useful for future replacement planning"],
    ]
    story.append(critical_method_table(rows, long=True))


def append_customer_pump_section(story: list, run: dict, pump: dict) -> None:
    story.append(PageBreak())
    story.append(p(pump.get("systemName", pump.get("system", "Pump System")), H1))
    story.extend(
        customer_system_snapshot(
            "System Snapshot",
            [
                ["Panel tag", pump.get("tag", "-"), pump.get("status", "Checked"), pump.get("location", "-")],
                ["Water / tank", pump.get("waterSupply", "-"), "Pass", "Must be checked before pump operation"],
                ["Valve position", pump.get("valves", "-"), "Pass", "Suction and delivery gate valves open"],
                ["Power supply", pump.get("power", "-"), "Pass", "Measure incoming 3-phase before test"],
            ],
        )
    )
    rows = [
        ["1", f"Check {pump.get('systemName', 'system')} water storage tank and supply", "Pass", pump.get("waterSupply", "Sufficient"), "Do not start pump if supply is not available"],
        ["2", "Check suction and delivery gate valves at open position", "Pass", pump.get("valves", "Fully open"), "Photo proof required"],
        ["3", "Check power supply of pump starter panel", "Pass", pump.get("power", "3-phase checked"), "Measure all phases before testing"],
        ["4", "Check general setting of pump starter panel", "Pass", "Panel normal", "Auto/manual selector checked"],
        ["5", "Test run duty pump on manual mode of operation", "Pass", "Manual run OK", "Record abnormal sound/vibration/leak"],
        ["6", "Test run duty pump on auto mode of operation", "Pass", "Auto run OK", "Cut-in reading recorded"],
        ["7", "Check standby pump engine starting battery and charger", "Pass", "Battery/charger normal", "Voltage to be recorded in actual workflow"],
        ["8", "Check standby pump diesel engine fuel and lubrication oil", "Pass", "Fuel/oil checked", "Low fuel/oil must create red flag"],
        ["9", "Test run standby pump on manual mode of operation", "Pass", "Manual run OK", "Record pressure"],
        ["10", "Test run standby pump on auto mode of operation", "Pass", "Auto run OK", "Cut-in reading recorded"],
        ["11", "Test run jockey pump on manual mode of operation", "Pass", "Manual run OK", "Applicable for sprinkler/wet riser/pressurized hydrant"],
        ["12", "Test run jockey pump on auto mode of operation", "Pass", "Auto run OK", "Cut-in/cut-out reading recorded"],
        ["13", "Check all zone isolating butterfly valves at open position", "Pass", "Open", "For sprinkler/wet riser floors and zones"],
        ["14", "Set pump selectors back to AUTO after testing", "Pass", pump.get("selector", "Returned to AUTO"), "Final normal photo required before close"],
    ]
    story.append(critical_method_table(rows, long=True))
    story.append(Spacer(1, 4))
    story.extend(pressure_reading_table("Pump Cut-In / Cut-Out Reading", pump.get("readings", [])))
    story.append(Spacer(1, 3))
    story.append(p(pump.get("finalNormal", "Final panel normal recorded."), SMALL))


def append_customer_hydrant_section(story: list) -> None:
    story.append(PageBreak())
    story.append(p("Pressurized Hydrant System", H1))
    story.append(
        p(
            "WETEX legacy report includes pressurized hydrant checks. The current pinned master does not yet have separate hydrant panel/device pins, so this section is included as the full customer-report template and will populate from pins once added.",
            BODY,
        )
    )
    rows = [
        ["1", "Ensure pillar hydrants are not obstructed", "Pass", "Visual check", "Record photo if obstructed"],
        ["2", "Ensure no unauthorized usage of hydrant is permitted", "Pass", "Visual check", "Remark any tampering"],
        ["3", "Check cabinet key is in position and glass is not broken", "Pass", "Key/glass checked", "Create defect if missing"],
        ["4", "Ensure canvas hose and nozzle are kept in cabinet", "Pass", "Hose/nozzle available", "Record missing item for quotation"],
        ["5", "Ensure hydrant valve is shut when not in use", "Pass", "Valve shut", "Abnormal open/leak is urgent"],
        ["6", "Check canvas hose, nozzle and hydrant valve condition", "Pass", "Condition checked", "Record leakage/corrosion"],
        ["7", "Check hydrant water storage tank and supply", "To capture", "Tank/supply", "Pump-room photo required"],
        ["8", "Check suction and delivery gate valve at open position", "To capture", "Valve position", "Photo proof required"],
        ["9", "Check power supply and general setting of pump starter panel", "To capture", "3-phase reading", "Measure all phases"],
        ["10", "Test jockey, duty and standby pumps on manual and auto mode", "To capture", "Cut-in/cut-out", "Selector must return to AUTO"],
    ]
    story.append(critical_method_table(rows, long=True))
    story.append(Spacer(1, 4))
    location_rows = [
        ["No", "Location", "Hydrant Hose", "O Ring", "Key Lock", "Cabinet Glass", "Landing Valve", "Nozzle", "Remarks"],
        ["1", "AHU 1", "Pass", "Pass", "Pass", "Pass", "Pass", "Pass", "Legacy WETEX report sample"],
        ["2", "Shopping", "Pass", "Pass", "Pass", "Pass", "Pass", "Pass", "Legacy WETEX report sample"],
        ["3", "Shopping", "Pass", "Pass", "Pass", "Pass", "Pass", "Pass", "Legacy WETEX report sample"],
    ]
    story.append(p("Hydrant Location Detail", H2))
    story.append(make_table(location_rows, [8 * mm, 28 * mm, 20 * mm, 16 * mm, 18 * mm, 22 * mm, 22 * mm, 18 * mm, 28 * mm], font_size=5.4))


def append_customer_future_critical_templates(story: list) -> None:
    story.append(PageBreak())
    story.append(p("Other Critical System Templates Ready", H1))
    story.append(
        p(
            "These systems are not pinned in the current WETEX demo master. When your team adds Wet Chemical, FM200 or other gas-release pins, the customer report should use these full sections automatically instead of a short summary only.",
            BODY,
        )
    )
    wet_chemical = [
        ["1", "Record panel/agent tank location, brand/model and system type", "To capture", "Panel and tank data", "First-time setup field"],
        ["2", "Record hood protected area and hood size", "To capture", "Hood size", "Important for kitchen expansion/quotation"],
        ["3", "Record wet chemical cylinder size and expiry/service date", "To capture", "Cylinder size/date", "Photo of cylinder label required"],
        ["4", "Count nozzles and confirm nozzle caps/aiming", "To capture", "Nozzle count", "Missing cap/nozzle creates defect"],
        ["5", "Check manual release, gas valve shut-off and micro-switch", "To capture", "Pass/Fail", "No false release during maintenance"],
        ["6", "Confirm final normal and safety pin/seal restored", "To capture", "Final photo", "Supervisor close-out for critical system"],
    ]
    story.append(p("Wet Chemical System", H2))
    story.append(critical_method_table(wet_chemical))
    story.append(Spacer(1, 5))
    fm200 = [
        ["1", "Record protected room, agent type, cylinder count and serial numbers", "To capture", "Agent/cylinder data", "FM200 / clean agent master data"],
        ["2", "Check power supply, standby battery and charger", "To capture", "VDC reading", "Panel reading required"],
        ["3", "Isolate discharge and remove discharge cable safely", "To capture", "Isolation proof", "Block next step if not completed"],
        ["4", "Remove actuator/solenoid head where applicable", "To capture", "Safe position", "Photo proof required"],
        ["5", "Test 2-zone alarm, sounder, strobe and tripping output", "To capture", "Delay sec / output V", "No actual discharge"],
        ["6", "Reset panel and restore discharge cable after 10 sec normal condition", "To capture", "Final normal", "Supervisor approval required"],
    ]
    story.append(p("FM200 / Clean Agent Release System", H2))
    story.append(critical_method_table(fm200))


def append_customer_critical_sections(story: list, run: dict) -> None:
    append_customer_mfap_section(story, run)
    append_customer_hose_reel_section(story, run)
    append_customer_co2_section(story, run)
    for pump in sorted(run.get("criticalTracking", {}).get("pumpTests", []), key=tag_sort_key):
        append_customer_pump_section(story, run, pump)
    append_customer_hydrant_section(story)
    append_customer_future_critical_templates(story)


def build_customer_pdf(run: dict) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    floor_sources = floor_image_map()
    rows_by_floor = defaultdict(list)
    for row in run["results"]:
        rows_by_floor[row["floor"]].append(row)

    story = [
        p("RMT Fire Inspection Apps", TITLE),
        p("WETEX Customer Summary Report", H1),
        p(
            "This customer copy starts with a fast system outlook. Detailed tested devices, defect photos and mimic references continue after the summary.",
            BODY,
        ),
    ]
    story.append(
        make_table(
            [
                ["Client / Site", "WETEX / WETEX", "Service", run["serviceType"]],
                ["Inspection date", REPORT_DATE, "Inspector", INSPECTOR],
                ["Overall status", "Follow-up required", "Report type", "Customer copy - demo"],
            ],
            [32 * mm, 58 * mm, 32 * mm, 58 * mm],
            font_size=8,
            header=False,
        )
    )
    story.append(Spacer(1, 6))
    story.append(
        Table(
            [
                [
                    kpi("Installed Devices", str(run["installedDeviceCount"]), "Total WETEX device master"),
                    kpi("Checked This Visit", str(run["scopeDeviceCount"]), "Monthly sample + active systems"),
                    kpi("Passed", str(run["passCount"]), "No follow-up"),
                ],
                [
                    kpi("Failed / Defect", str(run["failCount"]), "Quotation / repair review"),
                    kpi("Missing Evidence", str(len(run["redFlags"]["missingEvidence"])), "Backend hold item"),
                    kpi("Time On Site", f"{run['totalMinutes']} min", "Check-in to check-out"),
                ],
            ],
            colWidths=[58 * mm, 58 * mm, 58 * mm],
            rowHeights=[24 * mm, 24 * mm],
            style=[
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d9e2ef")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ],
        )
    )
    story.append(Spacer(1, 7))
    story.append(p("System Outlook", H2))
    story.append(make_table(result_counts_by_type(run), [44 * mm, 22 * mm, 22 * mm, 18 * mm, 18 * mm, 56 * mm], font_size=6.8))
    story.append(Spacer(1, 7))
    story.append(p("Critical System Summary", H2))
    story.append(
        make_table(
            critical_customer_rows(run),
            [42 * mm, 18 * mm, 28 * mm, 102 * mm],
            font_size=6.6,
        )
    )
    story.append(Spacer(1, 7))
    story.append(p("Defect / Quotation Follow-Up - Top 3", H2))
    story.append(make_table(defect_rows(run, limit=3), [18 * mm, 22 * mm, 30 * mm, 30 * mm, 47 * mm, 43 * mm], font_size=6.3))

    append_customer_critical_sections(story, run)

    story.append(PageBreak())
    story.append(p("Defect Photo Reference", TITLE))
    for row in [item for item in run["results"] if item["status"] == "Fail"]:
        block = [
            p(f"{row['tag']} - {row['type']}", H2),
            make_table(
                [["Finding", row["finding"]], ["Action", row["action"]], ["Floor / Pin", f"{row['floor']} / {row['pin']}"]],
                [32 * mm, 148 * mm],
                font_size=7.4,
                header=False,
            ),
            Spacer(1, 3),
        ]
        photo_cells = []
        for label in ["before", "after"]:
            path = row["evidence"].get(label)
            if path:
                photo_cells.append(fit_image(path, 85 * mm, 56 * mm))
            else:
                photo_cells.append(p(f"{label.title()} photo pending", CENTER))
        photos = Table([["Before Photo", "After Photo"], photo_cells], colWidths=[88 * mm, 88 * mm], rowHeights=[8 * mm, 58 * mm])
        photos.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d9e2ef")),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("FONTSIZE", (0, 0), (-1, 0), 7),
                ]
            )
        )
        block.append(photos)
        block.append(Spacer(1, 8))
        story.append(KeepTogether(block))

    append_customer_mimic_reference(story, rows_by_floor, floor_sources)

    story.append(PageBreak())
    story.append(p("Checked Device Register", TITLE))
    data = [["No", "Tag", "Type", "Floor", "Result", "Finding / Remarks"]]
    for row in run["results"]:
        data.append([row["sequence"], row["tag"], row["type"], row["floor"], row["status"], row["finding"]])
    story.append(make_table(data, [10 * mm, 22 * mm, 30 * mm, 34 * mm, 18 * mm, 76 * mm], font_size=6.2, long=True))

    doc = SimpleDocTemplate(
        str(CUSTOMER_PDF),
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=13 * mm,
        bottomMargin=14 * mm,
        title="WETEX Customer Demo Inspection Report",
        author="RMT Fire Inspection Apps",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return CUSTOMER_PDF


def exception_overview(run: dict):
    data = [
        ["Backend Exception", "Count", "Supervisor Action"],
        ["Tech did not follow MOS / sequence", len(run["redFlags"]["mosSequence"]), "Stop/hold affected system until supervisor closes it."],
        ["Missing required evidence", len(run["redFlags"]["missingEvidence"]), "Require photo, reading, remark or approval before closure."],
        ["Faulty / malfunction item", len(run["redFlags"]["faults"]), "Confirm defect and prepare quotation if needed."],
        ["Unusually fast test", len(run["redFlags"]["speedReview"]), "Review time and ask technician to justify/redo test."],
        ["Critical system left open", 1, "CO2 step remains blocked until supervisor confirmation is entered."],
    ]
    return make_table(data, [70 * mm, 24 * mm, 120 * mm], font_size=7.8)


def red_flag_table(title: str, rows: list[dict], columns: list[tuple[str, str]], widths):
    data = [[heading for heading, _key in columns]]
    if not rows:
        data.append(["OK"] + ["-" for _ in columns[1:]])
    for row in rows:
        data.append([row.get(key, "-") for _heading, key in columns])
    return [p(title, H2), make_table(data, widths, font_size=6.8)]


def critical_tracking_table(run: dict):
    return make_table(
        critical_summary_rows(run),
        [18 * mm, 38 * mm, 24 * mm, 34 * mm, 58 * mm, 70 * mm],
        font_size=6.5,
        long=True,
    )


def co2_testing_table(run: dict):
    data = [["Tag", "Floor", "Status", "Isolation", "Cable", "Actuator", "Supervisor Gate", "Delay", "Final Normal"]]
    for row in run.get("criticalTracking", {}).get("co2Tests", []):
        data.append(
            [
                row.get("tag", "-"),
                row.get("floor", "-"),
                row.get("status", "-"),
                row.get("isolationSwitch", "-"),
                row.get("dischargeCable", "-"),
                row.get("actuator", "-"),
                row.get("supervisorGate", "-"),
                row.get("delayReading", "-"),
                row.get("finalNormal", "-"),
            ]
        )
    if len(data) == 1:
        data.append(["-", "-", "No CO2 system captured", "-", "-", "-", "-", "-", "-"])
    return make_table(
        data,
        [18 * mm, 28 * mm, 44 * mm, 25 * mm, 28 * mm, 28 * mm, 38 * mm, 25 * mm, 31 * mm],
        font_size=5.4,
        long=True,
    )


def pump_testing_table(run: dict):
    data = [["Tag", "System", "Floor", "Status", "Water", "Valves", "Power", "Cut In/Out", "Selector / Final"]]
    for row in run.get("criticalTracking", {}).get("pumpTests", []):
        data.append(
            [
                row.get("tag", "-"),
                row.get("system", "-"),
                row.get("floor", "-"),
                row.get("status", "-"),
                row.get("waterSupply", "-"),
                row.get("valves", "-"),
                row.get("power", "-"),
                row.get("cutInOut", "-"),
                f"{row.get('selector', '-')} / {row.get('finalNormal', '-')}",
            ]
        )
    if len(data) == 1:
        data.append(["-", "No pump panel captured", "-", "-", "-", "-", "-", "-", "-"])
    return make_table(
        data,
        [17 * mm, 30 * mm, 26 * mm, 32 * mm, 20 * mm, 30 * mm, 42 * mm, 32 * mm, 42 * mm],
        font_size=5.0,
        long=True,
    )


def sop_table(rows: list[tuple[str, str, str, str]], title: str):
    data = [["Seq", "Step", "Backend Status", "Proof / Remark"]]
    for seq, step, status, detail in rows:
        data.append([seq, step, status, detail])
    return [p(title, H2), make_table(data, [12 * mm, 70 * mm, 34 * mm, 98 * mm], font_size=6.8)]


def build_backend_pdf(run: dict) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    floor_sources = floor_image_map()
    rows_by_floor = defaultdict(list)
    for row in run["results"]:
        rows_by_floor[row["floor"]].append(row)

    story = [
        p("RMT Fire Inspection Apps", TITLE),
        p("WETEX Backend Staff Tracking & Red Flag Report", H1),
        p(
            "Internal copy for supervisor/admin. This report shows only what matters first: MOS sequence problems, missing proof, fast testing, faulty items, and staff movement timing.",
            BODY,
        ),
        p(
            "Supervisor rule: do not issue the customer report when this page has any P1/Critical red flag until the issue is checked, corrected, or approved.",
            CALLOUT,
        ),
        exception_overview(run),
        Spacer(1, 5),
    ]
    story.extend(
        red_flag_table(
            "1. MOS / Sequence Red Flags",
            run["redFlags"]["mosSequence"],
            [("Priority", "priority"), ("System", "system"), ("Tag", "tag"), ("Issue", "issue"), ("Required Action", "required")],
            [20 * mm, 34 * mm, 24 * mm, 76 * mm, 60 * mm],
        )
    )
    story.append(Spacer(1, 4))
    story.extend(
        red_flag_table(
            "2. Missing Evidence / Approval",
            run["redFlags"]["missingEvidence"],
            [("Priority", "priority"), ("Tag", "tag"), ("Evidence Problem", "issue"), ("Required Before Close", "required")],
            [24 * mm, 30 * mm, 76 * mm, 84 * mm],
        )
    )
    story.append(Spacer(1, 4))
    story.extend(
        red_flag_table(
            "3. Staff Tracking Review",
            run["redFlags"]["speedReview"],
            [("Priority", "priority"), ("Tag", "tag"), ("Issue", "issue"), ("Required Action", "required")],
            [24 * mm, 30 * mm, 76 * mm, 84 * mm],
        )
    )
    story.append(Spacer(1, 4))
    story.extend(
        red_flag_table(
            "4. Faulty / Malfunction Items",
            run["redFlags"]["faults"],
            [("Priority", "priority"), ("Tag", "tag"), ("System", "system"), ("Floor", "floor"), ("Issue", "issue"), ("Action", "action")],
            [18 * mm, 24 * mm, 30 * mm, 32 * mm, 62 * mm, 48 * mm],
        )
    )

    story.append(PageBreak())
    story.append(p("Staff Movement Summary", TITLE))
    story.append(
        make_table(
            [
                ["Staff", INSPECTOR, "Supervisor", SUPERVISOR],
                ["Check-in", run["startedAt"], "Check-out", run["endedAt"]],
                ["GPS", run["gps"], "Total site time", f"{run['totalMinutes']} minutes"],
                ["Checked devices", run["scopeDeviceCount"], "Average per device", f"{round(run['totalMinutes'] / max(1, run['scopeDeviceCount']), 1)} minutes including movement/SOP"],
            ],
            [28 * mm, 78 * mm, 28 * mm, 80 * mm],
            font_size=7.6,
            header=False,
        )
    )
    story.append(Spacer(1, 6))
    floor_rows = [["Floor / Area", "Devices Checked", "First Activity", "Last Activity"]]
    for floor_name in sorted({row["floor"] for row in run["results"]}, key=floor_sort_key):
        floor_events = [event for event in run["activity"] if event["floor"] == floor_name]
        floor_rows.append([
            floor_name,
            len([row for row in run["results"] if row["floor"] == floor_name]),
            floor_events[0]["time"] if floor_events else "-",
            floor_events[-1]["time"] if floor_events else "-",
        ])
    story.append(make_table(floor_rows, [58 * mm, 34 * mm, 58 * mm, 58 * mm], font_size=7.0))

    story.append(PageBreak())
    story.append(p("Critical System Tracking", TITLE))
    story.append(
        p(
            "Pump, CO2/gas discharge and main panel items are pulled out from the normal device register because they create higher risk if a step is skipped or left unrestored.",
            BODY,
        )
    )
    story.append(critical_tracking_table(run))

    story.append(PageBreak())
    story.append(p("CO2 / Gas Discharge Testing Report", TITLE))
    story.append(
        p(
            "This section is for the no-discharge test method. Alarm simulation must be blocked until isolation, discharge cable, actuator/solenoid head and supervisor confirmation are completed.",
            BODY,
        )
    )
    story.append(p("Critical rule: a missing supervisor gate means the app must stop the technician from continuing the CO2 alarm simulation.", CALLOUT))
    story.append(co2_testing_table(run))
    story.append(Spacer(1, 5))
    story.extend(sop_table(run["sopAudit"]["co2"], "CO2 Step-By-Step SOP Record"))

    story.append(PageBreak())
    story.append(p("Pump / Water System Testing Report", TITLE))
    story.append(
        p(
            "This section covers WETEX sprinkler and wet riser pump panels. It records water availability, valve position, 3-phase power, pump readings, selector restoration and final normal condition.",
            BODY,
        )
    )
    story.append(p("Critical rule: do not close the test until all selectors are returned to AUTO and final panel/pressure normal status is recorded.", CALLOUT))
    story.append(pump_testing_table(run))
    story.append(Spacer(1, 5))
    story.extend(sop_table(run["sopAudit"]["pump"], "Pump Step-By-Step SOP Record"))

    story.append(PageBreak())
    story.append(p("How Technician Ticked And Tested", TITLE))
    story.append(p("This is the backend trail: device start, checklist tick, save time, GPS and any review flag.", BODY))
    timeline = [["Time", "Staff", "Action", "Floor", "Tag", "Detail", "Flag"]]
    for event in run["activity"]:
        timeline.append([event["time"], event["staff"], event["kind"], event["floor"], event["tag"], event["detail"], event["flag"]])
    story.append(make_table(timeline, [25 * mm, 26 * mm, 25 * mm, 36 * mm, 24 * mm, 80 * mm, 28 * mm], font_size=5.8, long=True))

    story.append(PageBreak())
    story.append(p("Fire Alarm / Interface SOP Sequence Audit", TITLE))
    story.append(p("CO2 and pump/water system SOPs are shown in their dedicated critical testing report pages above.", BODY))
    story.extend(sop_table(run["sopAudit"]["fireAlarm"], "Fire Alarm / Tripping SOP"))

    story.append(PageBreak())
    story.append(p("Device Execution Register", TITLE))
    register = [["Seq", "Tag", "Type", "Floor", "Start", "End", "Min", "Result", "Evidence", "Flag"]]
    for row in run["results"]:
        evidence = []
        if row["evidence"].get("before"):
            evidence.append("Before")
        if row["evidence"].get("after"):
            evidence.append("After")
        register.append([
            row["sequence"],
            row["tag"],
            row["type"],
            row["floor"],
            row["startTime"][11:16],
            row["endTime"][11:16],
            row["durationMinutes"],
            row["status"],
            ", ".join(evidence) or "-",
            row["trackingFlag"] or row["priority"],
        ])
    story.append(make_table(register, [10 * mm, 24 * mm, 28 * mm, 34 * mm, 18 * mm, 18 * mm, 12 * mm, 18 * mm, 24 * mm, 48 * mm], font_size=5.8, long=True))

    story.append(PageBreak())
    story.append(p("Photo Evidence Audit", TITLE))
    for row in [item for item in run["results"] if item["status"] == "Fail"]:
        block = [
            p(f"{row['tag']} - {row['type']}", H2),
            make_table(
                [
                    ["Finding", row["finding"]],
                    ["Backend evidence", "Before/after photo required for failed item. Missing after photo remains a red flag."],
                    ["Start / end", f"{row['startTime']} to {row['endTime']}"],
                ],
                [36 * mm, 176 * mm],
                font_size=7.0,
                header=False,
            ),
            Spacer(1, 3),
        ]
        photo_cells = []
        for label in ["before", "after"]:
            path = row["evidence"].get(label)
            if path:
                photo_cells.append(fit_image(path, 95 * mm, 58 * mm))
            else:
                photo_cells.append(p(f"{label.title()} photo missing - red flag", CENTER))
        photos = Table([["Before Photo", "After Photo"], photo_cells], colWidths=[98 * mm, 98 * mm], rowHeights=[8 * mm, 60 * mm])
        photos.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d9e2ef")),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("FONTSIZE", (0, 0), (-1, 0), 7),
                ]
            )
        )
        block.append(photos)
        block.append(Spacer(1, 7))
        story.append(KeepTogether(block))

    for floor_name in sorted(rows_by_floor, key=floor_sort_key):
        if floor_name not in floor_sources:
            continue
        story.append(PageBreak())
        story.append(p(f"Backend Mimic Pin Audit - {floor_name}", TITLE))
        story.append(p("Green/colored pins passed. Red pins failed and need follow-up.", BODY))
        image_path = create_pin_map(floor_name, floor_sources[floor_name], rows_by_floor[floor_name], "backend")
        story.append(fit_image(image_path, 250 * mm, 150 * mm))

    story.append(PageBreak())
    story.append(p("Backend Sign-Off", TITLE))
    story.append(
        make_table(
            [
                ["Role", "Name", "Date / Time", "Confirmation"],
                ["Technician", INSPECTOR, "", "I confirm the recorded steps, times and photos are true for this demo run."],
                ["Supervisor", SUPERVISOR, "", "I reviewed MOS red flags, failed items, missing evidence and customer report readiness."],
                ["Admin", "", "", "Confirm quotation items and report issue approval."],
            ],
            [34 * mm, 46 * mm, 38 * mm, 96 * mm],
            font_size=7.2,
        )
    )

    doc = SimpleDocTemplate(
        str(BACKEND_PDF),
        pagesize=landscape(A4),
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=13 * mm,
        bottomMargin=13 * mm,
        title="WETEX Backend Staff Tracking Demo Report",
        author="RMT Fire Inspection Apps",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return BACKEND_PDF


def main() -> None:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    run = build_run()
    write_run_files(run)
    print(RUN_JSON)
    print(ACTIVITY_CSV)
    print(RESULT_CSV)
    print(build_customer_pdf(run))
    print(build_backend_pdf(run))


if __name__ == "__main__":
    main()
