const { existsSync, mkdirSync, rmSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=wetex-pump-fap-live-link";
const OUTPUT_DIR = path.resolve("outputs/fire-inspection-mvp/technician-ui-qa/pump-physical-fixes");
const BROWSER_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:8026${pathname}`, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error(`${pathname} returned ${response.status} non-JSON response: ${responseText}`);
  }
  if (options.expect && response.status !== options.expect) {
    throw new Error(`${pathname} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function scheduleFixture(scheduleId) {
  return {
    scheduleId,
    jobId: `JOB-${scheduleId}`,
    status: "In Progress",
    companyName: "WETEX QA",
    siteName: "WETEX QA",
    technician: "Demo Technician / Tech 2",
    plannedDeviceIds: ["QA.SPP.1", "QA.MFAP.1"],
    technicians: [
      { technicianId: "tech@rmtfire.local", technicianName: "Demo Technician" },
      { technicianId: "tech2@rmtfire.local", technicianName: "Tech 2" }
    ],
    deviceAssignments: {
      "QA.SPP.1": { technicianId: "tech2@rmtfire.local", technicianName: "Tech 2" },
      "QA.MFAP.1": { technicianId: "tech@rmtfire.local", technicianName: "Demo Technician" }
    }
  };
}

async function seedTechnician(page, schedule, user, activeDevice, templateId, systemKey) {
  return page.evaluate(async ({ schedule, user, activeDevice, templateId, systemKey }) => {
    state.currentUser = { name: user.name, role: "Technician", email: user.email };
    state.setupDevices = [
      { tag: "QA.SPP.1", id: "QA.SPP.1", type: "Sprinkler Panel", floor: "Pump Room", floorId: "qa-floor", location: "Pump Room" },
      { tag: "QA.MFAP.1", id: "QA.MFAP.1", type: "Main Fire Alarm Panel", floor: "Control Room", floorId: "qa-floor", location: "Control Room" }
    ];
    state.schedules = [schedule];
    state.activeJob = { scheduleId: schedule.scheduleId, schedule, status: "In Progress" };
    state.activeTechPreviewScheduleId = schedule.scheduleId;
    state.activeTechSystemKey = systemKey;
    state.activeCriticalDevice = activeDevice;
    state.activeCriticalSopId = templateId;
    invalidateRuntimeCaches();
    applyRoleView();
    workspace?.classList.remove("hidden");
    workspace?.classList.remove("admin-mode");
    workspace?.classList.add("technician-mode", "critical-sop-active", "tech-screen-inspection");
    loginView?.classList.add("hidden");
    await requestSharedJobState(schedule, { migrate: true, apply: true });
    await loadLinkedVerificationIndex();
    renderTechSystemStagePanel(schedule);
    setTechScreen("inspection", { scroll: false, renderMarkers: false });
    openCriticalSopForDevice(activeDevice);
    startTechnicianSharedHeartbeat();
    return getScheduleLinkedVerificationDefinitions(schedule).map((item) => ({
      id: item.linkedVerificationId,
      key: item.pumpTestKey,
      sides: item.requiredSides
    }));
  }, { schedule, user, activeDevice, templateId, systemKey });
}

async function saveSideFromPage(page, testKey, result, submissionId) {
  return page.evaluate(async ({ testKey, result, submissionId }) => {
    const schedule = state.schedules[0];
    const definition = getScheduleLinkedVerificationDefinitions(schedule).find((item) => item.pumpTestKey === testKey);
    const side = definition.requiredSides.find((item) => linkedVerificationTechnicianMatches(item));
    return saveLinkedVerificationSide(schedule, definition, side, { result, submissionId });
  }, { testKey, result, submissionId });
}

async function setLiveFromPage(page, testKey, status) {
  return page.evaluate(async ({ testKey, status }) => {
    const schedule = state.schedules[0];
    const definition = getScheduleLinkedVerificationDefinitions(schedule).find((item) => item.pumpTestKey === testKey);
    const side = definition.requiredSides.find((item) => item.sideId === "PUMP_ROOM");
    return saveLinkedVerificationLiveState(schedule, definition, side, status);
  }, { testKey, status });
}

async function showPumpManualStage(page) {
  await page.evaluate(() => {
    const template = criticalSopTemplates.find((item) => item.id === "sprinkler-hydrant-pump-sop");
    const key = getCriticalSopStorageKey(template.id);
    state.criticalSops[key] = {
      ...(state.criticalSops[key] || {}),
      templateId: template.id,
      deviceTag: state.activeCriticalDevice.tag,
      steps: {
        0: { confirmed: true, remark: "Client informed" },
        1: { confirmed: true, photo: "qa-panel-before.jpg" },
        2: { choice: "Sufficient", fieldValues: { tankType: "RCC / Concrete Tank", capacityMethod: "Calculate from dimensions", tankLengthFt: "10", tankWidthFt: "8", tankHeightFt: "6" } },
        3: { confirmed: true, choice: "Fully Open", remark: "Valves confirmed open", photo: "qa-valves.jpg", recordedBy: "Tech 2" },
        4: { fieldValues: { phaseRy: "415", phaseYb: "415", phaseBr: "415" } },
        5: { choice: "Pass" },
        6: {},
        7: { choice: "Electrical" }
      }
    };
    state.pumpSopStageSelection = { [key]: "pump-manual-tests" };
    renderCriticalSop();
  });
}

async function saveMfapFromPrompt(page, linkedVerificationId, result) {
  const card = page.locator(`[data-critical-linked-prompt] [data-linked-card="${linkedVerificationId}"]`);
  await card.waitFor({ state: "visible", timeout: 12000 });
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/linked-verification-sides") && response.request().method() === "POST"),
    card.locator(`[data-linked-quick-result="${result}"]`).click()
  ]);
}

(async () => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const scheduleId = `QA-WETEX-LIVE-LINK-${Date.now()}`;
  const schedule = scheduleFixture(scheduleId);
  const executablePath = BROWSER_PATHS.find(existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  const techAContext = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const techBContext = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const techA = await techAContext.newPage();
  const techB = await techBContext.newPage();
  const errors = [];
  [techA, techB].forEach((page) => page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  }));

  try {
    await Promise.all([
      techA.goto(APP_URL, { waitUntil: "networkidle" }),
      techB.goto(APP_URL, { waitUntil: "networkidle" })
    ]);
    const [techADefinitions, techBDefinitions] = await Promise.all([
      seedTechnician(techA, schedule, { name: "Demo Technician", email: "tech@rmtfire.local" },
        { id: "QA.MFAP.1", tag: "QA.MFAP.1", type: "Main Fire Alarm Panel", floor: "Control Room", location: "Control Room" },
        "fire-alarm-tripping-sop", "fire-alarm"),
      seedTechnician(techB, schedule, { name: "Tech 2", email: "tech2@rmtfire.local" },
        { id: "QA.SPP.1", tag: "QA.SPP.1", type: "Sprinkler Panel", floor: "Pump Room", location: "Pump Room" },
        "sprinkler-hydrant-pump-sop", "pump-system")
    ]);
    assert(techADefinitions.length === 3 && techBDefinitions.length === 3, "Both sessions must resolve the same three automatic Pump/MFAP definitions.");
    assert(techADefinitions.every((item) => item.sides[0].assignedTechnicianId === "tech2@rmtfire.local" && item.sides[1].assignedTechnicianId === "tech@rmtfire.local"), "Pump and MFAP ownership must match the physical retest assignment.");

    const duty = techADefinitions.find((item) => item.key === "DUTY_MANUAL");
    await showPumpManualStage(techB);
    const jockeyPreviewLive = await setLiveFromPage(techB, "JOCKEY_MANUAL", "ACTIVE");
    assert(jockeyPreviewLive.ok, "Jockey live preview could not start.");
    await techB.evaluate(() => renderCriticalSopPreservingScroll());
    await techB.screenshot({ path: path.join(OUTPUT_DIR, "01-tech2-manual-live.png"), fullPage: true });
    await setLiveFromPage(techB, "JOCKEY_MANUAL", "ENDED");
    const dutyLive = await setLiveFromPage(techB, "DUTY_MANUAL", "ACTIVE");
    assert(dutyLive.ok && dutyLive.record.status === "ACTIVE", "Pump side must broadcast a separate transient live state.");
    await techB.evaluate(() => renderCriticalSopPreservingScroll());
    await techA.waitForFunction(() => {
      const alert = document.querySelector("[data-mfap-new-indication-alert]");
      return state.activeMfapWorkspaceTab === "checklist" && alert && !alert.classList.contains("hidden") && Number(document.querySelector("[data-mfap-pending-count]")?.textContent || 0) >= 1;
    }, { timeout: 12000 });
    await techA.locator("[data-mfap-view-new-indication]").click();
    await techA.waitForFunction((linkedId) => {
      const card = document.querySelector(`[data-critical-linked-prompt] [data-linked-card="${CSS.escape(linkedId)}"]`);
      return state.activeMfapWorkspaceTab === "live" && card && !card.closest("[data-mfap-live-view]")?.classList.contains("hidden") && card.textContent.includes("RUNNING");
    }, duty.id, { timeout: 4000 });
    await techA.screenshot({ path: path.join(OUTPUT_DIR, "02-tech1-mfap-auto-live.png"), fullPage: true });
    const pumpSave = await saveSideFromPage(techB, "DUTY_MANUAL", "CONFIRMED", `${scheduleId}-duty-pump`);
    assert(pumpSave.ok && pumpSave.linkedVerification.status === "AWAITING_COUNTERPART", "Pump side must create an awaiting-counterpart shared event.");
    await setLiveFromPage(techB, "DUTY_MANUAL", "ENDED");
    await saveMfapFromPrompt(techA, duty.id, "CONFIRMED");
    const afterDuty = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/state`, { expect: 200 });
    const dutyState = afterDuty.linkedVerifications.find((item) => item.linkedVerificationId === duty.id);
    assert(dutyState.status === "VERIFIED", "Matching Duty Pump and MFAP sides must verify.");
    const dutyPumpRecord = Object.values(afterDuty.store.linkedVerificationSideRecords).find((record) => record.linkedVerificationId === duty.id && record.sideId === "PUMP_ROOM");
    const semanticRetry = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/linked-verification-sides`, {
      method: "POST", expect: 200, body: {
        schedule,
        expectedRevision: 0,
        record: { ...dutyPumpRecord, submissionId: `${scheduleId}-duty-pump-retry` }
      }
    });
    assert(semanticRetry.ok && semanticRetry.idempotent && semanticRetry.record.revision === dutyPumpRecord.revision, "A stale duplicate with the same meaning must be idempotent, not a mismatch.");

    const jockey = techADefinitions.find((item) => item.key === "JOCKEY_MANUAL");
    await setLiveFromPage(techB, "JOCKEY_MANUAL", "ACTIVE");
    await techA.waitForTimeout(5500);
    await saveSideFromPage(techB, "JOCKEY_MANUAL", "CONFIRMED", `${scheduleId}-jockey-pump`);
    await setLiveFromPage(techB, "JOCKEY_MANUAL", "ENDED");
    await saveMfapFromPrompt(techA, jockey.id, "NOT_CONFIRMED");
    const afterMismatch = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/state`, { expect: 200 });
    const jockeyState = afterMismatch.linkedVerifications.find((item) => item.linkedVerificationId === jockey.id);
    assert(jockeyState.status === "MISMATCH_REVIEW_REQUIRED", "Pump/MFAP disagreement must require mismatch review.");
    await techA.screenshot({ path: path.join(OUTPUT_DIR, "03-genuine-mismatch-review.png"), fullPage: true });

    const wrongOwner = await techA.evaluate(async () => {
      const schedule = state.schedules[0];
      const definition = getScheduleLinkedVerificationDefinitions(schedule).find((item) => item.pumpTestKey === "STANDBY_MANUAL");
      const pumpSide = definition.requiredSides.find((item) => item.sideId === "PUMP_ROOM");
      return saveLinkedVerificationSide(schedule, definition, pumpSide, { result: "CONFIRMED" });
    });
    assert(wrongOwner.forbidden, "Tech A must not be able to save the Pump Room side.");

    const alertRecord = {
      templateId: "sprinkler-hydrant-pump-sop",
      deviceId: "QA.SPP.1",
      parentDeviceId: "QA.SPP.1",
      deviceTag: "QA.SPP.1",
      technicianId: "tech2@rmtfire.local",
      technicianName: "Tech 2",
      status: "IN_PROGRESS",
      jobAlerts: [{
        alertId: `phase-supply::${scheduleId}::QA.SPP.1`,
        type: "PHASE_SUPPLY_ABNORMAL",
        severity: "critical",
        status: "ACTIVE",
        title: "PUMP ROOM - PHASE SUPPLY ABNORMAL",
        location: "Pump Room",
        readings: { "R-Y": "415", "Y-B": "20", "B-R": "415" },
        scheduleId,
        deviceId: "QA.SPP.1"
      }]
    };
    await api(`/api/jobs/${encodeURIComponent(scheduleId)}/critical-sop-records`, {
      method: "POST", expect: 200, body: { schedule, expectedRevision: 0, record: alertRecord }
    });
    await techA.evaluate(async () => {
      const schedule = state.schedules[0];
      await requestSharedJobState(schedule, { migrate: false, apply: true });
      renderActiveCriticalSopLinkedPrompt(schedule);
    });
    await techA.locator("[data-critical-job-alerts]").getByText("PUMP ROOM - PHASE SUPPLY ABNORMAL").waitFor({ state: "visible", timeout: 12000 });

    await techAContext.setOffline(true);
    const standby = techADefinitions.find((item) => item.key === "STANDBY_MANUAL");
    await setLiveFromPage(techB, "STANDBY_MANUAL", "ACTIVE");
    const standbyPump = await saveSideFromPage(techB, "STANDBY_MANUAL", "CONFIRMED", `${scheduleId}-standby-pump`);
    assert(standbyPump.linkedVerification.status === "AWAITING_COUNTERPART", "Offline counterpart must leave the event awaiting counterpart.");
    await setLiveFromPage(techB, "STANDBY_MANUAL", "ENDED");
    await techAContext.setOffline(false);
    await saveMfapFromPrompt(techA, standby.id, "CONFIRMED");
    const afterReconnect = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/state`, { expect: 200 });
    const standbyState = afterReconnect.linkedVerifications.find((item) => item.linkedVerificationId === standby.id);
    assert(standbyState.status === "VERIFIED", "Reconnect must expose the pending prompt and reconcile once.");
    const standbyRecords = Object.values(afterReconnect.store.linkedVerificationSideRecords).filter((record) => record.linkedVerificationId === standby.id);
    assert(standbyRecords.length === 2, "Reconnect must not create duplicate logical side records.");
    assert(errors.length === 0, `Console errors found: ${errors.join(" | ")}`);

    console.log(JSON.stringify({
      ok: true,
      scheduleId,
      duty: dutyState.status,
      duplicateDutySave: "IDEMPOTENT",
      mismatch: jockeyState.status,
      ownership: "PASS",
      sameJobAlert: "PASS",
      offlineReconnect: standbyState.status,
      linkedSideRecords: Object.keys(afterReconnect.store.linkedVerificationSideRecords).length,
      screenshots: [
        path.join(OUTPUT_DIR, "01-tech2-manual-live.png"),
        path.join(OUTPUT_DIR, "02-tech1-mfap-auto-live.png"),
        path.join(OUTPUT_DIR, "03-genuine-mismatch-review.png")
      ],
      consoleErrors: errors
    }, null, 2));
  } finally {
    await Promise.allSettled([techAContext.close(), techBContext.close()]);
    await browser.close();
    const jobPath = path.resolve(__dirname, "..", "outputs", "rmt-fire-local-data", "shared-records", "jobs", `${scheduleId.toLowerCase()}.json`);
    rmSync(jobPath, { force: true });
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
