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
  const alreadyLoggedIn = await page.locator("#workspace.technician-mode").isVisible().catch(() => false);
  if (alreadyLoggedIn) return;
  const demoButton = page.locator("[data-demo-login='tech']");
  if (await demoButton.isVisible().catch(() => false)) {
    await page.evaluate(() => document.querySelector("[data-demo-login='tech']")?.click());
  }
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
  try {
    await page.waitForFunction(() => {
      const workspace = document.querySelector("#workspace");
      return Boolean(workspace && !workspace.classList.contains("hidden") && workspace.classList.contains("technician-mode"));
    }, null, { timeout: 30000 });
  } catch (error) {
    const debug = await page.evaluate(() => ({
      loginHidden: document.querySelector("#loginScreen")?.classList.contains("hidden"),
      workspaceClass: document.querySelector("#workspace")?.className || "",
      currentUserBadge: document.querySelector("#currentUserBadge")?.textContent.trim() || "",
      loginError: document.querySelector("#loginError")?.textContent.trim() || "",
      email: document.querySelector("#loginEmail")?.value || ""
    }));
    throw new Error(`Technician login did not open workspace: ${JSON.stringify(debug, null, 2)}`);
  }
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
    body: JSON.stringify({ ok: true, runKey: "qa-start-unlock" })
  }));
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("rmtActiveJob");
    localStorage.removeItem("tmFireInspections");
    localStorage.removeItem("rmtCriticalSops");
    localStorage.removeItem("rmtSystemChecks");
    localStorage.removeItem("tmFireRequests");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await loginAsTech(page);
  const scheduleId = await page.evaluate(() => {
    const profile = {
      companyName: "QA Start Unlock",
      siteName: "QA Start Unlock"
    };
    const floor = {
      id: "qa-start-unlock-l1",
      floorId: "qa-start-unlock-l1",
      title: "QA Start Unlock L1",
      floorCode: "L1",
      companyName: profile.companyName,
      siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src,
      cleanSrc: defaultFloorAssets.lv1.src,
      active: true
    };
    const device = {
      tag: "QA.START.UNLOCK.EL1",
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
    state.activeJob = null;
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
      scheduleId: "QA-START-UNLOCK",
      status: "Scheduled",
      companyName: profile.companyName,
      siteName: profile.siteName,
      floorId: floor.id,
      startFloorId: floor.id,
      floorTitle: floor.title,
      serviceType: "Maintenance / Inspection",
      scope: "full-maintenance",
      scopeLabel: "QA Start Unlock",
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
    writeStoredJson("rmtActiveJob", null);
    writeStoredJson("rmtMimicFloors", state.mimicFloors);
    writeStoredJson("tmFireSetupDevices", state.setupDevices);
    writeStoredJson("rmtSchedules", state.schedules);
    selectClientProfile(profile);
    renderTechWorkPanel();
    return schedule.scheduleId;
  });
  await page.waitForSelector(`[data-tech-start-schedule="${scheduleId}"]`, { timeout: 30000 });

  await page.evaluate((id) => document.querySelector(`[data-tech-start-schedule="${CSS.escape(id)}"]`)?.click(), scheduleId);
  await page.waitForFunction((id) => JSON.parse(localStorage.getItem("rmtActiveJob") || "null")?.scheduleId === id, scheduleId, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector("#clearActiveJobBtn")?.classList.contains("hidden"), null, { timeout: 30000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await loginAsTech(page);
  await page.waitForFunction((id) => {
    const activeJob = JSON.parse(localStorage.getItem("rmtActiveJob") || "null");
    return activeJob?.scheduleId === id && activeJob.status !== "Completed";
  }, scheduleId, { timeout: 30000 });

  const result = await page.evaluate(() => {
    const activeJob = JSON.parse(localStorage.getItem("rmtActiveJob") || "null");
    return {
      activeCompany: activeJob?.schedule?.companyName,
      resetButtonHidden: document.querySelector("#clearActiveJobBtn")?.classList.contains("hidden"),
      syncState: document.querySelector("#syncState")?.textContent
    };
  });

  assert(result.activeCompany === "QA Start Unlock", "QA job was not active after reload and technician re-login");
  assert(result.resetButtonHidden === true, "Unlock/reset button should stay hidden for technician role");
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
