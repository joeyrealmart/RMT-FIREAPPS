const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260829-save-next";
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

async function seedSaveNextJob(page) {
  await page.evaluate(() => {
    const profile = {
      companyName: "QA Save Next",
      siteName: "QA Save Next"
    };
    const floor = {
      id: "qa-save-next-l1",
      floorId: "qa-save-next-l1",
      title: "QA Save Next L1",
      floorCode: "L1",
      companyName: profile.companyName,
      siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src,
      cleanSrc: defaultFloorAssets.lv1.src,
      active: true
    };
    const qaTags = ["QA.MFAP.SN", "QA.MCP.SN1", "QA.MCP.SN2"];
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
        tag: "QA.MFAP.SN",
        type: "Main Fire Alarm Panel",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Fire command room",
        xPercent: 20,
        yPercent: 20,
        status: "Confirmed"
      },
      {
        tag: "QA.MCP.SN1",
        type: "Manual Call Point",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Lobby exit",
        xPercent: 50,
        yPercent: 40,
        status: "Confirmed"
      },
      {
        tag: "QA.MCP.SN2",
        type: "Manual Call Point",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Rear exit",
        xPercent: 70,
        yPercent: 50,
        status: "Confirmed"
      }
    ];
    state.schedules = [
      ...state.schedules.filter((schedule) => schedule.scheduleId !== "QA-SAVE-NEXT"),
      {
        scheduleId: "QA-SAVE-NEXT",
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
        time: "10:00",
        technician: "Demo Technician",
        serviceType: "Maintenance / Inspection",
        scope: "yearly-100",
        scopeLabel: "Yearly Full Inspection",
        priority: "Normal",
        contractFrequencyPercent: 100,
        scopeSelectionMode: "site-wide",
        plannedDeviceIds: qaTags,
        deviceCount: qaTags.length,
        activeCount: 1,
        passiveCount: 2,
        notes: "QA Save & Next seed"
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

async function completeMfapPrerequisite(page) {
  await page.evaluate(() => {
    const template = criticalSopTemplates.find((item) => item.id === "fire-alarm-tripping-sop");
    const steps = {};
    [0, 1, 2, 3, 4, 5, 6].forEach((index) => {
      const step = template.steps[index];
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
    state.criticalSops["fire-alarm-tripping-sop::QA.MFAP.SN"] = {
      templateId: "fire-alarm-tripping-sop",
      templateVersion: getCriticalSopTemplateVersion(template),
      templateSnapshot: createCriticalSopTemplateSnapshot(template),
      title: template.title,
      deviceTag: "QA.MFAP.SN",
      deviceType: "Main Fire Alarm Panel",
      floor: "QA Save Next L1",
      location: "Fire command room",
      companyName: "QA Save Next",
      siteName: "QA Save Next",
      steps,
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
  await seedSaveNextJob(page);

  await page.evaluate(() => startScheduledJob("QA-SAVE-NEXT"));
  await completeMfapPrerequisite(page);
  await page.evaluate(() => selectDevice("QA.MCP.SN1"));
  await page.waitForSelector("#checklistForm:not(.hidden)");

  const firstDeviceName = (await page.textContent("#deviceName")).trim();
  assert(firstDeviceName === "QA.MCP.SN1", `Expected first MCP checklist, got ${firstDeviceName}`);
  assert(await page.locator("#saveNextInspectionBtn").isVisible(), "Save & Next Item button is not visible");

  await page.click("#saveNextInspectionBtn");
  await page.waitForFunction(() => {
    return document.querySelector("#checklistForm:not(.hidden) #deviceName")?.textContent.trim() === "QA.MCP.SN2";
  });

  const nextDeviceName = (await page.textContent("#deviceName")).trim();
  const progress = await page.evaluate(() => getAssignedCompletionSummary(getActiveTechnicianMaintenanceSchedule()));
  assert(progress.done === 1, `Expected one completed child after Save & Next, got ${progress.done}`);

  console.log(JSON.stringify({
    firstDeviceName,
    nextOpened: nextDeviceName,
    progress,
    consoleErrors
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
