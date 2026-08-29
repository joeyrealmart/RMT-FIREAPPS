const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260829-mfap-precheck";
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

async function seedMfapGateJob(page) {
  await page.evaluate(() => {
    const profile = {
      companyName: "QA MFAP Gate",
      siteName: "QA MFAP Gate"
    };
    const floor = {
      id: "qa-mfap-l1",
      floorId: "qa-mfap-l1",
      title: "QA MFAP L1",
      floorCode: "L1",
      companyName: profile.companyName,
      siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src,
      cleanSrc: defaultFloorAssets.lv1.src,
      active: true
    };
    const qaTags = ["QA.MFAP.1", "QA.MCP.1"];
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
        xPercent: 20,
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
        xPercent: 60,
        yPercent: 40,
        status: "Confirmed"
      }
    ];
    state.schedules = [
      ...state.schedules.filter((schedule) => schedule.scheduleId !== "QA-MFAP-GATE"),
      {
        scheduleId: "QA-MFAP-GATE",
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
        activeCount: 1,
        passiveCount: 1,
        notes: "QA MFAP gate seed"
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
  await seedMfapGateJob(page);

  await page.evaluate(() => startScheduledJob("QA-MFAP-GATE"));
  await page.evaluate(() => selectDevice("QA.MCP.1"));
  await page.waitForSelector(".critical-sop-active #criticalSopPanel");
  const heading = (await page.textContent("#criticalSopPanel h2")).trim();
  assert(heading.includes("QA.MFAP.1"), `Expected MFAP prerequisite, got ${heading}`);

  const access = await page.evaluate(() => {
    const schedule = getActiveTechnicianMaintenanceSchedule();
    const device = getScheduledAssignedDevices(schedule).find((item) => item.id === "QA.MCP.1");
    return getDeviceCriticalAccessState(device, schedule);
  });
  assert(access.allowed === false, "MCP should be locked before MFAP prerequisite");
  assert(access.reason.includes("prerequisite"), `Expected prerequisite block reason, got ${access.reason}`);

  const stepCount = await page.locator("#criticalSopForm .sop-step").count();
  assert(stepCount === 11, `MFAP SOP should have 11 streamlined steps, got ${stepCount}`);

  const step4Checkboxes = await page.locator("#criticalSopForm .sop-step").nth(3).locator("input[type='checkbox']").count();
  const step4Choices = await page.locator("#criticalSopForm .sop-step").nth(3).locator("select[name='sop-choice-3']").count();
  assert(step4Checkboxes === 0 && step4Choices === 1, "MFAP Step 4 should be select-only with no checkbox");

  const step6Checkboxes = await page.locator("#criticalSopForm .sop-step").nth(5).locator("input[type='checkbox']").count();
  const step6Choices = await page.$$eval("select[name='sop-choice-5'] option", (options) => options.map((option) => option.textContent.trim()));
  assert(step6Checkboxes === 0, "MFAP Step 6 should have no checkbox");
  assert(step6Choices.includes("25V") && step6Choices.includes("30V"), "MFAP Step 6 should include 25V-30V presets");

  console.log(JSON.stringify({
    attemptedDevice: "QA.MCP.1",
    opened: heading,
    lockReason: access.reason,
    mfapStepCount: stepCount,
    step6Choices,
    consoleErrors
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
