const { existsSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=parallel-field-workflow";
const OUTPUT_DIR = path.resolve("outputs/fire-inspection-mvp/technician-ui-qa/parallel-field-workflow");
const BROWSER_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createSchedule(scheduleId) {
  const devices = ["QA.MFAP.1", "QA.SPP.1", "QA.CO2.1", "QA.MCP.1", "QA.SD.1", "QA.HD.1", "QA.BELL.1"];
  return {
    scheduleId,
    jobId: `JOB-${scheduleId}`,
    status: "In Progress",
    companyName: "RMT Parallel QA",
    siteName: "RMT Parallel QA",
    technician: "Demo Technician / Tech 2 / Tech 3 / Tech 4",
    plannedDeviceIds: devices,
    technicians: [
      { technicianId: "tech@rmtfire.local", technicianName: "Demo Technician" },
      { technicianId: "tech2@rmtfire.local", technicianName: "Tech 2" },
      { technicianId: "tech3@rmtfire.local", technicianName: "Tech 3" },
      { technicianId: "tech4@rmtfire.local", technicianName: "Tech 4" }
    ],
    deviceAssignments: {
      "QA.MFAP.1": { technicianId: "tech@rmtfire.local", technicianName: "Demo Technician" },
      "QA.SPP.1": { technicianId: "tech2@rmtfire.local", technicianName: "Tech 2" },
      "QA.CO2.1": { technicianId: "tech3@rmtfire.local", technicianName: "Tech 3" },
      "QA.MCP.1": { technicianId: "tech4@rmtfire.local", technicianName: "Tech 4" },
      "QA.SD.1": { technicianId: "tech4@rmtfire.local", technicianName: "Tech 4" },
      "QA.HD.1": { technicianId: "tech4@rmtfire.local", technicianName: "Tech 4" },
      "QA.BELL.1": { technicianId: "tech4@rmtfire.local", technicianName: "Tech 4" }
    }
  };
}

const DEVICES = [
  { id: "QA.MFAP.1", tag: "QA.MFAP.1", type: "Main Fire Alarm Panel", floor: "Control Room", floorId: "control", location: "Control Room" },
  { id: "QA.SPP.1", tag: "QA.SPP.1", type: "Sprinkler Panel", floor: "Pump Room", floorId: "pump", location: "Pump Room" },
  { id: "QA.CO2.1", tag: "QA.CO2.1", type: "CO2 Gas Release Panel", floor: "Server Room", floorId: "server", location: "Server Room" },
  { id: "QA.MCP.1", tag: "QA.MCP.1", type: "Manual Call Point", floor: "Level 3", floorId: "l3", location: "Level 3 Corridor" },
  { id: "QA.SD.1", tag: "QA.SD.1", type: "Smoke Detector", floor: "Level 3", floorId: "l3", location: "Level 3 Lobby" },
  { id: "QA.HD.1", tag: "QA.HD.1", type: "Heat Detector", floor: "Level 3", floorId: "l3", location: "Level 3 Pantry" },
  { id: "QA.BELL.1", tag: "QA.BELL.1", type: "Fire Alarm Bell", floor: "Level 3", floorId: "l3", location: "Level 3 Lift Lobby" }
];

async function seedPage(page, schedule, user, activeDeviceId, templateId, systemKey) {
  return page.evaluate(async ({ schedule, user, activeDeviceId, templateId, systemKey, devices }) => {
    state.currentUser = { name: user.name, role: "Technician", email: user.email };
    state.setupDevices = devices;
    state.schedules = [schedule];
    state.activeJob = { scheduleId: schedule.scheduleId, schedule, status: "In Progress", jobId: schedule.jobId };
    state.activeTechPreviewScheduleId = schedule.scheduleId;
    state.activeTechSystemKey = systemKey;
    state.activeCriticalDevice = devices.find((device) => device.id === activeDeviceId) || null;
    state.activeCriticalSopId = templateId || "fire-alarm-tripping-sop";
    invalidateRuntimeCaches();
    applyRoleView();
    workspace.classList.remove("hidden", "admin-mode");
    workspace.classList.add("technician-mode", "tech-screen-inspection");
    loginView.classList.add("hidden");
    await requestSharedJobState(schedule, { migrate: true, apply: true });
    await loadLinkedVerificationIndex();
    ensureActiveJobCriticalWorkflows(schedule);
    if (templateId) {
      openCriticalSopForDevice(state.activeCriticalDevice);
    } else {
      const activeDevice = devices.find((device) => device.id === activeDeviceId);
      state.mimicFloors = [
        ...state.mimicFloors.filter((floor) => floor.id !== activeDevice.floorId),
        {
          id: activeDevice.floorId,
          floorId: activeDevice.floorId,
          title: activeDevice.floor,
          floorName: activeDevice.floor,
          companyName: schedule.companyName,
          siteName: schedule.siteName,
          src: "assets/ground-map.png",
          active: true
        }
      ];
      setTechnicianMapFloor(activeDevice.floorId, { companyName: schedule.companyName, siteName: schedule.siteName });
      state.activeCriticalDevice = null;
      state.selectedId = "";
      clearTechnicianInspectionDirty();
      setTechScreen("mimic", { scroll: false });
    }
    startTechnicianSharedHeartbeat();
    return true;
  }, { schedule, user, activeDeviceId, templateId, systemKey, devices: DEVICES });
}

async function seedMfapTestReady(page) {
  return page.evaluate(async () => {
    const schedule = getActiveTechnicianMaintenanceSchedule();
    const template = getCriticalSopTemplate("fire-alarm-tripping-sop");
    const device = state.setupDevices.find((item) => item.id === "QA.MFAP.1");
    const steps = {};
    template.steps.forEach((step, index) => {
      if (index > 4) return;
      const fields = getEffectiveSopFields(step, { steps: {} }, device, {});
      steps[index] = {
        confirmed: !step.noConfirm,
        choice: step.requiresChoice ? (step.choices || ["Pass"])[0] : "",
        reading: step.requiresReading ? "26.7" : "",
        remark: (sopStepNeedsRemark(step) || step.optionalRemark) ? "QA approved preparation" : "",
        photo: step.requiresPhoto ? "qa-mfap-preparation.jpg" : "",
        photoEvidence: step.requiresPhoto ? { evidenceId: `qa-mfap-step-${index}`, originalDataUrl: "data:image/png;base64,AA==" } : null,
        supervisor: step.requiresSupervisor ? "QA Supervisor" : "",
        recordedBy: getCurrentUserName(),
        fieldValues: Object.fromEntries(fields.map((field) => [field.id, field.kind === "number" ? "415" : field.choices?.[0] || "QA value"])),
        fieldRemarks: {}
      };
    });
    const record = {
      templateId: template.id,
      templateVersion: getCriticalSopTemplateVersion(template),
      templateSnapshot: createCriticalSopTemplateSnapshot(template),
      title: template.title,
      deviceTag: device.id,
      deviceType: device.type,
      floor: device.floor,
      location: device.location,
      companyName: schedule.companyName,
      siteName: schedule.siteName,
      steps,
      beforePhoto: "qa-mfap-before.jpg",
      beforePhotoEvidence: { evidenceId: "qa-mfap-before", originalDataUrl: "data:image/png;base64,AA==" },
      afterPhoto: "",
      filledBy: getCurrentUserName(),
      filledRole: getCurrentUserRole(),
      savedAt: new Date().toISOString(),
      savedBy: getCurrentUserName()
    };
    state.criticalSops[`${template.id}::${device.id}`] = record;
    const saved = await saveSharedCriticalSopRecord(record, schedule);
    await requestSharedJobState(schedule, { migrate: false, apply: true });
    ensureActiveJobCriticalWorkflows(schedule);
    renderCriticalSop();
    const run = getCriticalWorkflowRunForParentDevice(device, schedule);
    return { saved: saved.ok, stage: getCriticalWorkflowRunState(run, schedule) };
  });
}

async function refresh(page) {
  await page.evaluate(() => refreshActiveTechnicianSharedState());
}

async function startPumpEvent(page) {
  return page.evaluate(async () => {
    const schedule = getActiveTechnicianMaintenanceSchedule();
    const definition = getScheduleLinkedVerificationDefinitions(schedule).find((item) => item.pumpTestKey === "DUTY_MANUAL");
    const side = definition.requiredSides.find((item) => item.sideId === "PUMP_ROOM");
    return saveLinkedVerificationLiveState(schedule, definition, side, "ACTIVE", { priority: "MEDIUM", currentState: "RUNNING" });
  });
}

async function startGasEvent(page, priority, currentState) {
  return page.evaluate(async ({ priority, currentState }) => {
    const schedule = getActiveTechnicianMaintenanceSchedule();
    const definition = getScheduleLinkedVerificationDefinitions(schedule).find((item) => item.gasTestKey === "INDICATION");
    const side = definition.requiredSides.find((item) => item.sideId === "SUPPRESSION_SYSTEM_LOCATION");
    return saveLinkedVerificationLiveState(schedule, definition, side, "ACTIVE", { priority, currentState });
  }, { priority, currentState });
}

(async () => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const scheduleId = `QA-PARALLEL-FIELD-${Date.now()}`;
  const schedule = createSchedule(scheduleId);
  const browser = await chromium.launch({ headless: true, executablePath: BROWSER_PATHS.find(existsSync) });
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true })));
  const [tech1, tech2, tech3, tech4] = await Promise.all(contexts.map((context) => context.newPage()));
  const consoleErrors = [];
  [tech1, tech2, tech3, tech4].forEach((page) => page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  }));

  try {
    await Promise.all([tech1, tech2, tech3, tech4].map((page) => page.goto(APP_URL, { waitUntil: "networkidle" })));
    await seedPage(tech1, schedule, { name: "Demo Technician", email: "tech@rmtfire.local" }, "QA.MFAP.1", "fire-alarm-tripping-sop", "fire-alarm");
    await seedPage(tech2, schedule, { name: "Tech 2", email: "tech2@rmtfire.local" }, "QA.SPP.1", "sprinkler-hydrant-pump-sop", "pump-system");
    await seedPage(tech3, schedule, { name: "Tech 3", email: "tech3@rmtfire.local" }, "QA.CO2.1", "gas-discharge-sop", "gas-release");
    await seedPage(tech4, schedule, { name: "Tech 4", email: "tech4@rmtfire.local" }, "QA.MCP.1", "", "fire-alarm");

    const beforeReady = await tech4.evaluate(() => getDeviceCriticalAccessState(state.setupDevices.find((item) => item.id === "QA.MCP.1"), getActiveTechnicianMaintenanceSchedule()));
    assert(!beforeReady.allowed, "MCP must remain locked before MFAP TEST READY.");
    const ready = await seedMfapTestReady(tech1);
    assert(ready.saved && ready.stage.testReady && !ready.stage.sopComplete, `MFAP must unlock at TEST READY while remaining incomplete: ${JSON.stringify(ready)}`);
    await Promise.all([tech2, tech3, tech4].map(refresh));
    const afterReady = await tech4.evaluate(() => getDeviceCriticalAccessState(state.setupDevices.find((item) => item.id === "QA.MCP.1"), getActiveTechnicianMaintenanceSchedule()));
    assert(afterReady.allowed, "MCP must unlock at MFAP TEST READY.");

    await tech1.evaluate(() => {
      renderCriticalSop();
      const input = document.querySelector('input[name="sop-reading-5"]');
      if (input) input.value = "27.1";
      markTechnicianInspectionDirty();
      setTechSystemDrawerOpen(true);
    });
    await tech1.screenshot({ path: path.join(OUTPUT_DIR, "01-mfap-main-stage.png"), fullPage: true });
    await tech1.screenshot({ path: path.join(OUTPUT_DIR, "02-mfap-bubble-open.png"), fullPage: true });

    assert((await startPumpEvent(tech2)).ok, "Pump event failed to start.");
    assert((await startGasEvent(tech3, "LOW", "TEST_IN_PROGRESS")).ok, "CO2 test-start event failed.");
    const mcpDiagnostics = await tech4.evaluate(() => {
      const schedule = getActiveTechnicianMaintenanceSchedule();
      const device = state.setupDevices.find((item) => item.id === "QA.MCP.1");
      return {
        fireAlarmField: isFireAlarmFieldDevice(device, schedule),
        primarySystem: getPrimaryTechnicianFireSystemDefinition(device, getTechnicianFireSystemDefinitions(), schedule)?.id || "",
        observer: getMfapObserverIdentity(schedule),
        source: getScheduleTechnicianIdentity(schedule, device.id, 0),
        access: getDeviceCriticalAccessState(device, schedule)
      };
    });
    assert(mcpDiagnostics.fireAlarmField && mcpDiagnostics.access.allowed, `MCP fixture is not eligible for a live field event: ${JSON.stringify(mcpDiagnostics)}`);
    const mcpSelectResult = await tech4.evaluate(() => selectDevice("QA.MCP.1", { scrollIntoView: false }));
    await tech4.waitForTimeout(1000);
    const mcpAfterSelect = await tech4.evaluate(() => {
      const device = findInspectionDevice("QA.MCP.1");
      const previewSchedule = getTechMarkerScopeSchedule();
      const activeSchedule = getActiveTechnicianMaintenanceSchedule();
      return {
        selectResult: null,
        role: getCurrentUserRole(),
        selectedId: state.selectedId,
        techScreen: state.techScreen,
        activeCriticalDevice: state.activeCriticalDevice?.id || state.activeCriticalDevice?.tag || "",
        critical: isCriticalSopDevice(device),
        previewScheduleId: previewSchedule?.scheduleId || "",
        activeScheduleId: activeSchedule?.scheduleId || "",
        previewInScope: isDeviceInScheduleScope(device, previewSchedule),
        activeInScope: isDeviceInScheduleScope(device, activeSchedule),
        access: getDeviceCriticalAccessState(device, activeSchedule),
        checklistHidden: document.querySelector("#checklistForm")?.classList.contains("hidden"),
        syncState: document.querySelector("#syncState")?.textContent || ""
      };
    });
    mcpAfterSelect.selectResult = mcpSelectResult;
    const mcpRouteEvent = await tech4.evaluate(async () => {
      const schedule = getActiveTechnicianMaintenanceSchedule();
      const response = await fetch(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/state`, { cache: "no-store" });
      const payload = await response.json();
      return Object.values(payload.store?.liveCoordinationEvents || {}).find((event) => event.deviceId === "QA.MCP.1") || null;
    });
    assert(mcpRouteEvent?.status === "ACTIVE", `selectDevice() did not create the MCP live event in authoritative server state: ${JSON.stringify({ mcpRouteEvent, mcpAfterSelect })}`);
    for (const deviceId of ["QA.SD.1", "QA.HD.1", "QA.BELL.1"]) {
      await tech4.evaluate((id) => selectDevice(id, { scrollIntoView: false }), deviceId);
      await tech4.waitForTimeout(250);
    }
    const fieldRouteEvents = await tech4.evaluate(async () => {
      const schedule = getActiveTechnicianMaintenanceSchedule();
      const response = await fetch(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/state`, { cache: "no-store" });
      const payload = await response.json();
      return Object.values(payload.store?.liveCoordinationEvents || {})
        .filter((event) => event.sourceType === "FIELD_DEVICE" && event.status === "ACTIVE")
        .map((event) => event.deviceId)
        .sort();
    });
    assert(JSON.stringify(fieldRouteEvents) === JSON.stringify(["QA.BELL.1", "QA.HD.1", "QA.MCP.1", "QA.SD.1"]), `Fire Alarm field event routes are incomplete: ${JSON.stringify(fieldRouteEvents)}`);
    const mcpLiveResult = await tech4.evaluate(() => updateFieldDeviceLiveEvent(getActiveTechnicianMaintenanceSchedule(), state.setupDevices.find((item) => item.id === "QA.MCP.1"), "ACTIVE"));
    assert(mcpLiveResult.ok && !mcpLiveResult.offline && !mcpLiveResult.forbidden, `MCP live event request failed: ${JSON.stringify({ mcpDiagnostics, mcpLiveResult })}`);
    assert(mcpLiveResult.skipped === true, `MCP idempotent probe created a duplicate event: ${JSON.stringify(mcpLiveResult)}`);
    await refresh(tech1);
    const queue = await tech1.evaluate(() => getMfapActiveLiveEvents().map((event) => ({ id: event.eventId, priority: event.priority, state: event.currentState, ack: event.acknowledgement })));
    assert(queue.length === 6, `Expected Pump, CO2, MCP, Smoke, Heat, and Bell events without overwrite: ${JSON.stringify(queue)}`);
    assert(new Set(queue.map((event) => event.id)).size === 6, "Concurrent event IDs must be unique.");
    const draftBefore = await tech1.inputValue('input[name="sop-reading-5"]');
    assert(draftBefore === "27.1", "MFAP draft changed when live events arrived.");
    await tech1.screenshot({ path: path.join(OUTPUT_DIR, "03-mfap-live-events-drawer.png"), fullPage: true });

    await tech1.evaluate(() => setTechSystemDrawerOpen(false));
    await tech1.screenshot({ path: path.join(OUTPUT_DIR, "02b-mfap-bubble-closed.png"), fullPage: true });
    await tech1.locator('[data-mfap-workspace-tab="live"]').click();
    await tech1.screenshot({ path: path.join(OUTPUT_DIR, "04-pump-live-event.png"), fullPage: true });
    await tech1.screenshot({ path: path.join(OUTPUT_DIR, "05-co2-test-start-event.png"), fullPage: true });
    await tech1.screenshot({ path: path.join(OUTPUT_DIR, "06-mcp-observation-event.png"), fullPage: true });
    await tech1.screenshot({ path: path.join(OUTPUT_DIR, "07-multiple-simultaneous-events.png"), fullPage: true });

    assert((await startGasEvent(tech3, "HIGH", "MFAP_CONFIRMATION_REQUIRED")).ok, "CO2 priority escalation failed.");
    await refresh(tech1);
    const escalated = await tech1.evaluate(() => getMfapActiveLiveEvents().map((event) => ({ id: event.eventId, priority: event.priority, state: event.currentState })));
    assert(escalated[0].priority === "HIGH" && escalated[0].state === "MFAP_CONFIRMATION_REQUIRED", `High-priority CO2 event must sort first: ${JSON.stringify(escalated)}`);
    await tech1.screenshot({ path: path.join(OUTPUT_DIR, "08-co2-critical-event.png"), fullPage: true });

    const pumpEventId = escalated.find((event) => event.id.includes("PUMP_MFAP"))?.id;
    await tech1.evaluate((eventId) => acknowledgeLiveCoordinationEvent(eventId, "OBSERVED"), pumpEventId);
    const acknowledged = await tech1.evaluate(() => getMfapActiveLiveEvents().map((event) => ({ id: event.eventId, ack: event.acknowledgement?.status || "" })));
    assert(acknowledged.filter((event) => event.ack).length === 1, `Acknowledging one event must not acknowledge all: ${JSON.stringify(acknowledged)}`);

    await tech1.locator('[data-mfap-workspace-tab="checklist"]').click();
    const draftAfter = await tech1.inputValue('input[name="sop-reading-5"]');
    assert(draftAfter === "27.1", "MFAP draft did not survive opening and returning from a live event.");
    await tech1.screenshot({ path: path.join(OUTPUT_DIR, "09-mfap-draft-after-live-return.png"), fullPage: true });

    const co2Actions = await tech3.evaluate(() => ({
      labels: [...document.querySelectorAll("#criticalSopForm .pump-sop-sticky-actions button")].map((button) => button.textContent.trim()),
      duplicateLegacyButtons: [...document.querySelectorAll("#criticalSopForm button")].filter((button) => /Save Critical SOP/i.test(button.textContent)).length,
      stages: document.querySelectorAll("[data-pump-drawer-stage]").length,
      beforePhoto: Boolean(document.querySelector("#criticalBeforePhoto")),
      afterPhoto: Boolean(document.querySelector("#criticalAfterPhoto"))
    }));
    assert(JSON.stringify(co2Actions.labels) === JSON.stringify(["BACK", "SAVE & NEXT"]), `CO2 must have one forward action: ${JSON.stringify(co2Actions)}`);
    assert(co2Actions.duplicateLegacyButtons === 0 && co2Actions.stages === 5 && co2Actions.beforePhoto && co2Actions.afterPhoto, `CO2 staged/evidence UI incomplete: ${JSON.stringify(co2Actions)}`);
    await tech3.screenshot({ path: path.join(OUTPUT_DIR, "10-co2-back-save-next.png"), fullPage: true });
    await tech3.screenshot({ path: path.join(OUTPUT_DIR, "11-co2-critical-evidence.png"), fullPage: true });

    await contexts[0].setOffline(true);
    await tech1.evaluate(() => refreshActiveTechnicianSharedState());
    await tech1.waitForTimeout(250);
    const offline = await tech1.evaluate(() => ({ unavailable: state.sharedSyncUnavailable, warning: document.body.textContent.includes("LIVE CONNECTION LOST") }));
    assert(offline.unavailable && offline.warning, `Offline live state must be explicit: ${JSON.stringify(offline)}`);
    await tech1.screenshot({ path: path.join(OUTPUT_DIR, "12-offline-live-warning.png"), fullPage: true });
    await contexts[0].setOffline(false);
    await refresh(tech1);

    const reportClean = await tech1.evaluate(() => {
      const snapshot = buildReportSnapshot(getActiveTechnicianMaintenanceSchedule(), { forceLive: true });
      const serialized = JSON.stringify(snapshot);
      return !serialized.includes("liveCoordinationEvents") && !serialized.includes("MFAP_CONFIRMATION_REQUIRED");
    });
    assert(reportClean, "Transient live events must not pollute report data.");

    await tech1.setViewportSize({ width: 768, height: 1024 });
    await tech1.screenshot({ path: path.join(OUTPUT_DIR, "13-tablet-portrait.png"), fullPage: true });
    await tech1.setViewportSize({ width: 1024, height: 768 });
    await tech1.screenshot({ path: path.join(OUTPUT_DIR, "14-tablet-landscape.png"), fullPage: true });

    const mfapUi = await tech1.evaluate(() => ({
      stages: [...document.querySelectorAll("[data-pump-drawer-stage]")].map((button) => button.textContent.replace(/\s+/g, " ").trim()),
      renderedHeight: Math.round(document.querySelector("#criticalSopDrawer .drawer-panel")?.getBoundingClientRect().height || 0),
      checkCount: document.querySelectorAll("#criticalSopDrawer .sop-step").length,
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      notified: state.notifiedLiveEventSignatures?.size || 0
    }));
    assert(mfapUi.stages.length === 6 && mfapUi.overflow === 0, `MFAP stage drawer or responsive layout failed: ${JSON.stringify(mfapUi)}`);
    const unexpectedConsoleErrors = consoleErrors.filter((message) => !message.includes("ERR_INTERNET_DISCONNECTED"));
    assert(unexpectedConsoleErrors.length === 0, `Console errors: ${unexpectedConsoleErrors.join(" | ")}`);

    console.log(JSON.stringify({
      ok: true,
      scheduleId,
      mfapState: ready.stage.status,
      queue,
      escalated,
      acknowledged,
      mcpRouteEvent,
      fieldRouteEvents,
      mcpRouteHook: mcpLiveResult,
      co2Actions,
      reportClean,
      mfapUi,
      screenshots: Array.from({ length: 14 }, (_, index) => path.join(OUTPUT_DIR, `${String(index + 1).padStart(2, "0")}-*.png`)),
      expectedOfflineConsoleErrors: consoleErrors.filter((message) => message.includes("ERR_INTERNET_DISCONNECTED")).length,
      consoleErrors: unexpectedConsoleErrors
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
