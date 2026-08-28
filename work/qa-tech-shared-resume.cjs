const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = "http://127.0.0.1:8026/?fresh=20260820-signature-flow";
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

  await page.route("**/api/save-schedules", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, count: 1 })
  }));
  await page.route("**/api/save-inspection-run", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, runKey: "qa-resume-run" })
  }));
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.removeItem("rmtActiveJob");
    localStorage.removeItem("tmFireInspections");
    localStorage.removeItem("rmtCriticalSops");
    localStorage.removeItem("rmtSystemChecks");
    localStorage.removeItem("tmFireRequests");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.click("[data-demo-login='tech']");
  await page.fill("#loginPassword", new Date().toISOString());
  await page.click("#loginForm button[type='submit']");
  await page.waitForSelector("#workspace.technician-mode");

  const firstDeviceId = await page.evaluate(() => {
    const pool = getInspectionDevices().filter((device) => !isCriticalSopDevice(device)).slice(0, 2);
    if (pool.length < 2) throw new Error("Not enough normal devices for QA schedule");
    const floor = getFloorAsset(floorSelect.value);
    const profile = getCurrentSiteIdentity();
    const schedule = {
      scheduleId: "QA-RESUME",
      status: "Scheduled",
      companyName: profile.companyName,
      siteName: profile.siteName,
      floorId: floor.id,
      startFloorId: floor.id,
      floorTitle: floor.title,
      serviceType: "Maintenance / Inspection",
      scope: "full-maintenance",
      scopeLabel: "QA Resume Test",
      scopeSelectionMode: "site-wide",
      date: "2026-08-20",
      time: "09:00",
      technician: "Technician Pool",
      contractFrequencyPercent: 100,
      plannedDeviceIds: pool.map((device) => device.id),
      deviceCount: pool.length,
      plannedFloorCounts: [{ floorId: floor.id, title: floor.title, count: pool.length }]
    };
    state.schedules = [schedule];
    writeStoredJson("rmtSchedules", state.schedules);
    renderTechWorkPanel();
    return pool[0].id;
  });

  await page.click("[data-tech-start-schedule='QA-RESUME']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rmtActiveJob") || "null")?.scheduleId === "QA-RESUME");
  await page.evaluate((deviceId) => {
    state.inspections[deviceId] = {
      status: "pass",
      answers: ["Pass"],
      notes: "Completed before handover",
      action: "",
      beforePhoto: "",
      afterPhoto: "",
      inspectedAt: new Date().toISOString(),
      inspectedBy: getCurrentUserName(),
      inspectedRole: getCurrentUserRole()
    };
    writeStoredJson("tmFireInspections", state.inspections);
    syncActiveJobProgressToSchedule();
    persistActiveJob();
    state.activeJob = null;
    state.inspections = {};
    writeStoredJson("rmtActiveJob", null);
    writeStoredJson("tmFireInspections", {});
    renderTechWorkPanel();
  }, firstDeviceId);

  await page.evaluate(() => document.querySelector("#logoutBtn")?.click());
  await page.click("[data-demo-login='tech2']");
  await page.fill("#loginPassword", new Date().toISOString());
  await page.click("#loginForm button[type='submit']");
  await page.waitForSelector("#workspace.technician-mode");
  await page.click("[data-tech-start-schedule='QA-RESUME']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rmtActiveJob") || "null")?.scheduleId === "QA-RESUME");

  const result = await page.evaluate((deviceId) => {
    const activeJob = JSON.parse(localStorage.getItem("rmtActiveJob") || "null");
    return {
      status: activeJob?.status,
      teamMembers: activeJob?.teamMembers || [],
      restoredStatus: state.inspections[deviceId]?.status || "",
      syncState: document.querySelector("#syncState")?.textContent
    };
  }, firstDeviceId);
  assert(result.teamMembers.includes("Tech 2"), "Tech 2 was not added to shared job team");
  assert(result.restoredStatus === "pass", "Saved inspection progress was not restored for second tech");
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
