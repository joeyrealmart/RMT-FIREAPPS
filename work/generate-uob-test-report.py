from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote
from xml.sax.saxutils import escape as xml_escape

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image as ReportImage,
    KeepTogether,
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
TMP_DIR = ROOT / "tmp" / "pdfs" / "uob-test-report"
OUT_DIR = ROOT / "output" / "pdf"
OUT_PDF = OUT_DIR / "uob-test-full-service-report.pdf"
REPORT_DATE = "7 August 2026"


TYPE_COLORS = {
    "Main Fire Alarm Panel": "#111827",
    "Exit Sign": "#16a34a",
    "Emergency Light": "#f59e0b",
    "Heat Detector": "#ef4444",
    "Smoke Detector": "#2563eb",
    "Manual Call Point": "#dc2626",
}


CHECKLISTS = {
    "Main Fire Alarm Panel": [
        "Power supply, battery and charger checked",
        "Panel indication, zone display and mimic/bulb test checked",
        "Panel reset and normal condition confirmed",
    ],
    "Manual Call Point": [
        "Unit visible and accessible",
        "Call point activation tested and alarm received at panel",
        "Reset key/glass condition checked",
    ],
    "Smoke Detector": [
        "Detector condition checked",
        "Detector test signal received at fire alarm panel",
        "Detector location matched with mimic pin",
    ],
    "Heat Detector": [
        "Detector condition checked",
        "Detector test signal received at fire alarm panel",
        "Detector location matched with mimic pin",
    ],
    "Emergency Light": [
        "Fitting condition checked",
        "Charging indicator checked",
        "Emergency operation tested",
    ],
    "Exit Sign": [
        "Signage visibility checked",
        "Charging/illumination checked",
        "Emergency operation tested",
    ],
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def url_to_path(url: str) -> Path:
    prefix = "/local-data/mimic-library/"
    return MIMIC_ROOT / unquote(url[len(prefix):])


def font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


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
        }
    if tag == "2ND.SD.14":
        return {
            "status": "Fail",
            "notes": "Smoke detector response recorded as slow/dirty condition in demo test.",
            "action": "Clean detector chamber or replace head, then retest at panel.",
        }
    if page2_el_fail_tag and tag == page2_el_fail_tag:
        return {
            "status": "Fail",
            "notes": "Emergency light did not sustain operation during demo discharge test.",
            "action": "Replace battery pack and retest duration.",
        }
    return {
        "status": "Pass",
        "notes": "Checked and tested normal in demo run.",
        "action": "-",
    }


def build_inspection(devices: list[dict]) -> tuple[list[dict], list[dict]]:
    page2_els = [d for d in devices if d.get("floor") == "UOB - Page 2" and d.get("type") == "Emergency Light"]
    page2_el_fail_tag = sorted(page2_els, key=tag_sort_key)[0].get("tag") if page2_els else None
    rows = []
    defects = []
    for device in sorted(devices, key=tag_sort_key):
        result = status_for(device, page2_el_fail_tag)
        checks = CHECKLISTS.get(device.get("type", ""), ["General condition checked", "Operation tested", "Mimic pin verified"])
        row = {
            **device,
            **result,
            "checklist": checks,
            "pin": f"{device.get('xPercent', '-')}, {device.get('yPercent', '-')}",
            "locationText": device.get("location") or "To be confirmed on site",
        }
        rows.append(row)
        if result["status"] == "Fail":
            defects.append(row)
    return rows, defects


def mimic_floor_map(manifest: dict) -> dict[str, Path]:
    mapping = {}
    for floor in manifest.get("floors", []):
        if floor.get("companyName") == "UOB":
            mapping[floor["title"]] = url_to_path(floor.get("src") or floor.get("cleanSrc"))
    return mapping


def create_pin_map(floor_name: str, source: Path, devices: list[dict]) -> Path:
    image = Image.open(source).convert("RGB")
    draw = ImageDraw.Draw(image)
    radius = max(12, image.width // 80)
    label_font = font(max(12, image.width // 95))
    for device in devices:
        x = float(device.get("xPercent", 0)) * image.width / 100
        y = float(device.get("yPercent", 0)) * image.height / 100
        color = TYPE_COLORS.get(device.get("type", ""), "#64748b")
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color, outline="white", width=3)
        code = str(device.get("tag", "")).split(".")
        short = code[1] if len(code) > 1 else str(device.get("type", "DEV"))[:3]
        draw.text((x + radius + 3, y - radius), short[:4], fill="#111827", font=label_font)
    draw.rectangle((12, 12, min(image.width - 12, 540), 52), fill="white", outline="#d9e2ef")
    draw.text((24, 24), f"{floor_name} - UOB test pin map", fill="#111827", font=font(18))
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    out = TMP_DIR / f"{floor_name.lower().replace(' ', '-').replace('/', '-')}-pins.png"
    image.save(out, optimize=True)
    return out


def p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(xml_escape(str(text)), style)


def table_text(value, style: ParagraphStyle) -> Paragraph:
    return Paragraph(xml_escape(str(value)), style)


def make_table(data, widths=None, font_size=8, header=True):
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
    table = Table(converted, colWidths=widths, repeatRows=1 if header else 0)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#06245a") if header else colors.white),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white if header else colors.HexColor("#162033")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), font_size),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d9e2ef")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#667085"))
    canvas.drawString(15 * mm, 10 * mm, "TEST REPORT - Demo data only, not an actual signed service record")
    canvas.drawRightString(195 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf() -> None:
    master = load_json(MASTER_PATH)
    manifest = load_json(MANIFEST_PATH)
    devices = master.get("devices", [])
    rows, defects = build_inspection(devices)
    floors = sorted(set(d.get("floor", "") for d in rows), key=lambda f: {"UOB - Page 1": 0, "UOB - Page 2": 1, "UOB - Page 3": 2}.get(f, 99))
    floor_sources = mimic_floor_map(manifest)
    pin_maps = {
        floor: create_pin_map(floor, floor_sources[floor], [d for d in rows if d.get("floor") == floor])
        for floor in floors
        if floor in floor_sources
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT_PDF),
        pagesize=A4,
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=16 * mm,
        title="UOB Test Full Service Report",
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("TitleCenter", parent=styles["Title"], alignment=TA_CENTER, fontSize=20, leading=24, textColor=colors.HexColor("#06245a")))
    styles.add(ParagraphStyle("H2Blue", parent=styles["Heading2"], fontSize=13, leading=16, textColor=colors.HexColor("#06245a"), spaceBefore=8, spaceAfter=6))
    styles.add(ParagraphStyle("Small", parent=styles["BodyText"], fontSize=8, leading=10))
    styles.add(ParagraphStyle("NormalTight", parent=styles["BodyText"], fontSize=9, leading=12, alignment=TA_LEFT))
    styles.add(ParagraphStyle("DashboardTitle", parent=styles["Heading1"], alignment=TA_CENTER, fontSize=18, leading=22, textColor=colors.HexColor("#06245a"), spaceAfter=5))
    styles.add(ParagraphStyle("DashboardLead", parent=styles["BodyText"], alignment=TA_CENTER, fontSize=10, leading=13, textColor=colors.HexColor("#162033"), spaceAfter=8))
    styles.add(ParagraphStyle("KpiCard", parent=styles["BodyText"], alignment=TA_CENTER, fontSize=8, leading=10, textColor=colors.HexColor("#162033")))
    styles.add(ParagraphStyle("StatusBox", parent=styles["BodyText"], alignment=TA_CENTER, fontSize=11, leading=14, textColor=colors.HexColor("#7f1d1d")))

    pass_count = len(rows) - len(defects)
    pass_rate = round((pass_count / len(rows)) * 100, 1) if rows else 0

    by_type = {}
    for row in rows:
        by_type.setdefault(row["type"], {"total": 0, "pass": 0, "fail": 0})
        by_type[row["type"]]["total"] += 1
        by_type[row["type"]]["pass" if row["status"] == "Pass" else "fail"] += 1

    def type_result(*device_types):
        total = sum(by_type.get(name, {}).get("total", 0) for name in device_types)
        failed = sum(by_type.get(name, {}).get("fail", 0) for name in device_types)
        passed = total - failed
        return total, passed, failed

    def kpi(title, value, note):
        return Paragraph(
            f"<font size='18'><b>{xml_escape(str(value))}</b></font><br/>"
            f"<font size='8'><b>{xml_escape(str(title))}</b></font><br/>"
            f"<font size='7'>{xml_escape(str(note))}</font>",
            styles["KpiCard"],
        )

    story = []
    story.append(p("RMT Fire Inspection App", styles["TitleCenter"]))
    story.append(p("Customer Summary - System Health Snapshot", styles["DashboardTitle"]))
    story.append(p("UOB Full Maintenance Inspection Report - TEST RUN", styles["DashboardLead"]))
    story.append(make_table([
        ["Client", "UOB", "Site", "UOB"],
        ["Inspection date", REPORT_DATE, "Inspector", "Demo Inspector"],
        ["Report type", "Full completed test report", "Overall status", "Completed - Follow Up Required"],
    ], [34 * mm, 58 * mm, 34 * mm, 58 * mm], font_size=8.5, header=False))
    story.append(Spacer(1, 7))

    status_box = Table([[
        Paragraph("<b>Overall Outlook</b><br/>System inspection completed. Defects found require repair/replacement and retest before closure.", styles["StatusBox"])
    ]], colWidths=[180 * mm])
    status_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fee2e2")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#fca5a5")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(status_box)
    story.append(Spacer(1, 7))

    kpi_table = Table([
        [
            kpi("Total Devices", len(rows), "Checked in this report"),
            kpi("Passed", pass_count, "No follow-up recorded"),
            kpi("Failed / Defect", len(defects), "Action required"),
        ],
        [
            kpi("Pass Rate", f"{pass_rate}%", "Fast health indicator"),
            kpi("Quotation Items", len(defects), "To review after client approval"),
            kpi("Mimic Pages", len(floors), "Pin maps included below"),
        ],
    ], colWidths=[58 * mm, 58 * mm, 58 * mm], rowHeights=[25 * mm, 25 * mm])
    kpi_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d9e2ef")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 8))

    story.append(p("Fast System Outlook", styles["H2Blue"]))
    alarm_total, alarm_pass, alarm_fail = type_result("Main Fire Alarm Panel")
    mcp_total, mcp_pass, mcp_fail = type_result("Manual Call Point")
    detector_total, detector_pass, detector_fail = type_result("Smoke Detector", "Heat Detector")
    lighting_total, lighting_pass, lighting_fail = type_result("Emergency Light", "Exit Sign")
    outlook_rows = [
        ["System / Area", "Quick Status", "Customer Summary"],
        ["Fire alarm panel", "Pass" if alarm_fail == 0 else "Attention", f"{alarm_pass}/{alarm_total} panel item checked normal."],
        ["Manual call point", "Pass" if mcp_fail == 0 else "Attention", f"{mcp_pass}/{mcp_total} call point(s) checked/tested."],
        ["Smoke / heat detection", "Attention" if detector_fail else "Pass", f"{detector_pass}/{detector_total} detector(s) passed, {detector_fail} defect recorded."],
        ["Emergency / exit lighting", "Attention" if lighting_fail else "Pass", f"{lighting_pass}/{lighting_total} light/sign item(s) passed, {lighting_fail} defect(s) recorded."],
        ["Mimic pin verification", "Completed", f"{len(floors)} mimic page(s) included for location reference."],
    ]
    story.append(make_table(outlook_rows, [47 * mm, 32 * mm, 101 * mm], font_size=7.7))
    story.append(Spacer(1, 7))

    story.append(p("Key Follow-Up Items", styles["H2Blue"]))
    front_defects = [["Tag", "System", "Finding", "Recommended Action"]]
    for defect in defects:
        front_defects.append([defect["tag"], defect["type"], defect["notes"], defect["action"]])
    story.append(make_table(front_defects, [24 * mm, 35 * mm, 60 * mm, 61 * mm], font_size=7))
    story.append(Spacer(1, 7))
    story.append(p(
        "Full details continue on the following pages, including mimic map reference, detailed device checklist, photo reference section, and sign-off.",
        styles["NormalTight"],
    ))

    story.append(PageBreak())
    story.append(p("Inspection Result Details", styles["TitleCenter"]))
    story.append(p(
        f"This demo run completed all {len(rows)} UOB device checkpoints. "
        f"{pass_count} items passed and {len(defects)} sample defects were recorded to demonstrate report behavior, "
        "photo reference handling, and follow-up action wording.",
        styles["NormalTight"],
    ))
    story.append(Spacer(1, 8))

    type_table = [["Device type", "Total", "Pass", "Fail"]]
    for name in sorted(by_type):
        item = by_type[name]
        type_table.append([name, str(item["total"]), str(item["pass"]), str(item["fail"])])
    story.append(make_table(type_table, [75 * mm, 28 * mm, 28 * mm, 28 * mm], font_size=8))

    story.append(Spacer(1, 8))
    story.append(p("System Checklist Summary", styles["H2Blue"]))
    system_rows = [
        ["System", "Completed checks", "Result / remarks"],
        ["Fire alarm control panel", "Power supply, standby battery, charger, indication and reset", "Pass - panel normal in demo run"],
        ["Manual call point", "7 points tested", "Pass"],
        ["Smoke / heat detection", "52 detectors checked/tested", "1 sample defect recorded"],
        ["Emergency / exit lighting", "31 fittings/signs checked", "2 sample defects recorded"],
        ["Mimic verification", "All 91 UOB pins referenced on mimic map", "Completed"],
    ]
    story.append(make_table(system_rows, [50 * mm, 75 * mm, 55 * mm], font_size=8))

    story.append(Spacer(1, 8))
    story.append(p("Defect / Follow Up Summary", styles["H2Blue"]))
    defect_rows = [["Tag", "Type", "Floor", "Pin", "Finding", "Recommended action"]]
    for defect in defects:
        defect_rows.append([
            defect["tag"], defect["type"], defect["floor"], defect["pin"], defect["notes"], defect["action"]
        ])
    story.append(make_table(defect_rows, [23 * mm, 31 * mm, 25 * mm, 20 * mm, 47 * mm, 42 * mm], font_size=7))

    story.append(PageBreak())
    story.append(p("Mimic Map Reference", styles["TitleCenter"]))
    story.append(p("The maps below use the same pin coordinates stored in the device master.", styles["NormalTight"]))
    for index, (floor, image_path) in enumerate(pin_maps.items()):
        if index > 0:
            story.append(PageBreak())
        story.append(Spacer(1, 8))
        story.append(p(floor, styles["H2Blue"]))
        img = Image.open(image_path)
        max_w = 180 * mm
        display_h = max_w * img.height / img.width
        if display_h > 150 * mm:
            display_h = 150 * mm
            max_w = display_h * img.width / img.height
        story.append(ReportImage(str(image_path), width=max_w, height=display_h))

    story.append(PageBreak())
    story.append(p("Detailed Device Checklist", styles["TitleCenter"]))
    detail_data = [["No", "Tag", "Type", "Floor", "Location", "Pin", "Result", "Remarks"]]
    for index, row in enumerate(rows, 1):
        detail_data.append([
            str(index),
            row["tag"],
            row["type"],
            row["floor"].replace("UOB - ", ""),
            row["locationText"],
            row["pin"],
            row["status"],
            row["notes"],
        ])
    story.append(make_table(detail_data, [9 * mm, 23 * mm, 28 * mm, 20 * mm, 34 * mm, 18 * mm, 16 * mm, 43 * mm], font_size=6.2))

    story.append(PageBreak())
    story.append(p("Photo Reference Section", styles["TitleCenter"]))
    story.append(p("No real inspection photos were uploaded in this test run. These boxes show where before/after photos will appear in the actual report.", styles["NormalTight"]))
    for defect in defects:
        block = []
        block.append(p(f"{defect['tag']} - {defect['type']}", styles["H2Blue"]))
        block.append(make_table([
            ["Finding", defect["notes"]],
            ["Recommended action", defect["action"]],
            ["Mimic pin", defect["pin"]],
        ], [40 * mm, 140 * mm], font_size=8, header=False))
        block.append(Spacer(1, 5))
        photo_table = Table([
            ["Before photo placeholder", "After photo placeholder"],
            ["Actual uploaded image will appear here", "Actual uploaded image will appear here"],
        ], colWidths=[88 * mm, 88 * mm], rowHeights=[38 * mm, 18 * mm])
        photo_table.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d9e2ef")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("TEXTCOLOR", (0, 1), (-1, 1), colors.HexColor("#667085")),
        ]))
        block.append(photo_table)
        block.append(Spacer(1, 10))
        story.append(KeepTogether(block))

    story.append(p("Inspector Declaration", styles["H2Blue"]))
    story.append(make_table([
        ["Prepared by", "Demo Inspector", "Signature", ""],
        ["Reviewed by", "Supervisor Demo", "Signature", ""],
        ["Client acknowledgement", "UOB representative", "Signature", ""],
    ], [35 * mm, 55 * mm, 30 * mm, 60 * mm], font_size=8, header=False))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUT_PDF)


if __name__ == "__main__":
    build_pdf()
