const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = "http://127.0.0.1:8026/?fresh=wetex-retest-fixture";
const SCHEDULE_ID = "DEMO-WETEX-RETEST-20260924";
const BROWSER_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

async function loginAndInspect(browser, email) {
  const context = await browser.newContext({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", "physical-retest-fixture-qa");
  await page.click("#loginForm button[type='submit']");
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("technician-mode"), null, { timeout: 20000 });
  const button = page.locator(`[data-tech-start-schedule="${SCHEDULE_ID}"]`);
  await button.waitFor({ state: "visible", timeout: 20000 });
  const card = button.locator("xpath=ancestor::article[contains(@class,'tech-job-card')]");
  const cardText = await card.textContent();
  const jobScopeCount = Number((cardText.match(/(\d+)\s*Assigned items/i) || [])[1]);
  assert.equal(jobScopeCount, 65);
  const ownedCount = await page.evaluate(({ scheduleId, technicianId }) => {
    const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
    return Object.values(schedule?.deviceAssignments || {}).filter((item) => item.technicianId === technicianId).length;
  }, { scheduleId: SCHEDULE_ID, technicianId: email });
  assert.equal(ownedCount, email === "tech@rmtfire.local" ? 33 : 32);
  assert.equal(errors.length, 0, `Console errors for ${email}: ${errors.join(" | ")}`);
  await context.close();
  return { email, jobScopeCount, ownedCount, selectable: true };
}

(async () => {
  const schedulesPayload = await fetch("http://127.0.0.1:8026/api/schedules").then((response) => response.json());
  const schedule = schedulesPayload.schedules.find((item) => item.scheduleId === SCHEDULE_ID);
  assert(schedule, "Fresh Wetex retest fixture must be present in the LAN schedule API.");
  assert.equal(schedule.status, "Scheduled");
  assert.equal(schedule.plannedDeviceIds.length, 65);
  assert.equal(schedule.sampledDeviceIds.length, 56);
  assert.equal(schedule.criticalDeviceIds.length, 9);
  assert.equal(schedule.deviceAssignments["LG.SPP.1"].technicianId, "tech2@rmtfire.local");
  assert.equal(schedule.deviceAssignments["GRD.MFAP.1"].technicianId, "tech@rmtfire.local");

  const executablePath = BROWSER_PATHS.find(existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const sessions = [];
    sessions.push(await loginAndInspect(browser, "tech@rmtfire.local"));
    sessions.push(await loginAndInspect(browser, "tech2@rmtfire.local"));
    console.log(JSON.stringify({ ok: true, scheduleId: SCHEDULE_ID, plannedCount: 65, sessions }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
