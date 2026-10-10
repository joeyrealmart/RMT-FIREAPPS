const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const assert = (value, message) => { if (!value) throw new Error(message); };
const edge = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
const url = process.env.RMT_UX_REVIEW_URL || "http://127.0.0.1:8026/dev/ux-review/";
const screenshot = path.resolve(__dirname, "../outputs/rmt-ux-lab/review/qa-review-page.png");

(async () => {
  const browser = await chromium.launch(edge ? { executablePath: edge, headless: true } : { headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], failed = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => response.status() >= 400 && failed.push(`${response.status()} ${response.url()}`));
    await page.goto(url, { waitUntil: "networkidle" });
    assert(await page.locator("#nav button").count() === 8, "Expected eight review pages");
    for (const id of ["summary", "tech-desktop", "tech-mobile", "checklist", "autofill", "admin", "integrity", "v1"]) {
      await page.locator(`#nav button[data-page='${id}']`).click();
      assert(await page.locator("#content").isVisible(), `${id} content is not visible`);
    }
    await page.locator("#nav button[data-page='tech-mobile']").click();
    await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
    assert(await page.locator(".shots img").count() === 6, "Expected six mobile screenshots");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    assert(!overflow, "UX review has horizontal overflow");
    assert(errors.length === 0, `Console errors: ${errors.join(" | ")}`);
    assert(failed.length === 0, `Failed requests: ${failed.join(" | ")}`);
    await page.screenshot({ path: screenshot, fullPage: true });
    console.log(JSON.stringify({ ok: true, url: page.url(), pages: 8, mobileScreenshots: 6, consoleErrors: errors, failedRequests: failed, screenshot }, null, 2));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
