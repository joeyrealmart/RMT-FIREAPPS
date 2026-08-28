from pathlib import Path
import sys


def read_pairs(path):
    lines = Path(path).read_text(errors="ignore").splitlines()
    for i in range(0, len(lines) - 1, 2):
        yield lines[i].strip(), lines[i + 1].rstrip("\n")


def as_float(value, default=0.0):
    try:
        return float(value.strip())
    except Exception:
        return default


def parse_texts(path):
    pairs = list(read_pairs(path))
    in_entities = False
    i = 0
    texts = []
    while i < len(pairs):
        code, value = pairs[i]
        if code == "0" and value == "SECTION" and i + 1 < len(pairs) and pairs[i + 1] == ("2", "ENTITIES"):
            in_entities = True
            i += 2
            continue
        if in_entities and code == "0" and value == "ENDSEC":
            break
        if not in_entities or code != "0" or value not in {"TEXT", "MTEXT"}:
            i += 1
            continue
        kind = value
        data = []
        i += 1
        while i < len(pairs) and pairs[i][0] != "0":
            data.append(pairs[i])
            i += 1
        text = ""
        x = y = 0.0
        for group, val in data:
            if group == "1":
                text = val.strip()
            elif group == "10":
                x = as_float(val)
            elif group == "20":
                y = as_float(val)
        if text:
            texts.append((x, y, kind, text))
    return texts


needle = sys.argv[2].lower()
for x, y, kind, text in parse_texts(sys.argv[1]):
    if needle in text.lower():
        print(f"{x:.3f},{y:.3f},{kind},{text}")
