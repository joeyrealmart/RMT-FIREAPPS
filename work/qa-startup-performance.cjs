const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { chromium, devices } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260831-startup-performance";
const OUTPUT_DIR = join(__dirname, "..", "outputs", "fire-inspection-mvp", "performance-qa");
const ROOT = join(__dirname, "..");
const UOB_MASTER = join(ROOT, "outputs", "rmt-fire-local-data", "device-master", "uob-uob-device-master.json");
const MIMIC_MANIFEST = join(ROOT, "outputs", "rmt-fire-local-data", "mimic-library", "mimic-library-app-data.json");
const STRESS_STORAGE = process.argv.includes("--stress-storage");
const REPORT_ONLY = process.argv.includes("--report-only");
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function countRecords(value) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== "object") return 0;
  if (Array.isArray(value.devices)) return value.devices.length;
  if (Array.isArray(value.floors)) return value.floors.length;
  if (Array.isArray(value.schedules)) return value.schedules.length;
  return Object.keys(value).length;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildUobFixture() {
  const master = readJson(UOB_MASTER);
  const manifest = readJson(MIMIC_MANIFEST);
  const uobFloor = (manifest.floors || []).find((floor) => floor.companyName === "UOB" && floor.siteName === "UOB" && /Page 1/i.test(floor.title || floor.floorName || ""))
    || (manifest.floors || []).find((floor) => floor.companyName === "UOB" && floor.siteName === "UOB");
  const fireAlarmTypes = new Set(["Main Fire Alarm Panel", "Manual Call Point", "Break Glass", "Smoke Detector", "Heat Detector", "Flow Switch"]);
  const devices = (master.devices || [])
    .filter((device) => fireAlarmTypes.has(device.type))
    .filter((device) => /Page 1/i.test(device.floor || "") || /G\.|GROUND|UOB\.TEST/i.test(device.tag || ""))
    .slice(0, 24);
  assert(uobFloor, "UOB floor fixture was not found.");
  assert(devices.length >= 4, "UOB device fixture does not contain enough fire-alarm devices.");
  const plannedDeviceIds = devices.map((device) => device.tag);
  const schedule = {
    scheduleId: "QA-PERF-UOB",
    status: "In Progress",
    companyName: "UOB",
    siteName: "UOB",
    clientSource: "Existing Client",
    floorId: uobFloor.id || uobFloor.floorId,
    floorTitle: uobFloor.title || "UOB - Page 1",
    floorCode: uobFloor.floorCode || "P1",
    startFloorId: uobFloor.id || uobFloor.floorId,
    startFloorTitle: uobFloor.title || "UOB - Page 1",
    date: todayDate(),
    time: "09:00",
    technician: "Technician Pool",
    serviceType: "Maintenance / Inspection",
    scope: "fire-alarm",
    scopeLabel: "UOB Performance Fire Alarm",
    scopeSelectionMode: "selected-floor",
    contractFrequencyPercent: 100,
    plannedDeviceIds,
    plannedFloorCounts: [{ floorId: uobFloor.id || uobFloor.floorId, floorTitle: uobFloor.title || "UOB - Page 1", count: plannedDeviceIds.length }],
    priority: "Normal",
    notes: "Startup performance regression fixture.",
    deviceCount: plannedDeviceIds.length,
    totalFloorDeviceCount: plannedDeviceIds.length,
    passiveCount: plannedDeviceIds.length,
    activeCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return { schedule, plannedDeviceIds };
}

function buildStressStorage(schedule) {
  if (!STRESS_STORAGE) return {};
  const photoData = `data:image/jpeg;base64,${"A".repeat(30000)}`;
  const inspections = {};
  for (let index = 0; index < 8; index += 1) {
    inspections[`OLD.PHOTO.${index + 1}`] = {
      status: index % 3 === 0 ? "fail" : "pass",
      notes: "Old cached photo-heavy inspection used only for startup performance stress testing.",
      beforePhotoData: photoData,
      afterPhotoData: photoData,
      inspectedAt: new Date().toISOString(),
      inspectedBy: "Performance Fixture"
    };
  }
  const sharedRecords = {};
  for (let index = 0; index < 3; index += 1) {
    const scheduleId = `OLD-SHARED-${index + 1}`;
    sharedRecords[scheduleId] = {
      online: true,
      loadedAt: new Date().toISOString(),
      store: {
        schemaVersion: "shared-records-v1",
        scheduleId,
        scheduleSnapshot: schedule,
        inspectionRecords: inspections,
        criticalSopRecords: {},
        itemClaims: {}
      },
      progress: { total: 8, done: 8, pass: 5, fail: 3, pending: 0, partial: 0, blocked: 0, ready: true }
    };
  }
  return {
    tmFireInspections: inspections,
    rmtSharedJobRecords: sharedRecords,
    tmFireHistory: inspections,
    rmtJobHistory: Object.values(inspections),
    rmtCriticalSops: {}
  };
}

function installPerfInstrumentation(fixture) {
  const stressStorage = buildStressStorage(fixture.schedule);
  const schedule = fixture.schedule;
  return ({ schedule, stressStorage }) => {
    window.__rmtPerf = {
      storageOps: [],
      parseOps: [],
      fetches: [],
      longTasks: [],
      marks: {},
      counters: {}
    };
    const seed = {
      rmtSchedules: [schedule],
      rmtActiveJob: null,
      rmtCurrentUser: null,
      tmFireRequests: [],
      rmtSystemChecks: {},
      rmtCriticalSops: {},
      ...stressStorage
    };
    if (!sessionStorage.getItem("rmtPerfStorageSeeded")) {
      localStorage.clear();
      Object.entries(seed).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      });
      sessionStorage.setItem("rmtPerfStorageSeeded", "1");
    }

    const originalParse = JSON.parse;
    JSON.parse = function patchedJsonParse(value, ...rest) {
      const started = performance.now();
      const result = originalParse.call(this, value, ...rest);
      const ms = performance.now() - started;
      if (typeof value === "string" && value.length > 1000) {
        window.__rmtPerf.parseOps.push({
          bytes: value.length * 2,
          ms,
          records: Array.isArray(result) ? result.length : result && typeof result === "object" ? Object.keys(result).length : 0
        });
      }
      return result;
    };

    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function patchedGetItem(key) {
      const started = performance.now();
      const value = originalGetItem.call(this, key);
      window.__rmtPerf.storageOps.push({ op: "get", key, bytes: value ? value.length * 2 : 0, ms: performance.now() - started });
      return value;
    };
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      const started = performance.now();
      const result = originalSetItem.call(this, key, value);
      window.__rmtPerf.storageOps.push({ op: "set", key, bytes: value ? String(value).length * 2 : 0, ms: performance.now() - started });
      return result;
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const started = performance.now();
      const url = String(args[0]?.url || args[0] || "");
      try {
        const response = await originalFetch(...args);
        window.__rmtPerf.fetches.push({ url, status: response.status, ms: performance.now() - started });
        return response;
      } catch (error) {
        window.__rmtPerf.fetches.push({ url, error: error.message, ms: performance.now() - started });
        throw error;
      }
    };

    try {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          window.__rmtPerf.longTasks.push({ name: entry.name, duration: entry.duration, startTime: entry.startTime });
        });
      }).observe({ entryTypes: ["longtask"] });
    } catch (error) {
      window.__rmtPerf.longTaskObserverError = error.message;
    }

    document.addEventListener("DOMContentLoaded", () => {
      window.__rmtPerf.marks.domContentLoaded = performance.now();
    });
    window.addEventListener("load", () => {
      window.__rmtPerf.marks.windowLoad = performance.now();
    });
  };
}

async function loginAsTech(page) {
  const started = await page.evaluate(() => performance.now());
  await page.evaluate(() => {
    const emailInput = document.querySelector("#loginEmail");
    const passwordInput = document.querySelector("#loginPassword");
    emailInput.value = "tech@rmtfire.local";
    passwordInput.value = "performance-test";
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#loginForm").requestSubmit();
  });
  await page.waitForFunction(() => {
    const workspace = document.querySelector("#workspace");
    return Boolean(workspace && !workspace.classList.contains("hidden") && workspace.classList.contains("technician-mode"));
  }, null, { timeout: 20000 });
  await page.waitForSelector(".tech-job-card", { timeout: 20000 });
  return {
    started,
    ready: await page.evaluate(() => performance.now())
  };
}

async function wrapCounters(page) {
  await page.evaluate(() => {
    const names = [
      "renderMarkers",
      "renderSetupMapMarkers",
      "renderTechWorkPanel",
      "renderTechAssignedItemList",
      "renderSchedulePanel",
      "renderJobPanel",
      "renderFloorOptions",
      "syncActiveJobProgressToSchedule",
      "loadScheduleProgressSnapshot",
      "requestSharedJobState",
      "ensureSchedulePlannedScope",
      "getScheduledAssignedDevices",
      "ensureActiveJobCriticalWorkflows",
      "getDeviceCriticalAccessState"
    ];
    window.__rmtPerf.counters = window.__rmtPerf.counters || {};
    names.forEach((name) => {
      const original = window[name];
      if (typeof original !== "function" || original.__rmtPerfWrapped) return;
      const wrapped = function perfWrapped(...args) {
        const started = performance.now();
        try {
          return original.apply(this, args);
        } finally {
          const previous = window.__rmtPerf.counters[name] || { count: 0, ms: 0, maxMs: 0 };
          const ms = performance.now() - started;
          window.__rmtPerf.counters[name] = {
            count: previous.count + 1,
            ms: previous.ms + ms,
            maxMs: Math.max(previous.maxMs, ms)
          };
        }
      };
      wrapped.__rmtPerfWrapped = true;
      window[name] = wrapped;
    });
  });
}

async function openUobToMimic(page) {
  const openStarted = await page.evaluate(() => performance.now());
  const scheduleId = await page.locator(".tech-job-card", { hasText: "UOB" }).first()
    .locator("[data-tech-start-schedule]").first()
    .getAttribute("data-tech-start-schedule");
  assert(scheduleId === "QA-PERF-UOB", `Expected QA-PERF-UOB schedule, got ${scheduleId}`);
  await page.locator(`[data-tech-start-schedule="${scheduleId}"]`).first().click();
  await page.waitForFunction((id) => {
    const activeId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
    return activeId === id && document.querySelectorAll("#techActiveJobSummary [data-tech-system]").length > 0;
  }, scheduleId, { timeout: 20000 });
  const jobReady = await page.evaluate(() => performance.now());
  await page.locator("#techActiveJobSummary [data-tech-system='fire-alarm']").click();
  await page.waitForFunction((id) => {
    const activeId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
    const markerId = getTechMarkerScopeSchedule?.()?.scheduleId || "";
    return activeId === id
      && markerId === id
      && document.querySelector("#workspace")?.classList.contains("tech-screen-mimic")
      && document.querySelectorAll(".marker.assigned-scope").length > 0
      && document.querySelector("#mapImage")?.complete;
  }, scheduleId, { timeout: 30000 });
  const mimicReady = await page.evaluate(() => performance.now());
  return { openStarted, jobReady, mimicReady, scheduleId };
}

async function collectStorageReport(page) {
  return page.evaluate(() => {
    const keys = Object.keys(localStorage)
      .filter((key) => /^(rmt|tmFire)/.test(key))
      .sort();
    return keys.map((key) => {
      const raw = localStorage.getItem(key) || "";
      const started = performance.now();
      let records = 0;
      let type = "string";
      let parseError = "";
      try {
        const parsed = JSON.parse(raw);
        type = Array.isArray(parsed) ? "array" : parsed && typeof parsed === "object" ? "object" : typeof parsed;
        records = Array.isArray(parsed) ? parsed.length : parsed && typeof parsed === "object" ? Object.keys(parsed).length : 0;
      } catch (error) {
        parseError = error.message;
      }
      return {
        key,
        bytes: raw.length * 2,
        records,
        type,
        parseMs: performance.now() - started,
        parseError
      };
    }).sort((a, b) => b.bytes - a.bytes);
  });
}

async function collectPerf(page) {
  const storage = await collectStorageReport(page);
  const runtime = await page.evaluate(() => ({
    marks: window.__rmtPerf?.marks || {},
    counters: window.__rmtPerf?.counters || {},
    fetches: window.__rmtPerf?.fetches || [],
    storageOps: window.__rmtPerf?.storageOps || [],
    parseOps: window.__rmtPerf?.parseOps || [],
    longTasks: window.__rmtPerf?.longTasks || [],
    domNodes: document.querySelectorAll("*").length,
    markerCount: document.querySelectorAll(".marker").length,
    assignedMarkerCount: document.querySelectorAll(".marker.assigned-scope").length,
    currentUser: state.currentUser ? { name: state.currentUser.name, role: state.currentUser.role } : null,
    activeJob: state.activeJob ? {
      scheduleId: state.activeJob.scheduleId || state.activeJob.schedule?.scheduleId || "",
      companyName: state.activeJob.companyName,
      status: state.activeJob.status
    } : null,
    techScreen: [...document.querySelector("#workspace")?.classList || []].filter((name) => name.startsWith("tech-screen-")).join(" "),
    mapTitle: document.querySelector("#mapTitle")?.textContent.trim() || "",
    loginVisible: !document.querySelector("#loginView")?.classList.contains("hidden"),
    workspaceVisible: !document.querySelector("#workspace")?.classList.contains("hidden")
  }));
  return { ...runtime, localStorage: storage };
}

(async () => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const executablePath = EDGE_PATHS.find((item) => existsSync(item));
  const fixture = buildUobFixture();
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ ...devices["Pixel 5"] });
  await context.route("**/api/schedules", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      schedules: [fixture.schedule],
      savedAt: new Date().toISOString(),
      savedByApp: "RMT Fire Inspection App Performance QA"
    })
  }));
  await context.addInitScript(installPerfInstrumentation(fixture), {
    schedule: fixture.schedule,
    stressStorage: buildStressStorage(fixture.schedule)
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  const gotoStarted = Date.now();
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  const domContentLoaded = await page.evaluate(() => performance.now());
  await page.waitForSelector("#loginForm", { timeout: 20000 });
  const loginReady = await page.evaluate(() => performance.now());
  await wrapCounters(page);
  const storageBeforeLogin = await collectStorageReport(page);
  const login = await loginAsTech(page);
  await page.waitForTimeout(250);
  const afterLogin = await collectPerf(page);
  const uob = await openUobToMimic(page);
  await page.waitForTimeout(250);
  const afterUob = await collectPerf(page);
  await page.screenshot({ path: join(OUTPUT_DIR, STRESS_STORAGE ? "startup-performance-stress.png" : "startup-performance.png"), fullPage: false });

  await page.reload({ waitUntil: "domcontentloaded" });
  const refreshStarted = await page.evaluate(() => performance.now());
  let restored = false;
  let restoreError = "";
  try {
    await page.waitForFunction(() => {
      const activeId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
      return !document.querySelector("#workspace")?.classList.contains("hidden")
        && document.querySelector("#workspace")?.classList.contains("technician-mode")
        && activeId === "QA-PERF-UOB"
        && document.querySelector("#workspace")?.classList.contains("tech-screen-mimic")
        && document.querySelectorAll(".marker.assigned-scope").length > 0;
    }, null, { timeout: 12000 });
    restored = true;
  } catch (error) {
    restoreError = error.message;
  }
  const refreshReady = await page.evaluate(() => performance.now());
  const afterRefresh = await collectPerf(page);

  const result = {
    ok: true,
    mode: STRESS_STORAGE ? "stress-storage" : "clean-storage",
    reportOnly: REPORT_ONLY,
    fixture: {
      scheduleId: fixture.schedule.scheduleId,
      plannedDeviceCount: fixture.plannedDeviceIds.length,
      floorId: fixture.schedule.floorId
    },
    timingsMs: {
      processWallLoadToEnd: Date.now() - gotoStarted,
      navigationToDomContentLoaded: Math.round(domContentLoaded),
      loginScreenReady: Math.round(loginReady),
      loginTapToTechnicianJobs: Math.round(login.ready - login.started),
      uobOpenTapToJobReady: Math.round(uob.jobReady - uob.openStarted),
      uobOpenTapToMimicReady: Math.round(uob.mimicReady - uob.openStarted),
      systemTapToMimicReady: Math.round(uob.mimicReady - uob.jobReady),
      refreshToRestoredJobMimic: Math.round(refreshReady - refreshStarted)
    },
    beforeLogin: {
      localStorage: storageBeforeLogin.slice(0, 12)
    },
    afterLogin,
    afterUob,
    refreshRestore: {
      restored,
      error: restoreError,
      afterRefresh
    },
    consoleErrors
  };
  writeFileSync(join(OUTPUT_DIR, STRESS_STORAGE ? "startup-performance-stress.json" : "startup-performance.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    mode: result.mode,
    timingsMs: result.timingsMs,
    localStorageTop: result.afterUob.localStorage.slice(0, 8),
    counters: result.afterUob.counters,
    fetches: result.afterUob.fetches.map((item) => ({ url: item.url, status: item.status, ms: Math.round(item.ms) })),
    domNodes: result.afterUob.domNodes,
    markers: result.afterUob.assignedMarkerCount,
    refreshRestore: result.refreshRestore.restored,
    refreshError: result.refreshRestore.error,
    consoleErrors
  }, null, 2));

  if (!REPORT_ONLY) {
    assert(!consoleErrors.length, `Console/page errors: ${consoleErrors.join(" | ")}`);
    assert(result.afterUob.assignedMarkerCount > 0, "UOB mimic did not render assigned pins.");
    assert(result.refreshRestore.restored, `Refresh did not restore technician UOB mimic: ${result.refreshRestore.error}`);
    const renderMarkers = result.afterUob.counters.renderMarkers?.count || 0;
    const techPanel = result.afterUob.counters.renderTechWorkPanel?.count || 0;
    assert(renderMarkers <= 20, `UOB resume rendered markers too many times: ${renderMarkers}`);
    assert(techPanel <= 18, `UOB resume rendered technician panel too many times: ${techPanel}`);
    assert(result.timingsMs.loginTapToTechnicianJobs < 4500, `Login to jobs is too slow: ${result.timingsMs.loginTapToTechnicianJobs}ms`);
    assert(result.timingsMs.uobOpenTapToMimicReady < 7000, `UOB open to mimic is too slow: ${result.timingsMs.uobOpenTapToMimicReady}ms`);
  }

  await context.close();
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
