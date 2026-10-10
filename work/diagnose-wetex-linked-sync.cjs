const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const scheduleId = "DEMO-WETEX-RETEST-20260924";
const appUrl = "http://127.0.0.1:8026/?fresh=diagnose-wetex-linked-sync";
const sharedPath = path.join(root, "outputs", "rmt-fire-local-data", "shared-records", "jobs", `${scheduleId.toLowerCase()}.json`);
const sharedBackup = fs.existsSync(sharedPath) ? fs.readFileSync(sharedPath) : null;
const browserPaths = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

async function login(page, email) {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", "linked-sync-diagnostic");
  await page.click("#loginForm button[type='submit']");
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("technician-mode"), null, { timeout: 20000 });
}

async function prepareSop(page, deviceTag, templateId, systemKey) {
  return page.evaluate(async ({ scheduleId, deviceTag, templateId, systemKey }) => {
    const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
    await ensureTechnicianFieldDataLoaded(schedule);
    state.activeTechPreviewScheduleId = scheduleId;
    state.activeJob = { scheduleId, jobId: schedule.jobId, schedule, status: schedule.status };
    state.activeTechSystemKey = systemKey;
    await requestSharedJobState(schedule, { migrate: true, apply: true });
    await loadLinkedVerificationIndex();
    const device = state.setupDevices.find((item) => (item.id || item.tag) === deviceTag);
    if (!device) throw new Error(`Missing ${deviceTag} in loaded Wetex master.`);
    state.activeCriticalSopId = templateId;
    state.activeCriticalDevice = device;
    openCriticalSopForDevice(device);
    startTechnicianSharedHeartbeat();
    return {
      scheduleId: schedule.scheduleId,
      jobId: schedule.jobId,
      device: device.id || device.tag,
      definitions: getScheduleLinkedVerificationDefinitions(schedule).map((definition) => ({
        id: definition.linkedVerificationId,
        type: definition.verificationType,
        pumpTestKey: definition.pumpTestKey || "",
        gasDeviceId: definition.gasDeviceId || "",
        sides: definition.requiredSides.map((side) => ({ sideId: side.sideId, technicianId: side.assignedTechnicianId }))
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
    return results.map((result) => ({ ok: result.ok, status: result.linkedVerification?.status, id: result.linkedVerification?.linkedVerificationId }));
  });
}

async function confirmVisibleMfapCards(page) {
  await page.waitForFunction(() => document.querySelectorAll("[data-critical-linked-prompt] [data-linked-card]").length === 3, null, { timeout: 15000 });
  const cards = page.locator("[data-critical-linked-prompt] [data-linked-card]");
  const count = await cards.count();
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    await card.locator("[data-linked-result]").selectOption("CONFIRMED");
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/linked-verification-sides") && response.request().method() === "POST"),
      card.locator("[data-linked-save-side]").click()
    ]);
  }
}

(async () => {
  const executablePath = browserPaths.find(fs.existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  const contextA = await browser.newContext({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true });
  const contextB = await browser.newContext({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true });
  const techA = await contextA.newPage();
  const techB = await contextB.newPage();
  try {
    await login(techA, "tech@rmtfire.local");
    await login(techB, "tech2@rmtfire.local");
    const beforeA = await prepareSop(techA, "GRD.MFAP.1", "fire-alarm-tripping-sop", "fire-alarm");
    const beforeB = await prepareSop(techB, "LG.SPP.1", "sprinkler-hydrant-pump-sop", "pump-system");
    const fapBefore = await techA.locator("#criticalSopForm .sop-step").nth(7).textContent();
    const pumpWrites = await savePumpSides(techB);
    await techA.waitForTimeout(6500);
    const promptCount = await techA.locator("[data-critical-linked-prompt] [data-linked-card]").count();
    await confirmVisibleMfapCards(techA);
    await techB.waitForTimeout(6500);
    const server = await fetch(`http://127.0.0.1:8026/api/jobs/${scheduleId}/state`).then((response) => response.json());
    const pumpStates = server.linkedVerifications.filter((item) => item.definition?.verificationType === "FIRE_PUMP_INDICATION");
    const co2States = server.linkedVerifications.filter((item) => item.definition?.verificationType === "CO2_GAS_RELEASE_INDICATION");
    const fapAfter = await techA.locator("#criticalSopForm .sop-step").nth(7).textContent();
    const techBStates = await techB.evaluate(() => state.linkedVerificationIndex.map((item) => ({ id: item.linkedVerificationId, status: item.status })));
    console.log(JSON.stringify({
      reproduction: {
        scheduleId,
        jobId: beforeA.jobId,
        techADefinitions: beforeA.definitions,
        techBDefinitions: beforeB.definitions,
        pumpWrites,
        mfapPromptCount: promptCount,
        serverPumpStates: pumpStates.map((item) => ({ id: item.linkedVerificationId, status: item.status, sides: item.sides.map((side) => ({ sideId: side.sideId, revision: side.record?.revision || 0, technicianId: side.record?.technicianId || "", result: side.record?.result || "" })) })),
        serverCo2Count: co2States.length,
        techBStates,
        fapStep8Before: fapBefore.replace(/\s+/g, " ").trim(),
        fapStep8After: fapAfter.replace(/\s+/g, " ").trim()
      }
    }, null, 2));
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
