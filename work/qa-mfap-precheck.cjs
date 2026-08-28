const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = "http://127.0.0.1:8026/?fresh=20260820-mfap-precheck";
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

  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.click("[data-demo-login='tech']");
  await page.fill("#loginPassword", new Date().toISOString());
  await page.click("#loginForm button[type='submit']");
  await page.waitForSelector("#workspace.technician-mode");
  await page.waitForSelector("#techAssignedJobs [data-tech-view-schedule]");

  const uobViewButton = page.locator(".tech-job-card", { hasText: "UOB" }).locator("[data-tech-view-schedule]").first();
  await uobViewButton.click();
  await page.waitForSelector("#techAssignedItemList [data-tech-item-card]");

  const normalDeviceId = await page.$$eval("#techAssignedItemList [data-tech-item-card]", (cards) => {
    const card = cards.find((item) => item.dataset.techItemCard !== "G.MFAP.1");
    return card?.dataset.techItemCard || "";
  });
  assert(normalDeviceId, "No non-MFAP device found for pre-check gate test");

  await page.$$eval("#techAssignedItemList [data-tech-item-card]", (cards, id) => {
    const card = cards.find((item) => item.dataset.techItemCard === id);
    card?.querySelector("[data-tech-open-device]")?.click();
  }, normalDeviceId);

  await page.waitForSelector(".critical-sop-active #criticalSopPanel");
  const heading = (await page.textContent("#criticalSopPanel h2")).trim();
  assert(heading.includes("G.MFAP.1"), `Expected MFAP pre-check, got ${heading}`);

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
    attemptedNormalDevice: normalDeviceId,
    opened: heading,
    mfapStepCount: stepCount,
    step6Choices,
    consoleErrors
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
