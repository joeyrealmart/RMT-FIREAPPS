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
    const pool = getInspectionDevices().filter((device) => !isCriticalSopDevice(device)).slice(0, 1);
    if (!pool.length) throw new Error("No normal device available for audit QA");
    const device = pool[0];
    const floor = getFloorAsset(floorSelect.value);
    const profile = getCurrentSiteIdentity();
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
      plannedDeviceIds: [device.id],
      deviceCount: 1,
      plannedFloorCounts: [{ floorId: floor.id, title: floor.title, count: 1 }]
    };
    state.schedules = [schedule];
    writeStoredJson("rmtSchedules", state.schedules);
    renderTechWorkPanel();
    return device.id;
  });

  await page.click("[data-tech-start-schedule='QA-AUDIT']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rmtActiveJob") || "null")?.scheduleId === "QA-AUDIT");
  await page.click(`[data-tech-open-device="${deviceId}"]`);
  await page.waitForSelector("#checklistForm:not(.hidden)");
  await page.waitForTimeout(250);
  await page.click("#checklistForm button[type='submit']");
  await page.waitForFunction((id) => Boolean(JSON.parse(localStorage.getItem("tmFireInspections") || "{}")?.[id]?.inspectedBy), deviceId);

  const result = await page.evaluate((id) => {
    const job = JSON.parse(localStorage.getItem("rmtActiveJob") || "null");
    const inspections = JSON.parse(localStorage.getItem("tmFireInspections") || "{}");
    const schedule = JSON.parse(localStorage.getItem("rmtSchedules") || "[]").find((item) => item.scheduleId === "QA-AUDIT");
    const cardText = document.querySelector(`[data-tech-item-card="${CSS.escape(id)}"]`)?.textContent || "";
    return {
      inspectedBy: inspections[id]?.inspectedBy,
      durationMs: inspections[id]?.checklistTotalDurationMs || 0,
      sessionBy: job?.itemSessions?.[id]?.savedBy,
      sessionDurationMs: job?.itemSessions?.[id]?.durationMs || 0,
      scheduleSessionBy: schedule?.jobProgress?.activeJob?.itemSessions?.[id]?.savedBy,
      cardText,
      reportButtonText: document.querySelector("#showReportBtn")?.textContent.trim()
    };
  }, deviceId);

  assert(result.inspectedBy === "Demo Technician", `Inspection saved wrong tech: ${result.inspectedBy}`);
  assert(result.sessionBy === "Demo Technician", `Item session saved wrong tech: ${result.sessionBy}`);
  assert(result.scheduleSessionBy === "Demo Technician", "Schedule progress did not receive item audit session");
  assert(result.durationMs >= 0 && result.sessionDurationMs >= 0, "Duration fields were not saved");
  assert(result.cardText.includes("Filled by Demo Technician"), "Tech item card does not show filled-by audit line");
  assert(result.reportButtonText === "Generate Report", "Admin report button label was not updated");

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
