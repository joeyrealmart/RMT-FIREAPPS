const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const scheduleId = "DEMO-WETEX-RETEST-20260924";
const appUrl = "http://127.0.0.1:8026/?fresh=qa-live-linked-two-tech";
const reviewRoot = path.join(root, "docs", "reviews", "linked-sync");
const screenshotDir = path.join(reviewRoot, "screenshots");
const outputDir = path.join(reviewRoot, "test-output");
const outputPath = path.join(outputDir, "qa-live-linked-two-tech.json");
const sharedPath = path.join(root, "outputs", "rmt-fire-local-data", "shared-records", "jobs", `${scheduleId.toLowerCase()}.json`);
const sharedBackup = fs.existsSync(sharedPath) ? fs.readFileSync(sharedPath) : null;
const browserPaths = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(pathname) {
  const response = await fetch(`http://127.0.0.1:8026${pathname}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function login(page, email) {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", "linked-sync-qa");
  await page.click("#loginForm button[type='submit']");
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("technician-mode"), null, { timeout: 20000 });
}

async function prepareSop(page, deviceTag, templateId, systemKey) {
  return page.evaluate(async ({ scheduleId, deviceTag, templateId, systemKey }) => {
    const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
    if (!schedule) throw new Error(`Schedule ${scheduleId} is unavailable.`);
    await ensureTechnicianFieldDataLoaded(schedule);
    state.activeTechPreviewScheduleId = scheduleId;
    state.activeJob = { scheduleId, jobId: schedule.jobId, schedule, status: schedule.status };
    state.activeTechSystemKey = systemKey;
    await requestSharedJobState(schedule, { migrate: true, apply: true });
    await loadLinkedVerificationIndex();
    const device = state.setupDevices.find((item) => (item.id || item.tag) === deviceTag);
    if (!device) throw new Error(`Missing ${deviceTag} in Wetex master data.`);
    state.activeCriticalSopId = templateId;
    state.activeCriticalDevice = device;
    openCriticalSopForDevice(device);
    startTechnicianSharedHeartbeat();
    return {
      scheduleId: schedule.scheduleId,
      jobId: schedule.jobId,
      deviceId: device.id || device.tag,
      definitions: getScheduleLinkedVerificationDefinitions(schedule).map((definition) => ({
        linkedVerificationId: definition.linkedVerificationId,
        verificationType: definition.verificationType,
        pumpTestKey: definition.pumpTestKey || "",
        gasDeviceId: definition.gasDeviceId || "",
        sides: definition.requiredSides.map((side) => ({
          sideId: side.sideId,
          technicianId: side.assignedTechnicianId,
          technicianName: side.assignedTechnicianName
        }))
      }))
    };
  }, { scheduleId, deviceTag, templateId, systemKey });
}

async function savePumpSides(page) {
  return page.evaluate(async () => {
    const schedule = state.schedules.find((item) => item.scheduleId === "DEMO-WETEX-RETEST-20260924");
    const template = criticalSopTemplates.find((item) => item.id === "sprinkler-hydrant-pump-sop");
    const steps = {};
    template.steps.forEach((step, index) => {
      if (step.linkedPumpTestKey === "STANDBY_MANUAL") steps[index] = { fieldValues: { manualResult: "Pass" } };
      else if (step.linkedPumpTestKey) steps[index] = { choice: "Pass" };
    });
    const results = await syncPumpManualLinkedVerifications(template, { steps }, schedule, state.activeCriticalDevice);
    return results.map((result) => ({
      ok: result.ok,
      idempotent: Boolean(result.idempotent),
      status: result.linkedVerification?.status || "",
      linkedVerificationId: result.linkedVerification?.linkedVerificationId || ""
    }));
  });
}

async function saveGasSide(page, deviceTag) {
  await prepareSop(page, deviceTag, "gas-discharge-sop", "gas-release");
  return page.evaluate(async () => {
    const schedule = state.schedules.find((item) => item.scheduleId === "DEMO-WETEX-RETEST-20260924");
    const template = criticalSopTemplates.find((item) => item.id === "gas-discharge-sop");
    const steps = {};
    template.steps.forEach((step, index) => {
      if (step.linkedGasTestKey) steps[index] = { confirmed: true, remark: "Automated two-context linked indication proof" };
    });
    const results = await syncGasReleaseLinkedVerification(template, { steps }, schedule, state.activeCriticalDevice);
    return results.map((result) => ({
      ok: result.ok,
      idempotent: Boolean(result.idempotent),
      status: result.linkedVerification?.status || "",
      linkedVerificationId: result.linkedVerification?.linkedVerificationId || ""
    }));
  });
}

async function waitForClientState(page, linkedVerificationId, expectedStatus, timeout = 15000) {
  const started = Date.now();
  await page.waitForFunction(({ linkedVerificationId, expectedStatus }) => {
    const item = state.linkedVerificationIndex.find((entry) => entry.linkedVerificationId === linkedVerificationId);
    return item?.status === expectedStatus;
  }, { linkedVerificationId, expectedStatus }, { timeout });
  return Date.now() - started;
}

async function waitForPrompt(page, linkedVerificationId, timeout = 15000) {
  const started = Date.now();
  await page.locator(`[data-critical-linked-prompt] [data-linked-card="${linkedVerificationId}"]`).waitFor({ state: "visible", timeout });
  return Date.now() - started;
}

async function saveMfapSide(page, linkedVerificationId, result) {
  const card = page.locator(`[data-critical-linked-prompt] [data-linked-card="${linkedVerificationId}"]`);
  await card.waitFor({ state: "visible", timeout: 15000 });
  await card.locator("[data-linked-result]").selectOption(result);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/linked-verification-sides") && response.request().method() === "POST"),
    card.locator("[data-linked-save-side]").click()
  ]);
}

async function screenshotLocator(page, selector, fileName) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: 15000 });
  await locator.screenshot({ path: path.join(screenshotDir, fileName) });
}

async function screenshotDesk(page, fileName) {
  await page.evaluate(() => {
    renderTechWorkPanel();
    setTechScreen("jobs", { scroll: false, skipDirtyCheck: true, renderMarkers: false });
  });
  await screenshotLocator(page, "#techLinkedVerificationDesk", fileName);
}

async function linkedState(linkedVerificationId) {
  const payload = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/state`);
  return {
    payload,
    linked: payload.linkedVerifications.find((item) => item.linkedVerificationId === linkedVerificationId)
  };
}

function summarizeLinked(item) {
  return {
    linkedVerificationId: item.linkedVerificationId,
    status: item.status,
    sides: item.sides.map((side) => ({
      sideId: side.sideId,
      technicianId: side.record?.technicianId || "",
      result: side.record?.result || "",
      revision: Number(side.record?.revision || 0),
      timestamp: side.record?.timestamp || ""
    }))
  };
}

async function readFapStep8(page) {
  return page.locator("#criticalSopForm .sop-step").nth(7).evaluate((element) => ({
    text: element.textContent.replace(/\s+/g, " ").trim(),
    details: [...element.querySelectorAll(".sop-linked-summary > div")].map((row) => ({
      label: row.querySelector("span")?.textContent?.trim() || "",
      status: row.querySelector("strong")?.textContent?.trim() || ""
    }))
  }));
}

(async () => {
  const executablePath = browserPaths.find(fs.existsSync);
  assert(executablePath, "No supported Chromium browser found.");
  const browser = await chromium.launch({ headless: true, executablePath });
  const contextA = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const contextB = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const techA = await contextA.newPage();
  const techB = await contextB.newPage();
  const consoleErrors = [];
  let navigationA = 0;
  let navigationB = 0;
  techA.on("framenavigated", (frame) => { if (frame === techA.mainFrame()) navigationA += 1; });
  techB.on("framenavigated", (frame) => { if (frame === techB.mainFrame()) navigationB += 1; });
  [techA, techB].forEach((page, index) => page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`Tech ${index ? "B" : "A"}: ${message.text()}`);
  }));

  const evidence = {
    generatedAt: new Date().toISOString(),
    scheduleId,
    jobId: "",
    provider: "Playwright with two independent Edge contexts",
    pump: {},
    co2: {},
    offline: {},
    fapStep8: {},
    updateDelaysMs: {},
    screenshots: [],
    assertions: {},
    consoleErrors
  };

  try {
    await Promise.all([
      login(techA, "tech@rmtfire.local"),
      login(techB, "tech2@rmtfire.local")
    ]);
    const [fap, pump] = await Promise.all([
      prepareSop(techA, "GRD.MFAP.1", "fire-alarm-tripping-sop", "fire-alarm"),
      prepareSop(techB, "LG.SPP.1", "sprinkler-hydrant-pump-sop", "pump-system")
    ]);
    evidence.jobId = fap.jobId;
    const definitions = fap.definitions.filter((item) => item.linkedVerificationId.startsWith(`${scheduleId}::`));
    const pumpDefinitions = definitions.filter((item) => item.verificationType === "FIRE_PUMP_INDICATION");
    const gasDefinitions = definitions.filter((item) => item.verificationType === "CO2_GAS_RELEASE_INDICATION");
    assert(pumpDefinitions.length === 3, `Expected Jockey, Duty and Standby only; found ${pumpDefinitions.length}.`);
    assert(gasDefinitions.length === 3, `Expected three cross-technician Wetex CO2 events; found ${gasDefinitions.length}.`);
    assert(pumpDefinitions.every((item) => item.sides[0].technicianId === "tech2@rmtfire.local" && item.sides[1].technicianId === "tech@rmtfire.local"), "Pump/MFAP assignments are incorrect.");
    assert(gasDefinitions.every((item) => item.sides[0].technicianId === "tech2@rmtfire.local" && item.sides[1].technicianId === "tech@rmtfire.local"), "CO2/MFAP assignments are incorrect.");

    evidence.fapStep8.initial = await readFapStep8(techA);
    assert(evidence.fapStep8.initial.details.some((item) => item.label === "Pump" && item.status === "PENDING"), "Initial Pump state must be pending.");
    assert(evidence.fapStep8.initial.details.some((item) => item.label === "CO2" && item.status === "PENDING"), "Initial CO2 state must be pending.");
    await screenshotLocator(techA, "#criticalSopForm .sop-step:nth-of-type(8)", "09-fap-step8-pending.png");
    evidence.screenshots.push("09-fap-step8-pending.png");

    const baselineNavA = navigationA;
    const baselineNavB = navigationB;
    await contextA.setOffline(true);
    const firstPumpWrites = await savePumpSides(techB);
    const duplicatePumpWrites = await savePumpSides(techB);
    assert(firstPumpWrites.length === 3 && firstPumpWrites.every((item) => item.status === "AWAITING_COUNTERPART"), "All three Pump sides must await MFAP.");
    assert(duplicatePumpWrites.every((item) => item.ok), "Duplicate Pump save must remain idempotent.");
    await screenshotDesk(techB, "01-pump-awaiting-counterpart.png");
    evidence.screenshots.push("01-pump-awaiting-counterpart.png");
    await prepareSop(techB, "LG.SPP.1", "sprinkler-hydrant-pump-sop", "pump-system");

    const awaiting = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/state`);
    const awaitingPump = awaiting.linkedVerifications.filter((item) => item.definition?.verificationType === "FIRE_PUMP_INDICATION");
    assert(awaitingPump.length === 3 && awaitingPump.every((item) => item.status === "AWAITING_COUNTERPART"), "Server must hold three independent Pump awaiting states.");
    assert(awaitingPump.every((item) => item.sides.filter((side) => side.record).length === 1), "Duplicate Pump save must not create extra side records.");
    evidence.offline.serverWhileTechAOffline = awaitingPump.map(summarizeLinked);

    const reconnectStarted = Date.now();
    await contextA.setOffline(false);
    const duty = pumpDefinitions.find((item) => item.pumpTestKey === "DUTY_MANUAL");
    const jockey = pumpDefinitions.find((item) => item.pumpTestKey === "JOCKEY_MANUAL");
    const standby = pumpDefinitions.find((item) => item.pumpTestKey === "STANDBY_MANUAL");
    evidence.updateDelaysMs.pumpPromptAfterReconnect = await waitForPrompt(techA, duty.linkedVerificationId);
    evidence.offline.reconnectElapsedMs = Date.now() - reconnectStarted;
    await screenshotLocator(techA, `[data-critical-linked-prompt] [data-linked-card="${duty.linkedVerificationId}"]`, "02-mfap-live-pump-prompt.png");
    evidence.screenshots.push("02-mfap-live-pump-prompt.png");

    await saveMfapSide(techA, duty.linkedVerificationId, "CONFIRMED");
    evidence.updateDelaysMs.dutyResultToTechB = await waitForClientState(techB, duty.linkedVerificationId, "VERIFIED");
    const dutyState = (await linkedState(duty.linkedVerificationId)).linked;
    assert(dutyState?.status === "VERIFIED", "Duty Pump must reconcile to VERIFIED.");
    await screenshotLocator(techA, `[data-critical-linked-prompt] [data-linked-card="${duty.linkedVerificationId}"]`, "04-mfap-verified-result.png");
    evidence.screenshots.push("04-mfap-verified-result.png");
    await screenshotDesk(techB, "03-pump-verified-result.png");
    evidence.screenshots.push("03-pump-verified-result.png");
    await prepareSop(techB, "LG.SPP.1", "sprinkler-hydrant-pump-sop", "pump-system");

    await saveMfapSide(techA, jockey.linkedVerificationId, "CONFIRMED");
    await waitForClientState(techB, jockey.linkedVerificationId, "VERIFIED");
    await saveMfapSide(techA, standby.linkedVerificationId, "NOT_CONFIRMED");
    await waitForClientState(techB, standby.linkedVerificationId, "MISMATCH_REVIEW_REQUIRED");
    const standbyMismatch = (await linkedState(standby.linkedVerificationId)).linked;
    assert(standbyMismatch?.status === "MISMATCH_REVIEW_REQUIRED", "Pump disagreement must become MISMATCH_REVIEW_REQUIRED.");
    await screenshotLocator(techA, `[data-critical-linked-prompt] [data-linked-card="${standby.linkedVerificationId}"]`, "05-pump-mismatch-result.png");
    evidence.screenshots.push("05-pump-mismatch-result.png");
    const fapMismatch = await readFapStep8(techA);
    assert(fapMismatch.details.some((item) => item.label === "Pump" && item.status === "FAIL"), "Pump mismatch must derive FAP Step 8 FAIL.");
    await saveMfapSide(techA, standby.linkedVerificationId, "CONFIRMED");
    await waitForClientState(techB, standby.linkedVerificationId, "VERIFIED");

    evidence.pump.states = [];
    for (const definition of pumpDefinitions) {
      const item = (await linkedState(definition.linkedVerificationId)).linked;
      evidence.pump.states.push(summarizeLinked(item));
      assert(item.status === "VERIFIED", `${definition.pumpTestKey} did not finish VERIFIED.`);
    }

    const firstGas = gasDefinitions[0];
    const secondGas = gasDefinitions[1];
    const thirdGas = gasDefinitions[2];
    const gasSaveOne = await saveGasSide(techB, firstGas.gasDeviceId);
    assert(gasSaveOne.length === 1 && gasSaveOne[0].status === "AWAITING_COUNTERPART", "CO2 side must create an awaiting counterpart event.");
    evidence.updateDelaysMs.co2PromptToTechA = await waitForPrompt(techA, firstGas.linkedVerificationId);
    await screenshotLocator(techA, `[data-critical-linked-prompt] [data-linked-card="${firstGas.linkedVerificationId}"]`, "06-co2-linked-prompt.png");
    evidence.screenshots.push("06-co2-linked-prompt.png");
    await saveMfapSide(techA, firstGas.linkedVerificationId, "CONFIRMED");
    evidence.updateDelaysMs.co2ResultToTechB = await waitForClientState(techB, firstGas.linkedVerificationId, "VERIFIED");
    await screenshotLocator(techA, `[data-critical-linked-prompt] [data-linked-card="${firstGas.linkedVerificationId}"]`, "07-co2-verified-result.png");
    evidence.screenshots.push("07-co2-verified-result.png");

    await saveGasSide(techB, secondGas.gasDeviceId);
    await waitForPrompt(techA, secondGas.linkedVerificationId);
    await saveMfapSide(techA, secondGas.linkedVerificationId, "NOT_CONFIRMED");
    await waitForClientState(techB, secondGas.linkedVerificationId, "MISMATCH_REVIEW_REQUIRED");
    const gasMismatch = (await linkedState(secondGas.linkedVerificationId)).linked;
    assert(gasMismatch?.status === "MISMATCH_REVIEW_REQUIRED", "CO2 disagreement must become MISMATCH_REVIEW_REQUIRED.");
    await screenshotLocator(techA, `[data-critical-linked-prompt] [data-linked-card="${secondGas.linkedVerificationId}"]`, "08-co2-mismatch-result.png");
    evidence.screenshots.push("08-co2-mismatch-result.png");
    const co2MismatchStep8 = await readFapStep8(techA);
    assert(co2MismatchStep8.details.some((item) => item.label === "CO2" && item.status === "FAIL"), "CO2 mismatch must derive FAP Step 8 FAIL.");
    await saveMfapSide(techA, secondGas.linkedVerificationId, "CONFIRMED");
    await waitForClientState(techB, secondGas.linkedVerificationId, "VERIFIED");

    await saveGasSide(techB, thirdGas.gasDeviceId);
    await waitForPrompt(techA, thirdGas.linkedVerificationId);
    await saveMfapSide(techA, thirdGas.linkedVerificationId, "CONFIRMED");
    await waitForClientState(techB, thirdGas.linkedVerificationId, "VERIFIED");

    await techA.waitForFunction(() => {
      const rows = [...document.querySelectorAll("#criticalSopForm .sop-step")][7]?.querySelectorAll(".sop-linked-summary > div") || [];
      const values = [...rows].map((row) => `${row.querySelector("span")?.textContent?.trim()}:${row.querySelector("strong")?.textContent?.trim()}`);
      return values.includes("Pump:PASS") && values.includes("CO2:PASS") && values.includes("Overall:PASS");
    }, null, { timeout: 15000 });
    evidence.fapStep8.final = await readFapStep8(techA);
    await screenshotLocator(techA, "#criticalSopForm .sop-step:nth-of-type(8)", "10-fap-step8-final-derived.png");
    evidence.screenshots.push("10-fap-step8-final-derived.png");

    const finalState = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/state`);
    const finalLinked = finalState.linkedVerifications.filter((item) => item.linkedVerificationId.startsWith(`${scheduleId}::`));
    evidence.co2.states = finalLinked.filter((item) => item.definition?.verificationType === "CO2_GAS_RELEASE_INDICATION").map(summarizeLinked);
    assert(evidence.co2.states.length === 3 && evidence.co2.states.every((item) => item.status === "VERIFIED"), "All cross-tech CO2 events must finish VERIFIED.");
    const sideRecords = Object.values(finalState.store.linkedVerificationSideRecords || {}).filter((record) => record.scheduleId === scheduleId);
    const recordCounts = Object.fromEntries(finalLinked.map((item) => [item.linkedVerificationId, sideRecords.filter((record) => record.linkedVerificationId === item.linkedVerificationId).length]));
    assert(Object.values(recordCounts).every((count) => count === 2), `Every event must contain exactly two side records: ${JSON.stringify(recordCounts)}`);

    const wrongOwner = await techA.evaluate(async ({ scheduleId }) => {
      const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
      const definition = getScheduleLinkedVerificationDefinitions(schedule).find((item) => item.pumpTestKey === "DUTY_MANUAL");
      const pumpSide = definition.requiredSides.find((item) => item.sideId === "PUMP_ROOM");
      return saveLinkedVerificationSide(schedule, definition, pumpSide, { result: "CONFIRMED" });
    }, { scheduleId });
    assert(wrongOwner.forbidden, "Tech A must not be able to write Tech B's Pump side.");
    assert(navigationA === baselineNavA && navigationB === baselineNavB, `Linked updates caused navigation/reload (A ${baselineNavA}->${navigationA}, B ${baselineNavB}->${navigationB}).`);
    assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(" | ")}`);

    evidence.recordCounts = recordCounts;
    evidence.navigationCounts = { techA: navigationA - baselineNavA, techB: navigationB - baselineNavB };
    evidence.assertions = {
      pumpTwoContext: "PASS",
      pumpLiveWithoutRefresh: "PASS",
      jockey: "PASS",
      duty: "PASS",
      standby: "PASS",
      pumpMismatch: "PASS",
      co2TwoContext: "PASS",
      co2LiveWithoutRefresh: "PASS",
      co2Mismatch: "PASS",
      offlineReconnect: "PASS",
      duplicateRecords: "PASS",
      ownership: "PASS",
      fapStep8: "PASS"
    };
    fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(JSON.stringify({ ok: true, outputPath, assertions: evidence.assertions, recordCounts, updateDelaysMs: evidence.updateDelaysMs, screenshots: evidence.screenshots }, null, 2));
  } finally {
    await Promise.allSettled([contextA.close(), contextB.close()]);
    await browser.close();
    if (sharedBackup) fs.writeFileSync(sharedPath, sharedBackup);
    else fs.rmSync(sharedPath, { force: true });
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
