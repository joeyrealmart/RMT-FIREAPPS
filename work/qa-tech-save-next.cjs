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
  await page.addInitScript(() => {
    localStorage.setItem("rmtCriticalSops", JSON.stringify({
      "fire-alarm-tripping-sop::G.MFAP.1": {
        templateId: "fire-alarm-tripping-sop",
        title: "Fire Alarm / Tripping SOP",
        deviceTag: "G.MFAP.1",
        steps: {
          0: { confirmed: true, remark: "QA permission confirmed" },
          1: { confirmed: true, reading: "Addressable / normal", remark: "" },
          2: { confirmed: true, photo: "QA before photo" },
          3: { confirmed: true, choice: "Silence/Test Mode Set" },
          4: { confirmed: true, photo: "QA tripping isolated photo" },
          5: { confirmed: true, choice: "27V" },
          6: { confirmed: true, choice: "Pass" },
          7: { confirmed: true, choice: "Pass" },
          8: { confirmed: true, choice: "Confirmed and Tested", supervisor: "QA Supervisor", remark: "QA FM confirmed" },
          9: { confirmed: true, photo: "QA restore photo", supervisor: "QA Supervisor", remark: "QA restored normal" },
          10: { confirmed: true, remark: "QA client informed" }
        },
        savedAt: new Date().toISOString(),
        savedBy: "QA"
      }
    }));
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

  const firstNormalDeviceId = await page.$$eval("#techAssignedItemList [data-tech-item-card]", (cards) => {
    const criticalWords = ["co2", "fm200", "gas release", "wet chemical", "mfap", "hrp", "spp", "wrp", "php", "pump panel", "fire pump"];
    const card = cards.find((item) => !criticalWords.some((word) => item.textContent.toLowerCase().includes(word)));
    return card?.dataset.techItemCard || "";
  });
  assert(firstNormalDeviceId, "No normal assigned device found for Save & Next test");

  await page.$$eval("#techAssignedItemList [data-tech-item-card]", (cards, id) => {
    const card = cards.find((item) => item.dataset.techItemCard === id);
    card?.querySelector("[data-tech-open-device]")?.click();
  }, firstNormalDeviceId);
  await page.waitForSelector("#checklistForm:not(.hidden)");

  const firstDeviceName = (await page.textContent("#deviceName")).trim();
  assert(firstDeviceName === firstNormalDeviceId, "Opened checklist did not match selected assigned device");
  assert(await page.locator("#saveNextInspectionBtn").isVisible(), "Save & Next Item button is not visible");

  await page.click("#saveNextInspectionBtn");
  await page.waitForFunction((previousName) => {
    const normalName = document.querySelector("#checklistForm:not(.hidden) #deviceName")?.textContent.trim();
    const criticalHeading = document.querySelector(".critical-sop-active #criticalSopPanel h2")?.textContent.trim();
    return Boolean((normalName && normalName !== previousName) || criticalHeading);
  }, firstDeviceName);

  const nextNormalName = await page.locator("#checklistForm:not(.hidden) #deviceName").count()
    ? (await page.textContent("#deviceName")).trim()
    : "";
  const nextCriticalName = await page.locator(".critical-sop-active #criticalSopPanel h2").count()
    ? (await page.textContent("#criticalSopPanel h2")).trim()
    : "";

  console.log(JSON.stringify({
    firstDeviceName,
    nextOpened: nextNormalName || nextCriticalName,
    consoleErrors
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
