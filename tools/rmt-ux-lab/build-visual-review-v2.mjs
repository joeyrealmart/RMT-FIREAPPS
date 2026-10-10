import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(import.meta.dirname, "../..");
const output = path.join(root, "outputs", "rmt-ux-lab", "visual-review-v2");
const served = path.join(root, "outputs", "fire-inspection-mvp", "dev", "visual-review-v2");
const current = path.join(root, "outputs", "rmt-ux-lab", "screenshots");
const mockupFile = path.join(root, "tools", "rmt-ux-lab", "visual-review-v2", "mockups.html");
const edge = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);

mkdirSync(output, { recursive: true });
mkdirSync(served, { recursive: true });

const currentImages = {
  "01-tech-desktop-current.png": "new-technician-03-device.png",
  "03-mobile-home-current.png": "mobile-technician-01-jobs.png",
  "06-mobile-inspection-current.png": "mobile-technician-03-device.png",
  "08-mobile-mimic-current.png": "mobile-technician-05-mimic.png",
  "10-admin-current.png": "admin-01-control-desk.png",
};
for (const [target, source] of Object.entries(currentImages)) cpSync(path.join(current, source), path.join(output, target));

const proposed = {
  "02-tech-desktop-proposed.png": "#tech-desktop",
  "04-mobile-home-option-a.png": "#mobile-home-a",
  "05-mobile-home-option-b.png": "#mobile-home-b",
  "07-mobile-inspection-proposed.png": "#mobile-inspection",
  "09-mobile-mimic-proposed.png": "#mobile-mimic",
  "11-admin-option-a.png": "#admin-a",
  "12-admin-option-b.png": "#admin-b",
};

const browser = await chromium.launch(edge ? { executablePath: edge, headless: true } : { headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(mockupFile).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
  for (const [file, selector] of Object.entries(proposed)) {
    const target = page.locator(selector);
    await target.scrollIntoViewIfNeeded();
    await target.screenshot({ path: path.join(output, file) });
  }
} finally {
  await browser.close();
}

const sections = [
  {
    id: "tech-desktop", title: "Technician Desktop", choice: "Current / Proposed / Modify",
    options: [
      { label: "CURRENT", image: "01-tech-desktop-current.png", points: ["Working hierarchy", "Device identity is clear", "Too many equal actions"] },
      { label: "PROPOSED", image: "02-tech-desktop-proposed.png", points: ["Device and result first", "Sync beside the action", "Back and Mimic stay secondary"] },
    ],
  },
  {
    id: "mobile-home", title: "Technician Mobile Home", choice: "A / B / Modify",
    options: [
      { label: "CURRENT", image: "03-mobile-home-current.png", points: ["Current flow works", "Uses a narrow column", "Systems require scrolling"] },
      { label: "OPTION A", image: "04-mobile-home-option-a.png", points: ["Full-width system cards", "Progress remains visible", "Status is easy to scan"] },
      { label: "OPTION B", image: "05-mobile-home-option-b.png", points: ["Resume action dominates", "Exceptions stay near top", "Denser system list"] },
    ],
  },
  {
    id: "inspection", title: "Mobile Inspection", choice: "Proposed / Modify",
    options: [
      { label: "CURRENT", image: "06-mobile-inspection-current.png", points: ["Device card is functional", "Navigation precedes work", "Normal PASS needs scrolling"] },
      { label: "PROPOSED", image: "07-mobile-inspection-proposed.png", points: ["PASS visible immediately", "Evidence is compact", "Save & Next is sticky"] },
    ],
  },
  {
    id: "mimic", title: "Mobile Mimic", choice: "Proposed / Modify",
    options: [
      { label: "CURRENT", image: "08-mobile-mimic-current.png", points: ["Selected pin is clear", "Stage content consumes space", "Device action is separated"] },
      { label: "PROPOSED", image: "09-mobile-mimic-proposed.png", points: ["Map fills the viewport", "Zoom stays reachable", "Selected device opens from sheet"] },
    ],
  },
  {
    id: "admin", title: "Admin Control Desk", choice: "A / B / Modify",
    options: [
      { label: "CURRENT", image: "10-admin-current.png", points: ["Workspace architecture works", "Too many equal summary cards", "Attention order is weak"] },
      { label: "OPTION A", image: "11-admin-option-a.png", points: ["Four exception cards first", "Jobs and staff visible together", "Queues stay separate"] },
      { label: "OPTION B", image: "12-admin-option-b.png", points: ["One prioritized action queue", "Live jobs remain central", "Fastest 30-second scan"] },
    ],
  },
];

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const htmlSections = sections.map((section) => `<section id="${section.id}"><header><div><span>VISUAL REVIEW</span><h2>${esc(section.title)}</h2></div><b>${esc(section.choice)}</b></header><div class="options ${section.options.length === 3 ? "three" : "two"}">${section.options.map((option) => `<article><div class="option-head"><strong>${esc(option.label)}</strong><button data-choice="${esc(section.id)}:${esc(option.label)}">SELECT</button></div><img src="${esc(option.image)}" alt="${esc(section.title)} ${esc(option.label)}"><div class="why"><b>WHY BETTER</b><ul>${option.points.map((point) => `<li>${esc(point)}</li>`).join("")}</ul></div></article>`).join("")}</div></section>`).join("");

const reviewHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RMT Visual UX Review V2</title><link rel="icon" href="data:,"><link rel="stylesheet" href="review.css"></head><body><aside><strong>RMT UX V2</strong><small>Current vs visual alternatives</small><nav>${sections.map((section) => `<a href="#${section.id}">${esc(section.title)}</a>`).join("")}</nav><p>Review only. Production is unchanged.</p></aside><main><div class="hero"><div><span>RMT FIREAPPS</span><h1>Visual UX Review Round 2</h1><p>Choose a direction. Implementation starts only after approval.</p></div><b>7/7 current journeys pass</b></div>${htmlSections}</main><script>document.querySelectorAll('[data-choice]').forEach(button=>{button.onclick=()=>{const [group]=button.dataset.choice.split(':');document.querySelectorAll('[data-choice^="'+group+':"]').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');localStorage.setItem('rmtVisualV2::'+group,button.dataset.choice)}})</script></body></html>`;
const reviewCss = `:root{font-family:Inter,Segoe UI,Arial,sans-serif;color:#14213d;background:#eef2f6}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;display:grid;grid-template-columns:220px minmax(0,1fr)}aside{position:sticky;top:0;height:100vh;padding:24px 16px;background:#17243a;color:white}aside strong{font-size:20px}aside small,aside p{display:block;color:#b7c2d2;margin-top:6px}aside nav{display:grid;gap:6px;margin-top:26px}aside a{padding:11px 12px;border-radius:6px;color:white;text-decoration:none;font-weight:700}aside a:hover{background:#2c3b51}main{min-width:0;padding:24px}.hero{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding:20px 22px;background:white;border:1px solid #d9e0e9;border-radius:8px}.hero span,section header span{color:#c91d2e;font-size:11px;font-weight:850;letter-spacing:.08em}.hero h1{margin:4px 0;font-size:29px}.hero p{margin:0;color:#687487}.hero>b{padding:7px 11px;border-radius:999px;background:#ddf6e8;color:#0b7a45}section{scroll-margin-top:18px;margin-bottom:22px}section>header{display:flex;justify-content:space-between;align-items:end;margin-bottom:9px}section h2{margin:3px 0 0;font-size:21px}.options{display:grid;gap:12px}.options.two{grid-template-columns:repeat(2,minmax(0,1fr))}.options.three{grid-template-columns:repeat(3,minmax(0,1fr))}.options article{min-width:0;padding:10px;background:white;border:1px solid #d8dfe8;border-radius:8px}.option-head{display:flex;justify-content:space-between;align-items:center;padding:3px 3px 9px}.option-head button{border:1px solid #c9d2df;border-radius:6px;background:white;color:#173d78;padding:7px 10px;font-weight:800}.option-head button.selected{border-color:#c91d2e;background:#c91d2e;color:white}.options img{display:block;width:100%;height:480px;object-fit:contain;background:#e9edf2;border:1px solid #e0e5ec}.three img{height:520px}.why{padding:10px 4px 3px}.why>b{font-size:11px;color:#c91d2e}.why ul{margin:7px 0 0;padding-left:18px;color:#526074;font-size:13px}.why li{margin:4px 0}@media(max-width:900px){body{grid-template-columns:1fr}aside{position:relative;height:auto}aside nav{grid-template-columns:repeat(2,1fr)}main{padding:14px}.options.two,.options.three{grid-template-columns:1fr}.options img,.three img{height:auto}.hero{align-items:flex-start;gap:14px}}`;

writeFileSync(path.join(output, "index.html"), reviewHtml);
writeFileSync(path.join(output, "review.css"), reviewCss);

for (const file of [...Object.keys(currentImages), ...Object.keys(proposed), "index.html", "review.css", "local-ollama-critique.json"]) {
  const source = path.join(output, file);
  if (existsSync(source)) cpSync(source, path.join(served, file));
}

console.log(JSON.stringify({ ok: true, output, served, images: [...Object.keys(currentImages), ...Object.keys(proposed)], sections: sections.length }, null, 2));
