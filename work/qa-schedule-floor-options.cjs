const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { existsSync } = require("node:fs");

const APP_URL = "http://127.0.0.1:8026/?fresh=20260820-floor-client";
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function setSelectByText(page, selector, textPart) {
  const value = await page.$eval(selector, (select, needle) => {
    const option = [...select.options].find((item) => item.textContent.toLowerCase().includes(String(needle).toLowerCase()));
    return option?.value || "";
  }, textPart);
  assert(value, `No option containing "${textPart}" found for ${selector}`);
  await page.selectOption(selector, value);
  await page.dispatchEvent(selector, "change");
  return value;
}

async function setSelectValue(page, selector, value) {
  await page.selectOption(selector, value);
  await page.dispatchEvent(selector, "change");
}

async function getOptionTexts(page, selector) {
  return page.$$eval(`${selector} option`, (options) => options.map((option) => option.textContent.trim()));
}

(async () => {
  const executablePath = EDGE_PATHS.find((item) => existsSync(item));
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const consoleErrors = [];
  const missingResources = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      missingResources.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.addInitScript(() => {
    localStorage.removeItem("rmtCurrentUser");
  });
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  if (await page.locator("#loginView:not(.hidden)").count()) {
    await page.click("[data-demo-login='admin']");
    await page.fill("#loginPassword", new Date().toISOString());
    await page.click("#loginForm button[type='submit']");
  }
  await page.waitForSelector("#workspace.admin-mode");
  await page.waitForSelector("#schedulePanel");
  await page.waitForFunction(() => {
    const labels = [...(document.querySelector("#scheduleClientSite")?.options || [])]
      .map((option) => option.textContent.trim().toLowerCase());
    return labels.some((label) => label.includes("wetex"))
      && labels.some((label) => label.includes("uob"))
      && labels.some((label) => label.includes("mtb"));
  });

  await setSelectValue(page, "#scheduleClientMode", "existing");
  const scheduleClientOptions = await getOptionTexts(page, "#scheduleClientSite");
  assert(scheduleClientOptions.some((text) => text.includes("WETEX")), "Schedule clients should include WETEX");
  assert(scheduleClientOptions.some((text) => text.includes("UOB")), "Schedule clients should include UOB");
  assert(scheduleClientOptions.some((text) => text.toLowerCase().includes("mtb")), "Schedule clients should include MTB");
  assert(!scheduleClientOptions.some((text) => /themofisher|wetex parade|qa shared records|umb-1|tokura/i.test(text)), "Schedule clients should hide incomplete/demo clients");
  const schedulePageText = await page.locator("#schedulePanel").textContent();
  assert(!/QA Shared Records/i.test(schedulePageText), "Schedule page should hide QA/demo maintenance schedules");

  await setSelectByText(page, "#scheduleClientSite", "WETEX");
  await setSelectByText(page, "#scheduleServiceType", "Maintenance");
  await setSelectValue(page, "#scheduleScope", "full-maintenance");
  const wetexFloors = await getOptionTexts(page, "#scheduleFloor");
  assert(wetexFloors.length > 1, "WETEX should have multiple floor choices");
  assert(wetexFloors.some((text) => text.toLowerCase().includes("wetex")), "WETEX floor options should mention WETEX");

  await setSelectByText(page, "#scheduleClientSite", "UOB");
  const uobFloors = await getOptionTexts(page, "#scheduleFloor");
  assert(uobFloors.length >= 1, "UOB should have at least one floor choice");
  assert(!uobFloors.every((text) => text.toLowerCase().includes("wetex")), "UOB floor options must not stay as WETEX only");

  await setSelectByText(page, "#scheduleClientSite", "MTB");
  const mtbFloors = await getOptionTexts(page, "#scheduleFloor");
  assert(mtbFloors.length > 1, "MTB should have multiple floor choices");
  assert(mtbFloors.some((text) => text.toLowerCase().includes("mtb")), "MTB floor options should mention MTB");

  await setSelectValue(page, "#scheduleClientMode", "new");
  await page.fill("#scheduleManualClient", "One Time Customer");
  await page.fill("#scheduleManualPlace", "Factory Visit");
  await page.dispatchEvent("#scheduleManualClient", "input");
  const newClientFloors = await getOptionTexts(page, "#scheduleFloor");
  assert(newClientFloors.length === 1 && newClientFloors[0].includes("General / TBC"), "New client should use General / TBC start floor");

  await setSelectValue(page, "#scheduleClientMode", "existing");
  await setSelectByText(page, "#scheduleClientSite", "WETEX");
  await setSelectByText(page, "#scheduleServiceType", "Fire Extinguisher Collection");
  const extinguisherFloors = await getOptionTexts(page, "#scheduleFloor");
  assert(extinguisherFloors.length === 1 && extinguisherFloors[0].includes("General / TBC"), "Extinguisher collection should use General / TBC start floor");

  console.log(JSON.stringify({
    wetexFloors: wetexFloors.slice(0, 5),
    uobFloors: uobFloors.slice(0, 5),
    mtbFloors: mtbFloors.slice(0, 5),
    newClientFloors,
    extinguisherFloors,
    consoleErrors,
    missingResources
  }, null, 2));

  await browser.close();
})().catch(async (error) => {
  console.error(error.message);
  process.exit(1);
});
