const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const fs = require("node:fs");
const path = require("node:path");
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
const BASE = process.env.BASE_URL || "http://127.0.0.1:8026";
const assert = (value, message) => { if (!value) throw new Error(message); };
const unique = (suffix) => `OFFLINE-POC-QA-${Date.now()}-${suffix}`;

async function setContext(page, job, tech, device) {
  await page.locator("#jobId").fill(job); await page.locator("#jobId").blur();
  await page.locator("#technician").selectOption(tech); await page.locator("#device").selectOption(device);
}
async function text(page, selector) { return (await page.locator(selector).textContent()).trim(); }

(async () => {
  const browser = await chromium.launch({ headless:true, ...(EDGE ? { executablePath:EDGE } : {}) });
  try {
    const context = await browser.newContext(); const page = await context.newPage(); const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    const job = unique("SYNC");
    await page.goto(`${BASE}/dev/offline-poc/index.html?enable=1`, { waitUntil:"domcontentloaded" });
    await page.waitForFunction(() => ["Ready", "Error"].includes(document.querySelector("#dbStatus")?.textContent));
    if ((await text(page, "#dbStatus")) !== "Ready") throw new Error(`POC initialization failed: ${(await text(page, "#message"))}; browser errors: ${browserErrors.join(" | ")}`);
    assert((await text(page, "#flagState")).includes("true"), "POC flag did not enable for test URL");
    await setContext(page, job, "tech@rmtfire.local", "POC-DEVICE-A");
    await page.locator("#saveDraft").click(); await page.locator("#queue").click(); await page.locator("#offline").click(); await page.locator("#retry").click();
    await page.waitForFunction(() => document.querySelector("#pendingCount")?.textContent === "1");
    const beforeReload = await page.evaluate(() => ({ evidence:document.querySelector("#evidence").textContent, queue:document.querySelector("#queueState").textContent }));
    await page.reload({ waitUntil:"domcontentloaded" }); await page.waitForFunction(() => document.querySelector("#dbStatus")?.textContent === "Ready"); await setContext(page, job, "tech@rmtfire.local", "POC-DEVICE-A"); await page.waitForFunction(() => document.querySelector("#draftCount")?.textContent === "1");
    assert((await text(page, "#evidence")).includes("originalImmutable"), "Evidence metadata did not survive refresh");
    await page.locator("#retry").click(); await page.waitForFunction(() => document.querySelector("#syncedCount")?.textContent === "1");
    const firstQueue = JSON.parse(await text(page, "#queueState"));
    assert(firstQueue.length === 1 && firstQueue[0].logicalMutationId, "Synced queue item is missing stable logical mutation identity");
    await page.locator("#queue").click();
    await page.waitForFunction(() => document.querySelector("#message")?.textContent.includes("already queued"));
    await page.waitForFunction(() => document.querySelector("#syncedCount")?.textContent === "1" && document.querySelector("#pendingCount")?.textContent === "0");
    const duplicateQueue = JSON.parse(await text(page, "#queueState"));
    assert(duplicateQueue.length === 1, "Duplicate logical save created another queue item");

    await page.locator("#saveDraft").click();
    await page.waitForFunction(() => document.querySelector("#message")?.textContent.includes("New logical action"));
    await page.locator("#queue").click();
    await page.waitForFunction(() => document.querySelector("#pendingCount")?.textContent === "1");
    await page.locator("#retry").click();
    await page.waitForFunction(() => document.querySelector("#syncedCount")?.textContent === "2" && document.querySelector("#pendingCount")?.textContent === "0");
    const newActionQueue = JSON.parse(await text(page, "#queueState"));
    assert(newActionQueue.length === 2, "Genuinely new technician action did not create a new queue item");
    assert(newActionQueue[0].logicalMutationId !== newActionQueue[1].logicalMutationId, "Genuinely new action reused the prior logical mutation identity");

    const conflictJob = unique("CONFLICT"); await setContext(page, conflictJob, "tech@rmtfire.local", "POC-DEVICE-A");
    await page.locator("#saveDraft").click(); await page.locator("#queue").click(); await page.locator("#conflict").click(); await page.locator("#retry").click();
    await page.waitForFunction(() => document.querySelector("#failedCount")?.textContent === "1");
    assert((await text(page, "#lastError")).startsWith("CONFLICT"), "Stale revision was not shown as a conflict");
    assert((await text(page, "#evidence")).includes("originalImmutable"), "Conflict discarded local evidence metadata");

    const ownershipJob = unique("OWNERSHIP"); await setContext(page, ownershipJob, "tech2@rmtfire.local", "POC-DEVICE-A");
    await page.locator("#saveDraft").click(); await page.locator("#queue").click(); await page.locator("#retry").click();
    await page.waitForFunction(() => document.querySelector("#failedCount")?.textContent === "1");
    const ownershipError = await text(page, "#lastError");
    if (!/assigned|another technician/i.test(ownershipError)) throw new Error(`Technician ownership rejection was not visible: ${ownershipError}; queue=${await text(page, "#queueState")}`);
    await page.locator("#clear").click(); await page.waitForFunction(() => document.querySelector("#draftCount")?.textContent === "0");
    console.log(JSON.stringify({ ok:true, job, conflictJob, ownershipJob, beforeReload, productionIntegration:false }, null, 2));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
