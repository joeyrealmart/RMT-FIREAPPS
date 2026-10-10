const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PORT = 8047;
const BASE = `http://127.0.0.1:${PORT}`;
const RUN_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "rmt-offline-status-"));
const DATA_ROOT = path.join(RUN_ROOT, "data");
const SERVER_COPY = path.join(RUN_ROOT, "serve-isolated.mjs");
const SCREENSHOT_ROOT = path.join(ROOT, "docs", "reviews", "offline-sync-status");
const EDGE = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
].find(fs.existsSync);

function assert(value, message) {
  if (!value) throw new Error(message);
}

function jsonPath(value) {
  return JSON.stringify(path.resolve(value).replace(/\\/g, "/"));
}

function prepareServerCopy() {
  fs.mkdirSync(SCREENSHOT_ROOT, { recursive: true });
  let source = fs.readFileSync(path.join(ROOT, "work", "serve-fire-inspection-mvp.mjs"), "utf8");
  source = source
    .replace(/^const dataRoot = .*;$/m, `const dataRoot = ${jsonPath(DATA_ROOT)};`)
    .replace(/^const reportRoot = .*;$/m, `const reportRoot = ${jsonPath(path.join(RUN_ROOT, "reports"))};`)
    .replace(/^const port = .*;$/m, `const port = ${PORT};`)
    .replace(/^const host = .*;$/m, 'const host = "127.0.0.1";');
  fs.writeFileSync(SERVER_COPY, source);
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/diagnostics`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Isolated offline status QA server did not start.");
}

async function setJob(page, job) {
  await page.locator("#jobId").fill(job);
  await page.locator("#jobId").blur();
  await page.waitForFunction((expected) => document.querySelector("#currentJob")?.textContent === expected, job);
}

async function waitForState(page, state) {
  await page.waitForFunction((expected) => window.__rmtOfflinePocStatus?.state === expected, state);
  return page.evaluate(() => window.__rmtOfflinePocStatus);
}

async function saveAndQueue(page) {
  await page.locator("#saveDraft").click();
  await page.waitForFunction(() => document.querySelector("#draftCount")?.textContent === "1");
  await page.locator("#queue").click();
  await page.waitForFunction(() => window.__rmtOfflinePocStatus?.pendingRecords === 1);
}

async function screenshot(page, name) {
  const output = path.join(SCREENSHOT_ROOT, name);
  await page.screenshot({ path: output, fullPage: true });
  return output;
}

(async () => {
  prepareServerCopy();
  const log = fs.openSync(path.join(RUN_ROOT, "server.log"), "a");
  const server = spawn(process.execPath, [SERVER_COPY], { cwd: ROOT, stdio: ["ignore", log, log], windowsHide: true });
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ headless: true, ...(EDGE ? { executablePath: EDGE } : {}) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const consoleErrors = [];
    const unexpectedResponses = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("Failed to load resource")) consoleErrors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() < 400) return;
      const expectedConflict = response.status() === 409 && response.url().includes("/inspection-records");
      const expectedFaviconMiss = response.status() === 404 && response.url().endsWith("/favicon.ico");
      if (!expectedConflict && !expectedFaviconMiss) unexpectedResponses.push(`${response.status()} ${response.url()}`);
    });
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(`${BASE}/dev/offline-poc/index.html?enable=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#dbStatus")?.textContent === "Ready");

    const primaryJob = `OFFLINE-POC-STATUS-${Date.now()}`;
    await setJob(page, primaryJob);
    await saveAndQueue(page);
    await page.locator("#offline").click();
    const offline = await waitForState(page, "OFFLINE");
    assert(offline.pendingRecords === 1 && offline.pendingPhotos === 1, "Offline banner did not use real record/photo counts.");
    const offlineScreenshot = await screenshot(page, "01-offline-saving-to-phone.png");

    await page.locator("#localComplete").click();
    await page.waitForFunction(() => document.querySelector("#syncCompletionState")?.textContent === "LOCAL COMPLETE — SYNC PENDING");
    const localCompleteScreenshot = await screenshot(page, "05-local-complete-sync-pending.png");

    let releaseRequest;
    const release = new Promise((resolve) => { releaseRequest = resolve; });
    let held = false;
    await page.route("**/api/jobs/**/inspection-records", async (route) => {
      if (!held) {
        held = true;
        await release;
      }
      await route.continue();
    });
    await page.locator("#offline").click();
    const syncing = await waitForState(page, "SYNCING");
    assert(syncing.pendingRecords === 1 && syncing.pendingPhotos === 1, "Syncing banner did not preserve actual pending counts.");
    await page.waitForFunction(() => document.querySelector("#syncElapsed")?.textContent !== "00:00");
    const elapsedDuringSync = await page.locator("#syncElapsed").textContent();
    const syncingScreenshot = await screenshot(page, "02-syncing-with-elapsed-time.png");
    releaseRequest();
    await page.waitForFunction(() => document.querySelector("#syncStateTitle")?.textContent === "ALL SYNCED");
    await page.unroute("**/api/jobs/**/inspection-records");
    const allSynced = await page.evaluate(() => window.__rmtOfflinePocStatus);
    assert(allSynced.pendingRecords === 0 && allSynced.pendingPhotos === 0 && allSynced.failedRecords === 0, "ALL SYNCED was shown before terminal authoritative state.");
    assert((await page.locator("#syncCompletionState").textContent()) === "SUBMITTED — ALL SYNCED", "Local completion did not distinguish fully synced state.");
    const primaryStateHistory = await page.evaluate(() => window.__rmtOfflinePocStateHistory.map((entry) => entry.state));
    assert(primaryStateHistory.includes("RECONNECTING") && primaryStateHistory.includes("SYNCING"), `Reconnect/sync transitions were not exposed: ${primaryStateHistory.join(", ")}`);
    const allSyncedScreenshot = await screenshot(page, "03-all-synced.png");

    const conflictJob = `OFFLINE-POC-STATUS-CONFLICT-${Date.now()}`;
    await setJob(page, conflictJob);
    await saveAndQueue(page);
    await page.locator("#conflict").click();
    await page.locator("#retry").click();
    await page.waitForFunction(() => window.__rmtOfflinePocStatus?.state === "INCOMPLETE" && window.__rmtOfflinePocStatus?.failedRecords === 1);
    const incomplete = await page.evaluate(() => window.__rmtOfflinePocStatus);
    assert(incomplete.failedRecords === 1 && incomplete.conflictRecords === 1 && incomplete.pendingPhotos === 1, `Conflict did not produce visible incomplete state with retained photo metadata: ${JSON.stringify(incomplete)}`);
    assert(await page.locator("#syncRetry").isVisible(), "Retry action was not visible for incomplete synchronization.");
    const incompleteScreenshot = await screenshot(page, "04-sync-incomplete.png");

    const droppedJob = `OFFLINE-POC-STATUS-DROP-${Date.now()}`;
    await setJob(page, droppedJob);
    await saveAndQueue(page);
    let releaseDropped;
    const droppedBarrier = new Promise((resolve) => { releaseDropped = resolve; });
    await page.route("**/api/jobs/**/inspection-records", async (route) => {
      await droppedBarrier;
      await route.continue().catch(() => {});
    });
    await page.locator("#retry").click();
    await waitForState(page, "SYNCING");
    await page.locator("#offline").click();
    const dropped = await waitForState(page, "OFFLINE");
    releaseDropped();
    await page.unroute("**/api/jobs/**/inspection-records");
    assert(dropped.pendingRecords === 1 && dropped.pendingPhotos === 1, "Network drop during sync did not return work to local pending state.");
    await page.locator("#offline").click();
    await page.waitForFunction(() => window.__rmtOfflinePocStatus?.state === "SYNCED" && window.__rmtOfflinePocStatus?.pendingRecords === 0);

    const interruptedJob = `OFFLINE-POC-STATUS-RESTART-${Date.now()}`;
    await setJob(page, interruptedJob);
    await saveAndQueue(page);
    let releaseInterrupted;
    const interruptedBarrier = new Promise((resolve) => { releaseInterrupted = resolve; });
    await page.route("**/api/jobs/**/inspection-records", async (route) => {
      await interruptedBarrier;
      await route.abort("connectionfailed").catch(() => {});
    });
    await page.locator("#retry").click();
    await waitForState(page, "SYNCING");
    await page.reload({ waitUntil: "domcontentloaded" });
    releaseInterrupted();
    await page.unroute("**/api/jobs/**/inspection-records");
    await page.waitForFunction(() => document.querySelector("#dbStatus")?.textContent === "Ready");
    await setJob(page, interruptedJob);
    const recovered = await waitForState(page, "INCOMPLETE");
    assert(recovered.pendingRecords === 1, "Interrupted SYNCING record was not recovered to retryable pending state after restart.");

    const backlogJob = `OFFLINE-POC-STATUS-BACKLOG-${Date.now()}`;
    await setJob(page, backlogJob);
    await page.evaluate(async (jobId) => {
      const store = window.RmtOfflineStore.createStore("rmt-fireapps-offline-v2-poc");
      await store.open();
      for (let index = 0; index < 10; index += 1) {
        const logicalMutationId = `mutation::${jobId}::DEVICE-${index}::tech@rmtfire.local::${index}`;
        await window.RmtOfflineStore.enqueueMutation(store, {
          operationId: `transport::${logicalMutationId}`,
          logicalMutationId,
          entityType: "inspection",
          entityId: `inspection::${jobId}::DEVICE-${index}::tech@rmtfire.local`,
          jobId,
          technicianId: "tech@rmtfire.local",
          syncState: "PENDING",
          payload: {}
        });
        await store.evidenceMetadata.put({
          id: `evidence::${logicalMutationId}`,
          logicalMutationId,
          jobId,
          deviceId: `DEVICE-${index}`,
          inspectionId: `inspection::${jobId}::DEVICE-${index}::tech@rmtfire.local`,
          technicianId: "tech@rmtfire.local",
          syncState: "LOCAL",
          updatedAt: new Date().toISOString()
        });
      }
      store.close();
    }, backlogJob);
    await page.locator("#loadDraft").click();
    await page.waitForFunction(() => window.__rmtOfflinePocStatus?.backlogWarning === true);
    const backlog = await page.evaluate(() => window.__rmtOfflinePocStatus);
    assert(backlog.pendingRecords === 10 && backlog.pendingPhotos === 10, "Large backlog warning did not use combined actual counts.");

    assert(consoleErrors.length === 0, `Browser errors: ${consoleErrors.join(" | ")}`);
    assert(unexpectedResponses.length === 0, `Unexpected HTTP failures: ${unexpectedResponses.join(" | ")}`);
    const regressionOutputs = {};
    for (const qaFile of ["work/qa-indexeddb-offline-prototype.cjs", "work/qa-android-offline-poc.cjs"]) {
      const result = spawnSync(process.execPath, [path.join(ROOT, qaFile)], {
        cwd: ROOT,
        env: { ...process.env, BASE_URL: BASE },
        encoding: "utf8",
        windowsHide: true
      });
      assert(result.status === 0, `${qaFile} failed:\n${result.stdout}\n${result.stderr}`);
      regressionOutputs[qaFile] = result.stdout.trim();
    }
    console.log(JSON.stringify({
      ok: true,
      primaryJob,
      conflictJob,
      interruptedJob,
      states: { offline, syncing, allSynced, incomplete, dropped, recovered, backlog },
      primaryStateHistory,
      elapsedDuringSync,
      regressionOutputs,
      screenshots: { offlineScreenshot, syncingScreenshot, allSyncedScreenshot, incompleteScreenshot, localCompleteScreenshot },
      productionIntegration: false
    }, null, 2));
  } finally {
    if (browser) await browser.close();
    server.kill();
    fs.closeSync(log);
    fs.rmSync(RUN_ROOT, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
