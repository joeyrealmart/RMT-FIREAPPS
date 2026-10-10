import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const output = join(root, "tools", "sharp-poc", "output");
mkdirSync(output, { recursive: true });

const evidenceId = "poc-evidence-photo-timestamp-v1";
const originalPath = join(output, "original-evidence.png");
const derivedPath = join(output, "derived-evidence-1600.jpg");
const manifestPath = join(output, "evidence-manifest.json");

const original = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#e2e8f0" } })
  .composite([{ input: Buffer.from('<svg width="2400" height="1800" xmlns="http://www.w3.org/2000/svg"><rect x="700" y="400" width="1000" height="1000" fill="#b91c1c"/><text x="810" y="920" font-family="Arial" font-size="96" fill="white">RMT QA EVIDENCE</text></svg>') }])
  .png()
  .toBuffer();
const originalHashBefore = createHash("sha256").update(original).digest("hex");
writeFileSync(originalPath, original);

const derived = await sharp(original)
  .rotate()
  .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
  .jpeg({ quality: 82, mozjpeg: true })
  .toBuffer();
writeFileSync(derivedPath, derived);
const originalHashAfter = createHash("sha256").update(original).digest("hex");
const derivedMeta = await sharp(derived).metadata();

const manifest = {
  evidenceId,
  jobId: "POC-JOB-001",
  siteId: "POC-SITE",
  floorId: "POC-L1",
  deviceId: "POC.SD.1",
  technicianId: "tech@rmtfire.local",
  captureTimestamp: "2026-09-15T00:00:00.000Z",
  timezone: "Asia/Singapore",
  gps: null,
  original: { filename: "original-evidence.png", path: originalPath, sha256: originalHashBefore, preserved: originalHashBefore === originalHashAfter },
  derived: { filename: "derived-evidence-1600.jpg", path: derivedPath, format: derivedMeta.format, width: derivedMeta.width, height: derivedMeta.height, stampVersion: "poc-v1", syncState: "LOCAL" }
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
if (!manifest.original.preserved || derivedMeta.width > 1600 || derivedMeta.height > 1600) throw new Error("Sharp derivative proof failed integrity checks.");
console.log(JSON.stringify({ ok: true, manifest }, null, 2));
