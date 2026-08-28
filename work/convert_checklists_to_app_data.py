from pathlib import Path
import csv
import json
import re


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
TEMPLATE_DIR = ROOT / "outputs" / "checklist-templates"
OUT_DIR = ROOT / "outputs" / "app-data"


DEVICE_TYPE_BY_TEMPLATE = {
    "fire-alarm-control-panel-checklist.md": "FAP",
    "hose-reel-system-checklist.md": "HR_SYSTEM",
    "sprinkler-system-checklist.md": "SPK_SYSTEM",
    "normal-hydrant-checklist.md": "HYD",
    "pressurized-hydrant-system-checklist.md": "HYD_PRESSURIZED",
    "portable-fire-extinguisher-checklist.md": "EXT",
    "fireman-intercom-system-checklist.md": "FI",
    "dry-riser-system-checklist.md": "DR",
    "tripping-system-checklist.md": "TRIP",
    "gas-release-system-checklist.md": "GAS",
}


def slugify(value):
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "_", value).strip("_")
    return value or "item"


def input_kind(input_type):
    text = input_type.lower()
    if "pass" in text and "fail" in text:
        return "status"
    if "yes" in text and "no" in text:
        return "boolean_status"
    if "date" in text:
        return "date"
    if "number" in text or "psi" in text or "/ v" in text or "seconds" in text:
        return "number"
    if "photo" in text:
        return "photo"
    if "scan" in text:
        return "scan"
    if "remark" in text or "text" in text:
        return "text"
    if "quantity" in text:
        return "number"
    return "text"


def parse_markdown_table(lines, start):
    rows = []
    i = start
    while i < len(lines) and lines[i].strip().startswith("|"):
        parts = [part.strip() for part in lines[i].strip().strip("|").split("|")]
        rows.append(parts)
        i += 1
    if len(rows) < 2:
        return [], start
    headers = rows[0]
    data = []
    for row in rows[2:]:
        if len(row) < len(headers):
            row += [""] * (len(headers) - len(row))
        data.append(dict(zip(headers, row)))
    return data, i


def parse_template(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    title = next((line[2:].strip() for line in lines if line.startswith("# ")), path.stem)
    template_id = slugify(path.stem.replace("-checklist", ""))
    template = {
        "template_id": template_id,
        "title": title,
        "source_file": str(path.relative_to(ROOT)).replace("\\", "/"),
        "applies_to_device_type": DEVICE_TYPE_BY_TEMPLATE.get(path.name, "UNKNOWN"),
        "sections": [],
    }

    section = None
    i = 0
    question_no = 1
    field_no = 1
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith("## "):
            section_title = line[3:].strip()
            section = {
                "section_id": slugify(section_title),
                "title": section_title,
                "fields": [],
                "questions": [],
                "repeatable_tables": [],
                "notes": [],
            }
            template["sections"].append(section)
            i += 1
            continue

        if section is None:
            i += 1
            continue

        if line.startswith("- "):
            label = line[2:].strip()
            section["fields"].append(
                {
                    "field_id": f"{template_id}_{slugify(label)}",
                    "label": label,
                    "input_type": "text",
                    "required": False,
                    "display_order": field_no,
                }
            )
            field_no += 1
            i += 1
            continue

        if line.startswith("|"):
            table, next_i = parse_markdown_table(lines, i)
            if table:
                headers = list(table[0].keys()) if table else []
                if "Item" in headers:
                    for row in table:
                        item = row.get("Item", "").strip()
                        if not item:
                            continue
                        input_type = row.get("Input Type", "Text").strip() or "Text"
                        section["questions"].append(
                            {
                                "question_id": f"{template_id}_q{question_no:04d}",
                                "question": item,
                                "input_type": input_kind(input_type),
                                "input_options": input_type,
                                "requires_photo_on_fail": True if input_kind(input_type) in {"status", "boolean_status"} else False,
                                "required": False,
                                "display_order": question_no,
                            }
                        )
                        question_no += 1
                else:
                    # Summary and detailed inspection tables become repeatable/nested data tables.
                    if any(key.lower() in {"no.", "no", "location", "pillar hydrant no."} for key in headers):
                        table_type = "repeatable"
                    else:
                        table_type = "summary"
                    section["repeatable_tables"].append(
                        {
                            "table_id": f"{template_id}_{slugify(section['title'])}_{len(section['repeatable_tables']) + 1}",
                            "table_type": table_type,
                            "columns": headers,
                            "sample_rows": table,
                        }
                    )
            i = next_i
            continue

        if line and not line.startswith("#"):
            section["notes"].append(line)
        i += 1

    return template


def flatten_questions(templates):
    rows = []
    for template in templates:
        for section in template["sections"]:
            for question in section["questions"]:
                rows.append(
                    {
                        "template_id": template["template_id"],
                        "template_title": template["title"],
                        "device_type": template["applies_to_device_type"],
                        "section_id": section["section_id"],
                        "section_title": section["title"],
                        **question,
                    }
                )
    return rows


def flatten_fields(templates):
    rows = []
    for template in templates:
        for section in template["sections"]:
            for field in section["fields"]:
                rows.append(
                    {
                        "template_id": template["template_id"],
                        "template_title": template["title"],
                        "device_type": template["applies_to_device_type"],
                        "section_id": section["section_id"],
                        "section_title": section["title"],
                        **field,
                    }
                )
    return rows


def write_csv(path, rows):
    if not rows:
        return
    fields = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    templates = [parse_template(path) for path in sorted(TEMPLATE_DIR.glob("*.md"))]
    (OUT_DIR / "checklist-templates.json").write_text(json.dumps(templates, indent=2), encoding="utf-8")
    write_csv(OUT_DIR / "checklist-questions.csv", flatten_questions(templates))
    write_csv(OUT_DIR / "checklist-setup-fields.csv", flatten_fields(templates))

    summary_rows = []
    for template in templates:
        questions = sum(len(section["questions"]) for section in template["sections"])
        fields = sum(len(section["fields"]) for section in template["sections"])
        tables = sum(len(section["repeatable_tables"]) for section in template["sections"])
        summary_rows.append(
            {
                "template_id": template["template_id"],
                "title": template["title"],
                "device_type": template["applies_to_device_type"],
                "sections": len(template["sections"]),
                "setup_fields": fields,
                "questions": questions,
                "repeatable_or_summary_tables": tables,
                "source_file": template["source_file"],
            }
        )
    write_csv(OUT_DIR / "checklist-template-summary.csv", summary_rows)
    print(OUT_DIR)
    print(f"templates: {len(templates)}")
    print(f"questions: {len(flatten_questions(templates))}")
    print(f"setup fields: {len(flatten_fields(templates))}")


if __name__ == "__main__":
    main()
