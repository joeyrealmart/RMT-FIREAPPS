const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "outputs", "rmt-ux-lab", "visual-review-v2");
const url = process.env.RMT_VISUAL_REVIEW_V2_URL || "http://127.0.0.1:8026/dev/visual-review-v2/index.html";
const expected = [
  "01-tech-desktop-current.png",
  "02-tech-desktop-proposed.png",
  "03-mobile-home-current.png",
  "04-mobile-home-option-a.png",
  "05-mobile-home-option-b.png",
  "06-mobile-inspection-current.png",
  "07-mobile-inspection-proposed.png",
  "08-mobile-mimic-current.png",
  "09-mobile-mimic-proposed.png",
  "10-admin-current.png",
  "11-admin-option-a.png",
  "12-admin-option-b.png",
];
const edge = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find(fs.existsSync);

for (const file of expected) {
  const target = path.join(output, file);
  assert.ok(fs.existsSync(target), `Missing review image: ${file}`);
  assert.ok(fs.statSync(target).size > 1000, `Review image is unexpectedly small: ${file}`);
}

(async () => {
  const browser = await chromium.launch(edge ? { executablePath: edge, headless: true } : { headless: true });
  const failures = [];
  try {
    for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      const failedRequests = [];
      page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => response.status() >= 400 && failedRequests.push(`${response.status()} ${response.url()}`));
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0));
      assert.equal(await page.locator("main > section").count(), 5, "Expected five comparison sections");
      assert.equal(await page.locator("main > section article img").count(), 12, "Expected twelve comparison images");
      const pointCounts = await page.locator(".why ul").evaluateAll((lists) => lists.map((list) => list.children.length));
      assert.ok(pointCounts.every((count) => count <= 3), "An option contains more than three short review points");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
      assert.equal(overflow, false, `${viewport.name} review page has horizontal overflow`);
      assert.deepEqual(errors, [], `${viewport.name} console errors: ${errors.join(" | ")}`);
      assert.deepEqual(failedRequests, [], `${viewport.name} failed requests: ${failedRequests.join(" | ")}`);
      const screenshot = path.join(output, `qa-${viewport.name}-review-page.png`);
      await page.screenshot({ path: screenshot, fullPage: viewport.name === "desktop" });
      failures.push({ viewport: viewport.name, overflow, consoleErrors: errors, failedRequests, screenshot });
      await page.close();
    }
    console.log(JSON.stringify({ ok: true, url, requiredImages: expected.length, sections: 5, qa: failures }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
