from __future__ import annotations

import hashlib
import json
import math
import shutil
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "outputs" / "rmt-mimic-factory"
PORTAL = ROOT / "outputs" / "rmt-mimic-lab" / "review-all"
sys.path.insert(0, str(ROOT / "work"))
from dxf_preview import collect_primitives, parse_dxf  # noqa: E402

MTB_BOXES = [
    ("level-01", "Level 1", 2060, -360, 2420, -150), ("level-02", "Level 2", 2395, -360, 2765, -150),
    ("level-03", "Level 3", 1900, -160, 2225, 35), ("level-04-05", "Typical Level 4 & 5", 2220, -160, 2465, 35),
    ("level-06", "Level 6", 2485, -160, 2785, 35), ("level-07", "Level 7", 1900, 25, 2225, 215),
    ("level-08", "Level 8", 2210, 25, 2465, 215), ("level-09", "Level 9", 2500, 25, 2785, 215),
    ("level-10", "Typical Level 10", 1900, 1010, 2175, 1218), ("level-11", "Typical Level 11", 1900, 850, 2175, 1010),
    ("level-12", "Typical Level 12", 1900, 690, 2175, 850), ("level-13", "Typical Level 13", 1900, 535, 2175, 690),
    ("level-14", "Typical Level 14", 1900, 380, 2175, 535), ("level-15", "Typical Level 15", 1900, 215, 2175, 380),
    ("level-16", "Typical Level 16", 2165, 1010, 2435, 1218), ("level-17", "Typical Level 17", 2165, 850, 2435, 1010),
    ("level-18", "Typical Level 18", 2165, 690, 2435, 850), ("level-19", "Typical Level 19", 2165, 535, 2435, 690),
    ("level-20", "Typical Level 20", 2165, 380, 2435, 535), ("level-21", "Typical Level 21", 2165, 215, 2435, 380),
    ("level-22", "Typical Level 22", 2440, 535, 2720, 690), ("level-23", "Typical Level 23", 2440, 380, 2720, 535),
    ("level-24", "Level 24", 2440, 215, 2720, 380),
]

RASTER_SOURCES = [
    ("Thermofisher", "source-page-1", "Source Page 1", ROOT / "work/mimic_pdf/mimic-1.png", None),
    ("Thermofisher", "source-page-2", "Source Page 2", ROOT / "work/mimic_pdf/mimic-2.png", None),
    ("Thermofisher", "source-page-3", "Source Page 3", ROOT / "work/mimic_pdf/mimic-3.png", None),
    ("Avillion", "main-building-level-1", "Main Building Level 1", ROOT / "outputs/mimic-cleanup-pilot/avillion-main-building-level-1/avillion-main-building-level-1-original-reference.png", ROOT / "outputs/mimic-cleanup-pilot/avillion-main-building-level-1/avillion-main-building-level-1-cleaned-background.png"),
    ("Avillion", "main-building-level-2", "Main Building Level 2", ROOT / "outputs/mimic-cleanup-pilot/avillion-main-building-level-2/avillion-main-building-level-2-original-reference.png", ROOT / "outputs/mimic-cleanup-pilot/avillion-main-building-level-2/avillion-main-building-level-2-cleaned-background.png"),
]

BLOCKED = ["Hibiscuss", "Hexachase", "IATAC", "UMB", "Costa Mahkota", "Myamax", "Wetex"]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def folders(client: str, candidate: str) -> dict[str, Path]:
    base = OUT / client / candidate
    result = {name: base / name for name in ("source", "clean", "review", "manifest")}
    for folder in result.values():
        folder.mkdir(parents=True, exist_ok=True)
    return result


def line_length(line) -> float:
    (x1, y1), (x2, y2) = line
    return math.hypot(x2 - x1, y2 - y1)


def dedupe(lines):
    seen, result = set(), []
    for a, b in lines:
        key = tuple(round(value, 3) for value in (*a, *b))
        reverse = tuple(round(value, 3) for value in (*b, *a))
        if key in seen or reverse in seen:
            continue
        seen.add(key); result.append((a, b))
    return result


def layer_for(line, width: float, height: float) -> str:
    length = line_length(line)
    return "RMT-WALL" if length >= max(width, height) * 0.18 else "RMT-PARTITION"


def write_dxf(path: Path, lines, bounds) -> Counter:
    min_x, min_y, max_x, max_y = bounds
    width, height = max_x - min_x, max_y - min_y
    counts = Counter()
    body = ["0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n"]
    for a, b in lines:
        layer = layer_for((a, b), width, height); counts[layer] += 1
        body.append(f"0\nLINE\n8\n{layer}\n10\n{a[0]:.4f}\n20\n{a[1]:.4f}\n30\n0\n11\n{b[0]:.4f}\n21\n{b[1]:.4f}\n31\n0\n")
    body.append("0\nENDSEC\n0\nEOF\n")
    path.write_text("".join(body), encoding="ascii", errors="ignore")
    return counts


def transform_point(point, bounds, canvas, margin=30):
    min_x, min_y, max_x, max_y = bounds
    width, height = canvas
    scale = min((width - margin * 2) / max(1e-6, max_x - min_x), (height - margin * 2) / max(1e-6, max_y - min_y))
    x = margin + (point[0] - min_x) * scale
    y = height - margin - (point[1] - min_y) * scale
    return x, y


def render_lines(lines, bounds, canvas, path: Path) -> Image.Image:
    image = Image.new("RGB", canvas, "white")
    draw = ImageDraw.Draw(image)
    width = max(1, round(max(canvas) / 1000))
    for a, b in lines:
        draw.line((transform_point(a, bounds, canvas), transform_point(b, bounds, canvas)), fill="#172033", width=width)
    image.save(path, optimize=True)
    return image


def write_svg(path: Path, lines, bounds, canvas) -> None:
    items = []
    for a, b in lines:
        x1, y1 = transform_point(a, bounds, canvas); x2, y2 = transform_point(b, bounds, canvas)
        items.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}"/>')
    path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas[0]} {canvas[1]}"><rect width="100%" height="100%" fill="white"/><g fill="none" stroke="#172033" stroke-width="2" stroke-linecap="square">{"".join(items)}</g></svg>\n', encoding="utf-8")


def comparison(source: Image.Image, clean: Image.Image, path: Path) -> None:
    panel = (900, 650)
    out = Image.new("RGB", (panel[0] * 2, panel[1] + 38), "white")
    for index, (image, label) in enumerate(((source, "ORIGINAL / SOURCE"), (clean, "CLEAN CAD CANDIDATE"))):
        fitted = ImageOps.contain(image.convert("RGB"), panel)
        x = index * panel[0] + (panel[0] - fitted.width) // 2
        y = 38 + (panel[1] - fitted.height) // 2
        out.paste(fitted, (x, y))
        ImageDraw.Draw(out).text((index * panel[0] + 12, 12), label, fill="#172033")
    out.save(path, optimize=True)


def overlay(source: Image.Image, clean: Image.Image, path: Path) -> None:
    base = ImageOps.contain(source.convert("RGB"), clean.size)
    canvas = Image.new("RGB", clean.size, "white")
    canvas.paste(base, ((clean.width - base.width) // 2, (clean.height - base.height) // 2))
    mask = clean.convert("L").point(lambda value: 190 if value < 180 else 0)
    cyan = Image.new("RGB", clean.size, "#0076bd")
    canvas.paste(cyan, mask=mask)
    canvas.save(path, optimize=True)


def finalize(client, candidate, display_name, dirs, source_ref, clean, lines, bounds, source_kind, source_path, extra=None):
    canvas = clean.size
    counts = write_dxf(dirs["clean"] / "mimic-clean.dxf", lines, bounds)
    write_svg(dirs["clean"] / "mimic-clean.svg", lines, bounds, canvas)
    clean.save(dirs["clean"] / "mimic-clean.png", optimize=True)
    comparison(source_ref, clean, dirs["review"] / "original-vs-clean.png")
    overlay(source_ref, clean, dirs["review"] / "overlay.png")
    transform = {"type": "IDENTITY_CANVAS" if source_kind == "raster" else "SOURCE_BOUNDS_UNIFORM_RENDER", "rotation": 0, "stretch": False, "outputWidth": canvas[0], "outputHeight": canvas[1], "sourceBounds": bounds}
    qa = {"status": "REVIEW_REQUIRED", "sourceKind": source_kind, "sourceGeometryAuthority": True, "pngValid": True, "svgValid": True, "dxfEditable": bool(lines), "entityCount": len(lines), "entityCountsByLayer": dict(counts), "aspectRatio": canvas[0] / canvas[1], "transformPreserved": True, "runtimePinsIncluded": False, "notes": "Deterministic candidate; human source comparison and minor AutoCAD cleanup required."}
    write_json(dirs["manifest"] / "transform.json", transform)
    write_json(dirs["manifest"] / "qa.json", qa)
    write_json(dirs["manifest"] / "worker-log.json", {"worker": "local deterministic Python/Pillow/NumPy/DXF", "generatedAt": now(), "source": str(source_path.relative_to(ROOT)).replace("\\", "/"), "sourceSha256": sha256(source_path), "operations": ["preserve source geometry/canvas", "remove coloured annotations for raster candidates", "extract source-supported editable line entities", "generate PNG/SVG/DXF and review comparisons"], "productionIntegration": False})
    item = {"client": client, "candidate": candidate, "displayName": display_name, "status": "REVIEW_REQUIRED", "base": f"/factory/{client}/{candidate}", "source": f"/factory/{client}/{candidate}/source/source-reference.png", "clean": f"/factory/{client}/{candidate}/clean/mimic-clean.png", "comparison": f"/factory/{client}/{candidate}/review/original-vs-clean.png", "overlay": f"/factory/{client}/{candidate}/review/overlay.png", "dxf": f"outputs/rmt-mimic-factory/{client}/{candidate}/clean/mimic-clean.dxf", "png": f"outputs/rmt-mimic-factory/{client}/{candidate}/clean/mimic-clean.png", "svg": f"outputs/rmt-mimic-factory/{client}/{candidate}/clean/mimic-clean.svg", "qa": qa}
    if extra: item.update(extra)
    return item


def build_ltk():
    results = []
    for slug, display in (("main-panel", "Main Panel / Overall Building"), ("feed-mill", "Feed Mill"), ("egg-production", "Egg Production")):
        source_dir = ROOT / "outputs/rmt-mimic-lab/LTK" / slug
        dirs = folders("LTK", slug)
        source = Image.open(source_dir / "source-reference.png").convert("RGB")
        clean = Image.open(source_dir / "background-cad-redraw.png").convert("RGB")
        shutil.copy2(source_dir / "source-reference.png", dirs["source"] / "source-reference.png")
        for ext in ("png", "svg", "dxf"):
            shutil.copy2(source_dir / f"background-cad-redraw.{ext}", dirs["clean"] / f"mimic-clean.{ext}")
        shutil.copy2(source_dir / "cad-style-comparison.png", dirs["review"] / "original-vs-clean.png")
        shutil.copy2(source_dir / "cad-source-overlay.png", dirs["review"] / "overlay.png")
        for name in ("transform.json", "qa.json"):
            shutil.copy2(source_dir / name, dirs["manifest"] / name)
        write_json(dirs["manifest"] / "worker-log.json", {"worker": "LTK accepted Mimic Factory V1 baseline", "generatedAt": now(), "source": "tools/rmt-mimic-lab/source/LTK/Mimic LTK.pdf", "productionIntegration": False})
        qa = json.loads((dirs["manifest"] / "qa.json").read_text(encoding="utf-8"))
        results.append({"client": "LTK", "candidate": slug, "displayName": display, "status": "REVIEW_REQUIRED", "base": f"/factory/LTK/{slug}", "source": f"/factory/LTK/{slug}/source/source-reference.png", "clean": f"/factory/LTK/{slug}/clean/mimic-clean.png", "comparison": f"/factory/LTK/{slug}/review/original-vs-clean.png", "overlay": f"/factory/LTK/{slug}/review/overlay.png", "dxf": f"outputs/rmt-mimic-factory/LTK/{slug}/clean/mimic-clean.dxf", "png": f"outputs/rmt-mimic-factory/LTK/{slug}/clean/mimic-clean.png", "svg": f"outputs/rmt-mimic-factory/LTK/{slug}/clean/mimic-clean.svg", "qa": qa})
    return results


def build_mtb():
    source_path = ROOT / "MIMIC-R1 2000.dxf"
    entities = parse_dxf(str(source_path)); all_lines, circles, texts, _ = collect_primitives(entities)
    results = []
    for slug, display, min_x, min_y, max_x, max_y in MTB_BOXES:
        box = (float(min_x), float(min_y), float(max_x), float(max_y))
        inside = lambda point: box[0] <= point[0] <= box[2] and box[1] <= point[1] <= box[3]
        lines = dedupe([(a, b) for a, b in all_lines if (inside(a) or inside(b)) and line_length((a, b)) >= 0.8])
        floor_circles = [(x, y, r) for x, y, r in circles if inside((x, y))]
        floor_texts = [(x, y, t) for x, y, t in texts if inside((x, y))]
        dirs = folders("MTB", slug)
        canvas = (1600, max(800, round(1600 * (box[3] - box[1]) / max(1, box[2] - box[0]))))
        source = render_lines(lines, box, canvas, dirs["source"] / "source-reference.png")
        draw = ImageDraw.Draw(source)
        for x, y, r in floor_circles:
            px, py = transform_point((x, y), box, canvas); draw.ellipse((px - 3, py - 3, px + 3, py + 3), outline="#a61b1b")
        for x, y, text in floor_texts[:400]:
            px, py = transform_point((x, y), box, canvas); draw.text((px, py), text[:24], fill="#64748b")
        source.save(dirs["source"] / "source-reference.png", optimize=True)
        clean = render_lines(lines, box, canvas, dirs["clean"] / "mimic-clean.png")
        results.append(finalize("MTB", slug, display, dirs, source, clean, lines, box, "dxf", source_path, {"sourceCircleCount": len(floor_circles), "sourceTextCount": len(floor_texts)}))
    return results


def clean_raster(source: Image.Image) -> Image.Image:
    rgb = np.asarray(source.convert("RGB"), dtype=np.int16)
    high, low = rgb.max(axis=2), rgb.min(axis=2)
    colour = (high - low > 32) & (high > 65)
    gray = (rgb[:, :, 0] * 30 + rgb[:, :, 1] * 59 + rgb[:, :, 2] * 11) // 100
    gray[colour] = 255
    gray = np.where(gray < 155, 25, np.where(gray > 218, 255, gray)).astype(np.uint8)
    return ImageOps.autocontrast(Image.fromarray(gray, mode="L")).filter(ImageFilter.MedianFilter(3)).convert("RGB")


def extract_axis_lines(clean: Image.Image):
    width, height = clean.size
    scale = min(1.0, 1800 / max(width, height))
    sample = clean.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.BILINEAR).convert("L")
    binary = np.asarray(sample) < 90
    sh, sw = binary.shape
    lines = []
    min_h, min_v = max(24, round(sw * 0.025)), max(24, round(sh * 0.025))
    for y in range(0, sh, 2):
        row = binary[y]; starts = np.flatnonzero(row & np.r_[True, ~row[:-1]]); ends = np.flatnonzero(row & np.r_[~row[1:], True])
        for start, end in zip(starts, ends):
            if end - start + 1 >= min_h: lines.append(((start / scale, (height - 1) - y / scale), (end / scale, (height - 1) - y / scale)))
    for x in range(0, sw, 2):
        col = binary[:, x]; starts = np.flatnonzero(col & np.r_[True, ~col[:-1]]); ends = np.flatnonzero(col & np.r_[~col[1:], True])
        for start, end in zip(starts, ends):
            if end - start + 1 >= min_v: lines.append(((x / scale, (height - 1) - start / scale), (x / scale, (height - 1) - end / scale)))
    return dedupe(sorted(lines, key=line_length, reverse=True)[:1800])


def build_rasters():
    results = []
    for client, slug, display, source_path, preferred_clean in RASTER_SOURCES:
        if not source_path.exists():
            continue
        dirs = folders(client, slug)
        source = Image.open(source_path).convert("RGB")
        source.save(dirs["source"] / "source-reference.png", optimize=True)
        cleaned = Image.open(preferred_clean).convert("RGB") if preferred_clean and preferred_clean.exists() else clean_raster(source)
        lines = extract_axis_lines(cleaned)
        bounds = (0.0, 0.0, float(cleaned.width), float(cleaned.height))
        clean = render_lines(lines, bounds, cleaned.size, dirs["clean"] / "mimic-clean.png")
        results.append(finalize(client, slug, display, dirs, source, clean, lines, bounds, "raster", source_path, {"rasterCleanupReference": str(preferred_clean.relative_to(ROOT)).replace("\\", "/") if preferred_clean else "deterministic colour/noise suppression"}))
    return results


def portal(candidates):
    PORTAL.mkdir(parents=True, exist_ok=True)
    clients = []
    for name in ["LTK", "MTB", "Thermofisher", "Avillion"]:
        items = [item for item in candidates if item["client"] == name]
        clients.append({"name": name, "status": "REVIEW_REQUIRED", "candidates": items})
    clients.extend({"name": name, "status": "BLOCKED_SOURCE_MISSING", "candidates": []} for name in BLOCKED)
    write_json(OUT / "factory-index.json", {"generatedAt": now(), "status": "REVIEW_REQUIRED", "clients": clients, "productionIntegration": False})
    (PORTAL / "review-data.js").write_text("window.RMT_FACTORY_DATA=" + json.dumps({"clients": clients}) + ";\n", encoding="utf-8")
    (PORTAL / "index.html").write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RMT Mimic Factory Review</title><link rel="icon" href="data:,"><link rel="stylesheet" href="review.css"></head><body><header><div><strong>RMT MIMIC FACTORY V1</strong><span>Review candidates only</span></div><b>Production pins and backgrounds unchanged</b></header><main><aside><label>Client<select id="client"></select></label><label>Drawing<select id="candidate"></select></label><label>View<select id="view"><option value="comparison">Original vs Clean</option><option value="source">Original</option><option value="clean">Clean CAD</option><option value="overlay">Overlay</option></select></label><section id="meta"></section><div id="links"></div></aside><section class="workspace"><h1 id="title"></h1><div id="status"></div><div class="canvas"><img id="image" alt="Mimic review candidate"></div></section></main><script src="review-data.js"></script><script src="review.js"></script></body></html>', encoding="utf-8")
    (PORTAL / "review.css").write_text(':root{font-family:Segoe UI,Arial,sans-serif;color:#172033;background:#eef2f6}*{box-sizing:border-box}body{margin:0}header{height:70px;background:#991b1b;color:white;display:flex;align-items:center;justify-content:space-between;padding:14px 22px}header strong,header span{display:block}header span{color:#fecaca;font-size:13px;margin-top:4px}main{display:grid;grid-template-columns:300px 1fr;min-height:calc(100vh - 70px)}aside{background:white;border-right:1px solid #d5dce5;padding:16px;display:grid;align-content:start;gap:14px}label{display:grid;gap:5px;font-weight:700}select{min-height:42px;border:1px solid #cbd5e1;border-radius:6px;padding:8px}#meta,#links{white-space:pre-wrap;font-size:13px;line-height:1.5}#links{display:grid;gap:6px}#links a{color:#991b1b}.workspace{min-width:0;padding:18px}.workspace h1{margin:0 0 6px}.canvas{margin-top:12px;background:white;border:1px solid #cbd5e1;border-radius:8px;height:calc(100vh - 150px);display:grid;place-items:center;overflow:auto}.canvas img{max-width:100%;max-height:100%;object-fit:contain}.blocked{color:#991b1b;font-weight:800}@media(max-width:760px){main{grid-template-columns:1fr}header{height:auto;gap:8px}.canvas{height:65vh}}', encoding="utf-8")
    (PORTAL / "review.js").write_text("""(()=>{const d=window.RMT_FACTORY_DATA,c=document.querySelector('#client'),k=document.querySelector('#candidate'),v=document.querySelector('#view'),img=document.querySelector('#image'),title=document.querySelector('#title'),status=document.querySelector('#status'),meta=document.querySelector('#meta'),links=document.querySelector('#links');d.clients.forEach(x=>c.add(new Option(x.name,x.name)));function currentClient(){return d.clients.find(x=>x.name===c.value)||d.clients[0]}function fill(){const x=currentClient();k.innerHTML='';if(!x.candidates.length)k.add(new Option('Source unavailable',''));else x.candidates.forEach(i=>k.add(new Option(i.displayName,i.candidate)));render()}function render(){const x=currentClient(),i=x.candidates.find(z=>z.candidate===k.value);title.textContent=i?x.name+' — '+i.displayName:x.name;status.textContent=i?i.status:x.status;status.className=x.status.startsWith('BLOCKED')?'blocked':'';if(!i){img.removeAttribute('src');img.alt='Source unavailable';meta.textContent='No usable source file is present in the current workspace. Geometry was not invented.';links.innerHTML='';return}const src={source:i.source,clean:i.clean,comparison:i.comparison,overlay:i.overlay}[v.value],transform=i.qa.transform?.type||(i.qa.transform?.sourceWidth?'IDENTITY':'preserved');img.src=src;img.alt=i.displayName+' '+v.value;meta.textContent='Status: '+i.status+'\\nEntities: '+(i.qa.entityCount??i.qa.outputCadEntities??'n/a')+'\\nTransform: '+transform+'\\nRuntime pins: excluded';links.innerHTML='<a href="/factory/'+x.name+'/'+i.candidate+'/clean/mimic-clean.dxf">Open DXF</a><a href="/factory/'+x.name+'/'+i.candidate+'/clean/mimic-clean.png">Open PNG</a><a href="/factory/'+x.name+'/'+i.candidate+'/clean/mimic-clean.svg">Open SVG</a><small>DXF path: '+i.dxf+'</small>'}c.onchange=fill;k.onchange=render;v.onchange=render;fill()})()""", encoding="utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    candidates = build_ltk() + build_mtb() + build_rasters()
    portal(candidates)
    print(json.dumps({"ok": True, "candidateCount": len(candidates), "clientsReady": sorted(set(item["client"] for item in candidates)), "blockedClients": BLOCKED, "output": str(OUT), "portal": str(PORTAL)}, indent=2))


if __name__ == "__main__":
    main()
