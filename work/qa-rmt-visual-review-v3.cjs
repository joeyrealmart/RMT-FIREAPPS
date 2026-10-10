const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "outputs", "rmt-ux-lab", "visual-review-v3");
const PUBLISHED = path.join(ROOT, "docs", "reviews", "ux-v3");
const URL = "http://127.0.0.1:8026/dev/visual-review-v3/index.html";
const EXPECTED_PAGES = ["summary", "desktop", "mobile-home", "inspection", "mimic", "admin", "checklist", "autofill", "integrity", "flows"];
const EXPECTED_IMAGES = [
  "tech-desktop-current.png", "tech-desktop-a.png", "mobile-home-current.png", "mobile-home-a.png",
  "mobile-home-b.png", "mobile-inspection-current.png", "mobile-inspection-a.png", "mimic-current.png",
  "mimic-a.png", "admin-current.png", "admin-a.png", "admin-b.png",
];
const EDGE_PATH = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((file) => fs.existsSync(file));

(async () => {
  const packageFiles = ["README.md", "index.html", "review.css", "review.js", ...EXPECTED_IMAGES.map((name) => path.join("assets", name))];
  for (const file of packageFiles) {
    const full = path.join(OUTPUT, file);
    assert.ok(fs.existsSync(full), `Missing review file: ${file}`);
    assert.ok(fs.statSync(full).size > 0, `Empty review file: ${file}`);
    const published = path.join(PUBLISHED, file);
    assert.ok(fs.existsSync(published), `Missing published review file: ${file}`);
    assert.ok(fs.statSync(published).size > 0, `Empty published review file: ${file}`);
    assert.equal(fs.readFileSync(published).equals(fs.readFileSync(full)), true, `Published review file differs: ${file}`);
  }

  const browser = await chromium.launch(EDGE_PATH ? { headless: true, executablePath: EDGE_PATH } : { headless: true });
  const results = [];
  try {
    for (const test of [
      { name: "desktop", viewport: { width: 1440, height: 900 } },
      { name: "mobile", viewport: { width: 390, height: 844 } },
    ]) {
      const context = await browser.newContext({ viewport: test.viewport });
      const page = await context.newPage();
      const consoleErrors = [];
      const failedRequests = [];
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("requestfailed", (request) => failedRequests.push(`${request.url()} ${request.failure()?.errorText || "failed"}`));

      const response = await page.goto(URL, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200, `${test.name} review HTTP status`);
      await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));

      assert.equal(await page.locator("[data-page]").count(), EXPECTED_PAGES.length, `${test.name} navigation page count`);
      for (const id of EXPECTED_PAGES) {
        await page.locator(`[data-page="${id}"]`).click();
        await page.waitForTimeout(40);
        assert.equal(await page.locator(`[data-view="${id}"]`).isVisible(), true, `${test.name} page visible: ${id}`);
        assert.equal(await page.locator(".page.active").count(), 1, `${test.name} only one page active: ${id}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `${test.name} horizontal overflow on ${id}: ${overflow}px`);
        if (test.name === "desktop") await page.screenshot({ path: path.join(OUTPUT, `review-${id}.png`), fullPage: true });
      }

      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await page.locator('[data-view="flows"]').isVisible(), true, `${test.name} selected page persists after refresh`);
      assert.deepEqual(consoleErrors, [], `${test.name} console errors`);
      assert.deepEqual(failedRequests, [], `${test.name} failed requests`);
      await page.screenshot({ path: path.join(OUTPUT, `qa-${test.name}.png`), fullPage: true });
      results.push({ viewport: test.name, pages: EXPECTED_PAGES.length, images: await page.locator("img").count(), consoleErrors: 0, failedRequests: 0 });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ ok: true, url: URL, published: PUBLISHED, publishedFiles: packageFiles.length, results }, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
