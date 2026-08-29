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
      steps[index] = {
        confirmed: true,
        title: step.title,
        critical: Boolean(step.critical),
        choice: step.requiresChoice ? (step.choices?.[0] || "Pass") : "",
        reading: step.requiresReading ? "QA reading normal" : "",
        remark: sopStepNeedsRemark(step) ? "QA remark" : "",
        photo: step.requiresPhoto ? "QA photo" : "",
        supervisor: step.requiresSupervisor ? "QA Supervisor" : ""
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

  await page.evaluate(() => selectDevice("QA.FS.1"));
  await page.waitForSelector(".critical-sop-active #criticalSopPanel");
  heading = (await page.textContent("#criticalSopPanel h2")).trim();
  assert(heading.includes("QA.SPP.1"), `Flow Switch should next be blocked by water-system prerequisite, got ${heading}`);

  const flowAccessBeforeWater = await page.evaluate(() => {
    const schedule = getActiveTechnicianMaintenanceSchedule();
    const device = getScheduledAssignedDevices(schedule).find((item) => item.id === "QA.FS.1");
    return getDeviceCriticalAccessState(device, schedule);
  });
  assert(flowAccessBeforeWater.allowed === false, "Flow Switch should still be locked before sprinkler prerequisite");
  assert(flowAccessBeforeWater.dependencies.length === 2, "Flow Switch should carry both primary and secondary dependencies");

  await writeSopStage(page, "QA.SPP.1", "sprinkler-hydrant-pump-sop", 5);
  await page.evaluate(() => selectDevice("QA.FS.1"));
  await page.waitForSelector("#checklistForm:not(.hidden)");
  deviceName = (await page.textContent("#deviceName")).trim();
  assert(deviceName === "QA.FS.1", `Flow Switch should open after both prerequisites, got ${deviceName}`);

  await saveNormalInspection(page, "QA.MCP.1");
  await saveNormalInspection(page, "QA.FS.1");
  const beforeFinalSummary = await page.evaluate(() => getAssignedCompletionSummary(getActiveTechnicianMaintenanceSchedule()));
  assert(beforeFinalSummary.ready === false, "Job should not be ready before final restoration");
  assert(beforeFinalSummary.partial >= 2, "Critical parents should remain partial before final restoration");

  await writeSopStage(page, "QA.MFAP.1", "fire-alarm-tripping-sop", 10);
  await writeSopStage(page, "QA.SPP.1", "sprinkler-hydrant-pump-sop", 16);
  const afterFinalSummary = await page.evaluate(() => getAssignedCompletionSummary(getActiveTechnicianMaintenanceSchedule()));
  assert(afterFinalSummary.ready === true, "Job should be ready after child devices and final restoration are complete");

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
