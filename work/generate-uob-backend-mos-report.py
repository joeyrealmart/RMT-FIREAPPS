from __future__ import annotations

import json
from datetime import datetime
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
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
MIMIC_ROOT = ROOT / "outputs" / "rmt-fire-local-data" / "mimic-library"
MASTER_PATH = ROOT / "outputs" / "rmt-fire-local-data" / "device-master" / "uob-uob-device-master.json"
MANIFEST_PATH = MIMIC_ROOT / "mimic-library-app-data.json"
TMP_DIR = ROOT / "tmp" / "pdfs" / "uob-backend-mos"
OUT_DIR = ROOT / "output" / "pdf"
OUT_PDF = OUT_DIR / "uob-backend-mos-test-report.pdf"
REPORT_DATE = "7 August 2026"


TYPE_COLORS = {
    "Main Fire Alarm Panel": "#111827",
    "Exit Sign": "#16a34a",
    "Emergency Light": "#f59e0b",
    "Heat Detector": "#ef4444",
    "Smoke Detector": "#2563eb",
    "Manual Call Point": "#dc2626",
    "Flow Switch": "#0891b2",
    "CO2 System": "#64748b",
}

TYPE_CODES = {
    "Main Fire Alarm Panel": "MFAP",
    "Exit Sign": "EX",
    "Emergency Light": "EL",
    "Heat Detector": "HD",
    "Smoke Detector": "SD",
    "Manual Call Point": "MCP",
    "Flow Switch": "FS",
    "CO2 System": "CO2",
}

CHECK_METHOD_BY_TYPE = {
    "Main Fire Alarm Panel": "Panel supply, standby battery, charger, mimic/bulb test, alarm test mode, reset and normal status.",
    "Manual Call Point": "Activate MCP, confirm alarm at panel/mimic, record zone/address, reset device and panel.",
    "Smoke Detector": "Apply detector test, confirm panel/mimic indication, reset detector/panel and record response.",
    "Heat Detector": "Apply heat test, confirm panel/mimic indication, reset detector/panel and record response.",
    "Emergency Light": "Check fitting condition, charging indicator and emergency operation.",
    "Exit Sign": "Check visibility, fitting condition, illumination and emergency operation.",
}

FIRE_ALARM_MOS = [
    ("1", "Permit to test", "Inform client / Facilities Manager, confirm test time, affected areas and person approving the test.", "Approval name/time in remarks.", "Required"),
    ("2", "Panel identification", "Record fire alarm panel type, brand/model, zone using and spare zone.", "Panel photo and panel details.", "Required"),
    ("3", "Test mode", "Before checking devices, make sure panel is set to Silence / Alarm Test mode where applicable.", "Panel status photo.", "Required"),
    ("4", "Tripping isolation", "Switch off / isolate all tripping outputs before device testing.", "Isolation photo and supervisor confirmation.", "Critical hold point"),
    ("5", "Power and battery", "Check power supply, standby battery and charger of the master control panel.", "Voltage/condition reading.", "Required"),
    ("6", "Panel and mimic check", "Check panel setting, mimic panel and bulb / LED test.", "Checklist tick and remark if abnormal.", "Required"),
    ("7", "Manual call point test", "Check and test every MCP in selected scope one by one.", "Each tested tag result.", "Required"),
    ("8", "Detector test", "Check and test smoke / heat detectors in selected scope one by one.", "Each tested tag result.", "Required"),
    ("9", "Alarm bell / sounder", "Check and test fire alarm bells only within approved testing window.", "Result and client permission note.", "Permission hold point"),
    ("10", "System indication", "Check fire fighting pump and gas release indication at main fire alarm panel where applicable.", "Result and photo where available.", "Required"),
    ("11", "Interface alarm mode", "Air-con, lift, roller shutter, smoke spill and pressurizing fan alarm mode only after double confirmation with FM.", "FM confirmation and result.", "Critical hold point"),
    ("12", "Restore normal", "Reinstate tripping outputs, reset panel and confirm no alarm/fault/isolate remains.", "Final normal photo and supervisor sign-off.", "Critical hold point"),
]

GAS_RELEASE_SOP = [
    ("1", "Client / FM informed", "Confirm responsible person knows the test scope, affected room, and no actual discharge will be performed.", "Remark"),
    ("2", "Protected room checked", "Confirm room is safe to test and no one is inside the protected area.", "Remark"),
    ("3", "System condition photo before test", "Take panel/status photo before touching isolation or actuator wiring.", "Photo"),
    ("4", "Isolate gas discharge switch", "Set gas discharge/isolate switch to safe test condition.", "Critical photo"),
    ("5", "Remove discharge cable", "Remove discharge cable safely. Do not short circuit. Confirm cable is protected.", "Critical photo"),
    ("6", "Remove pyrocharge / solenoid head", "Remove actuator/pyrocharge/solenoid head where applicable before alarm simulation.", "Critical photo"),
    ("7", "Supervisor confirmation before alarm test", "Supervisor or senior technician confirms discharge path is isolated before test alarm.", "Supervisor hold"),
    ("8", "Trigger first-zone alarm test", "Activate first detection zone and confirm panel indication / first stage alarm.", "Remark"),
    ("9", "Trigger second-zone alarm test", "Activate second detection zone and confirm pre-discharge sequence.", "Remark"),
    ("10", "Record discharge delay", "Record time delay. Expected delay commonly 20-30 seconds unless site design differs.", "Reading"),
    ("11", "Confirm outputs only, no discharge", "Confirm bell, strobe, shutdown/tripping device and indication operate without gas release.", "Critical remark"),
    ("12", "Reset panel and wait safe delay", "Reset panel to normal and wait at least 10 seconds before reconnection.", "Remark"),
    ("13", "Reconnect discharge cable / actuator", "Reconnect only after panel is normal and discharge risk is clear.", "Critical photo"),
    ("14", "Remove isolation and restore normal", "Set system back to normal operating condition.", "Critical photo"),
    ("15", "Final normal status confirmation", "Take final panel photo and confirm no fault, isolate, alarm, or disabled output remains.", "Supervisor hold"),
]

PUMP_SOP = [
    ("1", "Client / FM informed", "Confirm testing permission, affected system and discharge/drain area before starting.", "Remark"),
    ("2", "Panel condition photo before test", "Take photo of pump starter panel, selector positions and indicators before testing.", "Photo"),
    ("3", "Check incoming power supply", "Measure/check 3-phase supply where applicable before test run.", "Reading"),
    ("4", "Check valves open / system ready", "Confirm suction and delivery valves are open, no critical valve left shut.", "Critical remark"),
    ("5", "Record starting pressure", "Record current system pressure before running pumps.", "Reading"),
    ("6", "Run duty pump manual", "Test run duty pump on manual mode and record condition.", "Reading"),
    ("7", "Run duty pump auto", "Test duty pump auto operation and record cut-in/cut-out where applicable.", "Reading"),
    ("8", "Check standby battery/fuel/oil", "Check standby pump battery, charger, diesel fuel and lubrication oil where applicable.", "Remark"),
    ("9", "Run standby pump manual", "Test run standby pump on manual mode where applicable.", "Reading"),
    ("10", "Run standby pump auto", "Test standby pump auto operation and record cut-in/cut-out where applicable.", "Reading"),
    ("11", "Run jockey pump manual/auto", "Test jockey pump where applicable and record cut-in/cut-out pressure.", "Reading"),
    ("12", "Check leaks / abnormal sound", "Check piping, valves, fittings, vibration, leakage and abnormal noise.", "Remark"),
    ("13", "Selector returned to AUTO", "Confirm all pump selectors are returned to AUTO after testing.", "Critical photo"),
    ("14", "Final pressure and panel normal", "Record final pressure and confirm panel normal, no trip/fault left active.", "Supervisor hold"),
]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def url_to_path(url: str) -> Path:
    prefix = "/local-data/mimic-library/"
    return MIMIC_ROOT / unquote(url[len(prefix):])


def tag_sort_key(device: dict) -> tuple:
    tag = str(device.get("tag", ""))
    parts = tag.split(".")
    prefix = parts[0] if parts else ""
    kind = parts[1] if len(parts) > 1 else ""
    try:
        number = int(parts[2]) if len(parts) > 2 else 0
    except ValueError:
        number = 0
    order = {"G": 0, "1ST": 1, "2ND": 2}.get(prefix, 99)
    return (order, kind, number, tag)


def status_for(device: dict, page2_el_fail_tag: str | None) -> dict:
    tag = device.get("tag", "")
    if tag == "2ND.EX.3":
        return {
            "status": "Fail",
            "notes": "Exit sign illumination not satisfactory during test.",
            "action": "Replace battery/driver and retest emergency operation.",
            "priority": "P2",
        }
    if tag == "2ND.SD.14":
        return {
            "status": "Fail",
            "notes": "Smoke detector response recorded as slow/dirty condition in demo test.",
            "action": "Clean detector chamber or replace detector head, then retest at panel.",
            "priority": "P2",
        }
    if page2_el_fail_tag and tag == page2_el_fail_tag:
        return {
            "status": "Fail",
            "notes": "Emergency light did not sustain operation during demo emergency test.",
            "action": "Replace battery pack and retest duration.",
            "priority": "P2",
        }
    return {
        "status": "Pass",
        "notes": "Checked and tested normal in demo run.",
        "action": "-",
        "priority": "-",
    }


def build_inspection(devices: list[dict]) -> tuple[list[dict], list[dict]]:
    page2_els = [
        d
        for d in devices
        if d.get("floor") == "UOB - Page 2" and d.get("type") == "Emergency Light"
    ]
    page2_el_fail_tag = sorted(page2_els, key=tag_sort_key)[0].get("tag") if page2_els else None
    rows = []
    defects = []
    for sequence, device in enumerate(sorted(devices, key=tag_sort_key), start=1):
        result = status_for(device, page2_el_fail_tag)
        floor = device.get("floor") or "-"
        pin = f"{device.get('xPercent', '-')}, {device.get('yPercent', '-')}"
        method = CHECK_METHOD_BY_TYPE.get(
            device.get("type", ""),
            "General condition, tag, accessibility, operation and mimic pin verified.",
        )
        row = {
            **device,
            **result,
            "sequence": sequence,
            "floor": floor,
            "pin": pin,
            "method": method,
            "locationText": device.get("location") or "Site location to be filled by admin.",
            "evidence": "Before/after photo required" if result["status"] == "Fail" else "Result tick and pin verification",
            "supervisorReview": "Required" if result["status"] == "Fail" else "Sample review",
        }
        rows.append(row)
        if result["status"] == "Fail":
            defects.append(row)
    return rows, defects


def floor_sort_key(name: str) -> tuple:
    if "Page 1" in name:
        return (1, name)
    if "Page 2" in name:
        return (2, name)
    if "Page 3" in name:
        return (3, name)
    return (99, name)


def mimic_floor_map(manifest: dict) -> dict[str, Path]:
    mapping = {}
    for floor in manifest.get("floors", []):
        if floor.get("companyName") == "UOB":
            src = floor.get("cleanSrc") or floor.get("src")
            if src:
                mapping[floor["title"]] = url_to_path(src)
    return mapping


def font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def create_pin_map(floor_name: str, source: Path, devices: list[dict]) -> Path:
    image = Image.open(source).convert("RGB")
    draw = ImageDraw.Draw(image)
    radius = max(12, image.width // 80)
    label_font = font(max(13, image.width // 90))
    for device in devices:
        x = float(device.get("xPercent", 0)) * image.width / 100
        y = float(device.get("yPercent", 0)) * image.height / 100
        color = TYPE_COLORS.get(device.get("type", ""), "#64748b")
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color, outline="white", width=3)
        tag = str(device.get("tag", ""))
        short = tag.split(".")[1] if "." in tag else TYPE_CODES.get(device.get("type", ""), "DEV")
        draw.rounded_rectangle(
            (x + radius + 3, y - radius, x + radius + 82, y + radius),
            radius=5,
            fill="white",
            outline="#d9e2ef",
        )
        draw.text((x + radius + 8, y - radius + 3), short[:5], fill="#0f172a", font=label_font)
    draw.rounded_rectangle((14, 14, min(image.width - 14, 660), 58), radius=8, fill="white", outline="#d9e2ef")
    draw.text((28, 26), f"{floor_name} - Internal pin reference", fill="#0f172a", font=font(20))
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    out = TMP_DIR / f"{floor_name.lower().replace(' ', '-').replace('/', '-')}-backend-pins.png"
    image.save(out, optimize=True)
    return out


def p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(xml_escape(str(text)), style)


def make_paragraph_style(name: str, **kwargs) -> ParagraphStyle:
    return ParagraphStyle(name=name, **kwargs)


styles = getSampleStyleSheet()
TITLE = make_paragraph_style(
    "RmtTitle",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=21,
    leading=25,
    textColor=colors.HexColor("#09245a"),
    alignment=TA_LEFT,
    spaceAfter=7,
)
H1 = make_paragraph_style(
    "RmtH1",
    parent=styles["Heading1"],
    fontName="Helvetica-Bold",
    fontSize=14,
    leading=17,
    textColor=colors.HexColor("#09245a"),
    spaceBefore=10,
    spaceAfter=6,
)
H2 = make_paragraph_style(
    "RmtH2",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=11,
    leading=14,
    textColor=colors.HexColor("#0f172a"),
    spaceBefore=7,
    spaceAfter=4,
)
BODY = make_paragraph_style(
    "RmtBody",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=9,
    leading=12,
    textColor=colors.HexColor("#162033"),
)
SMALL = make_paragraph_style(
    "RmtSmall",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=7.5,
    leading=9.5,
    textColor=colors.HexColor("#334155"),
)
TINY = make_paragraph_style(
    "RmtTiny",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=6.5,
    leading=8,
    textColor=colors.HexColor("#334155"),
)
CALLOUT = make_paragraph_style(
    "RmtCallout",
    parent=styles["BodyText"],
    fontName="Helvetica-Bold",
    fontSize=9,
    leading=12,
    textColor=colors.HexColor("#7f1d1d"),
    backColor=colors.HexColor("#fee2e2"),
    borderColor=colors.HexColor("#fecaca"),
    borderPadding=7,
    borderRadius=3,
    spaceBefore=6,
    spaceAfter=6,
)


def table_text(value, style=SMALL) -> Paragraph:
    return Paragraph(xml_escape(str(value)), style)


def make_table(data, widths=None, font_size=7.5, header=True, long=False):
    header_style = ParagraphStyle(
        f"TableHeader{font_size}",
        fontName="Helvetica-Bold",
        fontSize=font_size,
        leading=font_size + 2,
        textColor=colors.white,
    )
    body_style = ParagraphStyle(
        f"TableBody{font_size}",
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
    style = [
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
        style.append(("BACKGROUND", (0, 1), (-1, -1), colors.white))
        for row_index in range(1, len(data)):
            if row_index % 2 == 0:
                style.append(("BACKGROUND", (0, row_index), (-1, row_index), colors.HexColor("#f8fafc")))
    table.setStyle(TableStyle(style))
    return table


def summary_boxes(rows: list[dict], defects: list[dict]):
    by_type: dict[str, int] = {}
    for row in rows:
        by_type[row.get("type", "Unknown")] = by_type.get(row.get("type", "Unknown"), 0) + 1
    active_count = sum(count for device_type, count in by_type.items() if device_type in {"Main Fire Alarm Panel"})
    passive_count = len(rows) - active_count
    data = [
        ["Internal Record", "Value", "Backend Use"],
        ["Client / Site", "UOB / UOB", "Customer copy hides MOS detail; this copy keeps method and sequence."],
        ["Inspection Date", REPORT_DATE, "Demo run for UOB full service checklist validation."],
        ["Device Count", str(len(rows)), f"{passive_count} passive / {active_count} active-control device."],
        ["Result", f"{len(rows) - len(defects)} pass / {len(defects)} fail", "Failed items require photo evidence and supervisor review."],
        ["Critical MOS", "Fire alarm isolation/restoration required", "Gas and pump SOP templates included for applicable future sites."],
    ]
    return make_table(data, widths=[40 * mm, 45 * mm, 90 * mm], font_size=8.2)


def device_type_table(rows: list[dict]):
    by_type: dict[str, int] = {}
    for row in rows:
        by_type[row.get("type", "Unknown")] = by_type.get(row.get("type", "Unknown"), 0) + 1
    data = [["Device Type", "Code", "Qty", "Testing Method Required"]]
    for device_type in sorted(by_type):
        data.append([
            device_type,
            TYPE_CODES.get(device_type, "-"),
            by_type[device_type],
            CHECK_METHOD_BY_TYPE.get(device_type, "General condition, function and mimic pin verification."),
        ])
    return make_table(data, widths=[45 * mm, 18 * mm, 16 * mm, 96 * mm], font_size=7.5)


def status_label_for_sop(rows: list[dict], target_types: set[str]) -> str:
    return "Applicable" if any(row.get("type") in target_types for row in rows) else "N/A for UOB demo - keep template active for matching sites"


def mos_table(rows: list[tuple[str, str, str, str, str]], status: str):
    data = [["Seq", "MOS Step", "Method / Control", "Evidence Required", "Backend Status"]]
    for seq, title, detail, evidence, hold in rows:
        status_text = hold if "Critical" in hold or "Permission" in hold else status
        data.append([seq, title, detail, evidence, status_text])
    return make_table(data, widths=[12 * mm, 36 * mm, 86 * mm, 46 * mm, 34 * mm], font_size=7.0, long=True)


def sop_table(rows: list[tuple[str, str, str, str]], status: str):
    data = [["Seq", "Critical SOP Step", "Required Action", "Evidence / Gate", "UOB Backend Status"]]
    for seq, title, detail, evidence in rows:
        data.append([seq, title, detail, evidence, status])
    return make_table(data, widths=[12 * mm, 38 * mm, 92 * mm, 36 * mm, 36 * mm], font_size=6.8, long=True)


def defect_table(defects: list[dict]):
    data = [["Tag", "System", "Floor", "Finding", "Action", "Internal Rule"]]
    for row in defects:
        data.append([
            row.get("tag", "-"),
            row.get("type", "-"),
            row.get("floor", "-"),
            row.get("notes", "-"),
            row.get("action", "-"),
            "Photo + supervisor review + quotation decision",
        ])
    return make_table(data, widths=[25 * mm, 30 * mm, 26 * mm, 58 * mm, 58 * mm, 40 * mm], font_size=6.8, long=True)


def backend_exception_overview(defects: list[dict], mos_flags: list[dict], evidence_flags: list[dict]):
    critical_open = [flag for flag in mos_flags if flag.get("priority") == "Critical"]
    evidence_count = sum(int(flag.get("count", 1)) for flag in evidence_flags)
    data = [
        ["Backend Exception", "Count", "Supervisor Action"],
        ["Tech did not follow MOS / sequence", len(mos_flags), "Review immediately if any item appears."],
        ["Missing required evidence", evidence_count, "Photo, reading, remark or supervisor proof required."],
        ["Faulty / malfunction item", len(defects), "Confirm defect, approve action and quotation if needed."],
        ["Critical system left open", len(critical_open), "Do not issue customer report until closed."],
    ]
    return make_table(data, widths=[64 * mm, 22 * mm, 128 * mm], font_size=8.2)


def mos_red_flag_table(mos_flags: list[dict]):
    data = [["Priority", "System", "Step / Issue", "Missing Proof", "Required Action"]]
    if not mos_flags:
        data.append([
            "OK",
            "Compulsory MOS",
            "No skipped compulsory MOS step captured in this demo export.",
            "-",
            "Continue review of faulty/malfunction items below.",
        ])
    for flag in mos_flags:
        data.append([
            flag.get("priority", "Red Flag"),
            flag.get("system", "-"),
            flag.get("issue", "-"),
            flag.get("missing", "-"),
            flag.get("action", "-"),
        ])
    return make_table(data, widths=[22 * mm, 35 * mm, 72 * mm, 42 * mm, 43 * mm], font_size=7.1)


def evidence_red_flag_table(evidence_flags: list[dict]):
    data = [["Priority", "Tag / Step", "Evidence Problem", "Required Before Close"]]
    if not evidence_flags:
        data.append(["OK", "-", "No missing evidence red flag captured.", "-"])
    for flag in evidence_flags:
        data.append([
            flag.get("priority", "Review"),
            flag.get("ref", "-"),
            flag.get("issue", "-"),
            flag.get("required", "-"),
        ])
    return make_table(data, widths=[24 * mm, 36 * mm, 86 * mm, 68 * mm], font_size=7.1)


def malfunction_exception_table(defects: list[dict]):
    data = [["Priority", "Tag", "System", "Floor", "Fault / Malfunction", "Action"]]
    if not defects:
        data.append(["OK", "-", "-", "-", "No faulty or malfunction item recorded.", "-"])
    for row in defects:
        data.append([
            row.get("priority", "P2"),
            row.get("tag", "-"),
            row.get("type", "-"),
            row.get("floor", "-"),
            row.get("notes", "-"),
            row.get("action", "-"),
        ])
    return make_table(data, widths=[18 * mm, 25 * mm, 34 * mm, 28 * mm, 70 * mm, 39 * mm], font_size=6.9)


def build_mos_red_flags() -> list[dict]:
    # The current demo data blocks skipped steps inside the app. When live SOP
    # exports are connected, incomplete required steps should be added here.
    return []


def build_evidence_red_flags(defects: list[dict]) -> list[dict]:
    if not defects:
        return []
    return [
        {
            "priority": "P1",
            "ref": f"{len(defects)} failed item(s)",
            "count": len(defects),
            "issue": "Faulty/malfunction items require evidence before closure.",
            "required": "Before/after photo, remark, corrective action, supervisor sign-off.",
        }
    ]


def execution_register(rows: list[dict]):
    data = [["Seq", "Tag", "Type", "Floor", "Pin", "Method / MOS Ref", "Result", "Evidence", "Review"]]
    for row in rows:
        data.append([
            row["sequence"],
            row.get("tag", "-"),
            row.get("type", "-"),
            row.get("floor", "-").replace("UOB - ", ""),
            row.get("pin", "-"),
            row.get("method", "-"),
            row.get("status", "-"),
            row.get("evidence", "-"),
            row.get("supervisorReview", "-"),
        ])
    return make_table(
        data,
        widths=[10 * mm, 20 * mm, 27 * mm, 20 * mm, 22 * mm, 74 * mm, 16 * mm, 36 * mm, 24 * mm],
        font_size=5.9,
        long=True,
    )


def signoff_table():
    data = [
        ["Role", "Name", "Date / Time", "Signature / Confirmation"],
        ["Technician", "", "", "I confirm testing was performed following the sequence recorded above."],
        ["Supervisor", "", "", "I reviewed critical isolation, failed items, restoration and final normal status."],
        ["Admin", "", "", "I reviewed data before customer report, quotation or follow-up issuance."],
        ["MOS Deviation / Near Miss", "", "", "Record any skipped step, unsafe condition, false alarm risk or client instruction here."],
    ]
    return make_table(data, widths=[38 * mm, 38 * mm, 34 * mm, 104 * mm], font_size=7.2)


def fit_image(path: Path, max_width: float, max_height: float) -> ReportImage:
    with Image.open(path) as image:
        width, height = image.size
    scale = min(max_width / width, max_height / height)
    return ReportImage(str(path), width=width * scale, height=height * scale)


def draw_footer(canvas, doc):
    canvas.saveState()
    width, height = doc.pagesize
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.setFont("Helvetica", 7)
    canvas.drawString(14 * mm, 8 * mm, "RMT Fire Inspection Apps - Internal Backend MOS Copy - Not for customer issue")
    canvas.drawRightString(width - 14 * mm, 8 * mm, f"Page {doc.page}")
    canvas.restoreState()


def add_page_title(story, title: str, subtitle: str | None = None):
    story.append(p(title, H1))
    if subtitle:
        story.append(p(subtitle, BODY))
    story.append(Spacer(1, 4 * mm))


def build_pdf() -> Path:
    master = load_json(MASTER_PATH)
    manifest = load_json(MANIFEST_PATH)
    rows, defects = build_inspection(master.get("devices", []))
    floor_maps = mimic_floor_map(manifest)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    mos_flags = build_mos_red_flags()
    evidence_flags = build_evidence_red_flags(defects)

    story = []
    story.append(p("RMT Fire Inspection Apps", TITLE))
    story.append(p("UOB Backend Red Flag Summary", H1))
    story.append(
        p(
            "This internal copy is for supervisor/admin review. It is designed to show only what needs attention: missed compulsory MOS sequence, missing evidence, missing supervisor confirmation, and faulty or malfunctioning devices.",
            BODY,
        )
    )
    story.append(p("Supervisor rule: if this page has any P1/Critical red flag, do not issue the customer report until the issue is checked, corrected, or approved by the responsible person.", CALLOUT))
    story.append(backend_exception_overview(defects, mos_flags, evidence_flags))
    story.append(Spacer(1, 5 * mm))
    story.append(p("1. MOS / Sequence Red Flags", H2))
    story.append(mos_red_flag_table(mos_flags))
    story.append(Spacer(1, 5 * mm))
    story.append(p("2. Missing Evidence / Approval Red Flags", H2))
    story.append(evidence_red_flag_table(evidence_flags))
    story.append(Spacer(1, 5 * mm))
    story.append(p("3. Faulty / Malfunction Items", H2))
    story.append(malfunction_exception_table(defects))
    story.append(Spacer(1, 4 * mm))
    story.append(
        p(
            "Full audit details continue after this summary. For daily operation, supervisor can review this first page quickly and only scroll down when more detail is needed.",
            BODY,
        )
    )

    story.append(PageBreak())
    story.append(p("Backend Audit Appendix", TITLE))
    story.append(p("UOB Internal Backend MOS Test Record", H1))
    story.append(
        p(
            "The appendix keeps the full method, required order, critical hold points, evidence rules, and device register behind the red-flag summary.",
            BODY,
        )
    )
    story.append(summary_boxes(rows, defects))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Device Scope By Type", H2))
    story.append(device_type_table(rows))
    story.append(Spacer(1, 4 * mm))
    story.append(p("Backend Decision Rule", H2))
    story.append(
        p(
            "Customer copy should show final condition and recommendations. Backend copy must show exceptions first, with full testing sequence available for audit when needed.",
            BODY,
        )
    )

    story.append(PageBreak())
    add_page_title(story, "Fire Alarm MOS Sequence", "UOB has fire alarm panel and point devices, so the following method is applicable to the demo test record.")
    story.append(mos_table(FIRE_ALARM_MOS, "Recorded in backend checklist"))

    story.append(PageBreak())
    add_page_title(story, "Critical Safety SOP - Gas Discharge / CO2", "This page is included because false discharge is high cost and high risk. For UOB this is a template/hold-point record unless a gas system is present.")
    story.append(p("Danger control: do not perform alarm simulation until discharge switch, cable, pyrocharge/solenoid head and supervisor confirmation are completed.", CALLOUT))
    story.append(sop_table(GAS_RELEASE_SOP, status_label_for_sop(rows, {"CO2 System", "Gas Release System"})))

    story.append(PageBreak())
    add_page_title(story, "Critical Safety SOP - Pump Systems", "This page covers hose reel, sprinkler, wet riser and pressurized hydrant pump testing sequence. UOB device master currently has no pump panel pinned, so this is retained as a controlled template.")
    story.append(p("Mandatory close-out: all selectors must be returned to AUTO and final panel/pressure normal status must be photographed.", CALLOUT))
    story.append(sop_table(PUMP_SOP, status_label_for_sop(rows, {"Hose Reel Panel", "Sprinkler Panel", "Wet Riser Panel", "Pressurized Hydrant Panel", "Fire Pump"})))

    story.append(PageBreak())
    add_page_title(story, "Evidence And Photo Control", "Backend evidence rules to prevent missing proof during review.")
    evidence_rows = [
        ["Item", "When Required", "Photo / Data Needed", "Backend Gate"],
        ["Panel before test", "Before fire alarm, gas or pump testing", "Panel status, selector/isolation state, date/time/person", "Required"],
        ["Failed device", "Every failed item", "Close photo, tag, defect condition, after-repair photo where done", "Cannot close without evidence"],
        ["Gas discharge isolation", "Before alarm simulation", "Isolation switch, cable/actuator removed, supervisor approval", "Critical hold"],
        ["Pump selector restoration", "After pump test", "Selector returned to AUTO, final pressure/panel normal", "Critical hold"],
        ["Mimic pin mismatch", "When actual device differs from mimic", "Photo and request to admin to add/move device", "Admin review"],
        ["Client/FM permission", "Before alarm sounder, tripping, gas or pump test", "Name, time, scope allowed", "Permission hold"],
    ]
    story.append(make_table(evidence_rows, widths=[42 * mm, 48 * mm, 78 * mm, 46 * mm], font_size=7.2))

    for floor_name in sorted(floor_maps, key=floor_sort_key):
        floor_devices = [row for row in rows if row.get("floor") == floor_name]
        if not floor_devices:
            continue
        story.append(PageBreak())
        add_page_title(story, f"Mimic Pin Audit - {floor_name}", "Pin positions are backend references for verification. Exact text location can be filled by admin after site confirmation.")
        pin_map = create_pin_map(floor_name, floor_maps[floor_name], floor_devices)
        story.append(fit_image(pin_map, 175 * mm, 215 * mm))

    story.append(PageBreak())
    add_page_title(story, "UOB Device Execution Register", "Each row records the backend method used for the point. This is the internal trail behind the shorter customer report.")
    story.append(execution_register(rows))

    story.append(PageBreak())
    add_page_title(story, "Failed Item Follow-Up", "These sample failed items must be checked by supervisor before quotation or customer issue.")
    story.append(defect_table(defects))
    story.append(Spacer(1, 5 * mm))
    story.append(p("Backend Sign-Off", H2))
    story.append(signoff_table())

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    story.append(Spacer(1, 5 * mm))
    story.append(p(f"Generated locally for Realmart Sdn Bhd on {generated_at}.", SMALL))

    doc = SimpleDocTemplate(
        str(OUT_PDF),
        pagesize=landscape(A4),
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=13 * mm,
        bottomMargin=13 * mm,
        title="UOB Internal Backend MOS Test Record",
        author="RMT Fire Inspection Apps",
    )
    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    return OUT_PDF


if __name__ == "__main__":
    print(build_pdf())
