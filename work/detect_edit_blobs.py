from PIL import Image, ImageChops
from collections import deque
from pathlib import Path

BASE = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\outputs\mtb-cad-preview\MTB-Level1-color-coded-preview.png")
EDIT = Path(r"C:\Users\Joey\Documents\Codex\2026-07-09\are-u-able-to-are\outputs\mtb-cad-preview\MTB-Level1-color-coded-preview-edit.png")

base = Image.open(BASE).convert("RGB")
edit = Image.open(EDIT).convert("RGB")
w, h = edit.size
diff = ImageChops.difference(base, edit)

mask = bytearray(w * h)
pix_e = edit.load()
pix_d = diff.load()
for y in range(h):
    for x in range(w):
        dr, dg, db = pix_d[x, y]
        if dr + dg + db < 80:
            continue
        r, g, b = pix_e[x, y]
        # Keep bright hand annotations, ignore tiny anti-alias differences.
        if max(r, g, b) - min(r, g, b) > 45 and max(r, g, b) > 120:
            mask[y * w + x] = 1

seen = bytearray(w * h)
components = []
for y in range(h):
    for x in range(w):
        idx = y * w + x
        if not mask[idx] or seen[idx]:
            continue
        q = deque([(x, y)])
        seen[idx] = 1
        xs, ys, colors = [], [], []
        while q:
            cx, cy = q.popleft()
            xs.append(cx)
            ys.append(cy)
            colors.append(pix_e[cx, cy])
            for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    ni = ny * w + nx
                    if mask[ni] and not seen[ni]:
                        seen[ni] = 1
                        q.append((nx, ny))
        if len(xs) >= 15:
            avg = tuple(sum(c[i] for c in colors) // len(colors) for i in range(3))
            components.append({
                "count": len(xs),
                "bbox": (min(xs), min(ys), max(xs), max(ys)),
                "center": (sum(xs) / len(xs), sum(ys) / len(ys)),
                "avg": avg,
            })

for c in sorted(components, key=lambda item: item["count"], reverse=True):
    print(c)
