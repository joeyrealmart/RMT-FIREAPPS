const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const scheduleId = "DEMO-WETEX-RETEST-20260924";
const appUrl = "http://127.0.0.1:8026/?fresh=physical-correction-batch";
const sharedPath = path.join(root, "outputs", "rmt-fire-local-data", "shared-records", "jobs", `${scheduleId.toLowerCase()}.json`);
const outputRoot = path.join(root, "docs", "reviews", "physical-correction");
const screenshotRoot = path.join(outputRoot, "screenshots");
const testOutputRoot = path.join(outputRoot, "test-output");
const sharedBackup = fs.existsSync(sharedPath) ? fs.readFileSync(sharedPath) : null;
const browserPaths = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function login(page, email) {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", "physical-correction-qa");
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
    if (!device) throw new Error(`Missing ${deviceTag} in loaded WETEX master.`);
    state.activeCriticalSopId = templateId;
    state.activeCriticalDevice = device;
    openCriticalSopForDevice(device);
    startTechnicianSharedHeartbeat();
    renderTechDesktopNavigation(schedule);
    return {
      scheduleId: schedule.scheduleId,
      jobId: schedule.jobId,
      activeWetexCount: getTechnicianMaintenanceSchedules(Infinity)
        .filter((item) => String(item.companyName || "").toUpperCase() === "WETEX")
        .length,
      configuredSystemCount: getTechnicianFireSystemGroups(schedule).length,
      definitions: getScheduleLinkedVerificationDefinitions(schedule).map((definition) => ({
        id: definition.linkedVerificationId,
        type: definition.verificationType,
        pumpTestKey: definition.pumpTestKey || "",
        gasDeviceId: definition.gasDeviceId || ""
      }))
    };
  }, { scheduleId, deviceTag, templateId, systemKey });
}

async function seedFapToStep4(page) {
  await page.evaluate(() => {
    const key = getCriticalSopStorageKey("fire-alarm-tripping-sop");
    const template = getCriticalSopTemplate("fire-alarm-tripping-sop");
    const stage = getTechnicianSopStageForStep(template, 3);
    state.criticalSops[key] = {
      templateId: "fire-alarm-tripping-sop",
      deviceTag: state.activeCriticalDevice.tag,
      steps: {
        0: { confirmed: true, remark: "Client informed" },
        1: { confirmed: true, reading: "Panel normal" },
        2: {
          confirmed: true,
          photo: "qa-before.jpg",
          photoEvidence: { evidenceId: "qa-fap-before", originalDataUrl: "data:image/png;base64,AA==" }
        }
      }
    };
    state.sopStageSelection = state.sopStageSelection || state.pumpSopStageSelection || {};
    state.pumpSopStageSelection = state.sopStageSelection;
    state.sopStageSelection[key] = stage.id;
    renderCriticalSop();
  });
}

async function syncPumpSide(page) {
  return page.evaluate(async () => {
    const schedule = state.schedules.find((item) => item.scheduleId === "DEMO-WETEX-RETEST-20260924");
    const template = criticalSopTemplates.find((item) => item.id === "sprinkler-hydrant-pump-sop");
    const steps = {};
    template.steps.forEach((step, index) => {
      if (step.linkedPumpTestKey === "STANDBY_MANUAL") steps[index] = { fieldValues: { manualResult: "Pass" } };
      else if (step.linkedPumpTestKey) steps[index] = { choice: "Pass" };
    });
    const results = await syncPumpManualLinkedVerifications(template, { steps }, schedule, state.activeCriticalDevice);
    renderCriticalSop();
    return results.map((result) => ({ ok: result.ok, id: result.linkedVerification?.linkedVerificationId, status: result.linkedVerification?.status }));
  });
}

async function syncGasSide(page) {
  return page.evaluate(async () => {
    const schedule = state.schedules.find((item) => item.scheduleId === "DEMO-WETEX-RETEST-20260924");
    const template = criticalSopTemplates.find((item) => item.id === "gas-discharge-sop");
    const index = template.steps.findIndex((step) => step.linkedGasTestKey === "INDICATION");
    const results = await syncGasReleaseLinkedVerification(template, { steps: { [index]: { confirmed: true } } }, schedule, state.activeCriticalDevice);
    renderCriticalSop();
    return results.map((result) => ({ ok: result.ok, id: result.linkedVerification?.linkedVerificationId, status: result.linkedVerification?.status }));
  });
}

async function answerMfap(page, linkedVerificationId, result) {
  const card = page.locator(`[data-critical-linked-prompt] [data-linked-card="${linkedVerificationId}"]`);
  await card.waitFor({ state: "visible", timeout: 15000 });
  const requestPromise = page.waitForRequest((request) => (
    request.url().includes(`/api/jobs/${scheduleId}/linked-verification-sides`)
      && request.method() === "POST"
  ));
  await card.locator(`[data-linked-quick-result="${result}"]`).click();
  const request = await requestPromise;
  const response = await request.response();
  assert(response, `MFAP ${result} save did not receive an HTTP response.`);
  const responseBody = await response.json();
  assert(response.ok() && responseBody?.ok, `MFAP ${result} save failed with HTTP ${response.status()}.`);
}

(async () => {
  fs.mkdirSync(screenshotRoot, { recursive: true });
  fs.mkdirSync(testOutputRoot, { recursive: true });
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

    const fapSetup = await prepareSop(techA, "GRD.MFAP.1", "fire-alarm-tripping-sop", "fire-alarm");
    assert(fapSetup.activeWetexCount === 1, `Expected one active WETEX fixture, found ${fapSetup.activeWetexCount}.`);
    await seedFapToStep4(techA);
    const mode = techA.locator('[name="sop-field-3-testMode"]');
    const modeLabels = techA.locator(".sop-single-choice label");
    assert(await mode.count() === 3, "FAP Step 4 must render exactly three single-choice modes.");
    await modeLabels.nth(0).click();
    assert(await mode.nth(0).isChecked(), "Silence Test was not selected.");
    await modeLabels.nth(1).click();
    assert(!await mode.nth(0).isChecked() && await mode.nth(1).isChecked(), "Alarm Test did not deselect Silence Test.");
    await modeLabels.nth(2).click();
    assert(!await mode.nth(1).isChecked() && await mode.nth(2).isChecked(), "Actual Test did not deselect Alarm Test.");
    assert(await techA.locator('[name="sop-field-3-testMode"]:checked').count() === 1, "FAP Step 4 allowed more than one mode.");
    await techA.screenshot({ path: path.join(screenshotRoot, "01-fap-step4-single-select.png"), fullPage: true });

    await techA.evaluate(() => setTechSystemDrawerOpen(true));
    const drawerSystemCount = await techA.locator("#techDesktopSystemList [data-tech-sidebar-system]").count();
    assert(drawerSystemCount === fapSetup.configuredSystemCount && drawerSystemCount > 0, "Drawer system list is not data-driven from the active job.");
    assert(await techA.locator("#techSystemSidebar .tech-sidebar-brand img").evaluate((img) => img.complete && img.naturalWidth > 0), "Official Realmart logo did not load.");
    await techA.screenshot({ path: path.join(screenshotRoot, "02-wetex-drawer-expanded.png"), fullPage: true });
    await techA.locator("#techSystemDrawerCloseBtn").click();
    assert(await techA.locator("#techSystemDrawerOpenBtn").isVisible(), "Floating drawer reopen button is not visible.");
    await techA.screenshot({ path: path.join(screenshotRoot, "03-drawer-collapsed-reopen.png"), fullPage: true });
    await techA.locator("#techSystemDrawerOpenBtn").click();
    assert(await techA.locator("#techSystemSidebar").getAttribute("aria-hidden") === "false", "Drawer did not reopen.");
    await techA.locator("#techSystemDrawerCloseBtn").click();
    assert(await techA.locator("#techSystemSidebar").getAttribute("aria-hidden") === "true", "Drawer did not close before MFAP interaction.");

    const pumpSetup = await prepareSop(techB, "LG.SPP.1", "sprinkler-hydrant-pump-sop", "pump-system");
    const pumpWrites = await syncPumpSide(techB);
    assert(pumpWrites.length === 3 && pumpWrites.every((item) => item.ok), "Pump-side Jockey/Duty/Standby records did not save independently.");
    await techB.waitForFunction(() => document.querySelectorAll("[data-sop-inline-linked-step] .sop-inline-linked").length === 3, null, { timeout: 15000 });
    await techB.screenshot({ path: path.join(screenshotRoot, "04-pump-inline-awaiting-mfap.png"), fullPage: true });

    const pumpDefinitions = pumpSetup.definitions.filter((item) => item.type === "FIRE_PUMP_INDICATION");
    const jockey = pumpDefinitions.find((item) => item.pumpTestKey === "JOCKEY_MANUAL");
    const duty = pumpDefinitions.find((item) => item.pumpTestKey === "DUTY_MANUAL");
    const standby = pumpDefinitions.find((item) => item.pumpTestKey === "STANDBY_MANUAL");
    assert(jockey && duty && standby, "Missing one or more stable Pump linked definitions.");
    await techA.waitForFunction(() => document.querySelectorAll("[data-critical-linked-prompt] [data-linked-card]").length >= 3, null, { timeout: 15000 });
    await techA.locator('[data-mfap-workspace-tab="live"]').click();
    assert(await techA.locator('[data-mfap-workspace-tab="live"]').getAttribute("aria-selected") === "true", "LIVE INDICATIONS tab did not open.");
    const jockeyPromptText = await techA.locator(`[data-critical-linked-prompt] [data-linked-card="${jockey.id}"]`).innerText();
    assert(jockeyPromptText.includes("Jockey Pump - Manual Test"), "MFAP Jockey prompt title is incorrect.");
    assert(jockeyPromptText.includes("Pump side") && jockeyPromptText.includes("TEST COMPLETE"), "Saved Pump result must not be presented as an active RUNNING test.");
    assert(jockeyPromptText.includes("MFAP confirmation:"), "MFAP confirmation label is missing from the Jockey prompt.");
    await techA.screenshot({ path: path.join(screenshotRoot, "05-mfap-inline-jockey-prompt.png"), fullPage: true });
    await answerMfap(techA, jockey.id, "CONFIRMED");
    await answerMfap(techA, duty.id, "CONFIRMED");
    await answerMfap(techA, standby.id, "NOT_CONFIRMED");
    await techB.waitForFunction(() => {
      const schedule = state.schedules.find((item) => item.scheduleId === "DEMO-WETEX-RETEST-20260924");
      const definition = getScheduleLinkedVerificationDefinitions(schedule).find((item) => item.pumpTestKey === "STANDBY_MANUAL");
      return calculateClientLinkedVerificationState(schedule, definition).status === "MISMATCH_REVIEW_REQUIRED";
    }, null, { timeout: 15000 });
    const pumpInlineText = await techB.locator("[data-sop-inline-linked-step]").allTextContents();
    assert(pumpInlineText.some((text) => text.includes("Jockey") && text.includes("CONFIRMED")), "Jockey inline state did not update without reload.");
    assert(pumpInlineText.some((text) => text.includes("Duty") && text.includes("CONFIRMED")), "Duty inline state did not update without reload.");
    assert(pumpInlineText.some((text) => text.includes("Standby") && text.includes("Mismatch Review Required")), "Standby mismatch did not update without reload.");
    await techB.screenshot({ path: path.join(screenshotRoot, "06-pump-inline-reconciled.png"), fullPage: true });

    const gasSetup = await prepareSop(techB, "GRD.CO2.1", "gas-discharge-sop", "gas-release");
    const gasWrites = await syncGasSide(techB);
    assert(gasWrites.length === 1 && gasWrites[0].ok, "Gas-side linked record did not save.");
    const gasDefinition = gasSetup.definitions.find((item) => item.type === "CO2_GAS_RELEASE_INDICATION" && item.gasDeviceId === "GRD.CO2.1");
    assert(gasDefinition, "Missing stable CO2 linked definition.");
    await techA.waitForFunction((id) => Boolean(document.querySelector(`[data-critical-linked-prompt] [data-linked-card="${id}"]`)), gasDefinition.id, { timeout: 15000 });
    const gasPromptText = await techA.locator(`[data-critical-linked-prompt] [data-linked-card="${gasDefinition.id}"]`).innerText();
    assert(gasPromptText.includes("CO2 System - Step 12"), "MFAP CO2 prompt title is incorrect.");
    assert(gasPromptText.includes("Suppression side") && gasPromptText.includes("TEST COMPLETE"), "Saved CO2 result must not be presented as an active TESTING state.");
    assert(gasPromptText.includes("MFAP confirmation:"), "MFAP confirmation label is missing from the CO2 prompt.");
    await techA.screenshot({ path: path.join(screenshotRoot, "07-mfap-inline-co2-prompt.png"), fullPage: true });
    await answerMfap(techA, gasDefinition.id, "CONFIRMED");
    await techB.waitForFunction(() => document.querySelector("[data-sop-inline-linked-step]")?.innerText.includes("CONFIRMED"), null, { timeout: 15000 });
    await techB.screenshot({ path: path.join(screenshotRoot, "08-co2-inline-confirmed.png"), fullPage: true });

    const server = await fetch(`http://127.0.0.1:8026/api/jobs/${scheduleId}/state`).then((response) => response.json());
    const states = Object.fromEntries(server.linkedVerifications.map((item) => [item.definition.linkedVerificationId, item.status]));
    assert(states[jockey.id] === "VERIFIED", "Jockey did not reconcile to VERIFIED.");
    assert(states[duty.id] === "VERIFIED", "Duty did not reconcile to VERIFIED.");
    assert(states[standby.id] === "MISMATCH_REVIEW_REQUIRED", "Standby did not reconcile to mismatch.");
    assert(states[gasDefinition.id] === "VERIFIED", "CO2 did not reconcile to VERIFIED.");
    assert(await techA.locator("#techSystemStagePanel [data-linked-card]").count() === 0, "A separate linked checklist remains in the system stage panel.");

    const result = {
      pass: true,
      scheduleId,
      activeWetexCount: fapSetup.activeWetexCount,
      configuredSystemCount: fapSetup.configuredSystemCount,
      drawerSystemCount,
      fapStep4Checked: await techA.locator('[name="sop-field-3-testMode"]:checked').count(),
      pumpWrites,
      gasWrites,
      linkedStates: states,
      consoleErrors
    };
    fs.writeFileSync(path.join(testOutputRoot, "physical-correction-result.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
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
