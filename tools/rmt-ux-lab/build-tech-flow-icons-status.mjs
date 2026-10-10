import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const source = path.join(root, "tools", "rmt-ux-lab", "technician-flow-icons-status");
const target = path.join(root, "docs", "reviews", "technician-flow-icons-status");
const screenshots = path.join(root, "outputs", "rmt-ux-lab", "screenshots");
const assets = {
  "current-desktop.png": "new-technician-03-device.png",
  "current-mobile-home.png": "mobile-technician-01-jobs.png",
  "current-mobile-inspection.png": "mobile-technician-03-device.png",
  "current-mimic.png": "mobile-technician-05-mimic.png",
};

rmSync(target, { recursive: true, force: true });
mkdirSync(path.join(target, "assets"), { recursive: true });
for (const file of ["index.html", "review.css", "review.js"]) cpSync(path.join(source, file), path.join(target, file));
for (const [name, file] of Object.entries(assets)) cpSync(path.join(screenshots, file), path.join(target, "assets", name));
console.log(JSON.stringify({ ok: true, target, screens: 4, currentAssets: Object.keys(assets).length }, null, 2));
