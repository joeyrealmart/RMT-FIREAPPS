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

async function loginAsTech(page) {
  await page.evaluate((password) => {
    const emailInput = document.querySelector("#loginEmail");
    const passwordInput = document.querySelector("#loginPassword");
    if (!emailInput || !passwordInput) throw new Error("Login inputs are not available");
    emailInput.value = "tech@rmtfire.local";
    passwordInput.value = password;
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#loginForm")?.requestSubmit();
  }, new Date().toISOString());
  await page.waitForSelector("#workspace.technician-mode");
}

(async () => {
  const executablePath = EDGE_PATHS.find((item) => existsSync(item));
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
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
  await loginAsTech(page);
  await page.waitForSelector("#techAssignedJobs [data-tech-start-schedule]");

  const startButton = page.locator(".tech-job-card", { hasText: "UOB" }).locator("[data-tech-start-schedule]").first();
  await startButton.click();
  await page.waitForFunction(() => Boolean(JSON.parse(localStorage.getItem("rmtActiveJob") || "null")));
  await page.waitForFunction(() => document.querySelector("#clearActiveJobBtn")?.classList.contains("hidden"));
  await page.reload({ waitUntil: "networkidle" });
  await loginAsTech(page);
  await page.waitForFunction(() => {
    const activeJob = JSON.parse(localStorage.getItem("rmtActiveJob") || "null");
    return activeJob?.schedule?.companyName === "UOB" && activeJob.status !== "Completed";
  });

  const result = await page.evaluate(() => {
    const activeJob = JSON.parse(localStorage.getItem("rmtActiveJob") || "null");
    return {
      activeCompany: activeJob?.schedule?.companyName,
      resetButtonHidden: document.querySelector("#clearActiveJobBtn")?.classList.contains("hidden"),
      syncState: document.querySelector("#syncState")?.textContent
    };
  });

  assert(result.activeCompany === "UOB", "UOB job was not active after reload and technician re-login");
  assert(result.resetButtonHidden === true, "Unlock/reset button should stay hidden for technician role");
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
