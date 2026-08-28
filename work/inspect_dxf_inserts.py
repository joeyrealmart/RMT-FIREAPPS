import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dxf_preview import parse_dxf, first


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "MIMIC-R1 2000.dxf"
    entities = parse_dxf(path)
    total = 0
    for kind, data in entities:
        if kind != "INSERT":
            continue
        print(
            "INSERT",
            total,
            "block=", first(data, "2"),
            "layer=", first(data, "8"),
            "x=", first(data, "10"),
            "y=", first(data, "20"),
            "sx=", first(data, "41", "1"),
            "sy=", first(data, "42", "1"),
            "rot=", first(data, "50", "0"),
        )
        total += 1
        if total >= 80:
            break
    print("shown", total)
    print("total", sum(1 for kind, _ in entities if kind == "INSERT"))


if __name__ == "__main__":
    main()
