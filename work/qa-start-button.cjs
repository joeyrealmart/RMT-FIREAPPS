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
  await page.waitForSelector("#techAssignedJobs [data-tech-start-schedule]");

  const startButton = page.locator(".tech-job-card", { hasText: "UOB" }).locator("[data-tech-start-schedule]").first();
  await startButton.click();
  await page.waitForFunction(() => {
    return Boolean(JSON.parse(localStorage.getItem("rmtActiveJob") || "null"));
  });
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
