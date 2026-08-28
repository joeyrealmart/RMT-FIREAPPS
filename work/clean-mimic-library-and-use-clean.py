from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import unquote

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
LOCAL_DATA_URL = "/local-data/mimic-library/"
MIMIC_ROOT = ROOT / "outputs" / "rmt-fire-local-data" / "mimic-library"
MANIFEST = MIMIC_ROOT / "mimic-library-app-data.json"


def url_to_path(url: str) -> Path:
    if not url.startswith(LOCAL_DATA_URL):
        raise ValueError(f"Unsupported mimic URL: {url}")
    rel = unquote(url[len(LOCAL_DATA_URL):])
    return MIMIC_ROOT / Path(rel)


def path_to_url(path: Path) -> str:
    rel = path.relative_to(MIMIC_ROOT).as_posix()
    return f"{LOCAL_DATA_URL}{rel}"


def line_runs(mask: np.ndarray, min_len: int) -> np.ndarray:
    h, w = mask.shape
    keep = np.zeros_like(mask, dtype=bool)

    for y in range(h):
        row = mask[y]
        x = 0
        while x < w:
            if not row[x]:
                x += 1
                continue
            start = x
            while x < w and row[x]:
                x += 1
            if x - start >= min_len:
                keep[y, start:x] = True

    for x in range(w):
        col = mask[:, x]
        y = 0
        while y < h:
            if not col[y]:
                y += 1
                continue
            start = y
            while y < h and col[y]:
                y += 1
            if y - start >= min_len:
                keep[start:y, x] = True

    return keep


def diagonal_runs(mask: np.ndarray, min_len: int) -> np.ndarray:
    h, w = mask.shape
    keep = np.zeros_like(mask, dtype=bool)

    def scan(source: np.ndarray, flip: bool = False) -> None:
        for offset in range(-h + 1, w):
            diag = np.diagonal(source, offset=offset)
            coords = [(i, i + offset) if offset >= 0 else (i - offset, i) for i in range(len(diag))]
            run_start = None
            for i, value in enumerate(diag):
                if value and run_start is None:
                    run_start = i
                is_end = not value or i == len(diag) - 1
                if is_end and run_start is not None:
                    end = i + 1 if value and i == len(diag) - 1 else i
                    if end - run_start >= min_len:
                        for j in range(run_start, end):
                            y, x = coords[j]
                            if flip:
                                x = w - 1 - x
                            if 0 <= y < h and 0 <= x < w:
                                keep[y, x] = True
                    run_start = None

    scan(mask)
    scan(np.fliplr(mask), flip=True)
    return keep


def clean_structure(src: Path, dest: Path) -> None:
    image = Image.open(src).convert("RGB")
    arr = np.asarray(image).astype(np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    maxc = arr.max(axis=2)
    minc = arr.min(axis=2)
    saturation = maxc - minc
    luminance = 0.299 * r + 0.587 * g + 0.114 * b

    # Fast pin-safe cleaning: remove pale scan background and most colored pen marks
    # while keeping the original geometry exactly the same size.
    mask = ((luminance < 188) & (saturation < 58)) | (luminance < 80)
    structure_img = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8), "L")
    structure_img = structure_img.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))

    out = Image.new("RGB", image.size, "white")
    out.paste(Image.merge("RGB", (structure_img, structure_img, structure_img)))
    draw = ImageDraw.Draw(out)
    draw.rectangle((0, 0, image.width - 1, image.height - 1), outline="#d9e2ef", width=2)
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, optimize=True)


def clean_url_for(original_url: str) -> str:
    original_path = url_to_path(original_url)
    if not original_path.exists():
        raise FileNotFoundError(original_path)
    clean_dir = original_path.parent.parent / "clean"
    clean_path = clean_dir / f"{original_path.stem}-structure-clean.png"
    if not clean_path.exists() or clean_path.stat().st_mtime < original_path.stat().st_mtime:
        clean_structure(original_path, clean_path)
    return path_to_url(clean_path)


def source_original(entry: dict) -> str | None:
    original = entry.get("originalSrc") or entry.get("src")
    if not isinstance(original, str):
        return None
    if "/clean/" in original and isinstance(entry.get("cleanSourceOriginalSrc"), str):
        return entry["cleanSourceOriginalSrc"]
    if "/clean/" in original:
        return None
    return original


def existing_clean_url(entry: dict) -> str | None:
    clean_url = entry.get("cleanSrc")
    if not isinstance(clean_url, str) or "/clean/" not in clean_url:
        return None
    try:
        clean_path = url_to_path(clean_url)
    except ValueError:
        return None
    return clean_url if clean_path.exists() else None


def apply_clean(entry: dict, clean_cache: dict[str, str]) -> bool:
    original = source_original(entry)
    if not original:
        return False
    if original not in clean_cache:
        clean_cache[original] = existing_clean_url(entry) or clean_url_for(original)
    clean_url = clean_cache[original]
    entry["originalSrc"] = original
    entry["cleanSourceOriginalSrc"] = original
    entry["cleanSrc"] = clean_url
    entry["src"] = clean_url
    entry["cleanLayerStatus"] = "Clean-only pin-safe structure layer"
    return True


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    clean_cache: dict[str, str] = {}
    updated_entries = 0

    for company in manifest.get("companies", []):
        for page in company.get("pages", []):
            if apply_clean(page, clean_cache):
                updated_entries += 1

    for floor in manifest.get("floors", []):
        if apply_clean(floor, clean_cache):
            updated_entries += 1

    manifest["generatedAt"] = __import__("datetime").datetime.now().isoformat()
    manifest["cleanOnlyMode"] = True
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "uniqueImagesCleaned": len(clean_cache),
        "manifestEntriesUpdated": updated_entries,
    }, indent=2))


if __name__ == "__main__":
    main()
