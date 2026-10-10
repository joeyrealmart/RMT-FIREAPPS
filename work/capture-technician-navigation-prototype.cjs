const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const ROOT = join(__dirname, "..", "docs", "reviews", "technician-nav");
const PROTOTYPE = join(ROOT, "prototype", "index.html");
const OUTPUT = join(ROOT, "screenshots", "proposed");
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

async function main() {
  mkdirSync(OUTPUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: EDGE_PATH });
  const errors = [];

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  desktop.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await desktop.goto(`${pathToFileURL(PROTOTYPE).href}?view=desktop`, { waitUntil: "load" });
  await desktop.locator('[data-screen="desktop"]').screenshot({ path: join(OUTPUT, "01-desktop-expanded-rail.png") });
  await desktop.goto(`${pathToFileURL(PROTOTYPE).href}?view=collapsed`, { waitUntil: "load" });
  await desktop.locator('[data-screen="collapsed"]').screenshot({ path: join(OUTPUT, "02-desktop-collapsed-rail.png") });

  const mobile = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  mobile.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  for (const [view, file] of [
    ["mobile-home", "03-mobile-system-drawer.png"],
    ["mobile-checklist", "04-mobile-active-checklist.png"],
    ["mobile-mimic", "05-mobile-mimic.png"]
  ]) {
    await mobile.goto(`${pathToFileURL(PROTOTYPE).href}?view=${view}`, { waitUntil: "load" });
    await mobile.locator(`[data-screen="${view}"]`).screenshot({ path: join(OUTPUT, file) });
  }

  await browser.close();
  if (errors.length) throw new Error(`Prototype console errors: ${errors.join(" | ")}`);
  process.stdout.write("Technician navigation prototype screenshots: PASS\n");
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
