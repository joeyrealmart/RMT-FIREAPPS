const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const edge = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
const assert = (value, message) => { if (!value) throw new Error(message); };
const root = path.resolve(__dirname, "..");
const reviewUrl = process.env.RMT_MIMIC_REVIEW_URL || "http://127.0.0.1:8031/";
const screenshotDir = path.join(root, "outputs", "rmt-mimic-lab", "LTK", "review", "screenshots");
const floors = ["main-panel", "feed-mill", "egg-production"];
const requiredAssets = ["background-cad-redraw.png", "background-cad-redraw.svg", "background-cad-redraw.dxf", "cad-source-overlay.png", "cad-style-comparison.png", "pin-alignment-overlay.png", "transform.json", "qa.json", "manifest-cad-redraw.json"];
(async () => {
  const browser = await chromium.launch(edge ? { executablePath: edge, headless: true } : { headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    const failedRequests = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || "failed"}`));
    page.on("response", (response) => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });
    await page.goto(reviewUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#reviewImage")?.naturalWidth > 0);
    const initial = await page.evaluate(() => { const image = document.querySelector("#reviewImage"); const rect = image.getBoundingClientRect(); return { drawings: document.querySelectorAll("#floorSelect option").length, floor: document.querySelector("#floorSelect").value, title: document.querySelector("#title").textContent, status: document.querySelector("#status").textContent, width: image.naturalWidth, height: image.naturalHeight, renderedWidth: rect.width, renderedHeight: rect.height, intersectsViewport: rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth, hasPinControls: Boolean(document.querySelector("#pinLayer, #addPin")), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
    assert(initial.drawings === 3 && initial.floor === "main-panel", "Expected three drawings with main panel first");
    assert(initial.status === "REVIEW_REQUIRED" && initial.width > 0 && initial.height > 0 && initial.renderedWidth > 0 && initial.renderedHeight > 0 && initial.intersectsViewport, "Expected visible review-required image in viewport");
    assert(!initial.hasPinControls, "Geometry review must not invent or edit candidate pins");
    assert(!initial.overflow, "Review page has horizontal overflow");
    fs.mkdirSync(screenshotDir, { recursive: true });
    const assetChecks = [];
    for (const floor of floors) {
      for (const asset of requiredAssets) {
        const localPath = path.join(root, "outputs", "rmt-mimic-lab", "LTK", floor, asset);
        assert(fs.existsSync(localPath) && fs.statSync(localPath).size > 0, `Missing or empty ${floor}/${asset}`);
        const response = await page.request.get(new URL(`LTK/${floor}/${asset}`, reviewUrl).href);
        assert(response.status() === 200, `${floor}/${asset} returned HTTP ${response.status()}`);
        assetChecks.push(`${floor}/${asset}`);
      }
      const qa = JSON.parse(fs.readFileSync(path.join(root, "outputs", "rmt-mimic-lab", "LTK", floor, "qa.json"), "utf8"));
      assert(qa.transform.type === "IDENTITY", `${floor} must retain identity transform`);
      assert(qa.runtimePinsIncluded === false, `${floor} must exclude runtime pins`);
      assert(qa.outputCadEntities > 0, `${floor} DXF must contain editable entities`);
    }
    const rendered = [];
    for (const floor of floors) {
      await page.locator("#floorSelect").selectOption(floor);
      for (const view of ["source", "revisionComparison", "overlay", "clean", "cadComparison", "cadOverlay", "cad", "pinAlignment"]) {
        await page.locator("#viewSelect").selectOption(view);
        await page.waitForFunction(() => { const image = document.querySelector("#reviewImage"); return image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0; });
      }
      const details = await page.evaluate(() => { const image = document.querySelector("#reviewImage"); return { title: document.querySelector("#title").textContent, src: image.src, width: image.naturalWidth, height: image.naturalHeight }; });
      assert(details.width > 0 && details.height > 0, `${floor} clean drawing did not render`);
      await page.locator("#viewSelect").selectOption("cad");
      await page.waitForFunction(() => document.querySelector("#reviewImage")?.src.includes("background-cad-redraw.png"));
      await page.screenshot({ path: path.join(screenshotDir, `${floor}-cad-redraw.png`), fullPage: true });
      rendered.push({ floor, ...details });
    }
    assert(rendered[1].title === "Feed Mill" && rendered[1].src.includes("feed-mill/pin-alignment-overlay.png"), "Drawing/view switching failed");
    assert(errors.length === 0, `Console errors: ${errors.join(" | ")}`);
    assert(failedRequests.length === 0, `Broken asset requests: ${failedRequests.join(" | ")}`);
    console.log(JSON.stringify({ ok: true, reviewUrl: page.url(), initial, rendered, assetCount: assetChecks.length, screenshotDir, consoleErrors: errors, failedRequests, productionIntegration: false }, null, 2));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
