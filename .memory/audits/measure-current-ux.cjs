const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = "http://127.0.0.1:8026/?overnight-audit=1";
const SCHEDULE_ID = "DEMO-WETEX-RETEST-20260924";
const OUTPUT = join(__dirname, "current-ux-measurements.json");
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const viewports = [
  { name: "small-phone", width: 360, height: 800, mobile: true },
  { name: "normal-phone", width: 390, height: 844, mobile: true },
  { name: "large-phone", width: 430, height: 932, mobile: true },
  { name: "tablet-portrait", width: 768, height: 1024, mobile: true },
  { name: "tablet-landscape", width: 1024, height: 768, mobile: false }
];

async function blockWrites(context) {
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    if (["GET", "HEAD"].includes(request.method())) return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, auditOnly: true })
    });
  });
}

async function login(page) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#loginForm", { timeout: 20000 });
  const loginScreen = await page.evaluate(measurePage);
  await page.evaluate(() => {
    document.querySelector("#loginEmail").value = "tech@rmtfire.local";
    document.querySelector("#loginPassword").value = "read-only-audit";
    document.querySelector("#loginForm").requestSubmit();
  });
  await page.waitForFunction(() => {
    const workspace = document.querySelector("#workspace");
    return workspace && !workspace.classList.contains("hidden");
  }, null, { timeout: 20000 });
  return loginScreen;
}

async function openJob(page) {
  await page.evaluate(() => setTechScreen("jobs"));
  await page.waitForSelector(`[data-tech-start-schedule="${SCHEDULE_ID}"]`, { timeout: 20000 });
  await page.locator(`[data-tech-start-schedule="${SCHEDULE_ID}"]`).click();
  await page.waitForFunction((scheduleId) => {
    const active = getActiveTechnicianMaintenanceSchedule?.();
    return active?.scheduleId === scheduleId;
  }, SCHEDULE_ID, { timeout: 25000 });
}

function measurePage() {
  const visible = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const controls = [...document.querySelectorAll("button, input, select, textarea")].filter(visible);
  const undersized = controls.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      tag: element.tagName,
      text: (element.getAttribute("aria-label") || element.textContent || element.name || "").trim().replace(/\s+/g, " ").slice(0, 80),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }).filter((item) => item.width < 44 || item.height < 44);
  const fixedOrSticky = [...document.querySelectorAll("body *")].filter((element) => {
    if (!visible(element)) return false;
    const position = getComputedStyle(element).position;
    return position === "fixed" || position === "sticky";
  }).length;
  return {
    viewport: { width: innerWidth, height: innerHeight },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    visibleControls: controls.length,
    undersizedCount: undersized.length,
    undersized: undersized.slice(0, 20),
    fixedOrSticky,
    domNodes: document.querySelectorAll("*").length,
    markerCount: document.querySelectorAll(".marker").length,
    assignedMarkerCount: document.querySelectorAll(".marker.assigned-scope").length,
    techScreen: state?.techScreen || "",
    systemKey: state?.activeTechSystemKey || ""
  };
}

async function runViewport(browser, config) {
  const context = await browser.newContext({
    viewport: { width: config.width, height: config.height },
    deviceScaleFactor: config.mobile ? 2 : 1,
    hasTouch: config.mobile,
    isMobile: config.mobile
  });
  await blockWrites(context);
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`));

  const started = Date.now();
  const loginScreen = await login(page);
  const loginReadyMs = Date.now() - started;
  const jobs = await page.evaluate(measurePage);
  await openJob(page);
  const openJobMs = Date.now() - started - loginReadyMs;
  const jobHome = await page.evaluate(measurePage);

  const groups = await page.evaluate((scheduleId) => {
    const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
    return getTechnicianFireSystemGroups(schedule).map((group) => ({ id: group.id, label: group.label }));
  }, SCHEDULE_ID);
  const systems = [];
  for (const group of groups) {
    const systemStart = Date.now();
    await page.evaluate(async ({ scheduleId, systemId }) => openTechnicianFireSystem(scheduleId, systemId), {
      scheduleId: SCHEDULE_ID,
      systemId: group.id
    });
    await page.waitForTimeout(200);
    systems.push({ ...group, openMs: Date.now() - systemStart, ...(await page.evaluate(measurePage)) });
    await page.evaluate(() => showTechnicianSystemList());
  }

  const fireAlarm = groups.find((group) => group.id === "fire-alarm");
  let mimic = null;
  if (fireAlarm) {
    await page.evaluate(async ({ scheduleId, systemId }) => openTechnicianFireSystem(scheduleId, systemId), {
      scheduleId: SCHEDULE_ID,
      systemId: fireAlarm.id
    });
    await page.evaluate(async ({ scheduleId, systemId }) => focusTechnicianSystemMimic(scheduleId, systemId, {
      scroll: false,
      skipDirtyCheck: true
    }), { scheduleId: SCHEDULE_ID, systemId: fireAlarm.id });
    await page.waitForTimeout(250);
    mimic = await page.evaluate(measurePage);
  }

  await context.close();
  return { name: config.name, loginReadyMs, openJobMs, loginScreen, jobs, jobHome, systems, mimic, consoleErrors, failedRequests };
}

async function main() {
  mkdirSync(__dirname, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: EDGE_PATH });
  const results = [];
  for (const viewport of viewports) results.push(await runViewport(browser, viewport));
  await browser.close();
  const output = {
    capturedAt: new Date().toISOString(),
    appUrl: APP_URL,
    scheduleId: SCHEDULE_ID,
    writeRequestsBlocked: true,
    results
  };
  writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
