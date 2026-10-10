import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const source = path.join(root, "tools", "rmt-ux-lab", "visual-review-v3");
const primary = path.join(root, "outputs", "rmt-ux-lab", "visual-review-v3");
const served = path.join(root, "outputs", "fire-inspection-mvp", "dev", "visual-review-v3");
const published = path.join(root, "docs", "reviews", "ux-v3");
const screenshots = path.join(root, "outputs", "rmt-ux-lab", "screenshots");
const v2 = path.join(root, "outputs", "rmt-ux-lab", "visual-review-v2");

const assets = {
  "tech-desktop-current.png": path.join(screenshots, "new-technician-03-device.png"),
  "tech-desktop-a.png": path.join(v2, "02-tech-desktop-proposed.png"),
  "mobile-home-current.png": path.join(screenshots, "mobile-technician-01-jobs.png"),
  "mobile-home-a.png": path.join(v2, "04-mobile-home-option-a.png"),
  "mobile-home-b.png": path.join(v2, "05-mobile-home-option-b.png"),
  "mobile-inspection-current.png": path.join(screenshots, "mobile-technician-03-device.png"),
  "mobile-inspection-a.png": path.join(v2, "07-mobile-inspection-proposed.png"),
  "mimic-current.png": path.join(screenshots, "mobile-technician-05-mimic.png"),
  "mimic-a.png": path.join(v2, "09-mobile-mimic-proposed.png"),
  "admin-current.png": path.join(screenshots, "admin-01-control-desk.png"),
  "admin-a.png": path.join(v2, "11-admin-option-a.png"),
  "admin-b.png": path.join(v2, "12-admin-option-b.png"),
};

for (const [name, file] of Object.entries(assets)) {
  if (!existsSync(file)) throw new Error(`Missing Round 3 source asset: ${name} <- ${file}`);
}

function build(target) {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(path.join(target, "assets"), { recursive: true });
  for (const file of ["README.md", "index.html", "review.css", "review.js"]) cpSync(path.join(source, file), path.join(target, file));
  for (const [name, file] of Object.entries(assets)) cpSync(file, path.join(target, "assets", name));
}

build(primary);
build(served);
build(published);

console.log(JSON.stringify({ ok: true, primary, served, published, pages: 10, assets: Object.keys(assets).length }, null, 2));
