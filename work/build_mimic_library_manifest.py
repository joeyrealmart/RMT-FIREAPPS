from __future__ import annotations

import csv
import json
import re
from pathlib import Path

import pypdfium2 as pdfium


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
LIBRARY = ROOT / "outputs" / "rmt-fire-local-data" / "mimic-library"
INDEX = LIBRARY / "mimic-library-index.csv"
MANIFEST = LIBRARY / "mimic-library-app-data.json"


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value or "mimic"


def rel_url(path: Path) -> str:
    rel = path.relative_to(ROOT / "outputs" / "rmt-fire-local-data")
    return "/local-data/" + rel.as_posix()


def render_pdf(pdf_path: Path, pages_dir: Path) -> list[dict]:
    pages_dir.mkdir(parents=True, exist_ok=True)
    doc = pdfium.PdfDocument(str(pdf_path))
    pages: list[dict] = []

    for index in range(len(doc)):
        page_no = index + 1
        output = pages_dir / f"page-{page_no:03d}.png"
        page = doc[index]
        width = float(page.get_width())
        height = float(page.get_height())

        if not output.exists():
            bitmap = page.render(scale=2.0)
            image = bitmap.to_pil()
            image.save(output)

        pages.append(
            {
                "pageNumber": page_no,
                "title": f"Page {page_no}",
                "src": rel_url(output),
                "fileName": output.name,
                "pdfWidth": width,
                "pdfHeight": height,
            }
        )

    return pages


def main() -> None:
    rows = list(csv.DictReader(INDEX.open("r", encoding="utf-8-sig")))
    companies: list[dict] = []
    floors: list[dict] = []

    for row in rows:
        if row.get("Status") != "Copied":
            continue

        company = row["Company"].strip()
        folder = Path(row["Folder"])
        copied_file = Path(row["CopiedFile"])
        pages_dir = folder / "pages"
        pages = render_pdf(copied_file, pages_dir)
        company_id = slugify(company)

        company_entry = {
            "id": company_id,
            "companyName": company,
            "siteName": company,
            "folder": str(folder),
            "pdfFile": copied_file.name,
            "pageCount": len(pages),
            "pages": [],
        }

        for page in pages:
            floor_code = f"P{page['pageNumber']}"
            floor_id = f"lib-{company_id}-{floor_code.lower()}"
            floor = {
                "id": floor_id,
                "library": True,
                "companyId": company_id,
                "companyName": company,
                "siteName": company,
                "floorCode": floor_code,
                "floorName": page["title"],
                "title": f"{company} - {page['title']}",
                "src": page["src"],
                "fileName": page["fileName"],
                "sourcePdf": copied_file.name,
                "pageNumber": page["pageNumber"],
                "pageCount": len(pages),
                "createdAt": "2026-07-20T00:00:00+08:00",
            }
            floors.append(floor)
            company_entry["pages"].append(
                {
                    "floorId": floor_id,
                    "pageNumber": page["pageNumber"],
                    "title": page["title"],
                    "src": page["src"],
                }
            )

        companies.append(company_entry)

    manifest = {
        "version": 1,
        "generatedAt": "2026-07-20T00:00:00+08:00",
        "companyCount": len(companies),
        "floorCount": len(floors),
        "companies": companies,
        "floors": floors,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"companies={len(companies)} floors={len(floors)}")
    print(MANIFEST)


if __name__ == "__main__":
    main()
