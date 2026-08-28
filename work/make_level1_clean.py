from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from dxf_preview import parse_dxf, collect_primitives


SRC = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\MIMIC-R1 2000.dxf")
OUT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\outputs\mtb-cad-preview\MTB-Level1-clean-first-pass.dxf")
BOX = (2060.0, -360.0, 2420.0, -150.0)


TYPE_COLORS = {
    "Wet Chemical System": 6,
    "Emergency Light": 2,
    "Smoke Detector": 5,
    "Hose Reel": 1,
    "Wet Riser": 12,
    "Flow Switch": 3,
    "Fireman Intercom": 200,
    "Fire Point / Zone Reference": 30,
    "CO2 System": 8,
}

MARKERS = [
    ("L1.WCC.1", "Wet Chemical System", 2192.7, -158.5),
    ("L1.WCC.2", "Wet Chemical System", 2196.8, -158.2),
    ("L1.WCC.3", "Wet Chemical System", 2200.7, -157.7),
    ("L1.EL.1", "Emergency Light", 2240.5, -173.8),
    ("L1.S.1", "Smoke Detector", 2270.5, -186.3),
    ("L1.H.1", "Hose Reel", 2243.9, -177.4),
    ("L1.WR.1", "Wet Riser", 2266.9, -168.8),
    ("L1.PA.2", "Fireman Intercom", 2349.2, -253.1),
    ("L1.FS.1", "Flow Switch", 2237.4, -199.5),
    ("L1.Z2.A", "Fire Point / Zone Reference", 2351.1, -165.0),
    ("L1.Z88.AHU", "Fire Point / Zone Reference", 2350.7, -217.2),
    ("L1.Z104.A", "Fire Point / Zone Reference", 2327.7, -253.5),
    ("L1.Z62.LIFT", "Fire Point / Zone Reference", 2313.6, -167.6),
    ("L1.Z32.A", "Fire Point / Zone Reference", 2206.2, -245.3),
    ("L1.CO2.1", "CO2 System", 2296.6, -154.5),
    ("L1.CO2.2", "CO2 System", 2311.2, -154.2),
    ("L1.CO2.3", "CO2 System", 2325.8, -154.3),
    ("L1.CO2.4", "CO2 System", 2368.2, -153.5),
]


def in_box(point):
    x, y = point
    min_x, min_y, max_x, max_y = BOX
    return min_x <= x <= max_x and min_y <= y <= max_y


def local(point):
    return point[0] - BOX[0], point[1] - BOX[1]


def dxf_line(x1, y1, x2, y2, color=7):
    return f"0\nLINE\n8\nLEVEL1_BASE\n62\n{color}\n10\n{x1:.4f}\n20\n{y1:.4f}\n30\n0\n11\n{x2:.4f}\n21\n{y2:.4f}\n31\n0\n"


def dxf_circle(x, y, r, layer="LEVEL1_MARKERS", color=1):
    return f"0\nCIRCLE\n8\n{layer}\n62\n{color}\n10\n{x:.4f}\n20\n{y:.4f}\n30\n0\n40\n{r:.4f}\n"


def dxf_solid_circle(x, y, r, layer="LEVEL1_MARKERS", color=1):
    return (
        f"0\nHATCH\n8\n{layer}\n62\n{color}\n10\n0\n20\n0\n30\n0\n2\nSOLID\n70\n1\n71\n0\n91\n1\n"
        f"92\n3\n72\n2\n73\n1\n93\n2\n10\n{x + r:.4f}\n20\n{y:.4f}\n42\n1.0\n10\n{x - r:.4f}\n20\n{y:.4f}\n42\n1.0\n97\n0\n75\n0\n76\n1\n98\n0\n"
    )


def dxf_text(x, y, text, height=2.5, layer="LEVEL1_TEXT", color=5):
    safe = text.replace("\n", " ").replace("\r", " ")
    return f"0\nTEXT\n8\n{layer}\n62\n{color}\n10\n{x:.4f}\n20\n{y:.4f}\n30\n0\n40\n{height:.4f}\n1\n{safe}\n"


def main():
    entities = parse_dxf(str(SRC))
    lines, circles, texts, _ = collect_primitives(entities)
    cropped_lines = [(a, b) for a, b in lines if in_box(a) or in_box(b)]
    cropped_circles = [(x, y, r) for x, y, r in circles if in_box((x, y))]
    cropped_texts = [(x, y, t) for x, y, t in texts if in_box((x, y))]

    body = []
    body.append("0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n")
    body.append("0\nSECTION\n2\nTABLES\n0\nENDSEC\n")
    body.append("0\nSECTION\n2\nENTITIES\n")
    for a, b in cropped_lines:
        ax, ay = local(a)
        bx, by = local(b)
        body.append(dxf_line(ax, ay, bx, by, 7))
    for x, y, r in cropped_circles:
        lx, ly = local((x, y))
        body.append(dxf_circle(lx, ly, r, "LEVEL1_BASE", 7))
    for x, y, text in cropped_texts:
        lx, ly = local((x, y))
        body.append(dxf_text(lx, ly, text, 1.6, "LEVEL1_ROOM_LABELS", 5))

    body.append(dxf_text(0, 30, "MTB REALITY SDN BHD - LEVEL 1 CLEAN MIMIC FIRST PASS", 4.0, "TITLE", 5))
    body.append(dxf_text(0, 24, "Device markers transferred from CAD/scanned mimic reference. Review required before final use.", 2.3, "TITLE", 5))
    body.append(dxf_text(0, 19, "Legend colors: WCC=magenta, EL=yellow, S=blue, H=red, WR=dark red, PA=purple, Z=orange zone reference.", 2.3, "TITLE", 1))

    legend_y = 14
    for label, color in [
        ("WCC Wet Chemical", TYPE_COLORS["Wet Chemical System"]),
        ("EL Emergency Light", TYPE_COLORS["Emergency Light"]),
        ("S Smoke Detector", TYPE_COLORS["Smoke Detector"]),
        ("H Hose Reel", TYPE_COLORS["Hose Reel"]),
        ("WR Wet Riser", TYPE_COLORS["Wet Riser"]),
        ("FS Flow Switch", TYPE_COLORS["Flow Switch"]),
        ("PA Fireman Intercom", TYPE_COLORS["Fireman Intercom"]),
        ("Z Zone Reference", TYPE_COLORS["Fire Point / Zone Reference"]),
        ("CO2 System", TYPE_COLORS["CO2 System"]),
    ]:
        body.append(dxf_solid_circle(4, legend_y, 1.4, "LEVEL1_LEGEND", color))
        body.append(dxf_circle(4, legend_y, 1.7, "LEVEL1_LEGEND", 7))
        body.append(dxf_text(8, legend_y - 0.9, label, 1.8, "LEVEL1_LEGEND", color))
        legend_y -= 5

    for tag, label, x, y in MARKERS:
        color = TYPE_COLORS.get(label, 7)
        lx, ly = local((x, y))
        body.append(dxf_solid_circle(lx, ly, 2.7, "LEVEL1_DEVICE_MARKERS", color))
        body.append(dxf_circle(lx, ly, 3.0, "LEVEL1_DEVICE_MARKERS", color))
        body.append(dxf_text(lx + 4.0, ly + 2.0, tag, 2.3, "LEVEL1_DEVICE_LABELS", color))
        body.append(dxf_text(lx + 4.0, ly - 1.0, label, 1.8, "LEVEL1_DEVICE_LABELS", color))

    body.append("0\nENDSEC\n0\nEOF\n")
    OUT.write_text("".join(body), encoding="ascii", errors="ignore")
    csv = OUT.with_suffix(".csv")
    csv.write_text(
        "Device Tag,Device Type,Source X,Source Y,Status\n"
        + "".join(f"{tag},{label},{x:.3f},{y:.3f},Needs review\n" for tag, label, x, y in MARKERS),
        encoding="utf-8",
    )
    print(OUT)
    print(csv)
    print({"base_lines": len(cropped_lines), "base_circles": len(cropped_circles), "base_texts": len(cropped_texts), "markers": len(MARKERS)})


if __name__ == "__main__":
    main()
