const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const scheduleId = "DEMO-WETEX-RETEST-20260924";
const appUrl = "http://127.0.0.1:8026/?fresh=mfap-live-indications-tab";
const sharedPath = path.join(root, "outputs", "rmt-fire-local-data", "shared-records", "jobs", `${scheduleId.toLowerCase()}.json`);
const screenshotRoot = path.join(root, "docs", "reviews", "physical-correction", "screenshots", "mfap-live-indications");
const sharedBackup = fs.readFileSync(sharedPath);
const browserPaths = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function resetLinkedQaState() {
  const store = JSON.parse(sharedBackup.toString("utf8"));
  store.linkedVerificationSideRecords = {};
  store.linkedVerificationConflicts = [];
  store.linkedVerificationAudit = [];
  store.liveCoordinationEvents = {};
  store.criticalSopRecords = {};
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(sharedPath, `${JSON.stringify(store, null, 2)}\n`);
}

async function login(page, email) {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.locator("#loginEmail").waitFor({ state: "visible", timeout: 45000 });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", "mfap-live-indications-qa");
  await page.click("#loginForm button[type='submit']");
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("technician-mode"), null, { timeout: 20000 });
}

async function prepareSop(page, deviceTag, templateId, systemKey) {
  return page.evaluate(async ({ scheduleId, deviceTag, templateId, systemKey }) => {
    const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
    if (!schedule) throw new Error(`Missing ${scheduleId}.`);
    await ensureTechnicianFieldDataLoaded(schedule);
    state.activeTechPreviewScheduleId = scheduleId;
    state.activeJob = { scheduleId, jobId: schedule.jobId, schedule, status: schedule.status };
    state.activeTechSystemKey = systemKey;
    await requestSharedJobState(schedule, { migrate: false, apply: true });
    await loadLinkedVerificationIndex();
    const device = state.setupDevices.find((item) => (item.id || item.tag) === deviceTag);
    if (!device) throw new Error(`Missing ${deviceTag}.`);
    state.activeCriticalSopId = templateId;
    state.activeCriticalDevice = device;
    openCriticalSopForDevice(device, { scrollIntoView: false });
    startTechnicianSharedHeartbeat();
    return getScheduleLinkedVerificationDefinitions(schedule).map((definition) => ({
      id: definition.linkedVerificationId,
      type: definition.verificationType,
      pumpTestKey: definition.pumpTestKey || "",
      gasDeviceId: definition.gasDeviceId || ""
    }));
  }, { scheduleId, deviceTag, templateId, systemKey });
}

async function startJockeyTest(page) {
  return page.evaluate(async () => {
    const schedule = state.schedules.find((item) => item.scheduleId === "DEMO-WETEX-RETEST-20260924");
    const template = criticalSopTemplates.find((item) => item.id === "sprinkler-hydrant-pump-sop");
    const index = template.steps.findIndex((step) => step.linkedPumpTestKey === "JOCKEY_MANUAL");
    const results = await syncPumpManualLinkedVerifications(template, { steps: { [index]: { choice: "Pass" } } }, schedule, state.activeCriticalDevice);
    const definition = getScheduleLinkedVerificationDefinitions(schedule).find((item) => item.pumpTestKey === "JOCKEY_MANUAL");
    const side = definition.requiredSides.find((item) => item.sideId === "PUMP_ROOM");
    await saveLinkedVerificationLiveState(schedule, definition, side, "ACTIVE", { priority: "MEDIUM", currentState: "RUNNING" });
    renderCriticalSop();
    return results.map((item) => ({ ok: item.ok, id: item.linkedVerification?.linkedVerificationId }));
  });
}

async function startCo2Test(page) {
  return page.evaluate(async () => {
    const schedule = state.schedules.find((item) => item.scheduleId === "DEMO-WETEX-RETEST-20260924");
    const template = criticalSopTemplates.find((item) => item.id === "gas-discharge-sop");
    const index = template.steps.findIndex((step) => step.linkedGasTestKey === "INDICATION");
    const results = await syncGasReleaseLinkedVerification(template, { steps: { [index]: { confirmed: true } } }, schedule, state.activeCriticalDevice);
    const definition = getScheduleLinkedVerificationDefinitions(schedule).find((item) => item.gasTestKey === "INDICATION" && item.gasDeviceId === "GRD.CO2.1");
    const side = definition.requiredSides.find((item) => item.sideId === "SUPPRESSION_SYSTEM_LOCATION");
    await saveLinkedVerificationLiveState(schedule, definition, side, "ACTIVE", { priority: "HIGH", currentState: "MFAP_CONFIRMATION_REQUIRED" });
    renderCriticalSop();
    return results.map((item) => ({ ok: item.ok, id: item.linkedVerification?.linkedVerificationId }));
  });
}

async function confirmMfap(page, linkedVerificationId) {
  const card = page.locator(`[data-mfap-live-view] [data-linked-card="${linkedVerificationId}"]`);
  await card.waitFor({ state: "visible", timeout: 15000 });
  const requestPromise = page.waitForRequest((request) => request.method() === "POST" && request.url().includes("/linked-verification-sides"));
  await card.locator('[data-linked-quick-result="CONFIRMED"]').click();
  const request = await requestPromise;
  const response = await request.response();
  assert(response?.ok(), `MFAP response failed with HTTP ${response?.status() || "no response"}.`);
  await page.evaluate(async (id) => {
    const event = getMfapActiveLiveEvents().find((item) => item.eventId.includes(id));
    if (event) await acknowledgeLiveCoordinationEvent(event.eventId, "OBSERVED");
  }, linkedVerificationId);
}

async function waitForPendingAlert(page, expectedCount) {
  try {
    await page.waitForFunction((count) => (
      document.querySelector("[data-mfap-pending-count]")?.textContent === String(count)
        && !document.querySelector("[data-mfap-new-indication-alert]")?.classList.contains("hidden")
    ), expectedCount, { timeout: 20000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      badge: document.querySelector("[data-mfap-pending-count]")?.textContent || "",
      alertHidden: document.querySelector("[data-mfap-new-indication-alert]")?.classList.contains("hidden"),
      events: getMfapActiveLiveEvents().map((event) => ({ id: event.eventId, status: event.status, state: event.currentState, observer: event.observerTechnicianId })),
      syncUnavailable: state.sharedSyncUnavailable
    }));
    throw new Error(`MFAP pending alert did not update: ${JSON.stringify(state)}`, { cause: error });
  }
}

(async () => {
  resetLinkedQaState();
  fs.mkdirSync(screenshotRoot, { recursive: true });
  const executablePath = browserPaths.find(fs.existsSync);
  assert(executablePath, "No supported browser was found.");
  const browser = await chromium.launch({ headless: true, executablePath });
  const contextA = await browser.newContext({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true });
  const contextB = await browser.newContext({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true });
  const techA = await contextA.newPage();
  const techB = await contextB.newPage();
  const consoleErrors = [];
  [techA, techB].forEach((page) => page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  }));

  try {
    await login(techA, "tech@rmtfire.local");
    await login(techB, "tech2@rmtfire.local");
    const fapDefinitions = await prepareSop(techA, "GRD.MFAP.1", "fire-alarm-tripping-sop", "fire-alarm");
    assert(await techA.locator('[data-mfap-workspace-tab="checklist"]').getAttribute("aria-selected") === "true", "MFAP did not open on CHECKLIST.");
    assert(await techA.locator("[data-mfap-pending-count]").textContent() === "0", "Initial pending badge was not zero.");
    await techA.evaluate(() => window.scrollTo(0, Math.floor(document.documentElement.scrollHeight * 0.52)));
    const pumpScrollBefore = await techA.evaluate(() => window.scrollY);

    const pumpDefinitions = await prepareSop(techB, "LG.SPP.1", "sprinkler-hydrant-pump-sop", "pump-system");
    const jockey = pumpDefinitions.find((item) => item.pumpTestKey === "JOCKEY_MANUAL");
    assert(jockey, "Jockey linked definition is missing.");
    const pumpStart = await startJockeyTest(techB);
    assert(pumpStart.length === 1 && pumpStart[0].ok, "Jockey side did not start exactly one linked event.");
    await waitForPendingAlert(techA, 1);
    const pumpScrollAfter = await techA.evaluate(() => window.scrollY);
    assert(Math.abs(pumpScrollAfter - pumpScrollBefore) < 100, "New Pump indication moved Tech 1 away from checklist scroll position.");
    assert(await techA.locator('[data-mfap-workspace-tab="checklist"]').getAttribute("aria-selected") === "true", "Pump request forced Tech 1 out of CHECKLIST.");
    assert((await techA.locator("[data-mfap-new-indication-title]").textContent()).includes("Jockey Pump"), "Pump alert title is incorrect.");
    await techA.screenshot({ path: path.join(screenshotRoot, "01-pump-alert-checklist.png"), fullPage: false });
    await techA.locator("[data-mfap-view-new-indication]").click();
    assert(await techA.locator('[data-mfap-workspace-tab="live"]').getAttribute("aria-selected") === "true", "VIEW did not open LIVE INDICATIONS.");
    assert(await techA.locator(`[data-mfap-live-view] [data-linked-card="${jockey.id}"]`).isVisible(), "Jockey card is not visible in LIVE INDICATIONS.");
    await techA.screenshot({ path: path.join(screenshotRoot, "02-pump-live-indications.png"), fullPage: false });
    await confirmMfap(techA, jockey.id);
    await techB.waitForFunction((id) => document.body.innerText.includes("VERIFIED") || state.linkedVerificationIndex.some((item) => item.linkedVerificationId === id && item.status === "VERIFIED"), jockey.id, { timeout: 15000 });

    await techA.locator('[data-mfap-workspace-tab="checklist"]').click();
    await techA.evaluate(() => window.scrollTo(0, Math.floor(document.documentElement.scrollHeight * 0.52)));
    const co2ScrollBefore = await techA.evaluate(() => window.scrollY);
    const gasDefinitions = await prepareSop(techB, "GRD.CO2.1", "gas-discharge-sop", "gas-release");
    const co2 = gasDefinitions.find((item) => item.type === "CO2_GAS_RELEASE_INDICATION" && item.gasDeviceId === "GRD.CO2.1");
    assert(co2, "CO2 linked definition is missing.");
    const co2Start = await startCo2Test(techB);
    assert(co2Start.length === 1 && co2Start[0].ok, "CO2 side did not start exactly one linked event.");
    await waitForPendingAlert(techA, 2);
    const co2ScrollAfter = await techA.evaluate(() => window.scrollY);
    assert(Math.abs(co2ScrollAfter - co2ScrollBefore) < 100, "New CO2 indication moved Tech 1 away from checklist scroll position.");
    assert(/CO2|Gas/i.test(await techA.locator("[data-mfap-new-indication-title]").textContent()), "CO2 alert title is incorrect.");
    await techA.screenshot({ path: path.join(screenshotRoot, "03-co2-alert-checklist.png"), fullPage: false });
    await techA.locator("[data-mfap-view-new-indication]").click();
    assert(await techA.locator(`[data-mfap-live-view] [data-linked-card="${co2.id}"]`).isVisible(), "CO2 card is not visible in LIVE INDICATIONS.");
    await techA.screenshot({ path: path.join(screenshotRoot, "04-co2-live-indications.png"), fullPage: false });
    await confirmMfap(techA, co2.id);

    const server = await fetch(`http://127.0.0.1:8026/api/jobs/${scheduleId}/state`).then((response) => response.json());
    const states = Object.fromEntries(server.linkedVerifications.map((item) => [item.definition.linkedVerificationId, item.status]));
    assert(states[jockey.id] === "VERIFIED", "Jockey did not reconcile to VERIFIED.");
    assert(states[co2.id] === "VERIFIED", "CO2 did not reconcile to VERIFIED.");
    [jockey.id, co2.id].forEach((linkedVerificationId) => {
      const linked = server.linkedVerifications.find((item) => item.definition.linkedVerificationId === linkedVerificationId);
      const recordedSides = linked.sides.filter((side) => side.record);
      assert(recordedSides.length === 2, `${linkedVerificationId} did not retain exactly two authoritative side records.`);
      assert(new Set(recordedSides.map((side) => side.sideId)).size === 2, `${linkedVerificationId} contains a duplicate logical side record.`);
    });
    const bodyOverflow = await techA.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(bodyOverflow <= 1, `MFAP tabs introduced ${bodyOverflow}px horizontal overflow.`);
    assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(" | ")}`);

    console.log(JSON.stringify({
      pass: true,
      scheduleId,
      checklistTab: true,
      liveIndicationsTab: true,
      pendingBadge: true,
      newTestAlert: true,
      viewFocus: true,
      pump: states[jockey.id],
      co2: states[co2.id],
      gasRelease: "NOT_CONFIGURED_SEPARATELY",
      wetChemical: "NOT_CONFIGURED",
      manualRefreshRequired: false,
      horizontalOverflow: bodyOverflow,
      consoleErrors
    }, null, 2));
  } finally {
    await Promise.allSettled([contextA.close(), contextB.close()]);
    await browser.close();
    fs.writeFileSync(sharedPath, sharedBackup);
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
