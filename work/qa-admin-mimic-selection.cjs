const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?qa=admin-mimic-selection";
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fixtureSrc(label, color) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="100%" height="100%" fill="${color}"/><text x="40" y="100" font-size="48" fill="white">${label}</text></svg>`)}`;
}

function launchOptions() {
  const fs = require("node:fs");
  const executablePath = EDGE_PATHS.find((path) => fs.existsSync(path));
  return executablePath ? { executablePath, headless: true } : { headless: true };
}

async function login(page) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", "admin@rmtfire.local");
  await page.fill("#loginPassword", "admin-mimic-selection-qa");
  await page.locator("#loginForm button[type='submit']").click();
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("admin-mode"), null, { timeout: 20000 });
}

async function selectMimic(page, client, site, floor) {
  await page.locator("#adminMimicClientSelect").selectOption({ label: client });
  await page.locator("#adminMimicSiteSelect").selectOption({ label: site });
  await page.locator("#adminMimicFloorSelect").selectOption({ label: floor });
}

(async () => {
  const fixtures = [
    { id: "qa-mtb-ground", companyName: "MTB QA", siteName: "MTB Site A", floorCode: "G", floorName: "Ground Floor", title: "Ground Floor", fileName: "qa-mtb-ground-background.svg", src: fixtureSrc("QA-MTB-GROUND", "#8b1d27") },
    { id: "qa-mtb-l1", companyName: "MTB QA", siteName: "MTB Site A", floorCode: "L1", floorName: "Level 1", title: "Level 1", fileName: "qa-mtb-level-1-background.svg", src: fixtureSrc("QA-MTB-L1", "#942a36") },
    { id: "qa-uob-ground", companyName: "UOB QA", siteName: "UOB Site B", floorCode: "G", floorName: "Ground Floor", title: "Ground Floor", fileName: "qa-uob-ground-background.svg", src: fixtureSrc("QA-UOB-GROUND", "#1f4f8b") },
    { id: "qa-ltk-ground", companyName: "LTK QA", siteName: "LTK Site C", floorCode: "G", floorName: "Ground Floor", title: "Ground Floor", fileName: "qa-ltk-ground-background.svg", src: fixtureSrc("QA-LTK-GROUND", "#2c6d4e") },
    { id: "qa-empty-ground", companyName: "EMPTY QA", siteName: "Empty Site", floorCode: "G", floorName: "Ground Floor", title: "Ground Floor", fileName: "", src: "" }
  ];
  const browser = await chromium.launch(launchOptions());
  const context = await browser.newContext({ viewport: { width: 1280, height: 840 } });
  await context.addInitScript((seed) => {
    if (!localStorage.getItem("rmtMimicFloors")) localStorage.setItem("rmtMimicFloors", JSON.stringify(seed));
  }, fixtures);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await login(page);
    await page.locator("#adminMainNav [data-admin-module='mimics']").click();
    await page.waitForSelector("#adminMimicClientSelect option", { state: "attached", timeout: 20000 });

    const clients = await page.locator("#adminMimicClientSelect option").allTextContents();
    ["MTB QA", "UOB QA", "LTK QA"].forEach((name) => assert(clients.includes(name), `${name} should be selectable in Admin Mimics.`));

    await selectMimic(page, "MTB QA", "MTB Site A", "Ground Floor");
    await page.locator("#adminOpenMimicBtn").click();
    await page.waitForFunction(() => document.querySelector("#mapImage")?.getAttribute("src")?.includes("QA-MTB-GROUND"));
    assert(await page.locator("#mapImage").getAttribute("src").then((src) => src.includes("QA-MTB-GROUND")), "MTB must open its own selected background.");

    await page.locator("#adminMimicFloorSelect").selectOption({ label: "Level 1" });
    await page.locator("#adminOpenMimicBtn").click();
    await page.waitForFunction(() => document.querySelector("#mapImage")?.getAttribute("src")?.includes("QA-MTB-L1"));

    await selectMimic(page, "UOB QA", "UOB Site B", "Ground Floor");
    await page.locator("#adminOpenMimicBtn").click();
    await page.waitForFunction(() => document.querySelector("#mapImage")?.getAttribute("src")?.includes("QA-UOB-GROUND"));
    assert(await page.locator("#adminMimicSelectionStatus").innerText().then((text) => text.includes("UOB QA / UOB Site B")), "Selection status should identify the active client, site and floor.");

    const deviceStoreBefore = await page.evaluate(() => localStorage.getItem("tmFireSetupDevices"));
    await selectMimic(page, "LTK QA", "LTK Site C", "Ground Floor");
    await page.locator("#adminOpenMimicBtn").click();
    await page.waitForFunction(() => document.querySelector("#mapImage")?.getAttribute("src")?.includes("QA-LTK-GROUND"));
    assert(await page.locator("#markersLayer").count() === 1, "The existing marker layer must remain present beside the selected background.");
    assert(await page.evaluate(() => localStorage.getItem("tmFireSetupDevices")) === deviceStoreBefore, "Changing a background must not mutate the device-pin store.");

    await selectMimic(page, "EMPTY QA", "Empty Site", "Ground Floor");
    assert(await page.locator("#adminOpenMimicBtn").isDisabled(), "A floor without a background must not open a fallback map.");
    assert((await page.locator("#adminMimicSelectionStatus").innerText()).includes("No mimic available for this floor"), "Missing backgrounds need an explicit empty state.");

    await selectMimic(page, "UOB QA", "UOB Site B", "Ground Floor");
    await page.locator("#adminOpenMimicBtn").click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("admin-mode"), null, { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector("#adminMimicClientSelect")?.value === "UOB QA", null, { timeout: 20000 });
    assert(await page.locator("#adminMimicSiteSelect").inputValue() === "UOB Site B", "Selected mimic site should persist after refresh.");
    assert(await page.locator("#adminMimicFloorSelect").inputValue() === "qa-uob-ground", "Selected mimic floor should persist after refresh.");

    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    assert(dimensions.scrollWidth <= dimensions.clientWidth + 2, "Admin Mimics has horizontal overflow.");
    assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(" | ")}`);
    console.log("PASS qa-admin-mimic-selection");
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
