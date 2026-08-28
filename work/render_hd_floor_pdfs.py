from pathlib import Path
import subprocess


ROOT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are")
SRC_DIR = ROOT / "outputs" / "mtb-cad-preview"
OUT_DIR = ROOT / "outputs" / "mtb-uploaded-floor-pdfs-hd"
POPPLER = Path(r"C:\Users\Joey\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin")
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
]


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in PDFS:
        src = SRC_DIR / name
        if not src.exists():
            continue
        prefix = OUT_DIR / Path(name).stem
        subprocess.run([str(PDFTOPPM), "-png", "-r", "360", str(src), str(prefix)], check=True)
    print(OUT_DIR)


if __name__ == "__main__":
    main()
