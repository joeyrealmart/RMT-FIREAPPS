const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = "http://127.0.0.1:8026/?fresh=20260820-audit-tracking";
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
    body: JSON.stringify({ ok: true, runKey: "qa-audit-run" })
  }));
  page.on("dialog", async (dialog) => dialog.accept());

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

  const deviceId = await page.evaluate(() => {
    const profile = {
      companyName: "QA Audit Tracking",
      siteName: "QA Audit Tracking"
    };
    const floor = {
      id: "qa-audit-l1",
      floorId: "qa-audit-l1",
      title: "QA Audit L1",
      floorCode: "L1",
      companyName: profile.companyName,
      siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src,
      cleanSrc: defaultFloorAssets.lv1.src,
      active: true
    };
    const device = {
      tag: "QA.EL.AUDIT",
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
    state.siteProfile = profile;
    state.mimicFloors = [
      floor,
      ...state.mimicFloors.filter((item) => item.id !== floor.id)
    ];
    state.setupDevices = [
      device,
      ...state.setupDevices.filter((item) => item.tag !== device.tag)
    ];
    const schedule = {
      scheduleId: "QA-AUDIT",
      status: "Scheduled",
      companyName: profile.companyName,
      siteName: profile.siteName,
      floorId: floor.id,
      startFloorId: floor.id,
      floorTitle: floor.title,
      serviceType: "Maintenance / Inspection",
      scope: "full-maintenance",
      scopeLabel: "QA Audit Tracking",
      scopeSelectionMode: "site-wide",
      date: "2026-08-20",
      time: "09:00",
      technician: "Demo Technician",
      contractFrequencyPercent: 100,
      plannedDeviceIds: [device.tag],
      deviceCount: 1,
      plannedFloorCounts: [{ floorId: floor.id, title: floor.title, count: 1 }]
    };
    state.schedules = [schedule];
    writeStoredJson("rmtMimicFloors", state.mimicFloors);
    writeStoredJson("tmFireSetupDevices", state.setupDevices);
    writeStoredJson("rmtSchedules", state.schedules);
    selectClientProfile(profile);
    renderTechWorkPanel();
    return device.tag;
  });

  await page.click("[data-tech-start-schedule='QA-AUDIT']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rmtActiveJob") || "null")?.scheduleId === "QA-AUDIT");
  await page.evaluate((id) => focusTechnicianAssignedDevice(id, { openChecklist: true }), deviceId);
  await page.waitForSelector("#checklistForm:not(.hidden)");
  await page.waitForTimeout(250);
  await page.click("#checklistForm button[type='submit']");
  await page.waitForFunction((id) => Boolean(JSON.parse(localStorage.getItem("tmFireInspections") || "{}")?.[id]?.inspectedBy), deviceId);

  const result = await page.evaluate((id) => {
    const job = JSON.parse(localStorage.getItem("rmtActiveJob") || "null");
    const inspections = JSON.parse(localStorage.getItem("tmFireInspections") || "{}");
    const schedule = JSON.parse(localStorage.getItem("rmtSchedules") || "[]").find((item) => item.scheduleId === "QA-AUDIT");
    const sharedRecord = getSharedInspectionRecord(id, schedule);
    const cardText = document.querySelector(`[data-tech-item-card="${CSS.escape(id)}"]`)?.textContent || "";
    return {
      inspectedBy: inspections[id]?.inspectedBy,
      durationMs: inspections[id]?.checklistTotalDurationMs || 0,
      sessionBy: job?.itemSessions?.[id]?.savedBy,
      sessionDurationMs: job?.itemSessions?.[id]?.durationMs || 0,
      sharedRecordBy: sharedRecord?.technicianName,
      sharedRecordRevision: sharedRecord?.revision || 0,
      scheduleJobProgressWritten: Boolean(schedule?.jobProgress),
      cardText,
      reportButtonText: document.querySelector("#showReportBtn")?.textContent.trim()
    };
  }, deviceId);

  assert(result.inspectedBy === "Demo Technician", `Inspection saved wrong tech: ${result.inspectedBy}`);
  assert(result.sharedRecordBy === "Demo Technician", "Shared inspection record did not receive item audit technician");
  assert(result.sharedRecordRevision > 0, "Shared inspection record revision was not saved");
  assert(result.scheduleJobProgressWritten === false, "Schedule jobProgress should remain read-only during shared-record save");
  assert(result.durationMs >= 0, "Inspection duration field was not saved");
  assert(result.cardText.includes("Filled by Demo Technician"), "Tech item card does not show filled-by audit line");
  assert(result.reportButtonText === "Generate Report", "Admin report button label was not updated");

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
