const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?tech-nav-review=1";
const SCHEDULE_ID = "DEMO-WETEX-RETEST-20260924";
const ROOT = join(__dirname, "..", "docs", "reviews", "technician-nav");
const CURRENT_DIR = join(ROOT, "screenshots", "current");
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

function ensureDirs() {
  mkdirSync(CURRENT_DIR, { recursive: true });
}

async function blockWrites(context) {
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() === "GET" || request.method() === "HEAD") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, reviewOnly: true })
    });
  });
}

async function login(page) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#loginForm", { timeout: 20000 });
  await page.evaluate(() => {
    document.querySelector("#loginEmail").value = "tech@rmtfire.local";
    document.querySelector("#loginPassword").value = `tech-nav-review-${Date.now()}`;
    document.querySelector("#loginForm").requestSubmit();
  });
  await page.waitForFunction(() => {
    const workspace = document.querySelector("#workspace");
    return workspace && !workspace.classList.contains("hidden");
  }, null, { timeout: 20000 });
}

async function openExactJob(page) {
  await page.evaluate(() => setTechScreen("jobs"));
  await page.waitForSelector(`[data-tech-start-schedule="${SCHEDULE_ID}"]`, { timeout: 20000 });
  await page.locator(`[data-tech-start-schedule="${SCHEDULE_ID}"]`).click();
  await page.waitForFunction((scheduleId) => {
    const active = getActiveTechnicianMaintenanceSchedule?.();
    return active?.scheduleId === scheduleId
      && document.querySelectorAll("#techActiveJobSummary [data-tech-system]").length > 0;
  }, SCHEDULE_ID, { timeout: 25000 });
}

async function screenshot(page, name, locator = null) {
  if (locator) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.screenshot({ path: join(CURRENT_DIR, name) });
    return;
  }
  await page.screenshot({ path: join(CURRENT_DIR, name), fullPage: false });
}

async function getInventory(page) {
  return page.evaluate((scheduleId) => {
    const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
    const groups = getTechnicianFireSystemGroups(schedule);
    const touchTargets = [...document.querySelectorAll("#techActiveJobSummary button, #techSystemStagePanel button")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          text: element.textContent.trim().replace(/\s+/g, " ").slice(0, 100),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      });
    return {
      scheduleId,
      plannedCount: schedule?.plannedDeviceIds?.length || 0,
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        height: document.documentElement.scrollHeight,
        width: document.documentElement.scrollWidth
      },
      groups: groups.map((group) => ({
        id: group.id,
        label: group.label,
        done: group.summary.done,
        total: group.summary.total,
        parents: group.parentDevices.map((device) => device.tag),
        fieldTypes: [...new Set(group.fieldDevices.map((device) => device.type || device.deviceType || "Unknown"))].sort(),
        fieldCount: group.fieldDevices.length,
        stageStatuses: group.stageModel.stages.map((stage) => ({ title: stage.title, status: stage.status }))
      })),
      touchTargets,
      undersizedTouchTargets: touchTargets.filter((target) => target.width < 44 || target.height < 44)
    };
  }, SCHEDULE_ID);
}

async function openSystem(page, systemId) {
  await page.evaluate(async ({ scheduleId, systemId }) => {
    await openTechnicianFireSystem(scheduleId, systemId);
  }, { scheduleId: SCHEDULE_ID, systemId });
  await page.waitForTimeout(500);
  return page.evaluate(() => ({
    screen: state.techScreen,
    systemKey: state.activeTechSystemKey,
    scrollY: Math.round(scrollY),
    stageText: document.querySelector("#techSystemStagePanel")?.textContent.trim().replace(/\s+/g, " ") || "",
    inspectionVisible: !document.querySelector("#techInspectionPanel")?.classList.contains("hidden"),
    mimicVisible: document.querySelector("#workspace")?.classList.contains("tech-screen-mimic"),
    markerCount: document.querySelectorAll(".marker.assigned-scope").length
  }));
}

async function main() {
  ensureDirs();
  const browser = await chromium.launch({ headless: true, executablePath: EDGE_PATH });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true
  });
  await blockWrites(context);
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`));

  await login(page);
  await page.evaluate(() => setTechScreen("jobs"));
  await screenshot(page, "01-job-home.png");
  await openExactJob(page);
  await screenshot(page, "02-system-selection.png", page.locator("#techActiveJobSummary"));

  const inventory = await getInventory(page);
  const routes = [];
  for (const group of inventory.groups) {
    const route = await openSystem(page, group.id);
    routes.push({ id: group.id, label: group.label, ...route });
    const safe = group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await screenshot(page, `system-${safe}.png`);
    await page.evaluate(() => showTechnicianSystemList());
    await page.waitForTimeout(150);
  }

  const fireAlarm = inventory.groups.find((group) => group.id === "fire-alarm");
  if (fireAlarm) {
    await openSystem(page, fireAlarm.id);
    await screenshot(page, "11-checklist-active.png");
    await page.evaluate(async ({ scheduleId, systemId }) => {
      await focusTechnicianSystemMimic(scheduleId, systemId, { scroll: true, skipDirtyCheck: true });
    }, { scheduleId: SCHEDULE_ID, systemId: fireAlarm.id });
    await page.waitForTimeout(350);
    await screenshot(page, "12-mimic-active.png");
  }

  const result = {
    capturedAt: new Date().toISOString(),
    appUrl: APP_URL,
    inventory,
    routes,
    consoleErrors,
    failedRequests
  };
  writeFileSync(join(ROOT, "field-measurements.json"), `${JSON.stringify(result, null, 2)}\n`);
  await browser.close();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
