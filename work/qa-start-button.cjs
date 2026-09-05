const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = "http://127.0.0.1:8026/?fresh=20260820-start-unlock";
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("rmtActiveJob");
    localStorage.removeItem("tmFireInspections");
    localStorage.removeItem("rmtCriticalSops");
    localStorage.removeItem("rmtSystemChecks");
    localStorage.removeItem("tmFireRequests");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#loginView:not(.hidden)");
  await page.click("[data-demo-login='tech']");
  await page.fill("#loginPassword", new Date().toISOString());
  await page.click("#loginForm button[type='submit']");
  await page.waitForSelector("#workspace.technician-mode");
  const scheduleId = await page.evaluate(() => {
    const profile = { companyName: "UOB", siteName: "UOB" };
    const floor = {
      id: "qa-uob-start-l1",
      floorId: "qa-uob-start-l1",
      title: "UOB QA Start L1",
      floorCode: "L1",
      companyName: profile.companyName,
      siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src,
      cleanSrc: defaultFloorAssets.lv1.src,
      active: true
    };
    const device = {
      tag: "QA.UOB.START.EL1",
      type: "Emergency Light",
      short: "EL",
      floor: floor.title,
      floorId: floor.id,
      floorCode: floor.floorCode,
      companyName: profile.companyName,
      siteName: profile.siteName,
      location: "Lobby",
      xPercent: 45,
      yPercent: 45,
      status: "Confirmed"
    };
    const schedule = {
      scheduleId: `QA-UOB-START-${Date.now()}`,
      status: "Scheduled",
      companyName: profile.companyName,
      siteName: profile.siteName,
      floorId: floor.id,
      startFloorId: floor.id,
      floorTitle: floor.title,
      serviceType: "Maintenance / Inspection",
      scope: "full-maintenance",
      scopeLabel: "QA Start Button",
      scopeSelectionMode: "site-wide",
      scopeFrozen: true,
      date: new Date().toISOString().slice(0, 10),
      time: "09:00",
      technician: "Demo Technician",
      contractFrequencyPercent: 100,
      plannedDeviceIds: [device.tag],
      deviceCount: 1,
      plannedFloorCounts: [{ floorId: floor.id, title: floor.title, count: 1 }]
    };
    state.activeJob = null;
    state.siteProfile = profile;
    state.mimicFloors = [floor, ...state.mimicFloors.filter((item) => item.id !== floor.id)];
    state.setupDevices = [device, ...state.setupDevices.filter((item) => item.tag !== device.tag)];
    state.schedules = [schedule];
    writeStoredJson("rmtActiveJob", null);
    writeStoredJson("rmtMimicFloors", state.mimicFloors);
    writeStoredJson("tmFireSetupDevices", state.setupDevices);
    writeStoredJson("rmtSchedules", state.schedules);
    invalidateRuntimeCaches();
    renderTechWorkPanel();
    return schedule.scheduleId;
  });
  await page.waitForSelector(`[data-tech-start-schedule="${scheduleId}"]`);

  const startButton = page.locator(`[data-tech-start-schedule="${scheduleId}"]`);
  await startButton.click();
  await page.waitForFunction((id) => JSON.parse(localStorage.getItem("rmtActiveJob") || "null")?.scheduleId === id, scheduleId);
  const activeJob = await page.evaluate(() => JSON.parse(localStorage.getItem("rmtActiveJob") || "null"));
  const syncState = await page.textContent("#syncState");
  assert(activeJob?.schedule?.companyName === "UOB", "Start button did not create a UOB active job");

  console.log(JSON.stringify({
    activeJobId: activeJob.jobId,
    activeCompany: activeJob.schedule.companyName,
    syncState,
    consoleErrors
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
