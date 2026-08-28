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
    body: JSON.stringify({ ok: true, runKey: "qa-run" })
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

  const testSchedule = await page.evaluate(() => {
    const pool = getInspectionDevices().filter((device) => !isCriticalSopDevice(device)).slice(0, 2);
    if (pool.length < 2) throw new Error("Not enough normal devices for QA schedule");
    const floor = getFloorAsset(floorSelect.value);
    const profile = getCurrentSiteIdentity();
    const schedule = {
      scheduleId: "QA-SIGNOFF",
      status: "Scheduled",
      companyName: profile.companyName,
      siteName: profile.siteName,
      floorId: floor.id,
      startFloorId: floor.id,
      floorTitle: floor.title,
      serviceType: "Maintenance / Inspection",
      scope: "full-maintenance",
      scopeLabel: "QA Flow Test",
      scopeSelectionMode: "site-wide",
      date: "2026-08-20",
      time: "09:00",
      technician: "Demo Technician",
      contractFrequencyPercent: 100,
      plannedDeviceIds: pool.map((device) => device.id),
      deviceCount: pool.length,
      plannedFloorCounts: [{ floorId: floor.id, title: floor.title, count: pool.length }]
    };
    state.schedules = [schedule];
    writeStoredJson("rmtSchedules", state.schedules);
    renderTechWorkPanel();
    return { firstId: pool[0].id, secondId: pool[1].id };
  });

  await page.click("[data-tech-start-schedule='QA-SIGNOFF']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rmtActiveJob") || "null")?.scheduleId === "QA-SIGNOFF");
  await page.click(`[data-tech-open-device="${testSchedule.firstId}"]`);
  await page.waitForSelector("#checklistForm:not(.hidden)");

  await page.waitForSelector("#questionList .question input[value='Fail']");
  const failChoice = page.locator("#questionList .question").first().locator("input[value='Fail']");
  await failChoice.scrollIntoViewIfNeeded();
  const beforeScroll = await page.evaluate(() => window.scrollY);
  await failChoice.check();
  await page.waitForTimeout(250);
  const afterScroll = await page.evaluate(() => window.scrollY);
  assert(Math.abs(afterScroll - beforeScroll) < 12, `Checklist radio caused scroll from ${beforeScroll} to ${afterScroll}`);

  await page.evaluate(async () => {
    const schedule = state.schedules[0];
    getScheduledAssignedDevices(schedule).forEach((device) => {
      state.inspections[device.id] = {
        status: "pass",
        answers: (device.questions || []).map(() => "Pass"),
        notes: "QA completed",
        action: "",
        beforePhoto: "",
        afterPhoto: "",
        inspectedAt: new Date().toISOString(),
        inspectedBy: getCurrentUserName(),
        inspectedRole: getCurrentUserRole()
      };
    });
    writeStoredJson("tmFireInspections", state.inspections);
    syncActiveJobProgressToSchedule();
    persistActiveJob();
    renderMarkers();
    renderTechAssignedItemList();
  });

  await page.waitForSelector("#techCompletionPanel:not(.hidden)");
  await page.fill("#techSignSupervisor", "QA Supervisor");
  const signatureBox = await page.locator("#techSignatureCanvas").boundingBox();
  const signature = page.locator("#techSignatureCanvas");
  await signature.dispatchEvent("pointerdown", {
    clientX: signatureBox.x + 24,
    clientY: signatureBox.y + 70,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true
  });
  await signature.dispatchEvent("pointermove", {
    clientX: signatureBox.x + 120,
    clientY: signatureBox.y + 45,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true
  });
  await signature.dispatchEvent("pointermove", {
    clientX: signatureBox.x + 210,
    clientY: signatureBox.y + 95,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true
  });
  await signature.dispatchEvent("pointerup", {
    clientX: signatureBox.x + 210,
    clientY: signatureBox.y + 95,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true
  });
  await page.waitForFunction(() => Boolean(document.querySelector("#techSignatureData")?.value));
  await page.check("#techSignConfirm");
  await page.click("#techCompleteJobBtn");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rmtActiveJob") || "null")?.status === "Completed");

  const result = await page.evaluate(() => {
    const job = JSON.parse(localStorage.getItem("rmtActiveJob") || "null");
    return {
      status: job?.status,
      signSupervisor: job?.signOff?.supervisorName,
      signatureCaptured: Boolean(job?.signOff?.supervisorSignatureData),
      teamMembers: job?.teamMembers || [],
      syncState: document.querySelector("#syncState")?.textContent
    };
  });
  assert(result.status === "Completed", "Job was not completed after sign-off");
  assert(result.signSupervisor === "QA Supervisor", "Sign-off supervisor was not saved");
  assert(result.signatureCaptured, "Signature was not saved");
  console.log(JSON.stringify({ beforeScroll, afterScroll, ...result }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
