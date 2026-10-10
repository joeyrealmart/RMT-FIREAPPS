from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FACTORY_INDEX = ROOT / "outputs" / "rmt-mimic-factory" / "factory-index.json"
STATUS_DIR = ROOT / ".mimic"


def main() -> None:
    factory = json.loads(FACTORY_INDEX.read_text(encoding="utf-8"))
    items = []
    for client in factory.get("clients", []):
        candidates = client.get("candidates", [])
        if not candidates:
            items.append({
                "client": client["name"],
                "mimicId": None,
                "displayName": None,
                "status": "BLOCKED_SOURCE_MISSING",
                "source": None,
                "outputs": None,
                "qaStatus": "NOT_RUN_SOURCE_MISSING",
                "blocker": "Authoritative source drawing is not available in the Mimic Factory input set.",
                "acceptanceCriteria": [],
                "approved": False,
                "productionIntegrated": False,
            })
            continue
        for candidate in candidates:
            items.append({
                "client": candidate["client"],
                "mimicId": candidate["candidate"],
                "displayName": candidate["displayName"],
                "status": candidate["status"],
                "source": candidate["source"],
                "outputs": {
                    "dxf": candidate["dxf"],
                    "svg": candidate["svg"],
                    "png": candidate["png"],
                    "comparison": candidate["comparison"],
                    "overlay": candidate["overlay"],
                },
                "qaStatus": candidate.get("qa", {}).get("status", "UNKNOWN"),
                "blocker": None,
                "acceptanceCriteria": [
                    "Source geometry is the authority; no invented geometry.",
                    "DXF, SVG, PNG, comparison, overlay, and transform manifest exist.",
                    "Runtime pins are excluded from the background candidate.",
                    "Joey visual review is required before production integration.",
                ],
                "approved": False,
                "productionIntegrated": False,
            })

    source_backed = sum(item["source"] is not None for item in items)
    blocked = sum(item["status"] == "BLOCKED_SOURCE_MISSING" for item in items)
    manifest = {
        "schemaVersion": 1,
        "generatedAt": factory.get("generatedAt"),
        "sourceIndex": "outputs/rmt-mimic-factory/factory-index.json",
        "productionIntegration": False,
        "summary": {
            "sourceBackedCandidates": source_backed,
            "blockedClients": blocked,
            "approvedCandidates": 0,
        },
        "items": items,
    }

    STATUS_DIR.mkdir(parents=True, exist_ok=True)
    (STATUS_DIR / "status-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )

    lines = [
        "# RMT Mimic Factory Status",
        "",
        "Generated from `outputs/rmt-mimic-factory/factory-index.json`.",
        "This inventory is review-only and does not authorize production background or pin changes.",
        "",
        f"- Source-backed candidates: {source_backed}",
        f"- Blocked clients (source missing): {blocked}",
        "- Approved/integrated candidates: 0",
        "",
        "| Client | Mimic | Status | QA | DXF | PNG | SVG |",
        "|---|---|---|---|---|---|---|",
    ]
    for item in items:
        outputs = item["outputs"] or {}
        lines.append(
            "| {client} | {mimic} | {status} | {qa} | {dxf} | {png} | {svg} |".format(
                client=item["client"],
                mimic=item["displayName"] or "-",
                status=item["status"],
                qa=item["qaStatus"],
                dxf=outputs.get("dxf", "-"),
                png=outputs.get("png", "-"),
                svg=outputs.get("svg", "-"),
            )
        )
    (STATUS_DIR / "STATUS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
