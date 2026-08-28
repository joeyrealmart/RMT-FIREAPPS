from dxf_find_text import parse_texts
import sys


min_x, min_y, max_x, max_y = [float(v) for v in sys.argv[2:6]]
for x, y, kind, text in parse_texts(sys.argv[1]):
    if min_x <= x <= max_x and min_y <= y <= max_y:
        print(f"{x:.3f},{y:.3f},{text}")
