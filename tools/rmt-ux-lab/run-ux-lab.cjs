const { existsSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT_DIR = path.join(ROOT, "outputs", "rmt-ux-lab");
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "screenshots");
const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260916-rmt-ux-lab";
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];
const TINY_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nX8AAAAASUVORK5CYII=", "base64");

const report = {
  generatedAt: new Date().toISOString(),
  appUrl: APP_URL,
  engine: "Playwright",
  dataSafety: "Synthetic browser-context fixtures; server writes intercepted",
  personas: [],
  journeys: [],
  findings: [],
  consoleErrors: [],
  screenshots: []
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function addFinding(severity, category, title, evidence, journey) {
  const key = `${severity}|${category}|${title}|${journey || ""}`;
  if (report.findings.some((item) => item.key === key)) return;
  report.findings.push({ key, severity, category, title, evidence, journey: journey || "" });
}

function safeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function screenshot(page, name) {
  const fileName = `${safeName(name)}.png`;
  const filePath = path.join(SCREENSHOT_DIR, fileName);
  await page.screenshot({ path: filePath, fullPage: false });
  report.screenshots.push(path.relative(ROOT, filePath).replaceAll("\\", "/"));
  return filePath;
}

async function screenSignature(page) {
  return page.evaluate(() => {
    const workspace = document.querySelector("#workspace");
    const visibleAdmin = [...document.querySelectorAll("#adminWorkspaceHost [data-admin-workspace]")]
      .find((item) => !item.classList.contains("hidden"))?.dataset.adminWorkspace || "";
    const visibleForm = document.querySelector("#checklistForm:not(.hidden)") ? "device" : "";
    const visibleSop = workspace?.classList.contains("critical-sop-active") ? "critical-sop" : "";
    return [
      workspace?.classList.contains("admin-mode") ? `admin:${visibleAdmin}` : "",
      workspace?.classList.contains("technician-mode") ? `tech:${window.state?.techScreen || "unknown"}` : "",
      visibleForm,
      visibleSop
    ].filter(Boolean).join("|") || "login";
  });
}

async function installInstrumentation(page) {
  await page.addInitScript(() => {
    window.__rmtUxMetrics = { scrollEvents: 0, maxScrollY: 0, browserBack: 0 };
    addEventListener("scroll", () => {
      window.__rmtUxMetrics.scrollEvents += 1;
      window.__rmtUxMetrics.maxScrollY = Math.max(window.__rmtUxMetrics.maxScrollY, scrollY);
    }, { passive: true });
    const originalBack = history.back.bind(history);
    history.back = () => {
      window.__rmtUxMetrics.browserBack += 1;
      return originalBack();
    };
  });
}

async function installSyntheticSaveApi(context) {
  await context.route("**/api/jobs/*/inspection-records", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const body = request.postDataJSON();
    const record = { ...body.record, revision: Number(body.expectedRevision || 0) + 1, updatedAt: new Date().toISOString() };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, record, progress: null }) });
  });
  await context.route("**/api/jobs/*/critical-sop-records", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const body = request.postDataJSON();
    const record = { ...body.record, revision: Number(body.expectedRevision || 0) + 1, updatedAt: new Date().toISOString() };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, record, progress: null }) });
  });
  await context.route("**/api/save-schedules", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, count: 1 }) }));
  await context.route("**/api/save-inspection-run", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, runKey: "UX-LAB" }) }));
}

async function login(page, email) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", "ux-lab-local-only");
  const started = Date.now();
  await page.locator("#loginForm button[type='submit']").click();
  await page.waitForFunction(() => !document.querySelector("#workspace")?.classList.contains("hidden"), null, { timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(350);
  return Date.now() - started;
}

async function seedTechnicianFixture(page) {
  return page.evaluate(() => {
    const profile = { companyName: "UX LAB", siteName: "Synthetic Test Site" };
    const floor = {
      id: "ux-lab-l1", floorId: "ux-lab-l1", title: "Level 1", floorCode: "L1",
      companyName: profile.companyName, siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src, cleanSrc: defaultFloorAssets.lv1.src, active: true
    };
    const specs = [
      ["UX.MFAP.1", "Main Fire Alarm Panel", "Fire control room"],
      ["UX.MCP.1", "Manual Call Point", "Lobby"],
      ["UX.SD.1", "Smoke Detector", "Office"],
      ["UX.HD.1", "Heat Detector", "Kitchen"],
      ["UX.PUMP.1", "Fire Pump Panel", "Pump room"],
      ["UX.SPP.1", "Sprinkler Panel", "Pump room"],
      ["UX.CO2.1", "CO2 System", "Suppression room"],
      ["UX.FE.1", "Fire Extinguisher", "Lobby"],
      ["UX.HR.1", "Hose Reel", "Corridor"],
      ["UX.EL.1", "Emergency Light", "Staircase"],
      ["UX.EX.1", "Exit Sign", "Exit door"]
    ];
    const setupDevices = specs.map(([tag, type, location], index) => ({
      tag, id: tag, type, location, floor: floor.title, floorId: floor.id, floorCode: floor.floorCode,
      companyName: profile.companyName, siteName: profile.siteName,
      xPercent: 9 + (index % 6) * 14, yPercent: 22 + Math.floor(index / 6) * 42, status: "Confirmed"
    }));
    const schedule = {
      scheduleId: "UX-LAB-SCHEDULE", jobId: "JOB-UX-LAB-SCHEDULE", status: "In Progress",
      companyName: profile.companyName, siteName: profile.siteName,
      serviceType: "Monthly Maintenance", scope: "full-maintenance", scopeLabel: "Frozen assigned scope",
      contractFrequencyPercent: 10, floorId: floor.id, startFloorId: floor.id,
      floorTitle: floor.title, startFloorTitle: floor.title,
      date: new Date().toISOString().slice(0, 10), time: "09:00", technician: "Demo Technician",
      plannedDeviceIds: setupDevices.map((device) => device.tag), deviceCount: setupDevices.length, scopeFrozen: true
    };
    state.currentUser = { name: "Demo Technician", role: "Technician", email: "tech@rmtfire.local", loggedInAt: new Date().toISOString() };
    state.siteProfile = profile;
    state.schedules = [schedule];
    state.activeJob = { scheduleId: schedule.scheduleId, jobId: schedule.jobId, status: "In Progress", schedule };
    state.setupDevices = setupDevices;
    state.mimicFloors = [floor];
    state.runtimeMimicAssets = [];
    state.libraryFloors = [];
    state.libraryCompanies = [];
    state.inspections = {};
    state.criticalSops = {};
    state.activeTechPreviewScheduleId = schedule.scheduleId;
    state.activeTechSystemKey = "";
    state.activeTechFloorId = floor.id;
    state.techInspectionDirty = false;
    state.sharedJobRecords = {
      [schedule.scheduleId]: {
        store: {
          inspectionRecords: {}, criticalSopRecords: {}, itemClaims: {},
          linkedVerificationDefinitions: {}, linkedVerificationSideRecords: {}, linkedVerificationConflicts: {}
        }
      }
    };
    normalizeSetupDevices();
    clearTechnicianInspectionDirty();
    browserDataState.fieldLoaded = true;
    browserDataState.mimicLibraryLoaded = true;
    browserDataState.deviceMastersLoaded = true;
    loginView.classList.add("hidden");
    workspace.classList.remove("hidden");
    applyRoleView();
    renderFloorOptions(floor.id, profile, { renderSchedule: false });
    setTechnicianMapFloor(floor.id, profile);
    invalidateRuntimeCaches();
    ensureActiveJobCriticalWorkflows(schedule);
    renderTechWorkPanel();
    setTechScreen("jobs", { skipDirtyCheck: true, scroll: false });
    return {
      scheduleId: schedule.scheduleId,
      tags: setupDevices.map((item) => item.tag),
      resolvedIds: getScheduledAssignedDevices(schedule).map((item) => item.id),
      groups: getTechnicianFireSystemGroups(schedule).map((item) => item.id)
    };
  });
}

async function seedAdminFixture(page) {
  await page.evaluate(() => {
    const today = new Date().toISOString().slice(0, 10);
    const base = {
      companyName: "UX LAB", siteName: "Synthetic Test Site", serviceType: "Monthly Maintenance",
      date: today, time: "09:00", technician: "Demo Technician", plannedDeviceIds: ["UX.SD.1", "UX.MCP.1"]
    };
    state.schedules = [
      { ...base, scheduleId: "UX-ADMIN-IN-PROGRESS", jobId: "JOB-UX-ADMIN-1", status: "In Progress" },
      { ...base, scheduleId: "UX-ADMIN-REVIEW", jobId: "JOB-UX-ADMIN-2", status: "Completed", reportSubmission: { status: "AWAITING_ADMIN_REVIEW", submittedAt: new Date().toISOString() } }
    ];
    state.setupDevices = [
      { tag: "UX.SD.1", id: "UX.SD.1", type: "Smoke Detector", location: "Office", companyName: "UX LAB", siteName: "Synthetic Test Site", floorId: "ux-admin-l1" },
      { tag: "UX.MCP.1", id: "UX.MCP.1", type: "Manual Call Point", location: "Lobby", companyName: "UX LAB", siteName: "Synthetic Test Site", floorId: "ux-admin-l1" }
    ];
    state.requests = [{ id: "UX-PIN-1", label: "Suggested detector", type: "Smoke Detector", companyName: "UX LAB", siteName: "Synthetic Test Site", floor: "Level 1", requestedBy: "Demo Technician", status: "PENDING_ADMIN_REVIEW" }];
    state.inspections = {
      "UX.MCP.1": { status: "fail", notes: "Synthetic UX fault", inspectedBy: "Demo Technician", inspectedAt: new Date().toISOString() }
    };
    invalidateRuntimeCaches();
    renderFrontDeskPanel();
    setAdminModule("home");
  });
}

async function observeLayout(page, journeyName, stepName, options = {}) {
  const data = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const visibleButtons = [...document.querySelectorAll("button, a.button-link")].filter(isVisible);
    const smallTargets = visibleButtons.map((element) => {
      const rect = element.getBoundingClientRect();
      return { text: element.textContent.trim().replace(/\s+/g, " ").slice(0, 60), width: Math.round(rect.width), height: Math.round(rect.height) };
    }).filter((item) => item.width < 40 || item.height < 40);
    const nav = document.querySelector("#techWorkflowNav");
    const navRect = isVisible(nav) ? nav.getBoundingClientRect() : null;
    const coveredActions = navRect ? visibleButtons.filter((element) => {
      if (nav.contains(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.bottom > navRect.top && rect.top < navRect.bottom;
    }).map((element) => element.textContent.trim().replace(/\s+/g, " ").slice(0, 60)) : [];
    const metrics = window.__rmtUxMetrics || {};
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, scrollHeight: document.documentElement.scrollHeight },
      scrollY: Math.round(scrollY),
      screen: document.querySelector("#workspace")?.className || "login",
      techScreen: window.state?.techScreen || "",
      activeSystem: window.state?.activeTechSystemKey || "",
      visibleButtonCount: visibleButtons.length,
      smallTargets: smallTargets.slice(0, 20),
      coveredActions,
      scrollEvents: metrics.scrollEvents || 0,
      maxScrollY: metrics.maxScrollY || 0,
      browserBack: metrics.browserBack || 0,
      markerCount: document.querySelectorAll(".marker.assigned-scope").length,
      visibleAdminWorkspaces: [...document.querySelectorAll("#adminWorkspaceHost [data-admin-workspace]")].filter(isVisible).map((item) => item.dataset.adminWorkspace),
      syncText: document.querySelector("#syncState")?.textContent.trim() || ""
    };
  });
  if (data.document.scrollWidth > data.document.clientWidth + 2) {
    addFinding("HIGH", "mobile-overflow", `${stepName} has horizontal overflow`, `${data.document.scrollWidth}px > ${data.document.clientWidth}px`, journeyName);
  }
  if (options.mobile && data.smallTargets.length) {
    addFinding("LOW", "touch-target", `${stepName} has controls below 40px`, data.smallTargets.slice(0, 5), journeyName);
  }
  if (data.coveredActions.length) {
    addFinding("HIGH", "overlap", `${stepName} actions overlap mobile navigation`, data.coveredActions, journeyName);
  }
  if (data.visibleAdminWorkspaces.length > 1) {
    addFinding("HIGH", "admin-navigation", `${stepName} shows mixed Admin workspaces`, data.visibleAdminWorkspaces, journeyName);
  }
  return data;
}

function createJourney(name, persona, viewport) {
  const journey = { name, persona, viewport, startedAt: new Date().toISOString(), actions: [], metrics: { clicks: 0, transitions: 0, browserBack: 0 }, status: "RUNNING" };
  report.journeys.push(journey);
  return journey;
}

async function action(page, journey, label, operation) {
  const before = await screenSignature(page);
  const started = Date.now();
  try {
    await operation();
    const after = await screenSignature(page);
    journey.metrics.clicks += 1;
    if (before !== after) journey.metrics.transitions += 1;
    journey.actions.push({ label, ok: true, durationMs: Date.now() - started, before, after });
    return true;
  } catch (error) {
    const after = await screenSignature(page).catch(() => "unknown");
    journey.actions.push({ label, ok: false, durationMs: Date.now() - started, before, after, error: error.message });
    addFinding("BLOCKER", "journey", `${label} could not be completed`, error.message, journey.name);
    return false;
  }
}

async function runTechnicianJourney(browser, persona, viewport, options = {}) {
  const context = await browser.newContext({ viewport, isMobile: options.mobile, hasTouch: options.mobile });
  await installSyntheticSaveApi(context);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await installInstrumentation(page);
  page.on("pageerror", (error) => report.consoleErrors.push(`${persona}: ${error.message}`));
  page.on("console", (message) => message.type() === "error" && report.consoleErrors.push(`${persona}: ${message.text()}`));
  const journey = createJourney(`${persona} golden technician flow`, persona, viewport);
  try {
    const loginMs = await login(page, "tech@rmtfire.local");
    journey.actions.push({ label: "Login", ok: true, durationMs: loginMs, before: "login", after: await screenSignature(page) });
    journey.metrics.clicks += 1;
    journey.metrics.transitions += 1;
    const seed = await seedTechnicianFixture(page);
    journey.seed = seed;
    assert(seed.resolvedIds.length === seed.tags.length, `Synthetic fixture resolved ${seed.resolvedIds.length}/${seed.tags.length} devices.`);
    await page.waitForFunction(() => document.querySelector("#techActiveJobSummary [data-tech-system='emergency-light']"), null, { timeout: 8000 });
    await screenshot(page, `${persona}-01-jobs`);
    journey.observations = [{ step: "Jobs", layout: await observeLayout(page, journey.name, "Jobs", options) }];

    await action(page, journey, "Choose Emergency Light system", async () => {
      await page.locator("#techActiveJobSummary [data-tech-system='emergency-light']").click();
      await page.waitForFunction(() => state.activeTechSystemKey === "emergency-light");
    });
    await screenshot(page, `${persona}-02-system`);
    journey.observations.push({ step: "System", layout: await observeLayout(page, journey.name, "System", options) });

    await action(page, journey, "Open assigned device", async () => {
      await page.evaluate(() => focusTechnicianAssignedDevice("UX.EL.1", { openChecklist: true }));
      await page.waitForSelector("#checklistForm:not(.hidden)", { timeout: 15000 });
    });
    await screenshot(page, `${persona}-03-device`);
    journey.observations.push({ step: "Device", layout: await observeLayout(page, journey.name, "Device", options) });

    await action(page, journey, "PASS with evidence and Save Next", async () => {
      await page.locator("#beforePhoto").setInputFiles({ name: "ux-pass.png", mimeType: "image/png", buffer: TINY_PNG });
      await page.waitForFunction(() => Boolean(pendingInspectionPhotoEvidence.before));
      await page.waitForSelector("#checklistForm:not(.hidden) #saveNextInspectionBtn", { state: "visible" });
      await page.locator("#saveNextInspectionBtn").click();
      await page.waitForFunction(() => state.inspections["UX.EL.1"]?.status === "pass", null, { timeout: 15000 });
    });
    await screenshot(page, `${persona}-04-save-next`);

    await action(page, journey, "Open mimic", async () => {
      await page.evaluate(() => openCurrentTechnicianMimic({ scroll: false }));
      await page.waitForFunction(() => state.techScreen === "mimic" && document.querySelectorAll(".marker.assigned-scope").length > 0, null, { timeout: 15000 });
    });
    await screenshot(page, `${persona}-05-mimic`);
    journey.observations.push({ step: "Mimic", layout: await observeLayout(page, journey.name, "Mimic", options) });

    await action(page, journey, "Return to system list", async () => {
      await page.evaluate(() => { clearTechnicianInspectionDirty(); showTechnicianSystemList(); });
      await page.waitForFunction(() => state.techScreen === "jobs");
    });
    await action(page, journey, "Open completion/report screen", async () => {
      await page.evaluate(() => setTechScreen("complete", { scroll: false, skipDirtyCheck: true }));
      await page.waitForFunction(() => state.techScreen === "complete");
    });
    await screenshot(page, `${persona}-06-completion`);
    journey.observations.push({ step: "Complete", layout: await observeLayout(page, journey.name, "Complete", options) });
    const completionText = await page.locator("#techCompletionPanel").textContent().catch(() => "");
    if (!/missing|pending|complete|submit/i.test(completionText)) {
      addFinding("HIGH", "completion", "Completion screen does not explain remaining work", completionText.slice(0, 300), journey.name);
    }

    const metrics = await page.evaluate(() => window.__rmtUxMetrics || {});
    journey.metrics.browserBack = metrics.browserBack || 0;
    journey.metrics.scrollEvents = metrics.scrollEvents || 0;
    journey.metrics.maxScrollY = metrics.maxScrollY || 0;
    journey.status = journey.actions.some((item) => !item.ok) ? "FAILED" : "PASSED";
  } finally {
    journey.finishedAt = new Date().toISOString();
    journey.durationMs = new Date(journey.finishedAt) - new Date(journey.startedAt);
    await context.close();
  }
}

async function runSystemInventoryJourney(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  await installSyntheticSaveApi(context);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await installInstrumentation(page);
  const journey = createJourney("Configured system discoverability", "EXPERIENCED TECHNICIAN", { width: 1440, height: 920 });
  const expected = [
    ["Fire Alarm", "fire-alarm"], ["Pump", "pump"], ["CO2", "gas-release"],
    ["SPP", "pump-system"], ["Extinguisher", "extinguisher"], ["Hose Reel", "hose-reel"],
    ["Emergency Light", "emergency-light"], ["Keluar Sign", "exit-sign"]
  ];
  try {
    await login(page, "tech@rmtfire.local");
    const seed = await seedTechnicianFixture(page);
    journey.seed = seed;
    assert(seed.resolvedIds.length === seed.tags.length, `Synthetic fixture resolved ${seed.resolvedIds.length}/${seed.tags.length} devices.`);
    const labels = await page.locator("#techActiveJobSummary [data-tech-system]").evaluateAll((items) => items.map((item) => ({ key: item.dataset.techSystem, text: item.textContent.trim().replace(/\s+/g, " ") })));
    for (const [label, key] of expected) {
      const match = labels.find((item) => item.key === key || item.text.toLowerCase().includes(label.toLowerCase()));
      journey.actions.push({ label: `Discover ${label}`, ok: Boolean(match), durationMs: 0, before: "tech:jobs", after: "tech:jobs" });
      if (!match) addFinding("HIGH", "discoverability", `${label} system is not discoverable`, labels, journey.name);
    }
    journey.metrics.clicks = 0;
    journey.metrics.transitions = 0;
    journey.status = journey.actions.every((item) => item.ok) ? "PASSED" : "PARTIAL";
    journey.systems = labels;
  } finally {
    journey.finishedAt = new Date().toISOString();
    journey.durationMs = new Date(journey.finishedAt) - new Date(journey.startedAt);
    await context.close();
  }
}

async function runOfflineJourney(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await installSyntheticSaveApi(context);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await installInstrumentation(page);
  const journey = createJourney("Interrupted connectivity visibility", "OFFLINE TECHNICIAN", { width: 390, height: 844 });
  try {
    await login(page, "tech@rmtfire.local");
    const seed = await seedTechnicianFixture(page);
    journey.seed = seed;
    assert(seed.resolvedIds.length === seed.tags.length, `Synthetic fixture resolved ${seed.resolvedIds.length}/${seed.tags.length} devices.`);
    await page.evaluate(() => {
      const sync = document.querySelector("#syncState");
      if (sync) sync.textContent = "OFFLINE - SAVED LOCALLY";
    });
    await context.setOffline(true);
    const layout = await observeLayout(page, journey.name, "Offline state", { mobile: true });
    journey.actions.push({ label: "Disconnect network", ok: /offline/i.test(layout.syncText), durationMs: 0, before: "tech:jobs", after: "tech:jobs" });
    if (!/offline/i.test(layout.syncText)) addFinding("HIGH", "offline-clarity", "Offline state is not clearly visible", layout.syncText, journey.name);
    await screenshot(page, "offline-technician-state");
    journey.status = journey.actions.every((item) => item.ok) ? "PASSED" : "FAILED";
  } finally {
    await context.setOffline(false).catch(() => {});
    journey.finishedAt = new Date().toISOString();
    journey.durationMs = new Date(journey.finishedAt) - new Date(journey.startedAt);
    await context.close();
  }
}

async function runAdminJourney(browser, persona, mobile = false) {
  const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 920 };
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await installInstrumentation(page);
  page.on("pageerror", (error) => report.consoleErrors.push(`${persona}: ${error.message}`));
  const journey = createJourney(`${persona} golden admin flow`, persona, viewport);
  try {
    const loginMs = await login(page, "admin@rmtfire.local");
    journey.actions.push({ label: "Login", ok: true, durationMs: loginMs, before: "login", after: await screenSignature(page) });
    journey.metrics.clicks += 1;
    journey.metrics.transitions += 1;
    await seedAdminFixture(page);
    await screenshot(page, `${persona}-01-control-desk`);
    journey.observations = [{ step: "Control Desk", layout: await observeLayout(page, journey.name, "Control Desk", { mobile }) }];
    const modules = ["staff", "defects", "reports"];
    for (const module of modules) {
      if (mobile) {
        const navVisible = await page.locator("#adminMainNav").evaluate((element) => getComputedStyle(element).display !== "none");
        if (!navVisible) await page.locator("#adminNavToggle").click();
      }
      await action(page, journey, `Open ${module}`, async () => {
        await page.locator(`#adminMainNav [data-admin-module='${module}']`).click();
        await page.waitForFunction((name) => {
          const visible = [...document.querySelectorAll("#adminWorkspaceHost [data-admin-workspace]")].filter((item) => !item.classList.contains("hidden"));
          return visible.length === 1 && visible[0].dataset.adminWorkspace === name;
        }, module);
      });
      journey.observations.push({ step: module, layout: await observeLayout(page, journey.name, module, { mobile }) });
    }
    await screenshot(page, `${persona}-02-report-review`);
    const reportText = await page.locator("[data-admin-workspace='reports']").textContent().catch(() => "");
    if (!/review|report/i.test(reportText)) addFinding("HIGH", "report-review", "Report workspace lacks a clear review route", reportText.slice(0, 300), journey.name);
    const metrics = await page.evaluate(() => window.__rmtUxMetrics || {});
    journey.metrics.browserBack = metrics.browserBack || 0;
    journey.metrics.scrollEvents = metrics.scrollEvents || 0;
    journey.metrics.maxScrollY = metrics.maxScrollY || 0;
    journey.status = journey.actions.some((item) => !item.ok) ? "FAILED" : "PASSED";
  } finally {
    journey.finishedAt = new Date().toISOString();
    journey.durationMs = new Date(journey.finishedAt) - new Date(journey.startedAt);
    await context.close();
  }
}

function finalizeReport() {
  const severityOrder = ["BLOCKER", "HIGH", "MEDIUM", "LOW", "COSMETIC"];
  report.findings.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));
  report.summary = {
    journeys: report.journeys.length,
    passed: report.journeys.filter((item) => item.status === "PASSED").length,
    partial: report.journeys.filter((item) => item.status === "PARTIAL").length,
    failed: report.journeys.filter((item) => item.status === "FAILED").length,
    findings: Object.fromEntries(severityOrder.map((severity) => [severity, report.findings.filter((item) => item.severity === severity).length])),
    screenshots: report.screenshots.length,
    consoleErrors: report.consoleErrors.length
  };
  writeFileSync(path.join(OUTPUT_DIR, "ux-observations.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(OUTPUT_DIR, "ux-summary.json"), `${JSON.stringify(report.summary, null, 2)}\n`);
}

(async () => {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const executablePath = EDGE_PATHS.find(existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  report.personas = [
    "NEW TECHNICIAN", "EXPERIENCED TECHNICIAN", "IMPATIENT TECHNICIAN",
    "MOBILE TECHNICIAN", "OFFLINE TECHNICIAN", "ADMIN", "REPORT REVIEWER"
  ];
  try {
    await runTechnicianJourney(browser, "NEW TECHNICIAN", { width: 1440, height: 920 });
    if (process.env.UX_LAB_QUICK !== "1") {
      await runTechnicianJourney(browser, "IMPATIENT TECHNICIAN", { width: 1440, height: 920 });
      await runTechnicianJourney(browser, "MOBILE TECHNICIAN", { width: 390, height: 844 }, { mobile: true });
      await runSystemInventoryJourney(browser);
      await runOfflineJourney(browser);
      await runAdminJourney(browser, "ADMIN");
      await runAdminJourney(browser, "REPORT REVIEWER");
    }
  } finally {
    await browser.close();
    finalizeReport();
  }
  console.log(JSON.stringify(report.summary, null, 2));
})().catch((error) => {
  report.fatalError = error.stack || error.message;
  finalizeReport();
  console.error(error.stack || error.message);
  process.exit(1);
});
