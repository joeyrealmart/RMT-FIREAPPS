const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260829-critical-dependency";
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loginAsTech(page) {
  await page.click("[data-demo-login='tech']");
  await page.fill("#loginPassword", new Date().toISOString());
  await page.click("#loginForm button[type='submit']");
  await page.waitForSelector("#workspace.technician-mode");
}

async function seedCriticalDependencyJob(page) {
  await page.evaluate(() => {
    const profile = {
      companyName: "QA Critical Dependency",
      siteName: "QA Critical Dependency"
    };
    const floor = {
      id: "qa-critical-l1",
      floorId: "qa-critical-l1",
      title: "QA Critical L1",
      floorCode: "L1",
      companyName: profile.companyName,
      siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src,
      cleanSrc: defaultFloorAssets.lv1.src,
      active: true
    };
    const qaTags = ["QA.MFAP.1", "QA.SPP.1", "QA.MCP.1", "QA.FS.1"];
    state.activeJob = null;
    state.inspections = {};
    state.criticalSops = {};
    state.systemChecks = {};
    state.siteProfile = profile;
    state.mimicFloors = [
      floor,
      ...state.mimicFloors.filter((item) => item.id !== floor.id)
    ];
    state.setupDevices = [
      ...state.setupDevices.filter((device) => !qaTags.includes(device.tag)),
      {
        tag: "QA.MFAP.1",
        type: "Main Fire Alarm Panel",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Fire command room",
        xPercent: 15,
        yPercent: 20,
        status: "Confirmed"
      },
      {
        tag: "QA.SPP.1",
        type: "Sprinkler Panel",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Pump room",
        xPercent: 35,
        yPercent: 20,
        status: "Confirmed"
      },
      {
        tag: "QA.MCP.1",
        type: "Manual Call Point",
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
        tag: "QA.FS.1",
        type: "Flow Switch",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Sprinkler riser",
        xPercent: 75,
        yPercent: 40,
        status: "Confirmed"
      }
    ];
    state.schedules = [
      ...state.schedules.filter((schedule) => schedule.scheduleId !== "QA-CRITICAL-DEPENDENCY"),
      {
        scheduleId: "QA-CRITICAL-DEPENDENCY",
        status: "Scheduled",
        clientSource: "existing",
        companyName: profile.companyName,
        siteName: profile.siteName,
        address: "QA test only",
        floorId: floor.id,
        startFloorId: floor.id,
        floorTitle: floor.title,
        startFloorTitle: floor.title,
        date: new Date().toISOString().slice(0, 10),
        time: "09:00",
        technician: "Demo Technician",
        technicians: [
          { technicianId: "tech@rmtfire.local", technicianName: "Demo Technician" },
          { technicianId: "tech2@rmtfire.local", technicianName: "Tech 2" }
        ],
        deviceAssignments: {
          "QA.MFAP.1": { technicianId: "tech@rmtfire.local", technicianName: "Demo Technician" },
          "QA.SPP.1": { technicianId: "tech2@rmtfire.local", technicianName: "Tech 2" }
        },
        linkedVerifications: [{
          linkedVerificationId: "QA-CRITICAL-DEPENDENCY::CO2_MFAP::QA.CO2.1::INDICATION",
          verificationType: "CO2_GAS_RELEASE_INDICATION",
          title: "QA CO2 indication",
          systemId: "gas-release",
          systemIds: ["gas-release", "fire-alarm"],
          reconciliationMode: "MATCHING_RESULTS",
          requiredSides: [
            { sideId: "SUPPRESSION_SYSTEM_LOCATION", sideName: "Suppression System Location", assignedTechnicianId: "tech2@rmtfire.local", assignedTechnicianName: "Tech 2" },
            { sideId: "REMOTE_PANEL_OR_MFAP", sideName: "Remote Panel / MFAP", assignedTechnicianId: "tech@rmtfire.local", assignedTechnicianName: "Demo Technician" }
          ]
        }],
        serviceType: "Maintenance / Inspection",
        scope: "yearly-100",
        scopeLabel: "Yearly Full Inspection",
        priority: "Normal",
        contractFrequencyPercent: 100,
        scopeSelectionMode: "site-wide",
        plannedDeviceIds: qaTags,
        deviceCount: qaTags.length,
        activeCount: 2,
        passiveCount: 2,
        notes: "QA critical dependency seed"
      }
    ];
    writeStoredJson("rmtActiveJob", state.activeJob);
    writeStoredJson("tmFireInspections", state.inspections);
    writeStoredJson("rmtCriticalSops", state.criticalSops);
    writeStoredJson("rmtSystemChecks", state.systemChecks);
    writeStoredJson("rmtMimicFloors", state.mimicFloors);
    writeStoredJson("tmFireSetupDevices", state.setupDevices);
    writeStoredJson("rmtSchedules", state.schedules);
    selectClientProfile(profile);
    renderSchedulePanel();
    renderTechWorkPanel();
  });
}

async function writeSopStage(page, tag, templateId, throughIndex) {
  await page.evaluate(({ tag, templateId, throughIndex }) => {
    const template = criticalSopTemplates.find((item) => item.id === templateId);
    const steps = {};
    template.steps.forEach((step, index) => {
      if (index > throughIndex) return;
      const structuredFields = [
        ...(step.fields || []),
        ...Object.values(step.variants || {}).flat()
      ];
      steps[index] = {
        confirmed: true,
        title: step.title,
        critical: Boolean(step.critical),
        choice: step.requiresChoice ? (step.choices?.[0] || "Pass") : "",
        reading: step.requiresReading ? (step.readingType === "number" ? "26.7" : "QA reading normal") : "",
        remark: sopStepNeedsRemark(step) ? "QA remark" : "",
        photo: step.requiresPhoto ? "QA photo" : "",
        photoEvidence: step.requiresPhoto ? { evidenceId: `qa-${templateId}-${index}`, originalDataUrl: "data:image/png;base64,AA==" } : null,
        supervisor: step.requiresSupervisor ? "QA Supervisor" : "",
        fieldValues: Object.fromEntries(structuredFields.map((field) => [field.id, field.kind === "number" ? "415" : field.choices?.[0] || "QA value"])),
        fieldRemarks: {}
      };
    });
    state.criticalSops[`${templateId}::${tag}`] = {
      templateId,
      templateVersion: getCriticalSopTemplateVersion(template),
      templateSnapshot: createCriticalSopTemplateSnapshot(template),
      title: template.title,
      deviceTag: tag,
      deviceType: tag.includes("MFAP") ? "Main Fire Alarm Panel" : "Sprinkler Panel",
      floor: "QA Critical L1",
      location: "QA location",
      companyName: "QA Critical Dependency",
      siteName: "QA Critical Dependency",
      steps,
      beforePhoto: template.requiresBeforeAfterPhotos ? "QA before" : "",
      afterPhoto: template.requiresBeforeAfterPhotos && throughIndex >= template.steps.length - 1 ? "QA after" : "",
      beforePhotoEvidence: template.requiresBeforeAfterPhotos ? { evidenceId: `qa-${templateId}-before`, originalDataUrl: "data:image/png;base64,AA==" } : null,
      afterPhotoEvidence: template.requiresBeforeAfterPhotos && throughIndex >= template.steps.length - 1 ? { evidenceId: `qa-${templateId}-after`, originalDataUrl: "data:image/png;base64,AA==" } : null,
      filledBy: getCurrentUserName(),
      filledRole: getCurrentUserRole(),
      savedAt: new Date().toISOString(),
      savedBy: getCurrentUserName()
    };
    writeStoredJson("rmtCriticalSops", state.criticalSops);
    ensureActiveJobCriticalWorkflows(getActiveTechnicianMaintenanceSchedule());
    syncActiveJobProgressToSchedule();
    persistActiveJob();
    renderTechWorkPanel();
    renderMarkers();
  }, { tag, templateId, throughIndex });
}

async function saveNormalInspection(page, tag, status = "pass") {
  await page.evaluate(({ tag, status }) => {
    state.inspections[tag] = {
      status,
      answers: ["Pass"],
      notes: status === "fail" ? "QA fault" : "",
      action: "",
      inspectedAt: new Date().toISOString(),
      inspectedBy: getCurrentUserName(),
      inspectedRole: getCurrentUserRole()
    };
    writeStoredJson("tmFireInspections", state.inspections);
    ensureActiveJobCriticalWorkflows(getActiveTechnicianMaintenanceSchedule());
    syncActiveJobProgressToSchedule();
    persistActiveJob();
    renderTechWorkPanel();
    renderMarkers();
  }, { tag, status });
}

async function seedCompletedLinkedVerifications(page) {
  await page.evaluate(() => {
    const schedule = getActiveTechnicianMaintenanceSchedule();
    const scheduleId = getScheduleKey(schedule);
    const cache = ensureSharedCacheForSchedule(schedule);
    const store = {
      ...cache.store,
      linkedVerificationDefinitions: { ...(cache.store?.linkedVerificationDefinitions || {}) },
      linkedVerificationSideRecords: { ...(cache.store?.linkedVerificationSideRecords || {}) }
    };
    getScheduleLinkedVerificationDefinitions(schedule).forEach((definition) => {
      store.linkedVerificationDefinitions[definition.linkedVerificationId] = definition;
      definition.requiredSides.forEach((side) => {
        const recordId = getLinkedVerificationSideRecordId(scheduleId, definition.linkedVerificationId, side.sideId);
        store.linkedVerificationSideRecords[recordId] = {
          recordId,
          linkedVerificationId: definition.linkedVerificationId,
          scheduleId,
          jobId: definition.jobId || `JOB-${scheduleId}`,
          verificationType: definition.verificationType,
          sideId: side.sideId,
          sideName: side.sideName,
          assignedTechnicianId: side.assignedTechnicianId,
          technicianId: side.assignedTechnicianId,
          technicianName: side.assignedTechnicianName,
          result: "CONFIRMED",
          status: "COMPLETE",
          revision: 1,
          timestamp: new Date().toISOString()
        };
      });
    });
    setSharedJobCache(scheduleId, { store, progress: cache.progress }, { online: true });
  });
}

(async () => {
  const executablePath = EDGE_PATHS.find((item) => existsSync(item));
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await loginAsTech(page);
  await seedCriticalDependencyJob(page);

  await page.evaluate(() => startScheduledJob("QA-CRITICAL-DEPENDENCY"));
  await page.evaluate(() => selectDevice("QA.MCP.1"));
  await page.waitForSelector(".critical-sop-active #criticalSopPanel");
  let heading = (await page.textContent("#criticalSopPanel h2")).trim();
  assert(heading.includes("QA.MFAP.1"), `MCP should be blocked by MFAP prerequisite, got ${heading}`);

  await writeSopStage(page, "QA.MFAP.1", "fire-alarm-tripping-sop", 6);
  await page.evaluate(() => selectDevice("QA.MCP.1"));
  await page.waitForSelector("#checklistForm:not(.hidden)");
  let deviceName = (await page.textContent("#deviceName")).trim();
  assert(deviceName === "QA.MCP.1", `MCP should open after MFAP prerequisite, got ${deviceName}`);

  await writeSopStage(page, "QA.SPP.1", "sprinkler-hydrant-pump-sop", 5);
  await page.evaluate(() => selectDevice("QA.FS.1"));
  await page.waitForSelector("#checklistForm:not(.hidden)");
  deviceName = (await page.textContent("#deviceName")).trim();
  assert(deviceName === "QA.FS.1", `Flow Switch should open after the FAP prerequisite, got ${deviceName}`);

  const flowAccessBeforeWater = await page.evaluate(() => {
    const schedule = getActiveTechnicianMaintenanceSchedule();
    const device = getScheduledAssignedDevices(schedule).find((item) => item.id === "QA.FS.1");
    return getDeviceCriticalAccessState(device, schedule);
  });
  assert(flowAccessBeforeWater.allowed === true, "Flow Switch should open once the FAP prerequisite is complete");
  assert(flowAccessBeforeWater.dependencies.length === 1, "Flow Switch should retain only its FAP dependency");

  await saveNormalInspection(page, "QA.MCP.1");
  await saveNormalInspection(page, "QA.FS.1");
  const beforeFinalSummary = await page.evaluate(() => getAssignedCompletionSummary(getActiveTechnicianMaintenanceSchedule()));
  assert(beforeFinalSummary.ready === false, "Job should not be ready before final restoration");
  assert(beforeFinalSummary.partial >= 2, "Critical parents should remain partial before final restoration");

  await seedCompletedLinkedVerifications(page);
  await writeSopStage(page, "QA.MFAP.1", "fire-alarm-tripping-sop", 10);
  await writeSopStage(page, "QA.SPP.1", "sprinkler-hydrant-pump-sop", 17);
  const afterFinalSummary = await page.evaluate(() => getAssignedCompletionSummary(getActiveTechnicianMaintenanceSchedule()));
  const finalStatuses = await page.evaluate(() => {
    const schedule = getActiveTechnicianMaintenanceSchedule();
    const template = getCriticalSopTemplate("sprinkler-hydrant-pump-sop");
    const mfapTemplate = getCriticalSopTemplate("fire-alarm-tripping-sop");
    const mfapRecord = state.criticalSops["fire-alarm-tripping-sop::QA.MFAP.1"];
    const record = state.criticalSops["sprinkler-hydrant-pump-sop::QA.SPP.1"];
    return {
      devices: getScheduledAssignedDevices(schedule).map((device) => ({ id: device.id || device.tag, status: getAssignedDeviceCompletionStatus(device, schedule) })),
      pumpCompleted: getCriticalSopCompleteCount(template, record),
      pumpTotal: template.steps.length,
      pumpSteps: template.steps.map((step, index) => ({ index, complete: isSopStepComplete(step, record.steps[index] || {}, template, index, record), missing: getMissingSopRequirements(step, record.steps[index] || {}, template, index, record) })),
      mfapCompleted: getCriticalSopCompleteCount(mfapTemplate, mfapRecord),
      mfapTotal: mfapTemplate.steps.length,
      mfapSteps: mfapTemplate.steps.map((step, index) => ({ index, complete: isSopStepComplete(step, mfapRecord.steps[index] || {}, mfapTemplate, index, mfapRecord), missing: getMissingSopRequirements(step, mfapRecord.steps[index] || {}, mfapTemplate, index, mfapRecord) }))
    };
  });
  assert(afterFinalSummary.ready === true, `Job should be ready after child devices and final restoration are complete: ${JSON.stringify({ afterFinalSummary, finalStatuses })}`);

  console.log(JSON.stringify({
    mcpGate: "blocked by MFAP, then opened",
    flowSwitchDependencies: flowAccessBeforeWater.dependencies.map((item) => `${item.relation}:${item.run.parentDeviceTag}`),
    beforeFinalSummary,
    afterFinalSummary,
    consoleErrors
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
