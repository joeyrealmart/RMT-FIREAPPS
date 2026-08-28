from pathlib import Path
import subprocess

ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
SRC_DIR = ROOT / "outputs" / "mtb-cad-preview"
OUT_DIR = ROOT / "outputs" / "mtb-uploaded-floor-pdfs"
POPPLER = Path(r"C:\Users\Joey\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin")
PDFINFO = POPPLER / "pdfinfo.exe"
PDFTOPPM = POPPLER / "pdftoppm.exe"

PDFS = [
    "basement.pdf",
    "L1.pdf",
    "L2.pdf",
    "L3.pdf",
    "L4-5.pdf",
    "L6.pdf",
    "L7.pdf",
    "L8.pdf",
    "L9.pdf",
    "L10-23.pdf",
    "L24.pdf",
    "ROOF.pdf",
    "ELEVATION.pdf",
]


def run(args):
    return subprocess.run(args, text=True, capture_output=True, check=False)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index = ["# MTB Uploaded Floor PDFs", "", "Rendered from the uploaded floor-by-floor PDF drawings.", ""]
    for name in PDFS:
        src = SRC_DIR / name
        if not src.exists():
            index.append(f"- {name}: missing")
            continue
        info = run([str(PDFINFO), str(src)])
        pages = "?"
        for line in info.stdout.splitlines():
            if line.startswith("Pages:"):
                pages = line.split(":", 1)[1].strip()
                break
        prefix = OUT_DIR / Path(name).stem
        render = run([str(PDFTOPPM), "-png", "-r", "180", str(src), str(prefix)])
        pngs = sorted(OUT_DIR.glob(f"{Path(name).stem}-*.png"))
        links = ", ".join(f"[{p.name}]({p.name})" for p in pngs) if pngs else "render failed"
        index.append(f"- {name}: {pages} page(s), {links}")
    (OUT_DIR / "index.md").write_text("\n".join(index) + "\n", encoding="utf-8")
    print(OUT_DIR)


if __name__ == "__main__":
    main()
