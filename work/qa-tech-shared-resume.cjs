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
    const profile = {
      companyName: "QA Shared Resume",
      siteName: "QA Shared Resume"
    };
    const floor = {
      id: "qa-resume-l1",
      floorId: "qa-resume-l1",
      title: "QA Resume L1",
      floorCode: "L1",
      companyName: profile.companyName,
      siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src,
      cleanSrc: defaultFloorAssets.lv1.src,
      active: true
    };
    const pool = [
      {
        tag: "QA.EL.RESUME1",
        type: "Emergency Light",
        short: "EL",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Lobby",
        xPercent: 30,
        yPercent: 40,
        status: "Confirmed"
      },
      {
        tag: "QA.EL.RESUME2",
        type: "Emergency Light",
        short: "EL",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Rear corridor",
        xPercent: 60,
        yPercent: 50,
        status: "Confirmed"
      }
    ];
    state.siteProfile = profile;
    state.mimicFloors = [
      floor,
      ...state.mimicFloors.filter((item) => item.id !== floor.id)
    ];
    state.setupDevices = [
      ...pool,
      ...state.setupDevices.filter((device) => !String(device.tag || "").startsWith("QA.EL.RESUME"))
    ];
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
      plannedDeviceIds: pool.map((device) => device.tag),
      deviceCount: pool.length,
      plannedFloorCounts: [{ floorId: floor.id, title: floor.title, count: pool.length }]
    };
    state.schedules = [schedule];
    writeStoredJson("rmtMimicFloors", state.mimicFloors);
    writeStoredJson("tmFireSetupDevices", state.setupDevices);
    writeStoredJson("rmtSchedules", state.schedules);
    selectClientProfile(profile);
    renderTechWorkPanel();
    return pool[0].tag;
  });

  await page.evaluate(() => startScheduledJob("QA-RESUME"));
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
  await page.evaluate(() => startScheduledJob("QA-RESUME"));
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
