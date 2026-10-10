const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const review = path.join(root, "docs", "reviews", "technician-flow-icons-status");
const screenshots = path.join(review, "screenshots");
const pages = ["summary", "desktop", "mobile-home", "inspection", "mimic"];
const edge = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find(fs.existsSync);

(async () => {
  for (const file of ["index.html", "review.css", "review.js", "current-desktop.png", "current-mobile-home.png", "current-mobile-inspection.png", "current-mimic.png"]) {
    const full = file.endsWith(".png") ? path.join(review, "assets", file) : path.join(review, file);
    assert.ok(fs.existsSync(full) && fs.statSync(full).size > 0, `Missing review asset: ${file}`);
  }
  fs.mkdirSync(screenshots, { recursive: true });
  const browser = await chromium.launch(edge ? { headless: true, executablePath: edge } : { headless: true });
  const results = [];
  try {
    for (const test of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport: { width: test.width, height: test.height } });
      const page = await context.newPage();
      const errors = [];
      const failed = [];
      page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("requestfailed", (request) => failed.push(request.url()));
      await page.goto(pathToFileURL(path.join(review, "index.html")).href, { waitUntil: "load" });
      await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
      assert.equal(await page.locator("[data-page]").count(), pages.length, "Review navigation count");
      assert.ok(await page.locator(".icon-grid svg").count() >= 10, "System icon set is incomplete");
      for (const id of pages) {
        await page.locator(`[data-page="${id}"]`).click();
        assert.equal(await page.locator(`[data-view="${id}"]`).isVisible(), true, `Page not visible: ${id}`);
        assert.equal(await page.locator(".review-page.active").count(), 1, `More than one active page: ${id}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `${test.name} overflow on ${id}: ${overflow}px`);
        if (test.name === "desktop" && id !== "summary") {
          await page.locator(`[data-view="${id}"] .proposed`).screenshot({ path: path.join(screenshots, `${id}-proposed.png`) });
        }
      }
      assert.equal(await page.getByText("SAVE & NEXT", { exact: true }).count() >= 2, true, "Primary action not shown consistently");
      assert.deepEqual(errors, [], `Console errors: ${errors.join(" | ")}`);
      assert.deepEqual(failed, [], `Failed requests: ${failed.join(" | ")}`);
      await page.screenshot({ path: path.join(screenshots, `review-${test.name}.png`), fullPage: true });
      results.push({ viewport: test.name, pages: pages.length, consoleErrors: 0, failedRequests: 0, overflow: 0 });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ ok: true, review, screenshots, results }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
