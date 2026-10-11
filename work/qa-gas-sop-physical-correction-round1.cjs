const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const scheduleId = "DEMO-WETEX-RETEST-20260924";
const appUrl = "http://127.0.0.1:8026/?fresh=gas-physical-round1&demoEvidence=1";
const sharedPath = path.join(root, "outputs", "rmt-fire-local-data", "shared-records", "jobs", `${scheduleId.toLowerCase()}.json`);
const outputPath = path.join(root, "docs", "reviews", "physical-correction", "gas-progression-round1.json");
const sharedBackup = fs.readFileSync(sharedPath);
const browserPaths = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function resetSharedTestState() {
  const store = JSON.parse(sharedBackup.toString("utf8"));
  store.linkedVerificationSideRecords = {};
  store.linkedVerificationConflicts = [];
  store.linkedVerificationAudit = [];
  store.linkedVerificationLiveStates = {};
  store.liveCoordinationEvents = {};
  store.criticalSopRecords = {};
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(sharedPath, `${JSON.stringify(store, null, 2)}\n`);
}

async function login(page, email) {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", "gas-round1-qa");
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
    return {
      stepCount: getCriticalSopTemplate(templateId).steps.length,
      version: getCriticalSopTemplateVersion(getCriticalSopTemplate(templateId)),
      definitions: getScheduleLinkedVerificationDefinitions(schedule).map((definition) => ({
        id: definition.linkedVerificationId,
        type: definition.verificationType,
        gasDeviceId: definition.gasDeviceId || ""
      }))
    };
  }, { scheduleId, deviceTag, templateId, systemKey });
}

async function activeStage(page) {
  return page.locator("#criticalSopForm").getAttribute("data-active-pump-stage");
}

async function visibleStepIndexes(page) {
  return page.locator(".sop-step:not(.pump-sop-step-hidden)").evaluateAll((nodes) => nodes.map((node) => Number(node.dataset.sopStepIndex)));
}

async function saveStep(page, index, matrix, options = {}) {
  const fieldset = page.locator(`[data-sop-step-index="${index}"]`);
  await fieldset.waitFor({ state: "attached" });
  const reading = fieldset.locator(`input[name="sop-reading-${index}"]`);
  if (await reading.count()) await reading.fill(options.reading || (index === 10 ? "28 seconds" : "AC normal / battery 26.8V / charger normal"));
  const supervisor = fieldset.locator(`input[name="sop-supervisor-${index}"]`);
  if (await supervisor.count()) await supervisor.fill("QA Supervisor");
  const checkbox = fieldset.locator(`input[name="sop-confirm-${index}"]`);
  if (await checkbox.count() && !await checkbox.isChecked()) await checkbox.check();

  let criticalWrites = 0;
  const countWrite = (request) => {
    if (request.method() === "POST" && request.url().includes("/critical-sop-records")) criticalWrites += 1;
  };
  page.on("request", countWrite);
  await page.locator("#saveCriticalSopBottomBtn").click();
  await page.waitForFunction(({ templateId, deviceTag, index }) => {
    const record = state.criticalSops[`${templateId}::${deviceTag}`];
    return Boolean(record?.steps?.[index]?.confirmed);
  }, { templateId: "gas-discharge-sop", deviceTag: "GRD.CO2.1", index }, { timeout: 20000 });
  await page.waitForTimeout(150);
  page.off("request", countWrite);
  assert(criticalWrites === 1, `Step ${index + 1} created ${criticalWrites} critical saves from one action.`);
  const stateResult = await page.evaluate(({ index }) => {
    const record = state.criticalSops["gas-discharge-sop::GRD.CO2.1"];
    const template = getCriticalSopTemplate("gas-discharge-sop");
    return {
      label: template.steps[index].title,
      stage: getTechnicianSopStageForStep(template, index)?.label || "",
      confirmed: Boolean(record?.steps?.[index]?.confirmed),
      currentStage: document.querySelector("#criticalSopForm")?.dataset.activePumpStage || "",
      sync: document.querySelector("#syncState")?.textContent || ""
    };
  }, { index });
  await page.evaluate(() => renderCriticalSop());
  const reopened = await page.evaluate(({ index }) => {
    const record = state.criticalSops["gas-discharge-sop::GRD.CO2.1"];
    const checkbox = document.querySelector(`input[name="sop-confirm-${index}"]`);
    return Boolean(record?.steps?.[index]?.confirmed) && (!checkbox || checkbox.checked);
  }, { index });
  matrix.push({
    step: index + 1,
    label: stateResult.label,
    stage: stateResult.stage,
    input: options.input || (await reading.count() ? "reading + confirm" : await supervisor.count() ? "supervisor + confirm" : "confirm"),
    save: stateResult.confirmed ? "PASS" : "FAIL",
    next: stateResult.currentStage,
    reopen: reopened ? "PASS" : "FAIL",
    result: stateResult.confirmed && criticalWrites === 1 && reopened ? "PASS" : "FAIL"
  });
}

(async () => {
  resetSharedTestState();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const executablePath = browserPaths.find(fs.existsSync);
  assert(executablePath, "No supported browser was found.");
  const browser = await chromium.launch({ headless: true, executablePath });
  const mfapContext = await browser.newContext({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true });
  await mfapContext.addInitScript(() => {
    window.__qaAudioCount = 0;
    window.__qaVibrateCount = 0;
    class QaAudioContext {
      constructor() { this.currentTime = 0; window.__qaAudioCount += 1; }
      createOscillator() { return { frequency: { value: 0 }, connect() { return this; }, start() {}, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return this; } }; }
      get destination() { return {}; }
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: QaAudioContext });
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => { window.__qaVibrateCount += 1; return true; } });
  });
  const gasContext = await browser.newContext({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true });
  const mfap = await mfapContext.newPage();
  const gas = await gasContext.newPage();
  const consoleErrors = [];
  [mfap, gas].forEach((page) => page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  }));
  const progression = [];
  try {
    await login(mfap, "tech@rmtfire.local");
    await login(gas, "tech2@rmtfire.local");
    await prepareSop(mfap, "GRD.MFAP.1", "fire-alarm-tripping-sop", "fire-alarm");
    const setup = await prepareSop(gas, "GRD.CO2.1", "gas-discharge-sop", "gas-release");
    assert(setup.stepCount === 16, `Expected 16 Gas steps, found ${setup.stepCount}.`);
    assert(await activeStage(gas) === "gas-preparation", "Fresh Gas SOP did not start at Preparation.");
    assert(JSON.stringify(await visibleStepIndexes(gas)) === JSON.stringify([0, 1, 2, 3]), "Fresh Gas SOP did not render Steps 1-4 first.");

    const missingDefinitionRequirement = await gas.evaluate(() => {
      const originalDevice = state.activeCriticalDevice;
      const template = getCriticalSopTemplate("gas-discharge-sop");
      state.activeCriticalDevice = { ...originalDevice, id: "QA.GAS.NO.LINK", tag: "QA.GAS.NO.LINK" };
      const requirement = getGasLinkedStepRequirement(template.steps[11]);
      state.activeCriticalDevice = originalDevice;
      return requirement;
    });
    assert(
      missingDefinitionRequirement && !missingDefinitionRequirement.complete && missingDefinitionRequirement.message.includes("configured MFAP"),
      `Missing Gas linked definition did not block Step 12: ${JSON.stringify(missingDefinitionRequirement)}`
    );

    const migration = await gas.evaluate(() => {
      const template = getCriticalSopTemplate("gas-discharge-sop");
      const snapshot = createCriticalSopTemplateSnapshot(template);
      snapshot.steps = snapshot.steps.map(({ stepId, ...step }) => step);
      const firstZone = snapshot.steps.splice(8, 1)[0];
      snapshot.steps.unshift(firstZone);
      const old = {
        templateId: template.id,
        templateVersion: "legacy-indexed-gas",
        templateSnapshot: snapshot,
        steps: { 0: { confirmed: true, title: firstZone.title } }
      };
      const normalized = normalizeCriticalSopRecordForTemplate(old, template);
      return {
        step0: Boolean(normalized.steps?.[0]?.confirmed),
        step8: Boolean(normalized.steps?.[8]?.confirmed),
        mode: normalized.legacySopMigration?.mode
      };
    });
    assert(!migration.step0 && migration.step8 && migration.mode === "STEP_IDENTITY", `Legacy Gas steps were not identity-remapped: ${JSON.stringify(migration)}`);

    await gas.locator('[data-critical-demo-photo="before"]').click();
    await gas.locator('[data-critical-demo-photo="after"]').click();
    for (let index = 0; index <= 10; index += 1) await saveStep(gas, index, progression);

    const gasDefinition = setup.definitions.find((item) => item.type === "CO2_GAS_RELEASE_INDICATION" && item.gasDeviceId === "GRD.CO2.1");
    assert(gasDefinition, "Gas/MFAP linked definition is missing.");
    const liveButton = gas.locator('[data-sop-step-index="11"] [data-linked-live-toggle][data-linked-live-status="ACTIVE"]');
    await liveButton.click();
    await mfap.waitForFunction(() => !document.querySelector("[data-mfap-new-indication-alert]")?.classList.contains("hidden"), null, { timeout: 20000 });
    const attention = await mfap.evaluate(() => ({ audio: window.__qaAudioCount, vibrate: window.__qaVibrateCount }));
    assert(attention.audio > 0 && attention.vibrate > 0, `MFAP attention was not invoked: ${JSON.stringify(attention)}`);
    await mfap.locator("[data-mfap-view-new-indication]").click();
    const mfapCard = mfap.locator(`[data-mfap-live-view] [data-linked-card="${gasDefinition.id}"]`);
    await mfapCard.waitFor({ state: "visible", timeout: 15000 });

    await saveStep(gas, 11, progression, { input: "field confirmation + linked MFAP" });
    assert((await activeStage(gas)) === "gas-indication", "Step 12 advanced before MFAP confirmation.");
    assert((await gas.locator('[data-sop-step-index="11"]').innerText()).includes("AWAITING COUNTERPART"), "Step 12 did not show awaiting counterpart.");
    await gas.locator("#saveCriticalSopBottomBtn").click();
    await gas.waitForTimeout(200);
    const repeatedAwaitingSave = await gas.evaluate(() => ({
      confirmed: Boolean(state.criticalSops["gas-discharge-sop::GRD.CO2.1"]?.steps?.[11]?.confirmed),
      checked: Boolean(document.querySelector('input[name="sop-confirm-11"]')?.checked)
    }));
    assert(repeatedAwaitingSave.confirmed && repeatedAwaitingSave.checked, `Repeated awaiting save cleared Step 12 confirmation: ${JSON.stringify(repeatedAwaitingSave)}`);
    const liveBeforeMfap = await fetch(`http://127.0.0.1:8026/api/jobs/${scheduleId}/state`).then((response) => response.json());
    const activeEvents = Object.values(liveBeforeMfap.store.liveCoordinationEvents || {}).filter((event) => event.status === "ACTIVE" && event.linkedVerificationId === gasDefinition.id);
    assert(activeEvents.length === 1, `Expected one active Gas event, found ${activeEvents.length}.`);

    await mfapCard.locator('[data-linked-quick-result="NOT_CONFIRMED"]').click();
    await gas.waitForFunction((id) => state.linkedVerificationIndex.some((item) => item.linkedVerificationId === id && item.status === "MISMATCH_REVIEW_REQUIRED"), gasDefinition.id, { timeout: 20000 });
    await gas.waitForFunction(() => document.querySelector('[data-sop-step-index="11"]')?.innerText.toUpperCase().includes("MISMATCH"), null, { timeout: 20000 });
    const mismatchState = await gas.evaluate(() => {
      const template = getCriticalSopTemplate("gas-discharge-sop");
      const record = state.criticalSops["gas-discharge-sop::GRD.CO2.1"];
      return {
        complete: isSopStepComplete(template.steps[11], record.steps[11], template, 11, record),
        status: getSopStepLinkedVerificationState(template.steps[11])?.linkedState?.status || ""
      };
    });
    assert(!mismatchState.complete && mismatchState.status === "MISMATCH_REVIEW_REQUIRED", `Negative MFAP result incorrectly passed Step 12: ${JSON.stringify(mismatchState)}`);

    await mfap.locator(`[data-mfap-live-view] [data-linked-card="${gasDefinition.id}"] [data-linked-quick-result="CONFIRMED"]`).click();
    await gas.waitForFunction((id) => state.linkedVerificationIndex.some((item) => item.linkedVerificationId === id && item.status === "VERIFIED"), gasDefinition.id, { timeout: 20000 });
    await gas.waitForFunction(() => document.querySelector('[data-sop-step-index="12"]') && !document.querySelector('[data-sop-step-index="12"]')?.classList.contains("pump-sop-step-hidden"), null, { timeout: 20000 });
    progression[11].next = "MFAP verified → Step 13";
    progression[11].result = "PASS";

    for (let index = 12; index <= 15; index += 1) await saveStep(gas, index, progression);
    await gas.evaluate(() => renderCriticalSop());
    const finalRecord = await gas.evaluate(() => {
      const record = state.criticalSops["gas-discharge-sop::GRD.CO2.1"];
      const template = getCriticalSopTemplate("gas-discharge-sop");
      return {
        complete: isCriticalSopRecordComplete(template, record),
        beforeMode: record.beforePhotoEvidence?.evidenceMode,
        afterMode: record.afterPhotoEvidence?.evidenceMode,
        stepCount: Object.keys(record.steps || {}).length,
        migration: record.legacySopMigration || null
      };
    });
    assert(finalRecord.complete && finalRecord.stepCount === 16, `Gas SOP did not complete: ${JSON.stringify(finalRecord)}`);
    assert(finalRecord.beforeMode === "DEMO_TEST" && finalRecord.afterMode === "DEMO_TEST", "Demo evidence was not retained.");
    assert(progression.every((item) => item.result === "PASS"), "Gas progression matrix contains a failure.");
    assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(" | ")}`);

    const result = {
      pass: true,
      scheduleId,
      templateStepCount: setup.stepCount,
      firstStage: "gas-preparation",
      firstVisibleSteps: [1, 2, 3, 4],
      legacyMigration: migration,
      missingDefinitionRequirement,
      repeatedAwaitingSave,
      mfapAttention: attention,
      activeEventCountBeforeMfap: activeEvents.length,
      negativeMfapResult: mismatchState,
      linkedStatus: "VERIFIED",
      finalRecord,
      progression,
      consoleErrors
    };
    fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await Promise.allSettled([mfapContext.close(), gasContext.close()]);
    await browser.close();
    fs.writeFileSync(sharedPath, sharedBackup);
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
