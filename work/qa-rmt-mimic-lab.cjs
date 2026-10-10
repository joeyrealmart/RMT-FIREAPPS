const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const lab = path.join(root, "outputs", "rmt-mimic-lab", "LTK");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const assert = (value, message) => { if (!value) throw new Error(message); };
for (const file of ["analysis/mimic-analysis.json", "analysis/transformation-metadata.json", "analysis/production-checksums.json", "review/index.html", "review/review.js", "review/review-data.js"]) assert(fs.existsSync(path.join(lab, file)), `Missing ${file}`);
const analysis = readJson(path.join(lab, "analysis/mimic-analysis.json"));
assert(analysis.pages.length === 4, "Expected four interpreted source pages");
assert(analysis.pages[0].role === "MAIN_PANEL_OVERALL_BUILDING", "Page 1 role is incorrect");
assert(analysis.pages[1].role === "FEED_MILL_DETAIL", "Page 2 role is incorrect");
assert(analysis.pages[2].role === "EGG_PRODUCTION_DETAIL", "Page 3 role is incorrect");
assert(analysis.pages[3].role === "DEVICE_SCHEDULE_REFERENCE", "Page 4 must remain reference-only");
const floorResults = {};
for (const floor of ["main-panel", "feed-mill", "egg-production"]) {
  const directory = path.join(lab, floor);
  for (const file of ["source-reference.png", "structure-mask.png", "background-revision-2.png", "background-revision-2.svg", "background-revision-2.dxf", "manifest-revision-2.json", "background-clean.png", "background-clean.svg", "background-clean.dxf", "before-after.png", "revision-comparison.png", "overlay-review.png", "manifest.json", "review-status.json"]) {
    const target = path.join(directory, file);
    assert(fs.existsSync(target) && fs.statSync(target).size > 100, `Missing or empty ${floor}/${file}`);
  }
  const manifest = readJson(path.join(directory, "manifest.json"));
  const review = readJson(path.join(directory, "review-status.json"));
  assert(manifest.coordinateTransform.type === "IDENTITY", `${floor} changed source coordinates`);
  assert(manifest.containsRuntimePins === false, `${floor} background contains runtime pin data`);
  assert(manifest.backgroundVersion === "deterministic-reconstruction-v3", `${floor} is not the Revision 3 reconstruction`);
  assert(manifest.geometry.segmentCount > 20, `${floor} has insufficient extracted geometry`);
  assert(manifest.geometry.revision2SegmentCount > manifest.geometry.segmentCount, `${floor} Revision 3 did not reduce raw segment density`);
  assert(manifest.geometry.removedUnsupportedSegments > 0, `${floor} did not record unsupported-stroke suppression`);
  assert(review.status === "REVIEW_REQUIRED", `${floor} must not be auto-approved`);
  const svg = fs.readFileSync(path.join(directory, "background-clean.svg"), "utf8");
  assert(svg.startsWith("<svg") && (svg.match(/<line /g) || []).length === manifest.geometry.segmentCount, `${floor} SVG does not match manifest segments`);
  const dxf = fs.readFileSync(path.join(directory, "background-clean.dxf"), "ascii").replace(/\r\n/g, "\n");
  assert(dxf.includes("SECTION\n2\nENTITIES") && dxf.endsWith("0\nEOF\n"), `${floor} DXF structure is invalid`);
  assert((dxf.match(/\nLINE\n/g) || []).length === manifest.geometry.segmentCount, `${floor} DXF line count does not match manifest`);
  floorResults[floor] = { revision2Segments: manifest.geometry.revision2SegmentCount, revision3Segments: manifest.geometry.segmentCount, diagonalsForReview: manifest.geometry.diagonalSegments, pngSha256: hash(path.join(directory, "background-clean.png")) };
}
const checksums = readJson(path.join(lab, "analysis", "production-checksums.json"));
assert(checksums.unchanged === true, "Production pin/device-bearing file checksums changed");
console.log(JSON.stringify({ ok: true, pageRoles: analysis.pages.map((page) => page.role), floors: floorResults, productionChecksumsUnchanged: true, productionIntegration: false }, null, 2));
