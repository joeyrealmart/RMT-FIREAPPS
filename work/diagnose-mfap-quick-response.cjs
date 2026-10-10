const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const scheduleId = "DEMO-WETEX-RETEST-20260924";
const appUrl = "http://127.0.0.1:8026/?fresh=diagnose-mfap-quick-response";
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
  await page.fill("#loginPassword", "mfap-post-diagnostic");
  await page.click("#loginForm button[type='submit']");
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("technician-mode"), null, { timeout: 20000 });
}

async function prepare(page, deviceTag, templateId, systemKey) {
  return page.evaluate(async ({ scheduleId, deviceTag, templateId, systemKey }) => {
    const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
    await ensureTechnicianFieldDataLoaded(schedule);
    state.activeTechPreviewScheduleId = scheduleId;
    state.activeJob = { scheduleId, jobId: schedule.jobId, schedule, status: schedule.status };
    state.activeTechSystemKey = systemKey;
    await requestSharedJobState(schedule, { migrate: false, apply: true });
    await loadLinkedVerificationIndex();
    const device = state.setupDevices.find((item) => (item.id || item.tag) === deviceTag);
    state.activeCriticalSopId = templateId;
    state.activeCriticalDevice = device;
    openCriticalSopForDevice(device);
    startTechnicianSharedHeartbeat();
    return { scheduleId: schedule.scheduleId, jobId: schedule.jobId };
  }, { scheduleId, deviceTag, templateId, systemKey });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPaths.find(fs.existsSync) });
  const contextA = await browser.newContext({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true });
  const contextB = await browser.newContext({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true });
  const techA = await contextA.newPage();
  const techB = await contextB.newPage();
  const network = [];
  const consoleMessages = [];
  const pageErrors = [];
  techA.on("request", (request) => {
    if (request.url().includes("linked-verification")) network.push({ event: "request", method: request.method(), url: request.url(), payload: request.postDataJSON?.() || request.postData() });
  });
  techA.on("response", async (response) => {
    if (response.url().includes("linked-verification")) network.push({ event: "response", status: response.status(), url: response.url(), body: await response.text().catch(() => "") });
  });
  techA.on("console", (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  techA.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    await login(techA, "tech@rmtfire.local");
    await login(techB, "tech2@rmtfire.local");
    const tech1 = await prepare(techA, "GRD.MFAP.1", "fire-alarm-tripping-sop", "fire-alarm");
    await prepare(techB, "LG.SPP.1", "sprinkler-hydrant-pump-sop", "pump-system");
    const pumpWrite = await techB.evaluate(async () => {
      const schedule = state.schedules.find((item) => item.scheduleId === "DEMO-WETEX-RETEST-20260924");
      const template = criticalSopTemplates.find((item) => item.id === "sprinkler-hydrant-pump-sop");
      const index = template.steps.findIndex((step) => step.linkedPumpTestKey === "JOCKEY_MANUAL");
      const results = await syncPumpManualLinkedVerifications(template, { steps: { [index]: { choice: "Pass" } } }, schedule, state.activeCriticalDevice);
      return results[0];
    });
    await techA.waitForFunction(() => document.querySelector('[data-critical-linked-prompt] [data-linked-quick-result="CONFIRMED"]'), null, { timeout: 15000 });
    const beforeClick = await techA.evaluate(() => {
      const button = document.querySelector('[data-critical-linked-prompt] [data-linked-quick-result="CONFIRMED"]');
      const card = button?.closest("[data-linked-card]");
      const schedule = getActiveTechnicianMaintenanceSchedule();
      const definition = getScheduleLinkedVerificationDefinitions(schedule).find((item) => item.linkedVerificationId === button?.dataset.linkedEventId);
      const side = definition?.requiredSides.find((item) => item.sideId === button?.dataset.linkedSaveSide);
      return {
        buttonType: button?.type,
        linkedVerificationId: button?.dataset.linkedEventId,
        sideId: button?.dataset.linkedSaveSide,
        quickResult: button?.dataset.linkedQuickResult,
        resultControlPresent: Boolean(card?.querySelector("[data-linked-result]")),
        definitionFound: Boolean(definition),
        verificationType: definition?.verificationType,
        pumpTestKey: definition?.pumpTestKey,
        scheduleId: schedule?.scheduleId,
        jobId: schedule?.jobId,
        side,
        currentTechnicianId: getCurrentUserId(),
        ownershipMatches: Boolean(side && linkedVerificationTechnicianMatches(side))
      };
    });
    await techA.locator('[data-critical-linked-prompt] [data-linked-quick-result="CONFIRMED"]').click();
    await techA.waitForTimeout(3500);
    const afterClick = await techA.evaluate(() => ({
      syncState: document.querySelector("#syncState")?.textContent || "",
      drafts: Object.values(state.linkedVerificationDrafts || {}).map((draft) => ({
        linkedVerificationId: draft.linkedVerificationId,
        sideId: draft.sideId,
        result: draft.result,
        expectedRevision: draft.expectedRevision,
        syncStatus: draft.syncStatus
      }))
    }));
    const server = await fetch(`http://127.0.0.1:8026/api/jobs/${scheduleId}/state`).then((response) => response.json());
    const linked = server.linkedVerifications.find((item) => item.definition?.linkedVerificationId === beforeClick.linkedVerificationId);
    const result = {
      tech1,
      pumpWrite: { ok: pumpWrite?.ok, status: pumpWrite?.linkedVerification?.status, record: pumpWrite?.record },
      beforeClick,
      network,
      afterClick,
      authoritative: linked ? {
        linkedVerificationId: linked.definition.linkedVerificationId,
        status: linked.status,
        sides: linked.sides.map((entry) => ({ sideId: entry.sideId, revision: entry.record?.revision || 0, technicianId: entry.record?.technicianId || "", result: entry.record?.result || "" }))
      } : null,
      consoleMessages,
      pageErrors
    };
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
