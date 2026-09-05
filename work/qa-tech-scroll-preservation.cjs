const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260901-tech-scroll";
const ROOT = join(__dirname, "..");
const UOB_MASTER = join(ROOT, "outputs", "rmt-fire-local-data", "device-master", "uob-uob-device-master.json");
const MIMIC_MANIFEST = join(ROOT, "outputs", "rmt-fire-local-data", "mimic-library", "mimic-library-app-data.json");
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function getDeviceId(device) {
  return device.id || device.tag || "";
}

function buildUobFixture() {
  const master = readJson(UOB_MASTER);
  const manifest = readJson(MIMIC_MANIFEST);
  const floor = (manifest.floors || []).find((item) => item.companyName === "UOB" && item.siteName === "UOB" && /Page 1/i.test(item.title || item.floorName || ""))
    || (manifest.floors || []).find((item) => item.companyName === "UOB" && item.siteName === "UOB");
  assert(floor, "UOB mimic floor fixture was not found.");

  const isReferenceFloor = (device) => /Page 1/i.test(device.floor || "") || /G\.|GROUND|UOB\.TEST/i.test(device.tag || "");
  const devices = (master.devices || []).filter(isReferenceFloor);
  const mfap = devices.find((device) => /main fire alarm panel/i.test(device.type || "") || /MFAP/i.test(device.tag || ""));
  const mcp = devices.find((device) => /manual call point|break glass/i.test(device.type || "") || /\.MCP\./i.test(device.tag || ""));
  const smoke = devices.find((device) => /smoke detector/i.test(device.type || "") || /\.SD\./i.test(device.tag || ""));
  const emergencyExit = devices.find((device) => /emergency light|exit sign/i.test(device.type || "") || /\.(EL|EX)\./i.test(device.tag || ""));
  assert(mfap && mcp && smoke && emergencyExit, "UOB hierarchy devices were not found.");

  const selectedDevices = [mfap, mcp, smoke, emergencyExit].map((device) => ({
    ...device,
    id: getDeviceId(device),
    tag: getDeviceId(device),
    companyName: "UOB",
    siteName: "UOB",
    floorId: device.floorId || floor.id || floor.floorId,
    floorCode: device.floorCode || floor.floorCode || "P1",
    floor: device.floor || floor.title || "UOB - Page 1",
    floorTitle: device.floorTitle || device.floor || floor.title || "UOB - Page 1",
    xPercent: Number(device.xPercent ?? device.x ?? 20),
    yPercent: Number(device.yPercent ?? device.y ?? 20),
    status: device.status || "Confirmed"
  }));
  const scheduleId = `QA-UOB-SCROLL-${Date.now()}`;
  const plannedDeviceIds = selectedDevices.map((device) => device.tag);

  return {
    scheduleId,
    floor: {
      ...floor,
      id: floor.id || floor.floorId,
      floorId: floor.id || floor.floorId,
      title: floor.title || floor.floorName || "UOB - Page 1",
      floorCode: floor.floorCode || "P1",
      companyName: "UOB",
      siteName: "UOB",
      active: true
    },
    devices: selectedDevices,
    tags: {
      mfap: selectedDevices[0].tag,
      mcp: selectedDevices[1].tag,
      smoke: selectedDevices[2].tag,
      emergencyExit: selectedDevices[3].tag
    },
    schedule: {
      scheduleId,
      status: "Scheduled",
      clientSource: "existing",
      companyName: "UOB",
      siteName: "UOB",
      address: "QA test only",
      floorId: floor.id || floor.floorId,
      startFloorId: floor.id || floor.floorId,
      floorTitle: floor.title || floor.floorName || "UOB - Page 1",
      startFloorTitle: floor.title || floor.floorName || "UOB - Page 1",
      date: new Date().toISOString().slice(0, 10),
      time: "09:00",
      technician: "Demo Technician",
      serviceType: "Maintenance / Inspection",
      scope: "yearly-100",
      scopeLabel: "UOB Scroll QA",
      priority: "Normal",
      contractFrequencyPercent: 100,
      scopeSelectionMode: "selected-floor",
      plannedDeviceIds,
      deviceCount: plannedDeviceIds.length,
      activeCount: 1,
      passiveCount: plannedDeviceIds.length - 1,
      plannedFloorCounts: [{ floorId: floor.id || floor.floorId, floorTitle: floor.title || floor.floorName || "UOB - Page 1", count: plannedDeviceIds.length }]
    }
  };
}

async function loginAsTech(page) {
  await page.click("[data-demo-login='tech']");
  await page.fill("#loginPassword", new Date().toISOString());
  await page.click("#loginForm button[type='submit']");
  await page.waitForSelector("#workspace.technician-mode", { timeout: 15000 });
}

async function seedFixture(page, fixture) {
  await page.evaluate((fixtureData) => {
    const qaTags = fixtureData.devices.map((device) => device.tag);
    state.activeJob = null;
    state.activeTechPreviewScheduleId = "";
    state.activeTechSystemKey = "";
    state.activeTechFloorId = "";
    state.focusedMapTag = "";
    state.selectedSetupTag = "";
    state.inspections = {};
    state.criticalSops = {};
    state.systemChecks = {};
    state.siteProfile = { companyName: "UOB", siteName: "UOB" };
    state.mimicFloors = [
      fixtureData.floor,
      ...state.mimicFloors.filter((floor) => (floor.id || floor.floorId) !== fixtureData.floor.id)
    ];
    state.setupDevices = [
      ...state.setupDevices.filter((device) => !qaTags.includes(device.tag)),
      ...fixtureData.devices
    ];
    state.schedules = [
      fixtureData.schedule,
      ...state.schedules.filter((schedule) => schedule.scheduleId !== fixtureData.schedule.scheduleId)
    ];
    writeStoredJson("rmtActiveJob", state.activeJob);
    writeStoredJson("tmFireInspections", state.inspections);
    writeStoredJson("rmtCriticalSops", state.criticalSops);
    writeStoredJson("rmtSystemChecks", state.systemChecks);
    writeStoredJson("rmtMimicFloors", state.mimicFloors);
    writeStoredJson("tmFireSetupDevices", state.setupDevices);
    writeStoredJson("rmtSchedules", state.schedules);
    selectClientProfile(state.siteProfile);
    invalidateRuntimeCaches();
    renderTechWorkPanel();
  }, fixture);
}

async function openUobFireAlarm(page, fixture) {
  await page.locator(`[data-tech-start-schedule="${fixture.scheduleId}"]`).first().click();
  await page.waitForFunction((scheduleId) => {
    const activeId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
    return activeId === scheduleId && document.querySelector("#techActiveJobSummary [data-tech-system='fire-alarm']");
  }, fixture.scheduleId, { timeout: 15000 });
  await page.locator("#techActiveJobSummary [data-tech-system='fire-alarm']").click();
  await page.waitForFunction(({ scheduleId, mfapTag }) => {
    const activeId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
    return activeId === scheduleId
      && state.activeTechSystemKey === "fire-alarm"
      && document.querySelector("#workspace")?.classList.contains("tech-screen-inspection")
      && document.querySelector("#workspace")?.classList.contains("critical-sop-active")
      && document.querySelector("#criticalSopPanel h2")?.textContent.includes(mfapTag);
  }, { scheduleId: fixture.scheduleId, mfapTag: fixture.tags.mfap }, { timeout: 20000 });
  await page.evaluate((scheduleId) => focusTechnicianSystemMimic(scheduleId, "fire-alarm", { scroll: false }), fixture.scheduleId);
  await page.waitForFunction((scheduleId) => {
    const activeId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
    return activeId === scheduleId
      && state.activeTechSystemKey === "fire-alarm"
      && document.querySelector("#workspace")?.classList.contains("tech-screen-mimic")
      && document.querySelector("#techSystemStagePanel:not(.hidden)")
      && document.querySelectorAll(".marker.assigned-scope").length > 0;
  }, fixture.scheduleId, { timeout: 20000 });
}

async function installScrollProbe(page) {
  await page.evaluate(() => {
    window.__rmtScrollProbe = [];
    const log = (type, detail = {}) => {
      window.__rmtScrollProbe.push({
        type,
        detail,
        time: Math.round(performance.now()),
        winY: Math.round(window.scrollY || 0),
        mapTop: Math.round(document.querySelector("#mapStage")?.scrollTop || 0),
        activeElement: document.activeElement?.id || document.activeElement?.dataset?.label || document.activeElement?.tagName || "",
        stack: String(new Error().stack || "").split("\n").slice(2, 7).join(" | ")
      });
    };
    const originalWindowScrollTo = window.scrollTo.bind(window);
    window.scrollTo = (...args) => {
      log("window.scrollTo", { args });
      return originalWindowScrollTo(...args);
    };
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function patchedScrollIntoView(...args) {
      log("element.scrollIntoView", { id: this.id || "", className: this.className || "", args });
      return originalScrollIntoView.apply(this, args);
    };
    const originalFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function patchedFocus(...args) {
      log("element.focus", { id: this.id || "", className: this.className || "", args });
      return originalFocus.apply(this, args);
    };
    ["setTechScreen", "renderTechSystemStagePanel", "renderTechAssignedItemList", "renderTechWorkPanel", "renderMarkers", "refreshTechnicianAssignedPins", "refreshSelectedFloorView", "renderFloorOptions"].forEach((name) => {
      const original = window[name];
      if (typeof original !== "function" || original.__scrollProbeWrapped) return;
      window[name] = function wrappedScrollProbeFunction(...args) {
        log(`${name}:start`, { args: args.map((arg) => typeof arg === "object" ? Object.keys(arg || {}) : arg) });
        const result = original.apply(this, args);
        log(`${name}:end`);
        return result;
      };
      window[name].__scrollProbeWrapped = true;
    });
  });
}

async function setManualScrollPosition(page) {
  return page.evaluate(() => {
    const mapPanel = document.querySelector(".map-panel");
    const mapStage = document.querySelector("#mapStage");
    const top = mapPanel ? mapPanel.getBoundingClientRect().top + window.scrollY + 160 : 220;
    window.scrollTo(0, top);
    if (mapStage) {
      mapStage.scrollTop = Math.min(180, Math.max(0, mapStage.scrollHeight - mapStage.clientHeight));
      mapStage.scrollLeft = 0;
    }
    return {
      winY: Math.round(window.scrollY || 0),
      mapTop: Math.round(mapStage?.scrollTop || 0),
      mapMax: Math.round(mapStage ? mapStage.scrollHeight - mapStage.clientHeight : 0),
      bodyHeight: Math.round(document.documentElement.scrollHeight || 0),
      viewportHeight: Math.round(window.innerHeight || 0)
    };
  });
}

async function getScrollPosition(page, label) {
  return page.evaluate((name) => ({
    label: name,
    winY: Math.round(window.scrollY || 0),
    mapTop: Math.round(document.querySelector("#mapStage")?.scrollTop || 0),
    probeTail: (window.__rmtScrollProbe || []).slice(-12)
  }), label);
}

async function triggerAndMeasure(page, label, trigger) {
  const before = await getScrollPosition(page, `${label}:before`);
  await trigger();
  await page.waitForTimeout(200);
  const after = await getScrollPosition(page, `${label}:after`);
  return {
    label,
    before: { winY: before.winY, mapTop: before.mapTop },
    after: { winY: after.winY, mapTop: after.mapTop },
    winDelta: after.winY - before.winY,
    mapDelta: after.mapTop - before.mapTop,
    probeTail: after.probeTail
  };
}

async function simulateScrollGestureStartingOnMarker(page, tag) {
  return page.evaluate((deviceTag) => {
    const marker = [...document.querySelectorAll(".marker.assigned-scope")]
      .find((item) => item.dataset.setupTag === deviceTag || item.dataset.deviceId === deviceTag || item.dataset.label === deviceTag);
    if (!marker) return { ok: false, reason: "marker missing" };
    const rect = marker.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    marker.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 7,
      pointerType: "touch",
      clientX: startX,
      clientY: startY
    }));
    marker.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: 7,
      pointerType: "touch",
      clientX: startX,
      clientY: startY + 96
    }));
    marker.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 7,
      pointerType: "touch",
      clientX: startX,
      clientY: startY + 96
    }));
    return {
      ok: true,
      screen: state.techScreen,
      criticalActive: document.querySelector("#workspace")?.classList.contains("critical-sop-active"),
      checklistOpen: !document.querySelector("#checklistForm")?.classList.contains("hidden"),
      syncState: document.querySelector("#syncState")?.textContent || ""
    };
  }, tag);
}

async function simulateTapOnMarker(page, tag) {
  return page.evaluate((deviceTag) => {
    const marker = [...document.querySelectorAll(".marker.assigned-scope")]
      .find((item) => item.dataset.setupTag === deviceTag || item.dataset.deviceId === deviceTag || item.dataset.label === deviceTag);
    if (!marker) return { ok: false, reason: "marker missing" };
    const rect = marker.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    marker.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 8,
      pointerType: "touch",
      clientX: x,
      clientY: y
    }));
    marker.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 8,
      pointerType: "touch",
      clientX: x,
      clientY: y
    }));
    return { ok: true };
  }, tag);
}

(async () => {
  const executablePath = EDGE_PATHS.find((item) => existsSync(item));
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ viewport: { width: 393, height: 727 }, isMobile: true, hasTouch: true });
  const fixture = buildUobFixture();
  await context.route("**/api/schedules", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      schedules: [fixture.schedule],
      savedAt: new Date().toISOString(),
      savedByApp: "RMT Fire Inspection App Scroll QA"
    })
  }));
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await loginAsTech(page);
  await seedFixture(page, fixture);
  await openUobFireAlarm(page, fixture);
  await installScrollProbe(page);

  const initialScroll = await setManualScrollPosition(page);
  assert(initialScroll.winY > 40 || initialScroll.mapTop > 0, `Unable to create a meaningful scroll position: ${JSON.stringify(initialScroll)}`);

  const probes = [];
  probes.push(await triggerAndMeasure(page, "renderMarkers", () => page.evaluate(() => renderMarkers())));
  probes.push(await triggerAndMeasure(page, "renderTechSystemStagePanel", () => page.evaluate(() => renderTechSystemStagePanel(getActiveTechnicianMaintenanceSchedule()))));
  probes.push(await triggerAndMeasure(page, "renderTechAssignedItemList", () => page.evaluate(() => renderTechAssignedItemList())));
  probes.push(await triggerAndMeasure(page, "renderTechWorkPanel", () => page.evaluate(() => renderTechWorkPanel())));
  probes.push(await triggerAndMeasure(page, "refreshTechnicianAssignedPins-no-scroll", () => page.evaluate(() => refreshTechnicianAssignedPins({ scrollToMap: false }))));
  const markerScrollGesture = await triggerAndMeasure(page, "scroll-gesture-starting-on-locked-marker", async () => {
    const result = await simulateScrollGestureStartingOnMarker(page, fixture.tags.mcp);
    assert(result.ok, `Unable to simulate marker scroll gesture: ${result.reason || ""}`);
  });
  const postGesture = await page.evaluate(() => ({
    screen: state.techScreen,
    criticalActive: document.querySelector("#workspace")?.classList.contains("critical-sop-active"),
    checklistOpen: !document.querySelector("#checklistForm")?.classList.contains("hidden"),
    syncState: document.querySelector("#syncState")?.textContent || ""
  }));
  probes.push(markerScrollGesture);

  const unexpected = probes.find((probe) => probe.after.winY < Math.max(0, probe.before.winY - 60) || probe.after.mapTop < Math.max(0, probe.before.mapTop - 60));
  if (unexpected) {
    throw new Error(`Unexpected technician scroll jump after ${unexpected.label}: ${JSON.stringify(unexpected, null, 2)}`);
  }
  assert(postGesture.screen === "mimic" && !postGesture.criticalActive && !postGesture.checklistOpen, `Scroll gesture over marker was treated as a tap: ${JSON.stringify(postGesture, null, 2)}`);
  const tapResult = await simulateTapOnMarker(page, fixture.tags.mcp);
  assert(tapResult.ok, `Unable to simulate genuine marker tap: ${tapResult.reason || ""}`);
  await page.waitForFunction((mfapTag) => {
    const syncText = document.querySelector("#syncState")?.textContent || "";
    return syncText.includes("Blocked:")
      && syncText.includes(mfapTag)
      && document.querySelector("#workspace")?.classList.contains("critical-sop-active");
  }, fixture.tags.mfap, { timeout: 15000 });
  const genuineTap = await page.evaluate(() => ({
    screen: state.techScreen,
    criticalActive: document.querySelector("#workspace")?.classList.contains("critical-sop-active"),
    syncState: document.querySelector("#syncState")?.textContent || ""
  }));
  assert(!consoleErrors.length, `Console errors: ${consoleErrors.join(" | ")}`);

  console.log(JSON.stringify({
    initialScroll,
    probes: probes.map((probe) => ({
      label: probe.label,
      before: probe.before,
      after: probe.after,
      winDelta: probe.winDelta,
      mapDelta: probe.mapDelta
    })),
    postGesture,
    genuineTap,
    consoleErrors
  }, null, 2));

  await context.close();
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
