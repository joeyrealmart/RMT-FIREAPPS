const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const RAW_APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260829-shared-records";
const APP_URL = RAW_APP_URL;
const BASE_URL = RAW_APP_URL.replace(/\?.*$/, "").replace(/\/$/, "");
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    payload = { raw: text };
  }
  if (options.expect && response.status !== options.expect) {
    throw new Error(`Expected ${options.expect} for ${path}, got ${response.status}: ${text}`);
  }
  if (!options.allowError && response.status >= 400 && !options.expect) {
    throw new Error(`HTTP ${response.status} for ${path}: ${text}`);
  }
  return { status: response.status, payload };
}

function buildSchedule(scheduleId) {
  const devices = ["QA.SD.SR", "QA.MCP.SR", "QA.MFAP.SR", "QA.FS.SR"];
  return {
    scheduleId,
    jobId: `JOB-${scheduleId}`,
    status: "Scheduled",
    clientSource: "existing",
    companyName: "QA Shared Records",
    siteName: "QA Shared Records",
    address: "QA test only",
    floorId: "qa-shared-l1",
    startFloorId: "qa-shared-l1",
    floorTitle: "QA Shared L1",
    startFloorTitle: "QA Shared L1",
    date: "2026-08-29",
    time: "09:00",
    technician: "Technician Pool",
    serviceType: "Maintenance / Inspection",
    scope: "yearly-100",
    scopeLabel: "QA Shared Records",
    priority: "Normal",
    contractFrequencyPercent: 100,
    scopeSelectionMode: "site-wide",
    plannedDeviceIds: devices,
    deviceCount: devices.length,
    activeCount: 1,
    passiveCount: 3,
    notes: "QA shared-record multi-tech regression"
  };
}

function inspectionRecord(schedule, deviceId, technician, status = "pass", notes = "QA normal") {
  return {
    jobId: schedule.jobId,
    scheduleId: schedule.scheduleId,
    deviceId,
    checklistItemId: deviceId,
    technicianId: technician.id,
    technicianName: technician.name,
    technicianRole: "Technician",
    status,
    answers: [status === "fail" ? "Fail" : "Pass"],
    notes,
    action: status === "fail" ? "Follow up required" : "",
    evidenceRefs: status === "fail" ? [{ type: "photo", ref: `${deviceId}-fault-photo.jpg` }] : [],
    inspectedAt: "2026-08-29T09:15:00.000Z"
  };
}

async function runServerRegression() {
  const scheduleId = `QA-SHARED-${Date.now()}`;
  const schedule = buildSchedule(scheduleId);
  const techA = { id: "tech-a", name: "Tech A" };
  const techB = { id: "tech-b", name: "Tech B" };

  const empty = await api(`/api/jobs/${encodeURIComponent(scheduleId)}-EMPTY/state`, { expect: 200 });
  assert(empty.payload.store.migration.migratedFromJobProgress === false, "Empty shared store must not be marked as legacy migrated");

  const migrated = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/migrate`, {
    method: "POST",
    expect: 200,
    body: { schedule }
  });
  assert(migrated.payload.progress.total === 4, "Migration/start should know all planned devices");
  assert(migrated.payload.progress.pending === 4, "New shared job should start with all devices pending");
  assert(migrated.payload.store.migration.migratedFromJobProgress === false, "No legacy progress should be migrated for a clean schedule");

  const sdPayload = inspectionRecord(schedule, "QA.SD.SR", techA, "pass", "Tech A checked smoke detector");
  const sdSave = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/inspection-records`, {
    method: "POST",
    expect: 200,
    body: { schedule, record: sdPayload, expectedRevision: 0 }
  });
  assert(sdSave.payload.record.revision === 1, "First device save should create revision 1");

  const mcpPayload = inspectionRecord(schedule, "QA.MCP.SR", techB, "fail", "Tech B found MCP glass cracked");
  const mcpSave = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/inspection-records`, {
    method: "POST",
    expect: 200,
    body: { schedule, record: mcpPayload, expectedRevision: 0 }
  });
  assert(mcpSave.payload.record.revision === 1, "Different-device save should not conflict");
  assert(mcpSave.payload.progress.done === 2, "Progress should aggregate two independent item records");
  assert(mcpSave.payload.progress.fail === 1, "Progress should include failed item count");

  const stale = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/inspection-records`, {
    method: "POST",
    expect: 409,
    body: {
      schedule,
      record: inspectionRecord(schedule, "QA.SD.SR", techB, "fail", "Stale phone tried to overwrite SD"),
      expectedRevision: 0
    }
  });
  assert(stale.payload.conflict === true, "Same-device stale write must return conflict");
  assert(stale.payload.current.status === "pass", "Conflict response should preserve current authoritative record");

  const duplicate = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/inspection-records`, {
    method: "POST",
    expect: 200,
    body: { schedule, record: sdPayload, expectedRevision: 0 }
  });
  assert(duplicate.payload.idempotent === true, "Duplicate save with same payload should be treated as idempotent");
  assert(duplicate.payload.record.revision === 1, "Idempotent duplicate must not create a new revision");

  const claimA = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/item-claims`, {
    method: "POST",
    expect: 200,
    body: {
      schedule,
      itemId: "QA.FS.SR",
      claimedBy: techA.id,
      claimedByName: techA.name,
      expiresAt: "2099-01-01T00:00:00.000Z"
    }
  });
  assert(claimA.payload.claim.claimedBy === techA.id, "First item claim should be recorded");
  const claimB = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/item-claims`, {
    method: "POST",
    expect: 200,
    body: {
      schedule,
      itemId: "QA.FS.SR",
      claimedBy: techB.id,
      claimedByName: techB.name,
      expiresAt: "2099-01-01T00:00:00.000Z"
    }
  });
  assert(claimB.payload.warning === true, "Second tech should receive an advisory claim warning");
  assert(claimB.payload.activeClaim.claimedBy === techA.id, "Claim warning should point to the active first tech");

  const signoffBlocked = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/signoff`, {
    method: "POST",
    expect: 409,
    body: {
      schedule,
      expectedRevision: 0,
      signOff: {
        supervisorName: "QA Supervisor",
        supervisorSignatureData: "data:image/png;base64,QA"
      }
    }
  });
  assert(signoffBlocked.payload.blocked === true, "Server must reject sign-off before all shared records are complete");

  const mfapSop = {
    jobId: schedule.jobId,
    scheduleId,
    templateId: "fire-alarm-tripping-sop",
    parentDeviceId: "QA.MFAP.SR",
    deviceId: "QA.MFAP.SR",
    deviceTag: "QA.MFAP.SR",
    technicianId: techA.id,
    technicianName: techA.name,
    status: "pass",
    workflowStatus: "complete",
    beforePhoto: "mfap-before.jpg",
    afterPhoto: "mfap-after.jpg",
    steps: {
      0: { confirmed: true, title: "Record panel type and status", reading: "Addressable / normal" },
      1: { confirmed: true, title: "Panel photo before test", photo: "mfap-before.jpg" },
      2: { title: "Set Silence / Alarm Test mode", choice: "Silence/Test Mode Set" },
      3: { confirmed: true, title: "Switch off all tripping outputs", photo: "tripping-isolated.jpg" },
      4: { title: "Check power supply, battery and charger", choice: "27V" },
      5: { title: "Panel setting, mimic and bulb test", choice: "Pass" },
      6: { title: "Test pump / gas release indication", choice: "Pass" },
      7: { confirmed: true, title: "Interface alarm mode test", choice: "N/A", remark: "Not applicable for QA", supervisor: "QA Supervisor" },
      8: { confirmed: true, title: "Reset and restore all isolations", photo: "mfap-after.jpg", supervisor: "QA Supervisor" }
    }
  };
  const mfapSave = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/critical-sop-records`, {
    method: "POST",
    expect: 200,
    body: { schedule, record: mfapSop, expectedRevision: 0 }
  });
  assert(mfapSave.payload.record.revision === 1, "Critical SOP save should create revision 1");

  const fsSave = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/inspection-records`, {
    method: "POST",
    expect: 200,
    body: {
      schedule,
      record: inspectionRecord(schedule, "QA.FS.SR", techB, "pass", "Flow switch physical check passed"),
      expectedRevision: 0
    }
  });
  assert(fsSave.payload.progress.ready === true, "All four assigned records should make the shared progress ready");

  const signoffOk = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/signoff`, {
    method: "POST",
    expect: 200,
    body: {
      schedule,
      expectedRevision: 0,
      signOff: {
        technicianId: techA.id,
        technicianName: techA.name,
        supervisorName: "QA Supervisor",
        supervisorSignatureData: "data:image/png;base64,QA",
        signedBy: techA.name
      }
    }
  });
  assert(signoffOk.payload.signOff.revision === 1, "Accepted sign-off should create revision 1");
  assert(signoffOk.payload.progress.ready === true, "Accepted sign-off should include ready shared progress");

  const staleSignoff = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/signoff`, {
    method: "POST",
    expect: 409,
    body: {
      schedule,
      expectedRevision: 0,
      signOff: {
        supervisorName: "QA Supervisor 2",
        supervisorSignatureData: "data:image/png;base64,QA2"
      }
    }
  });
  assert(staleSignoff.payload.conflict === true, "Stale sign-off update must conflict");

  const legacyScheduleId = `QA-LEGACY-${Date.now()}`;
  const legacySchedule = {
    ...buildSchedule(legacyScheduleId),
    plannedDeviceIds: ["QA.LEGACY.EL1"],
    deviceCount: 1,
    jobProgress: {
      updatedAt: "2026-08-01T08:00:00.000Z",
      updatedBy: "Legacy Tech",
      activeJob: { jobId: `JOB-${legacyScheduleId}` },
      inspections: {
        "QA.LEGACY.EL1": {
          status: "pass",
          answers: ["Pass"],
          inspectedBy: "Legacy Tech",
          inspectedAt: "2026-08-01T08:10:00.000Z"
        }
      }
    }
  };
  const legacyMigrated = await api(`/api/jobs/${encodeURIComponent(legacyScheduleId)}/migrate`, {
    method: "POST",
    expect: 200,
    body: { schedule: legacySchedule }
  });
  assert(legacyMigrated.payload.store.migration.migratedFromJobProgress === true, "Legacy jobProgress should migrate once");
  assert(legacyMigrated.payload.progress.done === 1, "Migrated legacy inspection should count in shared progress");

  const stateAfter = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/state`, { expect: 200 });
  assert(Object.keys(stateAfter.payload.store.inspectionRecords).length === 3, "Shared store should retain three independent inspection records");
  assert(Object.keys(stateAfter.payload.store.criticalSopRecords).length === 1, "Shared store should retain one critical SOP record");

  return {
    scheduleId,
    legacyScheduleId,
    savedInspectionRecords: Object.keys(stateAfter.payload.store.inspectionRecords).length,
    savedCriticalSopRecords: Object.keys(stateAfter.payload.store.criticalSopRecords).length,
    progress: stateAfter.payload.progress,
    signoffRevision: signoffOk.payload.signOff.revision
  };
}

async function login(page, demoUser) {
  await page.click(`[data-demo-login='${demoUser}']`);
  await page.fill("#loginPassword", new Date().toISOString());
  await page.click("#loginForm button[type='submit']");
  await page.waitForSelector("#workspace.technician-mode");
}

async function seedBrowserSharedJob(page, schedule) {
  await page.evaluate((schedule) => {
    const profile = {
      companyName: schedule.companyName,
      siteName: schedule.siteName
    };
    const floor = {
      id: schedule.floorId,
      floorId: schedule.floorId,
      title: schedule.floorTitle,
      floorCode: "L1",
      companyName: profile.companyName,
      siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src,
      cleanSrc: defaultFloorAssets.lv1.src,
      active: true
    };
    const tags = schedule.plannedDeviceIds;
    const devices = [
      {
        tag: "QA.MFAP.SR",
        type: "Main Fire Alarm Panel",
        short: "MFAP",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Fire command room",
        xPercent: 20,
        yPercent: 25,
        status: "Confirmed"
      },
      {
        tag: "QA.MCP.SR",
        type: "Manual Call Point",
        short: "MCP",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Lobby exit",
        xPercent: 55,
        yPercent: 40,
        status: "Confirmed"
      },
      {
        tag: "QA.SD.SR",
        type: "Smoke Detector",
        short: "SD",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Office area",
        xPercent: 35,
        yPercent: 45,
        status: "Confirmed"
      },
      {
        tag: "QA.FS.SR",
        type: "Flow Switch",
        short: "FS",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Riser room",
        xPercent: 75,
        yPercent: 50,
        status: "Confirmed"
      }
    ].filter((device) => tags.includes(device.tag));
    state.activeJob = null;
    state.inspections = {};
    state.criticalSops = {};
    state.systemChecks = {};
    state.sharedJobRecords = {};
    state.siteProfile = profile;
    state.mimicFloors = [floor, ...state.mimicFloors.filter((item) => item.id !== floor.id)];
    state.setupDevices = [
      ...devices,
      ...state.setupDevices.filter((device) => !tags.includes(device.tag))
    ];
    state.schedules = [schedule, ...state.schedules.filter((item) => item.scheduleId !== schedule.scheduleId)];
    writeStoredJson("rmtActiveJob", state.activeJob);
    writeStoredJson("tmFireInspections", state.inspections);
    writeStoredJson("rmtCriticalSops", state.criticalSops);
    writeStoredJson("rmtSystemChecks", state.systemChecks);
    writeStoredJson("rmtSharedJobRecords", state.sharedJobRecords);
    writeStoredJson("rmtMimicFloors", state.mimicFloors);
    writeStoredJson("tmFireSetupDevices", state.setupDevices);
    writeStoredJson("rmtSchedules", state.schedules);
    selectClientProfile(profile);
    renderTechWorkPanel();
  }, schedule);
}

async function runBrowserSharedRegression() {
  const scheduleId = `QA-BROWSER-SHARED-${Date.now()}`;
  const schedule = buildSchedule(scheduleId);
  await api(`/api/jobs/${encodeURIComponent(scheduleId)}/migrate`, {
    method: "POST",
    expect: 200,
    body: { schedule }
  });

  const executablePath = EDGE_PATHS.find((item) => existsSync(item));
  const browser = await chromium.launch({ headless: true, executablePath });
  const contextA = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const contextB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const consoleErrors = [];
  [pageA, pageB].forEach((page) => {
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });
  });

  await pageA.goto(APP_URL, { waitUntil: "networkidle" });
  await pageB.goto(APP_URL, { waitUntil: "networkidle" });
  await login(pageA, "tech");
  await login(pageB, "tech2");
  await seedBrowserSharedJob(pageA, schedule);
  await seedBrowserSharedJob(pageB, schedule);

  await pageA.evaluate((scheduleId) => startScheduledJob(scheduleId), scheduleId);
  await pageB.evaluate((scheduleId) => startScheduledJob(scheduleId), scheduleId);
  await pageA.waitForFunction((scheduleId) => JSON.parse(localStorage.getItem("rmtActiveJob") || "null")?.scheduleId === scheduleId, scheduleId);
  await pageB.waitForFunction((scheduleId) => JSON.parse(localStorage.getItem("rmtActiveJob") || "null")?.scheduleId === scheduleId, scheduleId);

  const beforeAccess = await pageB.evaluate(() => {
    const schedule = getActiveTechnicianMaintenanceSchedule();
    const device = getScheduledAssignedDevices(schedule).find((item) => item.id === "QA.MCP.SR");
    return getDeviceCriticalAccessState(device, schedule);
  });
  assert(beforeAccess.allowed === false, "Phone B should see MCP locked before shared MFAP prerequisite");

  const mfapRecord = await pageA.evaluate((schedule) => {
    const template = criticalSopTemplates.find((item) => item.id === "fire-alarm-tripping-sop");
    const steps = {};
    template.steps.forEach((step, index) => {
      if (index > 6) return;
      steps[index] = {
        confirmed: !step.noConfirm,
        title: step.title,
        critical: Boolean(step.critical),
        choice: step.requiresChoice ? (step.choices?.[0] || "Pass") : "",
        reading: step.requiresReading ? "QA normal" : "",
        remark: sopStepNeedsRemark(step) ? "QA remark" : "",
        photo: step.requiresPhoto ? "QA photo" : "",
        supervisor: step.requiresSupervisor ? "QA Supervisor" : ""
      };
    });
    return {
      jobId: schedule.jobId,
      scheduleId: schedule.scheduleId,
      templateId: "fire-alarm-tripping-sop",
      templateVersion: getCriticalSopTemplateVersion(template),
      templateSnapshot: createCriticalSopTemplateSnapshot(template),
      title: template.title,
      parentDeviceId: "QA.MFAP.SR",
      deviceId: "QA.MFAP.SR",
      deviceTag: "QA.MFAP.SR",
      deviceType: "Main Fire Alarm Panel",
      floor: schedule.floorTitle,
      location: "Fire command room",
      companyName: schedule.companyName,
      siteName: schedule.siteName,
      steps,
      beforePhoto: "QA before",
      afterPhoto: "",
      filledBy: getCurrentUserName(),
      filledRole: getCurrentUserRole(),
      savedAt: new Date().toISOString(),
      savedBy: getCurrentUserName(),
      technicianId: getCurrentUserId(),
      technicianName: getCurrentUserName(),
      status: "partial",
      workflowStatus: "prerequisite_complete"
    };
  }, schedule);
  await api(`/api/jobs/${encodeURIComponent(scheduleId)}/critical-sop-records`, {
    method: "POST",
    expect: 200,
    body: { schedule, record: mfapRecord, expectedRevision: 0 }
  });
  await pageB.evaluate((schedule) => requestSharedJobState(schedule, { migrate: false }), schedule);
  const afterAccess = await pageB.evaluate(() => {
    const schedule = getActiveTechnicianMaintenanceSchedule();
    const device = getScheduledAssignedDevices(schedule).find((item) => item.id === "QA.MCP.SR");
    return getDeviceCriticalAccessState(device, schedule);
  });
  assert(afterAccess.allowed === true, "Phone B should unlock MCP after Phone A shared MFAP prerequisite save");

  const pageC = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await pageC.route("**/api/jobs/**", (route) => route.abort());
  await pageC.route("**/api/save-schedules", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, count: 1 })
  }));
  await pageC.route("**/api/save-inspection-run", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, runKey: "qa-shared-offline" })
  }));
  await pageC.goto(APP_URL, { waitUntil: "networkidle" });
  await login(pageC, "tech3");
  const offlineSchedule = {
    ...buildSchedule(`QA-OFFLINE-${Date.now()}`),
    plannedDeviceIds: ["QA.OFF.EL1"],
    deviceCount: 1,
    floorId: "qa-offline-l1",
    startFloorId: "qa-offline-l1",
    floorTitle: "QA Offline L1",
    startFloorTitle: "QA Offline L1"
  };
  await pageC.evaluate((schedule) => {
    const profile = { companyName: schedule.companyName, siteName: schedule.siteName };
    const floor = {
      id: schedule.floorId,
      floorId: schedule.floorId,
      title: schedule.floorTitle,
      floorCode: "L1",
      companyName: profile.companyName,
      siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src,
      cleanSrc: defaultFloorAssets.lv1.src,
      active: true
    };
    const device = {
      tag: "QA.OFF.EL1",
      type: "Emergency Light",
      short: "EL",
      floor: floor.title,
      floorId: floor.id,
      floorCode: floor.floorCode,
      companyName: profile.companyName,
      siteName: profile.siteName,
      location: "Offline lobby",
      xPercent: 50,
      yPercent: 50,
      status: "Confirmed"
    };
    state.activeJob = null;
    state.inspections = {};
    state.criticalSops = {};
    state.systemChecks = {};
    state.sharedJobRecords = {};
    state.siteProfile = profile;
    state.mimicFloors = [floor, ...state.mimicFloors.filter((item) => item.id !== floor.id)];
    state.setupDevices = [device, ...state.setupDevices.filter((item) => item.tag !== device.tag)];
    state.schedules = [schedule];
    writeStoredJson("rmtActiveJob", null);
    writeStoredJson("tmFireInspections", {});
    writeStoredJson("rmtCriticalSops", {});
    writeStoredJson("rmtSystemChecks", {});
    writeStoredJson("rmtSharedJobRecords", {});
    writeStoredJson("rmtMimicFloors", state.mimicFloors);
    writeStoredJson("tmFireSetupDevices", state.setupDevices);
    writeStoredJson("rmtSchedules", state.schedules);
    selectClientProfile(profile);
    renderTechWorkPanel();
  }, offlineSchedule);
  await pageC.evaluate((scheduleId) => startScheduledJob(scheduleId), offlineSchedule.scheduleId);
  await pageC.waitForFunction((scheduleId) => JSON.parse(localStorage.getItem("rmtActiveJob") || "null")?.scheduleId === scheduleId, offlineSchedule.scheduleId);
  const offlineResult = await pageC.evaluate(async () => {
    selectDevice("QA.OFF.EL1");
    await saveInspection("pass");
    const signoffAttempt = await completeActiveJobWithSignOff({
      technicianName: getCurrentUserName(),
      supervisorName: "QA Supervisor",
      supervisorSignatureData: "data:image/png;base64,QA",
      signedBy: getCurrentUserName()
    });
    return {
      saveStatus: state.inspections["QA.OFF.EL1"]?.syncStatus,
      unsynced: Boolean(state.inspections["QA.OFF.EL1"]?.unsynced),
      signoffAttempt,
      syncState: document.querySelector("#syncState")?.textContent || ""
    };
  });
  assert(offlineResult.saveStatus === "draft", "Server-unavailable save should be marked local draft");
  assert(offlineResult.unsynced === true, "Server-unavailable save should stay unsynced");
  assert(offlineResult.signoffAttempt === false, "Server-unavailable sign-off must be blocked");

  await browser.close();
  return {
    scheduleId,
    beforeAccess: beforeAccess.reason,
    afterAccess: afterAccess.allowed,
    offlineDraft: offlineResult.saveStatus,
    consoleErrors
  };
}

(async () => {
  const server = await runServerRegression();
  const browser = await runBrowserSharedRegression();
  console.log(JSON.stringify({ server, browser }, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
