const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = "http://127.0.0.1:8026/";
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeWetexData(extraDevices = []) {
  const floors = Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    const padded = String(number).padStart(2, "0");
    return {
      id: `wetex-floor-${padded}`,
      companyName: "WETEX",
      siteName: "WETEX",
      floorCode: `L${number}`,
      floorName: `Floor ${padded}`,
      title: `WETEX - Floor ${padded}`,
      src: "assets/lv1-map.png",
      cleanSrc: "assets/lv1-map.png"
    };
  });

  const devices = [];
  floors.forEach((floor, floorIndex) => {
    const floorNumber = floorIndex + 1;
    for (let index = 1; index <= 10; index += 1) {
      devices.push({
        tag: `W${floorNumber}.SD.${index}`,
        type: "Smoke Detector",
        floor: floor.title,
        companyName: "WETEX",
        siteName: "WETEX",
        location: `Corridor ${index}`,
        status: "Confirmed",
        xPercent: 8 + index,
        yPercent: 8 + floorNumber,
        capturedBy: "QA",
        capturedAt: new Date().toISOString()
      });
    }
  });

  devices.push({
    tag: "W1.MFAP.1",
    type: "Main Fire Alarm Panel",
    floor: floors[0].title,
    companyName: "WETEX",
    siteName: "WETEX",
    location: "Security counter",
    status: "Confirmed",
    xPercent: 70,
    yPercent: 20,
    capturedBy: "QA",
    capturedAt: new Date().toISOString()
  });

  devices.push({
    tag: "W2.HRP.1",
    type: "Hose Reel Panel",
    floor: floors[1].title,
    companyName: "WETEX",
    siteName: "WETEX",
    location: "Pump room",
    status: "Confirmed",
    xPercent: 75,
    yPercent: 25,
    capturedBy: "QA",
    capturedAt: new Date().toISOString()
  });

  devices.push(...extraDevices);

  return { floors, devices };
}

async function createPage(browser, options = {}) {
  const { floors, devices } = makeWetexData(options.extraDevices || []);
  const frequency = options.frequency || 10;
  const context = await browser.newContext();
  await context.addInitScript(({ floors, devices, frequency, schedules }) => {
    localStorage.clear();
    localStorage.setItem("rmtMimicFloors", JSON.stringify(floors));
    localStorage.setItem("tmFireSetupDevices", JSON.stringify(devices));
    localStorage.setItem("rmtSiteProfile", JSON.stringify({ companyName: "WETEX", siteName: "WETEX" }));
    localStorage.setItem("rmtContractRules", JSON.stringify({
      "WETEX|WETEX": {
        companyName: "WETEX",
        siteName: "WETEX",
        frequencyPercent: frequency
      }
    }));
    if (schedules) {
      localStorage.setItem("rmtSchedules", JSON.stringify(schedules));
    }
  }, { floors, devices, frequency, schedules: options.schedules || null });

  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });

  await page.route("**/api/schedules", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ schedules: options.schedules || [] })
  }));
  await page.route("**/api/save-schedules", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, count: 1 })
  }));
  await page.route("**/api/save-job-progress", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, runKey: "qa-job-progress" })
  }));
  await page.route("**/api/save-inspection-run", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, runKey: "qa-inspection-run" })
  }));
  await page.route("**/api/device-masters", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ files: [] })
  }));
  await page.route("**/local-data/device-master/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ companyName: "QA", siteName: "QA", devices: [] })
  }));
  await page.route("**/local-data/mimic-library/mimic-library-app-data.json", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ companies: [], floors: [] })
  }));
  await page.route("**/local-data/inspection-runs/wetex-demo-inspection-run.json", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      serviceType: "QA demo",
      installedDeviceCount: 0,
      scopeDeviceCount: 0,
      totalMinutes: 0,
      redFlags: {},
      criticalTracking: { summary: [] },
      staffActivity: []
    })
  }));

  return { context, page, browserErrors };
}

async function login(page, role = "admin") {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  if (role === "tech") {
    await page.fill("#loginEmail", "tech@rmtfire.local");
  } else {
    await page.fill("#loginEmail", "admin@rmtfire.local");
  }
  await page.fill("#loginPassword", new Date().toISOString());
  await page.click("#loginForm button[type=\"submit\"]");
  await page.waitForSelector("#workspace:not(.hidden)");
}

async function startTechSchedule(page, scheduleId = "") {
  await page.evaluate((id) => {
    const schedule = id || state.schedules?.[0]?.scheduleId || "";
    if (!schedule) throw new Error("No schedule available to start");
    return startScheduledJob(schedule);
  }, scheduleId);
  await page.waitForFunction((id) => {
    const activeJob = JSON.parse(localStorage.getItem("rmtActiveJob") || "null");
    return Boolean(activeJob && (!id || activeJob.scheduleId === id));
  }, scheduleId);
}

async function showTechMimicFloor(page, floorId, scheduleId = "") {
  await page.evaluate(({ floorId, scheduleId }) => {
    const targetScheduleId = scheduleId || state.activeJob?.scheduleId || state.schedules?.[0]?.scheduleId || "";
    if (targetScheduleId) {
      return showTechnicianScheduleOnMap(targetScheduleId, { scrollToMap: false }).then(() => {
        setTechScreen("mimic");
        focusTechnicianFloor(floorId);
      });
    }
    setTechScreen("mimic");
    focusTechnicianFloor(floorId);
  }, { floorId, scheduleId });
  await page.waitForSelector("#workspace.tech-screen-mimic");
  await page.waitForTimeout(250);
}

async function saveMaintenanceSchedule(page) {
  await page.waitForFunction(() => document.querySelectorAll("#scheduleFloor option").length >= 10);
  await page.selectOption("#scheduleScope", "full-maintenance");
  await page.click("#saveScheduleBtn");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rmtSchedules") || "[]").length === 1);
  return page.evaluate(() => JSON.parse(localStorage.getItem("rmtSchedules"))[0]);
}

async function saveScheduleWithScope(page, scope, floorId = "") {
  await page.waitForFunction(() => document.querySelectorAll("#scheduleFloor option").length >= 10);
  if (floorId) {
    await page.selectOption("#scheduleFloor", floorId);
  }
  await page.selectOption("#scheduleScope", scope);
  await page.click("#saveScheduleBtn");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rmtSchedules") || "[]").length === 1);
  return page.evaluate(() => JSON.parse(localStorage.getItem("rmtSchedules"))[0]);
}

function makeLegacyOneFloorSchedule() {
  return {
    scheduleId: "OLD-FLOOR-ONLY",
    status: "Scheduled",
    companyName: "WETEX",
    siteName: "WETEX",
    clientSource: "Existing Client",
    floorId: "wetex-floor-01",
    floorTitle: "WETEX - Floor 01",
    floorCode: "L1",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    technician: "Demo Technician",
    serviceType: "Maintenance / Inspection",
    scope: "full-maintenance",
    scopeLabel: "Full Maintenance Visit",
    contractFrequencyPercent: 10,
    plannedDeviceIds: ["W1.SD.1"],
    priority: "Normal",
    notes: "Legacy schedule before site-wide scope fix",
    deviceCount: 1,
    totalFloorDeviceCount: 10,
    passiveCount: 1,
    activeCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function makeGeneralMaintenanceSchedule() {
  const now = new Date().toISOString();
  return {
    scheduleId: "GENERAL-MAINT-QA",
    status: "Scheduled",
    companyName: "WETEX",
    siteName: "WETEX",
    clientSource: "Existing Client",
    floorId: "wetex-floor-01",
    floorTitle: "WETEX - Floor 01",
    floorCode: "L1",
    startFloorId: "wetex-floor-01",
    startFloorTitle: "WETEX - Floor 01",
    date: now.slice(0, 10),
    time: "09:00",
    technician: "Demo Technician",
    serviceType: "Maintenance / Inspection",
    scope: "general-job",
    scopeLabel: "General Client Job",
    scopeSelectionMode: "selected-floor",
    contractFrequencyPercent: 10,
    plannedDeviceIds: [],
    plannedFloorCounts: [],
    priority: "Normal",
    notes: "QA schedule saved with wrong detail",
    deviceCount: 0,
    totalFloorDeviceCount: 10,
    passiveCount: 0,
    activeCount: 0,
    createdAt: now,
    updatedAt: now
  };
}

function makeStaleWetexSchedule() {
  const now = new Date().toISOString();
  return {
    scheduleId: "STALE-WETEX-QA",
    status: "Scheduled",
    companyName: "WETEX",
    siteName: "WETEX",
    clientSource: "Existing Client",
    floorId: "wetex-floor-01",
    floorTitle: "Whole site (start: WETEX - Floor 01)",
    floorCode: "L1",
    startFloorId: "wetex-floor-01",
    startFloorTitle: "WETEX - Floor 01",
    date: now.slice(0, 10),
    time: "09:00",
    technician: "Demo Technician",
    serviceType: "Maintenance / Inspection",
    scope: "full-maintenance",
    scopeLabel: "Full Maintenance Visit",
    scopeSelectionMode: "site-wide",
    contractFrequencyPercent: 10,
    plannedDeviceIds: ["LV1-HR-1"],
    plannedFloorCounts: [{ floorId: "lv1", floorTitle: "LV-1 First Floor", count: 1 }],
    priority: "Normal",
    notes: "QA schedule saved before WETEX master was loaded",
    deviceCount: 1,
    totalFloorDeviceCount: 10,
    totalSiteDeviceCount: 10,
    passiveCount: 1,
    activeCount: 0,
    createdAt: now,
    updatedAt: now
  };
}

function makeAssignedExtinguisherSchedule() {
  const now = new Date().toISOString();
  return {
    scheduleId: "EXT-ASSIGNED-QA",
    status: "Scheduled",
    companyName: "On Call QA Customer",
    siteName: "Guard House",
    clientSource: "Standalone Extinguisher Job",
    address: "QA test address",
    floorId: "extinguisher-standalone",
    floorTitle: "Standalone Extinguisher Job",
    floorCode: "EXT",
    date: now.slice(0, 10),
    time: "10:30",
    technician: "Demo Technician",
    serviceType: "Fire Extinguisher Collection",
    scope: "extinguisher-collection",
    scopeLabel: "Extinguisher Collection / Delivery",
    priority: "Normal",
    notes: "Collect and record photo proof",
    extinguisherDetails: "9kg ABC x 2",
    deviceCount: 0,
    totalFloorDeviceCount: 0,
    passiveCount: 0,
    activeCount: 0,
    tracking: {},
    photoProof: {},
    createdAt: now,
    updatedAt: now
  };
}

async function runTest(name, callback) {
  const start = Date.now();
  await callback();
  console.log(`PASS ${name} (${Date.now() - start} ms)`);
}

(async () => {
  const executablePath = EDGE_PATHS.find((path) => existsSync(path));
  assert(executablePath, "No Edge/Chrome executable found for browser QA.");

  const browser = await chromium.launch({ headless: true, executablePath });

  await runTest("Admin can create site-wide 10% maintenance schedule", async () => {
    const { context, page, browserErrors } = await createPage(browser, { frequency: 10 });
    await login(page, "admin");
    const schedule = await saveMaintenanceSchedule(page);
    assert(schedule.scopeSelectionMode === "site-wide", "Schedule was not saved as site-wide.");
    assert(schedule.totalSiteDeviceCount === 102, `Expected 102 site devices, got ${schedule.totalSiteDeviceCount}.`);
    assert(schedule.passiveCount === 10, `Expected 10 passive checkpoints, got ${schedule.passiveCount}.`);
    assert(schedule.activeCount === 2, `Expected 2 active systems, got ${schedule.activeCount}.`);
    assert(schedule.plannedDeviceIds.length === 12, `Expected 12 total checkpoints, got ${schedule.plannedDeviceIds.length}.`);
    assert(schedule.plannedFloorCounts.length === 10, "Expected assigned points to be spread across 10 floors.");
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Mimic original and clean toggle use the correct image source", async () => {
    const { context, page, browserErrors } = await createPage(browser, { frequency: 10 });
    await login(page, "admin");
    const result = await page.evaluate(() => {
      setMimicViewMode("original");
      const original = getMimicImageSrc({
        src: "fallback.png",
        originalSrc: "original.png",
        cleanSrc: "clean.png"
      });
      setMimicViewMode("clean");
      const clean = getMimicImageSrc({
        src: "fallback.png",
        originalSrc: "original.png",
        cleanSrc: "clean.png"
      });
      return { original, clean };
    });
    assert(result.original === "original.png", `Original mode returned ${result.original}.`);
    assert(result.clean === "clean.png", `Clean mode returned ${result.clean}.`);
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Monthly 10% cycle does not repeat passive devices before 100% coverage", async () => {
    const { context, page, browserErrors } = await createPage(browser, { frequency: 10 });
    await login(page, "admin");
    const result = await page.evaluate(() => {
      const profile = { companyName: "WETEX", siteName: "WETEX" };
      const scopeInfo = getScheduleScopeInfo("full-maintenance");
      const pool = getDevicesForScheduleSite(profile);
      const monthPicks = [];
      for (let month = 0; month < 10; month += 1) {
        const selected = getScheduleDevicesForScope(pool, scopeInfo, {
          profile,
          floorId: "site-wide",
          frequencyPercent: 10,
          commitHistory: true
        }).filter((device) => isPassiveScopeDevice(device));
        monthPicks.push(selected.map((device) => device.id));
      }
      const flat = monthPicks.flat();
      const flagged = monthPicks[0][0];
      window.eval(`state.inspections[${JSON.stringify(flagged)}] = { status: "Fail", notes: "Faulty during earlier visit" };`);
      const overrun = getScheduleDevicesForScope(pool, scopeInfo, {
        profile,
        floorId: "site-wide",
        frequencyPercent: 10,
        commitHistory: true
      }).filter((device) => isPassiveScopeDevice(device)).map((device) => device.id);
      return {
        totalPicked: flat.length,
        uniquePicked: new Set(flat).size,
        flagged,
        overrun
      };
    });
    assert(result.totalPicked === 100, `Expected 100 passive picks over 10 monthly visits, got ${result.totalPicked}.`);
    assert(result.uniquePicked === 100, `Expected no repeated passive devices before full cycle, got ${result.uniquePicked} unique.`);
    assert(result.overrun.includes(result.flagged), "Post-cycle 20% overlap did not prioritize earlier faulty item.");
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Admin can create site-wide 50% maintenance schedule", async () => {
    const { context, page, browserErrors } = await createPage(browser, { frequency: 50 });
    await login(page, "admin");
    const schedule = await saveMaintenanceSchedule(page);
    assert(schedule.passiveCount === 50, `Expected 50 passive checkpoints, got ${schedule.passiveCount}.`);
    assert(schedule.activeCount === 2, `Expected 2 active systems, got ${schedule.activeCount}.`);
    assert(schedule.plannedDeviceIds.length === 52, `Expected 52 total checkpoints, got ${schedule.plannedDeviceIds.length}.`);
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Admin can create site-wide 100% yearly maintenance schedule", async () => {
    const { context, page, browserErrors } = await createPage(browser, { frequency: 100 });
    await login(page, "admin");
    const schedule = await saveMaintenanceSchedule(page);
    assert(schedule.scopeSelectionMode === "site-wide", "Yearly schedule was not site-wide.");
    assert(schedule.passiveCount === 100, `Expected 100 passive checkpoints, got ${schedule.passiveCount}.`);
    assert(schedule.activeCount === 2, `Expected 2 active systems, got ${schedule.activeCount}.`);
    assert(schedule.plannedDeviceIds.length === 102, `Expected 102 total checkpoints, got ${schedule.plannedDeviceIds.length}.`);
    assert(schedule.plannedFloorCounts.length === 10, "Expected yearly schedule to cover all 10 floors.");
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Selected-floor fire alarm scope stays on chosen floor", async () => {
    const { context, page, browserErrors } = await createPage(browser, { frequency: 10 });
    await login(page, "admin");
    const schedule = await saveScheduleWithScope(page, "fire-alarm", "wetex-floor-05");
    assert(schedule.scopeSelectionMode === "selected-floor", "Fire alarm floor scope should not become site-wide.");
    assert(schedule.floorId === "wetex-floor-05", "Fire alarm schedule did not keep selected floor.");
    assert(schedule.deviceCount === 10, `Expected 10 fire alarm devices on Floor 05, got ${schedule.deviceCount}.`);
    assert(schedule.plannedDeviceIds.every((id) => id.startsWith("W5.")), "Fire alarm selected-floor scope included devices from other floors.");
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Calendar dragged/saved job can be removed from calendar", async () => {
    const { context, page, browserErrors } = await createPage(browser, { frequency: 10 });
    await login(page, "admin");
    await saveMaintenanceSchedule(page);
    await page.waitForSelector(".calendar-chip-delete");
    await page.locator(".calendar-chip-delete").first().click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("rmtSchedules") || "[]").length === 0);
    assert(await page.locator(".calendar-schedule-chip[data-schedule-drag-id]").count() === 0, "Calendar chip still visible after delete.");
    const reservedCount = await page.evaluate(() => {
      const cycles = JSON.parse(localStorage.getItem("rmtScopeCycle") || "{}");
      return Object.values(cycles).reduce((sum, cycle) => sum + (cycle.coveredIds?.length || 0), 0);
    });
    assert(reservedCount === 0, `Deleted schedule still reserved ${reservedCount} cycle devices.`);
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Legacy one-floor maintenance schedule upgrades to site-wide when started", async () => {
    const legacySchedule = makeLegacyOneFloorSchedule();
    const { context, page, browserErrors } = await createPage(browser, { frequency: 10, schedules: [legacySchedule] });
    await login(page, "tech");
    await page.click("[data-tech-start-schedule]");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("rmtActiveJob") || "{}").schedule?.scopeSelectionMode === "site-wide");
    const activeJob = await page.evaluate(() => JSON.parse(localStorage.getItem("rmtActiveJob")));
    assert(activeJob.schedule.plannedDeviceIds.length === 12, `Legacy schedule should upgrade to 12 site-wide points, got ${activeJob.schedule.plannedDeviceIds.length}.`);
    assert(activeJob.schedule.activeCount === 2, "Legacy schedule upgrade did not include active systems.");
    assert(activeJob.schedule.plannedFloorCounts.length === 10, "Legacy schedule upgrade did not spread across floors.");
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Maintenance schedule saved as general job still shows assigned mimic pins", async () => {
    const generalMaintenance = makeGeneralMaintenanceSchedule();
    const { context, page, browserErrors } = await createPage(browser, { frequency: 10, schedules: [generalMaintenance] });
    await login(page, "tech");
    await showTechMimicFloor(page, "wetex-floor-05", "GENERAL-MAINT-QA");
    const activeSchedule = await page.evaluate(() => state.schedules[0]);
    const allMarkers = await page.locator(".marker.setup-marker").count();
    const assignedMarkers = await page.locator(".marker.setup-marker.assigned-scope").count();
    assert(activeSchedule.scope === "full-maintenance", `Expected general maintenance schedule to upgrade to full-maintenance, got ${activeSchedule.scope}.`);
    assert(activeSchedule.plannedDeviceIds.length === 12, `Expected upgraded schedule to have 12 planned devices, got ${activeSchedule.plannedDeviceIds.length}.`);
    assert(allMarkers === 1 && assignedMarkers === 1, `Expected 1 assigned mimic pin from upgraded schedule, got ${assignedMarkers}/${allMarkers}.`);
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Stale WETEX planned IDs rebuild and show assigned mimic pins", async () => {
    const staleSchedule = makeStaleWetexSchedule();
    const { context, page, browserErrors } = await createPage(browser, { frequency: 10, schedules: [staleSchedule] });
    await login(page, "tech");
    await showTechMimicFloor(page, "wetex-floor-05", "STALE-WETEX-QA");
    const activeSchedule = await page.evaluate(() => state.schedules[0]);
    const allMarkers = await page.locator(".marker.setup-marker").count();
    const assignedMarkers = await page.locator(".marker.setup-marker.assigned-scope").count();
    assert(activeSchedule.scopeSelectionMode === "site-wide", "Stale schedule did not stay site-wide after rebuild.");
    assert(activeSchedule.plannedDeviceIds.length === 12, `Expected stale WETEX schedule to rebuild to 12 planned devices, got ${activeSchedule.plannedDeviceIds.length}.`);
    assert(!activeSchedule.plannedDeviceIds.includes("LV1-HR-1"), "Stale legacy demo ID was kept in WETEX planned devices.");
    assert(allMarkers === 1 && assignedMarkers === 1, `Expected rebuilt assigned WETEX pin on Floor 05, got ${assignedMarkers}/${allMarkers}.`);
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Technician tapping assigned preview pin auto-starts and opens checklist", async () => {
    const admin = await createPage(browser, { frequency: 10 });
    await login(admin.page, "admin");
    const schedule = await saveMaintenanceSchedule(admin.page);
    await admin.context.close();

    const { context, page, browserErrors } = await createPage(browser, { frequency: 10, schedules: [schedule] });
    await login(page, "tech");
    await showTechMimicFloor(page, "wetex-floor-05", schedule.scheduleId);
    const allMarkers = await page.locator(".marker.setup-marker").count();
    const assignedMarkers = await page.locator(".marker.setup-marker.assigned-scope").count();
    const previewMarkers = await page.locator(".marker.setup-marker.preview-scope").count();
    assert(allMarkers === 1 && assignedMarkers === 1 && previewMarkers === 1, `Expected 1 preview assigned marker, got ${previewMarkers}/${assignedMarkers}/${allMarkers}.`);
    await page.locator(".marker.setup-marker.assigned-scope").first().click();
    await page.waitForFunction(() => {
      return !document.querySelector("#checklistForm")?.classList.contains("hidden")
        || document.querySelector("#workspace")?.classList.contains("critical-sop-active");
    });
    const activeJob = await page.evaluate(() => JSON.parse(localStorage.getItem("rmtActiveJob") || "{}"));
    const opened = await page.evaluate(() => ({
      checklistOpen: !document.querySelector("#checklistForm")?.classList.contains("hidden"),
      criticalSopOpen: document.querySelector("#workspace")?.classList.contains("critical-sop-active"),
      sopText: document.querySelector("#criticalSopPanel")?.innerText || ""
    }));
    assert(activeJob.scheduleId === schedule.scheduleId, "Preview pin tap did not auto-start the assigned schedule.");
    assert(opened.checklistOpen || opened.criticalSopOpen, "Preview pin tap did not open checklist or prerequisite SOP.");
    if (opened.criticalSopOpen) {
      assert(opened.sopText.includes("Fire Alarm / Tripping SOP"), "Dependent preview pin did not open the MFAP prerequisite SOP.");
    }
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Technician sees only assigned pins on selected floor with job progress summary", async () => {
    const admin = await createPage(browser, { frequency: 10 });
    await login(admin.page, "admin");
    const schedule = await saveMaintenanceSchedule(admin.page);
    await admin.context.close();

    const { context, page, browserErrors } = await createPage(browser, { frequency: 10, schedules: [schedule] });
    await login(page, "tech");
    await startTechSchedule(page, schedule.scheduleId);
    await showTechMimicFloor(page, "wetex-floor-05", schedule.scheduleId);
    const allMarkers = await page.locator(".marker.setup-marker").count();
    const assignedMarkers = await page.locator(".marker.setup-marker.assigned-scope").count();
    const activeText = await page.locator("#techActiveJobSummary").innerText();
    const counts = await page.evaluate(() => getInspectionRunCounts());
    const floorFiveCount = schedule.plannedFloorCounts.find((item) => item.floorId === "wetex-floor-05")?.count || 0;
    assert(allMarkers === 1 && assignedMarkers === 1, `Expected 1 assigned marker on Floor 05, got ${assignedMarkers}/${allMarkers}.`);
    assert(activeText.includes("Assigned scope:"), "Technician active job summary did not show assigned scope.");
    assert(activeText.includes("Starting floor:"), "Technician active job summary did not show starting floor.");
    assert(activeText.includes("Completed"), "Technician active job summary did not show progress counters.");
    assert(floorFiveCount === 1, `Expected schedule data to assign 1 point on Floor 05, got ${floorFiveCount}.`);
    assert(counts.total === 12, `Run counts should use full site-wide schedule, got ${counts.total}.`);
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Technician tapping assigned passive pin opens checklist", async () => {
    const admin = await createPage(browser, { frequency: 10 });
    await login(admin.page, "admin");
    const schedule = await saveMaintenanceSchedule(admin.page);
    await admin.context.close();

    const { context, page, browserErrors } = await createPage(browser, { frequency: 10, schedules: [schedule] });
    await login(page, "tech");
    await startTechSchedule(page, schedule.scheduleId);
    await showTechMimicFloor(page, "wetex-floor-05", schedule.scheduleId);
    await page.waitForSelector(".marker.setup-marker.assigned-scope");
    await page.locator(".marker.setup-marker.assigned-scope").first().click();
    await page.waitForFunction(() => {
      return !document.querySelector("#checklistForm")?.classList.contains("hidden")
        || document.querySelector("#workspace")?.classList.contains("critical-sop-active");
    });
    const opened = await page.evaluate(() => ({
      checklistOpen: !document.querySelector("#checklistForm")?.classList.contains("hidden"),
      criticalSopOpen: document.querySelector("#workspace")?.classList.contains("critical-sop-active"),
      deviceName: document.querySelector("#deviceName")?.textContent.trim() || "",
      questionCount: document.querySelectorAll("#questionList .question").length,
      sopText: document.querySelector("#criticalSopPanel")?.innerText || ""
    }));
    if (opened.checklistOpen) {
      assert(opened.deviceName.startsWith("W5."), `Expected Floor 05 checklist, got ${opened.deviceName}.`);
      assert(opened.questionCount > 0, "Assigned passive pin opened an empty checklist.");
    } else {
      assert(opened.criticalSopOpen && opened.sopText.includes("Fire Alarm / Tripping SOP"), "Dependent passive pin did not open MFAP prerequisite SOP.");
    }
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Critical active item opens SOP in technician flow", async () => {
    const admin = await createPage(browser, { frequency: 10 });
    await login(admin.page, "admin");
    const schedule = await saveMaintenanceSchedule(admin.page);
    await admin.context.close();

    const { context, page, browserErrors } = await createPage(browser, { frequency: 10, schedules: [schedule] });
    await login(page, "tech");
    await startTechSchedule(page, schedule.scheduleId);
    await showTechMimicFloor(page, "wetex-floor-01", schedule.scheduleId);
    await page.waitForSelector("[data-setup-tag=\"W1.MFAP.1\"]");
    await page.click("[data-setup-tag=\"W1.MFAP.1\"]");
    await page.waitForFunction(() => document.querySelector("#workspace").classList.contains("critical-sop-active"));
    const sopText = await page.locator("#criticalSopPanel").innerText();
    assert(sopText.includes("Fire Alarm / Tripping SOP"), "MFAP did not open the fire alarm critical SOP.");
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Gas CO2 SOP is fast tick but still requires photos and supervisor", async () => {
    const co2Device = {
      tag: "W1.CO2.1",
      type: "CO2 System",
      floor: "WETEX - Floor 01",
      companyName: "WETEX",
      siteName: "WETEX",
      location: "CO2 room",
      status: "Confirmed",
      xPercent: 82,
      yPercent: 34,
      capturedBy: "QA",
      capturedAt: new Date().toISOString()
    };
    const admin = await createPage(browser, { frequency: 10, extraDevices: [co2Device] });
    await login(admin.page, "admin");
    const schedule = await saveMaintenanceSchedule(admin.page);
    assert(schedule.plannedDeviceIds.includes("W1.CO2.1"), "CO2 critical device was not included in active 100% schedule scope.");
    await admin.context.close();

    const { context, page, browserErrors } = await createPage(browser, { frequency: 10, schedules: [schedule], extraDevices: [co2Device] });
    await login(page, "tech");
    await startTechSchedule(page, schedule.scheduleId);
    await showTechMimicFloor(page, "wetex-floor-01", schedule.scheduleId);
    await page.waitForSelector("[data-setup-tag=\"W1.CO2.1\"]");
    await page.click("[data-setup-tag=\"W1.CO2.1\"]");
    await page.waitForFunction(() => document.querySelector("#workspace").classList.contains("critical-sop-active"));

    const sopText = await page.locator("#criticalSopPanel").innerText();
    const firstStepText = await page.locator(".sop-step").first().innerText();
    assert(sopText.includes("Gas Discharge / CO2 SOP"), "CO2 device did not open gas discharge SOP.");
    assert(sopText.includes("Required Critical Evidence"), "Gas SOP did not show before/after evidence block.");
    assert(!firstStepText.includes("Remark / Confirmation Detail"), "Gas SOP first step should be tick-only.");

    for (let index = 0; index < 14; index += 1) {
      const reading = page.locator(`input[name="sop-reading-${index}"]`);
      if (await reading.count()) {
        await reading.fill(index === 10 ? "28 seconds" : "AC normal / battery 26.8V / charger normal");
      }
      await page.locator(`input[name="sop-confirm-${index}"]`).check();
    }
    const supervisorName = await page.locator("input[name^=\"sop-supervisor-\"]").last().getAttribute("name");
    const supervisorIndex = Number(supervisorName.match(/\d+$/)?.[0]);
    for (let index = 14; index < supervisorIndex; index += 1) {
      await page.locator(`input[name="sop-confirm-${index}"]`).check();
    }
    await page.fill(`input[name="sop-supervisor-${supervisorIndex}"]`, "Mr Safety");
    await page.locator(`input[name="sop-confirm-${supervisorIndex}"]`).click();
    const blockedState = await page.evaluate((index) => ({
      checked: document.querySelector(`input[name="sop-confirm-${index}"]`)?.checked,
      sync: document.querySelector("#syncState")?.textContent || ""
    }), supervisorIndex);
    assert(!blockedState.checked, "Final gas SOP step should stay unchecked without before/after photos.");
    assert(blockedState.sync.includes("before photo") && blockedState.sync.includes("after photo"), `Missing photo warning not shown: ${blockedState.sync}`);

    await page.click("[data-critical-demo-photo=\"before\"]");
    await page.click("[data-critical-demo-photo=\"after\"]");
    await page.fill(`input[name="sop-supervisor-${supervisorIndex}"]`, "Mr Safety");
    await page.locator(`input[name="sop-confirm-${supervisorIndex}"]`).check();
    await page.waitForFunction((index) => {
      const saved = JSON.parse(localStorage.getItem("rmtCriticalSops") || "{}")["gas-discharge-sop::W1.CO2.1"];
      return Boolean(saved?.beforePhoto && saved?.afterPhoto && saved?.steps?.[index]?.confirmed && saved?.steps?.[index]?.supervisor);
    }, supervisorIndex);
    const savedSop = await page.evaluate(() => JSON.parse(localStorage.getItem("rmtCriticalSops"))["gas-discharge-sop::W1.CO2.1"]);
    assert(savedSop.filledBy === "Demo Technician", `Expected filledBy to record technician, got ${savedSop.filledBy}.`);
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Customer report uses full active schedule scope", async () => {
    const { context, page, browserErrors } = await createPage(browser, { frequency: 10 });
    await login(page, "admin");
    await saveMaintenanceSchedule(page);
    await page.click(".start-schedule-btn");
    await page.click("#showReportBtn");
    await page.waitForSelector("#reportView:not(.hidden)");
    const reportRows = await page.locator("#reportRows tr").count();
    const reportStatus = await page.locator("#reportStatus").innerText();
    assert(reportRows === 12, `Report should show 12 scheduled devices, got ${reportRows}.`);
    assert(reportStatus === "In Progress", `Expected in-progress report before checks, got ${reportStatus}.`);
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Technician requests admin before extinguisher form is available", async () => {
    const { context, page, browserErrors } = await createPage(browser, { frequency: 10 });
    await login(page, "tech");
    assert(await page.locator("#techExtinguisherPanel:not(.hidden)").count() === 0, "Extinguisher form was visible without an assigned job.");
    await page.click(".tech-ext-request-btn");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("tmFireRequests") || "[]").some((request) => request.type === "Extinguisher Job Request"));
    const scheduleCount = await page.evaluate(() => JSON.parse(localStorage.getItem("rmtSchedules") || "[]").length);
    assert(scheduleCount === 0, "Technician request should not create an unapproved extinguisher schedule.");
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await runTest("Assigned extinguisher collection requires photo proof when units move", async () => {
    const { context, page, browserErrors } = await createPage(browser, {
      frequency: 10,
      schedules: [makeAssignedExtinguisherSchedule()]
    });
    await login(page, "tech");
    await page.click(".tech-ext-load-btn");
    await page.waitForSelector("#techExtinguisherPanel:not(.hidden)");
    assert(await page.inputValue("#techExtManualClient") === "On Call QA Customer", "Assigned extinguisher customer was not loaded.");
    await page.fill("#techExtCollectedUnits", "1");
    await page.click("#saveTechExtinguisherBtn");
    await page.waitForFunction(() => document.querySelector("#syncState")?.textContent.includes("missing collection photo"));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("rmtSchedules") || "[]")[0]);
    assert(saved.status === "Scheduled", "Assigned extinguisher record was saved even though collection photo proof was missing.");
    assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
    await context.close();
  });

  await browser.close();
  console.log("QA COMPLETE");
})().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
});
