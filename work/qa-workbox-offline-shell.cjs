const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { existsSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const NODE = process.execPath;
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:8026";
const EDGE_PATHS = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"];
const assert = (condition, message) => { if (!condition) throw new Error(message); };

(async () => {
  execFileSync(NODE, ["tools/workbox-prototype/generate-rmt-offline-shell.mjs"], { cwd: ROOT, stdio: "inherit" });
  const browser = await chromium.launch({ headless: true, ...(EDGE_PATHS.find(existsSync) ? { executablePath: EDGE_PATHS.find(existsSync) } : {}) });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/?rmtOfflineShellPrototype=1`, { waitUntil: "networkidle" });
    const registration = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register("/sw-rmt-offline-prototype.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      return { scope: registration.scope, controller: Boolean(navigator.serviceWorker.controller) };
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.evaluate(() => fetch("/assets/qa-workbox-cached-mimic.svg").then((response) => response.text()));
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    const shellVisible = await page.locator("#loginView").count() === 1;
    const cachedMimic = await page.evaluate(() => fetch("/assets/qa-workbox-cached-mimic.svg").then((response) => response.ok));
    assert(shellVisible, "Cached application shell did not open offline.");
    assert(cachedMimic, "Cached approved mimic fixture did not reopen offline.");
    console.log(JSON.stringify({ ok: true, registration, shellVisible, cachedMimic }, null, 2));
  } finally {
    await context.setOffline(false).catch(() => {});
    await browser.close();
  }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
