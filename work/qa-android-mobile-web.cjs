const { existsSync, mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { chromium, devices } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260820-audit-tracking";
const OUTPUT_DIR = join(__dirname, "..", "outputs", "fire-inspection-mvp", "mobile-qa");
const QA_LOGIN_TEXT = new Date().toISOString();
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoHorizontalOverflow(result, label) {
  assert(
    result.scrollWidth <= result.clientWidth + 2,
    `${label} has horizontal page overflow: scrollWidth ${result.scrollWidth}, clientWidth ${result.clientWidth}.`
  );
}

async function tapVisibleCenter(page, locator, label) {
  await locator.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  await page.waitForTimeout(150);
  const tap = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      rect: {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      ok: Boolean(hit && (hit === element || element.contains(hit))),
      description: hit ? `${hit.tagName}.${hit.className || ""} ${hit.textContent.trim().replace(/\s+/g, " ").slice(0, 80)}` : "nothing"
    };
  });
  assert(tap.rect.width > 0 && tap.rect.height > 0, `${label} is not visible for tapping`);
  assert(tap.ok, `${label} is covered at tap point by ${tap.description} (${JSON.stringify(tap.rect)})`);
  await page.touchscreen.tap(tap.x, tap.y);
}

async function showTechJobs(page) {
  await page.evaluate(() => setTechScreen("jobs"));
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("tech-screen-jobs"), null, { timeout: 15000 });
}

async function openTechnicianJob(page, companyName) {
  await showTechJobs(page);
  const card = page.locator(".tech-job-card", { hasText: companyName }).first();
  await card.waitFor({ state: "visible", timeout: 15000 });
  const button = card.getByRole("button", { name: /Open Job|Resume Job|Start Job/ }).first();
  await button.waitFor({ state: "visible", timeout: 15000 });
  const scheduleId = await button.getAttribute("data-tech-start-schedule");
  assert(scheduleId, `No schedule id found on ${companyName} job action.`);
  await button.click();
  try {
    await page.waitForFunction(({ scheduleId, companyName }) => {
      const activeScheduleId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
      const summaryText = document.querySelector("#techActiveJobSummary")?.textContent || "";
      return activeScheduleId === scheduleId
        && summaryText.includes(companyName)
        && document.querySelectorAll("#techActiveJobSummary .tech-system-grid button").length > 0;
    }, { scheduleId, companyName }, { timeout: 15000 });
  } catch (error) {
    const debug = await page.evaluate(() => {
      const activeSchedule = getActiveTechnicianMaintenanceSchedule?.();
      const markerSchedule = getTechMarkerScopeSchedule?.();
      return {
        syncState: document.querySelector("#syncState")?.textContent || "",
        activeJob: state.activeJob ? {
          jobId: state.activeJob.jobId,
          scheduleId: state.activeJob.scheduleId || state.activeJob.schedule?.scheduleId || "",
          companyName: state.activeJob.companyName,
          status: state.activeJob.status
        } : null,
        seedDebug: window.__androidQaSeedDebug || null,
        currentQaTags: state.setupDevices
          .filter((device) => /^WETEX\.QA\.|^UOB\.QA\.|^MTB\.QA\./.test(String(device.tag || "")))
          .map((device) => device.tag),
        activeSchedule: activeSchedule ? {
          scheduleId: activeSchedule.scheduleId,
          companyName: activeSchedule.companyName,
          status: activeSchedule.status,
          plannedCount: activeSchedule.plannedDeviceIds?.length || 0,
          plannedIds: activeSchedule.plannedDeviceIds || [],
          assignedCount: getScheduledAssignedDevices(activeSchedule).length,
          groupLabels: getTechnicianFireSystemGroups(activeSchedule).map((group) => `${group.label}:${group.devices.length}`),
          setupMatches: (activeSchedule.plannedDeviceIds || []).map((id) => {
            const device = state.setupDevices.find((item) => item.tag === id);
            return device ? {
              tag: device.tag,
              type: device.type,
              floorId: device.floorId,
              companyName: device.companyName,
              siteName: device.siteName
            } : { tag: id, missing: true };
          })
        } : null,
        markerSchedule: markerSchedule ? {
          scheduleId: markerSchedule.scheduleId,
          companyName: markerSchedule.companyName,
          plannedCount: markerSchedule.plannedDeviceIds?.length || 0
        } : null,
        activeSummaryText: document.querySelector("#techActiveJobSummary")?.textContent.trim() || "",
        jobText: document.querySelector("#techAssignedJobs")?.textContent.trim() || ""
      };
    });
    throw new Error(`Opening ${companyName} did not activate the selected technician job: ${JSON.stringify({ scheduleId, ...debug }, null, 2)}`);
  }
  return scheduleId;
}

async function openTechnicianSystem(page, companyName, systemName = "Fire Alarm") {
  const scheduleId = await openTechnicianJob(page, companyName);
  const activeSummary = page.locator("#techActiveJobSummary");
  const button = activeSummary.locator("[data-tech-system]", { hasText: systemName }).first();
  await button.waitFor({ state: "visible", timeout: 15000 });
  await button.click();
  await page.waitForSelector("#workspace.tech-screen-mimic", { timeout: 15000 });
  await page.waitForFunction(({ scheduleId }) => {
    const activeScheduleId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
    const markerScheduleId = getTechMarkerScopeSchedule?.()?.scheduleId || "";
    return activeScheduleId === scheduleId && markerScheduleId === scheduleId;
  }, { scheduleId }, { timeout: 15000 });
  await waitForAssignedPins(page, `${companyName} ${systemName}`);
}

async function loginAs(page, email, password) {
  await page.evaluate(({ email, password }) => {
    const emailInput = document.querySelector("#loginEmail");
    const passwordInput = document.querySelector("#loginPassword");
    if (!emailInput || !passwordInput) throw new Error("Login inputs are not available");
    emailInput.value = email;
    passwordInput.value = password;
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#loginForm")?.requestSubmit();
  }, { email, password });
}

async function stubSaveRoutes(context) {
  await context.route("**/api/save-schedules", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, count: 1 })
  }));
  await context.route("**/api/save-inspection-run", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, runKey: "android-qa-run" })
  }));
}

async function waitForWorkspace(page) {
  await page.waitForFunction(() => {
    const workspace = document.querySelector("#workspace");
    return Boolean(workspace && !workspace.classList.contains("hidden"));
  }, null, { timeout: 15000 });
}

async function waitForInitialDataLoad(page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function waitForAssignedPins(page, label) {
  try {
    await page.waitForFunction(() => document.querySelectorAll(".marker.assigned-scope").length > 0, null, { timeout: 15000 });
  } catch (error) {
    const debug = await page.evaluate(() => {
      const schedule = getTechMarkerScopeSchedule?.();
      const floor = getFloorAsset(floorSelect.value);
      return {
        activePreview: state.activeTechPreviewScheduleId,
        activeJobSchedule: state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "",
        selectedFloor: floorSelect.value,
        floorTitle: floor?.title || "",
        scheduleId: schedule?.scheduleId || "",
        scheduleCompany: schedule?.companyName || "",
        plannedIds: (schedule?.plannedDeviceIds || []).slice(0, 12),
        assignedDeviceCount: getScheduledAssignedDevices(schedule).length,
        currentFloorSetupCount: getCurrentFloorSetupDevices().length,
        markerCount: document.querySelectorAll(".marker").length,
        assignedMarkerCount: document.querySelectorAll(".marker.assigned-scope").length,
        setupMarkerCount: document.querySelectorAll(".marker.setup-marker").length,
        syncState: document.querySelector("#syncState")?.textContent || "",
        techList: document.querySelector("#techAssignedItemList")?.textContent || ""
      };
    });
    throw new Error(`${label} assigned pins did not appear: ${JSON.stringify(debug, null, 2)}`);
  }
}

async function seedTemporaryMtbSchedule(page) {
  const seeded = await page.evaluate(() => {
    const specs = [
      { scheduleId: "QA-MOBILE-WETEX", companyName: "WETEX", siteName: "WETEX QA", floorId: "qa-wetex-lv1", floorTitle: "WETEX QA L1", prefix: "WETEX.QA", time: "09:00" },
      { scheduleId: "QA-MOBILE-UOB", companyName: "UOB", siteName: "UOB", floorId: "qa-uob-lv1", floorTitle: "UOB QA Ground Floor", prefix: "UOB.QA", time: "10:00" },
      { scheduleId: "QA-MOBILE-MTB", companyName: "MTB Reality Sdn Bhd", siteName: "Bandar Hilir", floorId: "qa-mtb-lv1", floorTitle: "MTB Reality QA L1", prefix: "MTB.QA", time: "10:30" }
    ];
    const fallbackSeedDevices = devices.filter((device) => deviceMatchesScheduleScope(device, "fire-alarm")).slice(0, 6);
    if (!fallbackSeedDevices.length) return false;
    const syntheticFloors = [];
    const syntheticDevices = [];
    const schedules = [];
    const today = formatDateValue(new Date());
    state.activeJob = null;
    state.activeTechPreviewScheduleId = null;
    state.activeTechSystemKey = "";
    state.inspections = {};
    state.criticalSops = {};
    state.systemChecks = {};
    writeStoredJson("rmtActiveJob", state.activeJob);
    writeStoredJson("tmFireInspections", state.inspections);
    writeStoredJson("rmtCriticalSops", state.criticalSops);
    writeStoredJson("rmtSystemChecks", state.systemChecks);

    const buildFallbackScope = (spec, profile) => {
      const floor = {
        id: spec.floorId,
        floorId: spec.floorId,
        title: spec.floorTitle,
        floorCode: "L1",
        companyName: profile.companyName,
        siteName: profile.siteName,
        src: defaultFloorAssets.lv1.src,
        cleanSrc: defaultFloorAssets.lv1.src,
        active: true
      };
      const pool = fallbackSeedDevices.map((device, index) => ({
        id: `${spec.prefix}.${index + 1}`,
        tag: `${spec.prefix}.${index + 1}`,
        type: device.type,
        short: device.short,
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: device.location,
        xPercent: device.x,
        yPercent: device.y,
        status: "Confirmed"
      }));
      syntheticFloors.push(floor);
      syntheticDevices.push(...pool);
      return { floor, devices: pool, source: "synthetic" };
    };

    specs.forEach((spec) => {
      const profile = {
        companyName: spec.companyName,
        siteName: spec.siteName
      };
      const realFloors = getScheduleFloorsForSite(profile).filter((floor) => !isGeneralScheduleFloorId(floor.id || floor.floorId));
      let selectedFloor = null;
      let pool = [];
      for (const floor of realFloors) {
        const floorId = floor.id || floor.floorId;
        const devicesForFloor = getDevicesForScheduleFloor(floorId, profile)
          .filter((device) => deviceMatchesScheduleScope(device, "fire-alarm"));
        if (devicesForFloor.length) {
          selectedFloor = floor;
          pool = devicesForFloor.slice(0, 6);
          break;
        }
      }
      if (!pool.length) {
        const fallback = buildFallbackScope(spec, profile);
        selectedFloor = fallback.floor;
        pool = fallback.devices;
      }
      const floorId = selectedFloor.id || selectedFloor.floorId;
      const floorTitle = selectedFloor.title || selectedFloor.floorTitle || spec.floorTitle;
      const floorCode = selectedFloor.floorCode || getFloorCode(floorId);
      const plannedIds = pool.map((device) => device.id || device.tag).filter(Boolean);
      schedules.push({
        scheduleId: spec.scheduleId,
        status: "Scheduled",
        companyName: profile.companyName,
        siteName: profile.siteName,
        clientSource: "Existing Client",
        floorId,
        floorTitle,
        floorCode,
        startFloorId: floorId,
        startFloorTitle: floorTitle,
        date: today,
        time: spec.time,
        technician: "Technician Pool",
        serviceType: "Maintenance / Inspection",
        scope: "fire-alarm",
        scopeLabel: `QA ${spec.companyName} Phone Pins`,
        scopeSelectionMode: "selected-floor",
        contractFrequencyPercent: 100,
        plannedDeviceIds: plannedIds,
        plannedFloorCounts: [{ floorId, floorTitle, count: plannedIds.length }],
        priority: "Normal",
        notes: "Temporary Android QA schedule only.",
        deviceCount: plannedIds.length,
        totalFloorDeviceCount: plannedIds.length,
        passiveCount: pool.filter((device) => isPassiveScopeDevice(device)).length,
        activeCount: pool.filter((device) => isActiveSystem(device.type)).length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    state.mimicFloors = [
      ...syntheticFloors,
      ...state.mimicFloors.filter((item) => !syntheticFloors.some((floor) => floor.id === item.id))
    ];
    state.setupDevices = [
      ...syntheticDevices,
      ...state.setupDevices.filter((device) => !specs.some((spec) => String(device.tag || "").startsWith(`${spec.prefix}.`)))
    ];
    state.schedules = schedules;
    writeStoredJson("rmtSchedules", state.schedules);
    writeStoredJson("rmtMimicFloors", state.mimicFloors);
    writeStoredJson("tmFireSetupDevices", state.setupDevices);
    renderTechWorkPanel();
    window.__androidQaSeedDebug = {
      ok: schedules.every((schedule) => schedule.plannedDeviceIds.length),
      schedules: schedules.map((schedule) => ({
        scheduleId: schedule.scheduleId,
        companyName: schedule.companyName,
        floorId: schedule.floorId,
        plannedDeviceIds: schedule.plannedDeviceIds
      })),
      setupQaTags: state.setupDevices
        .filter((device) => specs.some((spec) => String(device.tag || "").startsWith(`${spec.prefix}.`)))
        .map((device) => device.tag)
    };
    return window.__androidQaSeedDebug;
  });
  assert(seeded.ok, `Unable to seed temporary MTB schedule for Android QA: ${JSON.stringify(seeded, null, 2)}`);
}

function ensureQaFaultPhoto() {
  const photoPath = join(OUTPUT_DIR, "android-qa-fault-photo.png");
  if (!existsSync(photoPath)) {
    writeFileSync(photoPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lCOgSwAAAABJRU5ErkJggg==", "base64"));
  }
  return photoPath;
}

(async () => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const executablePath = EDGE_PATHS.find((path) => existsSync(path));
  assert(executablePath, "No Edge/Chrome executable found for Android web QA.");

  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({
    ...devices["Pixel 5"],
    locale: "en-US"
  });
  await stubSaveRoutes(context);
  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
      browserErrors.push(message.text());
    }
  });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await loginAs(page, "tech@rmtfire.local", QA_LOGIN_TEXT);
  await waitForWorkspace(page);
  await waitForInitialDataLoad(page);
  await showTechJobs(page);
  await seedTemporaryMtbSchedule(page);
  await showTechJobs(page);
  await page.locator(".tech-job-card").first().waitFor({ state: "visible", timeout: 15000 });

  const jobText = await page.locator("#techAssignedJobs").innerText();
  assert(jobText.includes("WETEX"), "WETEX job is not visible in technician job list.");
  assert(jobText.includes("UOB"), "UOB job is not visible in technician job list.");
  assert(jobText.includes("MTB Reality"), "MTB job is not visible in technician job list.");

  const faultPhotoPath = ensureQaFaultPhoto();

  await openTechnicianJob(page, "WETEX");
  const listFirstResult = await page.evaluate(() => {
    const isVisible = (selector) => {
      const element = document.querySelector(selector);
      return Boolean(element && element.getClientRects().length && getComputedStyle(element).display !== "none");
    };
    return {
      activeJobText: document.querySelector("#techActiveJobSummary")?.textContent.trim() || "",
      jobCards: document.querySelectorAll(".tech-job-card").length,
      systemButtons: document.querySelectorAll("#techActiveJobSummary [data-tech-system]").length,
      workflowNavVisible: isVisible("#techWorkflowNav"),
      diagnosticsVisible: isVisible("#diagnosticsPanel"),
      suggestVisible: isVisible("#showRequestBtn"),
      contentGridHidden: !isVisible(".content-grid")
    };
  });

  await openTechnicianSystem(page, "WETEX", "Fire Alarm");
  const wetexResult = await page.evaluate(() => ({
    title: document.querySelector("#mapTitle")?.textContent.trim(),
    floor: document.querySelector("#floorSelect")?.selectedOptions?.[0]?.textContent.trim(),
    assignedPins: document.querySelectorAll(".marker.assigned-scope").length,
    activeJobText: document.querySelector("#techActiveJobSummary")?.textContent.trim() || "",
    techScreen: [...document.querySelector("#workspace")?.classList || []].filter((name) => name.startsWith("tech-screen-")).join(" "),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  await page.screenshot({ path: join(OUTPUT_DIR, "android-wetex-view-pins.png"), fullPage: false });

  const passMarkerCount = await page.locator(".marker.assigned-scope:not(.critical-marker)").count();
  const passMarker = passMarkerCount
    ? page.locator(".marker.assigned-scope:not(.critical-marker)").first()
    : page.locator(".marker.assigned-scope").first();
  await tapVisibleCenter(page, passMarker, "WETEX Fire Alarm assigned pin for PASS");
  await page.waitForSelector("#workspace.tech-screen-inspection", { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector("#checklistForm")?.classList.contains("hidden"), null, { timeout: 15000 });
  const autoStartItemResult = await page.evaluate(() => {
    const isVisible = (selector) => {
      const element = document.querySelector(selector);
      return Boolean(element && element.getClientRects().length && getComputedStyle(element).display !== "none");
    };
    return {
      activeJobText: document.querySelector("#techActiveJobSummary")?.textContent.trim(),
      checklistOpen: !document.querySelector("#checklistForm")?.classList.contains("hidden"),
      criticalSopOpen: document.querySelector("#workspace")?.classList.contains("critical-sop-active"),
      selectedDevice: document.querySelector("#deviceName")?.textContent.trim() || "",
      faultFieldsHiddenBeforeFault: !isVisible(".fault-evidence-row") && !isVisible(".inspection-notes-field"),
      questionListHidden: !isVisible("#questionList"),
      actionText: document.querySelector("#checklistForm button[type='submit']")?.textContent.trim() || ""
    };
  });
  await page.locator("#checklistForm button[type='submit']").click();
  await page.waitForSelector("#workspace.tech-screen-mimic", { timeout: 15000 });
  const autoStartTapResult = await page.evaluate(() => ({
    backOnMimic: document.querySelector("#workspace")?.classList.contains("tech-screen-mimic"),
    checklistHidden: document.querySelector("#checklistForm")?.classList.contains("hidden"),
    syncState: document.querySelector("#syncState")?.textContent.trim() || "",
    passMarkers: document.querySelectorAll(".marker.assigned-scope.pass").length
  }));

  const failMarkerCount = await page.locator(".marker.assigned-scope:not(.critical-marker):not(.pass)").count();
  const failMarker = failMarkerCount
    ? page.locator(".marker.assigned-scope:not(.critical-marker):not(.pass)").first()
    : page.locator(".marker.assigned-scope:not(.critical-marker)").nth(1);
  await tapVisibleCenter(page, failMarker, "WETEX Fire Alarm assigned pin for FAULT");
  await page.waitForSelector("#workspace.tech-screen-inspection", { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector("#checklistForm")?.classList.contains("hidden"), null, { timeout: 15000 });
  const faultFieldsBefore = await page.evaluate(() => {
    const isVisible = (selector) => {
      const element = document.querySelector(selector);
      return Boolean(element && element.getClientRects().length && getComputedStyle(element).display !== "none");
    };
    return {
      photosVisible: isVisible(".fault-evidence-row"),
      notesVisible: isVisible(".inspection-notes-field"),
      failButton: document.querySelector("#markFailBtn")?.textContent.trim() || ""
    };
  });
  await page.locator("#markFailBtn").click();
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("tech-fault-entry-active"), null, { timeout: 15000 });
  const faultFieldsAfter = await page.evaluate(() => {
    const isVisible = (selector) => {
      const element = document.querySelector(selector);
      return Boolean(element && element.getClientRects().length && getComputedStyle(element).display !== "none");
    };
    return {
      photosVisible: isVisible(".fault-evidence-row"),
      notesVisible: isVisible(".inspection-notes-field"),
      failButton: document.querySelector("#markFailBtn")?.textContent.trim() || ""
    };
  });
  await page.locator("#notes").fill("Android QA fault evidence test.");
  await page.setInputFiles("#beforePhoto", faultPhotoPath);
  await page.locator("#markFailBtn").click();
  await page.waitForSelector("#workspace.tech-screen-mimic", { timeout: 15000 });
  const tapResult = await page.evaluate(() => ({
    backOnMimic: document.querySelector("#workspace")?.classList.contains("tech-screen-mimic"),
    checklistHidden: document.querySelector("#checklistForm")?.classList.contains("hidden"),
    faultFieldsCleared: !document.querySelector("#workspace")?.classList.contains("tech-fault-entry-active"),
    failMarkers: document.querySelectorAll(".marker.assigned-scope.fail").length,
    syncState: document.querySelector("#syncState")?.textContent.trim() || ""
  }));
  await page.screenshot({ path: join(OUTPUT_DIR, "android-wetex-start-tap-pin.png"), fullPage: false });

  const mapFocusResult = await page.evaluate(() => {
    const marker = document.querySelector(".marker.map-focus-marker");
    const stage = document.querySelector("#mapStage");
    const focusedLabel = marker?.dataset.label || marker?.dataset.setupTag || marker?.dataset.deviceId || "";
    const device = typeof state !== "undefined"
      ? state.setupDevices.find((item) => item.tag === focusedLabel)
      : null;
    const markerX = Number.parseFloat(marker?.style.left || "");
    const markerY = Number.parseFloat(marker?.style.top || "");
    const savedX = device ? getSetupDeviceX(device) : NaN;
    const savedY = device ? getSetupDeviceY(device) : NaN;
    return {
      focusedLabel,
      hasFocusClass: Boolean(marker),
      markerX,
      markerY,
      savedX,
      savedY,
      trueSavedPosition: Number.isFinite(markerX)
        && Number.isFinite(markerY)
        && Number.isFinite(savedX)
        && Number.isFinite(savedY)
        && Math.abs(markerX - savedX) <= 0.05
        && Math.abs(markerY - savedY) <= 0.05,
      stageScrollLeft: stage?.scrollLeft || 0,
      stageScrollTop: stage?.scrollTop || 0
    };
  });

  await openTechnicianSystem(page, "UOB", "Fire Alarm");
  const uobResult = await page.evaluate(() => ({
    title: document.querySelector("#mapTitle")?.textContent.trim(),
    floor: document.querySelector("#floorSelect")?.selectedOptions?.[0]?.textContent.trim(),
    assignedPins: document.querySelectorAll(".marker.assigned-scope").length,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  await page.screenshot({ path: join(OUTPUT_DIR, "android-uob-view-pins.png"), fullPage: false });

  await openTechnicianSystem(page, "MTB Reality", "Fire Alarm");
  const mtbResult = await page.evaluate(() => ({
    title: document.querySelector("#mapTitle")?.textContent.trim(),
    floor: document.querySelector("#floorSelect")?.selectedOptions?.[0]?.textContent.trim(),
    assignedPins: document.querySelectorAll(".marker.assigned-scope").length,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  await page.screenshot({ path: join(OUTPUT_DIR, "android-mtb-view-pins.png"), fullPage: false });

  const diagnosticsResult = await page.evaluate(() => {
    const element = document.querySelector("#diagnosticsPanel");
    const visible = Boolean(element && element.getClientRects().length && getComputedStyle(element).display !== "none");
    return {
      visible,
      serverText: document.querySelector("#diagServerStatus")?.textContent.trim() || "",
      appModeText: document.querySelector("#diagAppMode")?.textContent.trim() || ""
    };
  });

  const mtbWhileWetexActiveResult = await page.evaluate(() => ({
    title: document.querySelector("#mapTitle")?.textContent.trim(),
    floor: document.querySelector("#floorSelect")?.selectedOptions?.[0]?.textContent.trim(),
    assignedPins: document.querySelectorAll(".marker.assigned-scope").length,
    activeJobText: document.querySelector("#techActiveJobSummary")?.textContent.trim()
  }));

  assert(wetexResult.assignedPins > 0, "WETEX assigned pins did not appear on Android viewport.");
  assert(uobResult.assignedPins > 0, "UOB assigned pins did not appear on Android viewport.");
  assert(mtbResult.assignedPins > 0, "MTB assigned pins did not appear on Android viewport.");
  assertNoHorizontalOverflow(wetexResult, "WETEX Android view");
  assertNoHorizontalOverflow(uobResult, "UOB Android view");
  assertNoHorizontalOverflow(mtbResult, "MTB Android view");
  assert(listFirstResult.jobCards >= 3, "Technician Today's Jobs did not show WETEX/UOB/MTB cards.");
  assert(listFirstResult.systemButtons > 0, "Opening a technician job did not show fire-system buttons.");
  assert(!listFirstResult.workflowNavVisible, "Hidden technician workflow tabs are still visible on Android.");
  assert(!listFirstResult.diagnosticsVisible, "Diagnostics panel is visible in normal technician workflow.");
  assert(!listFirstResult.suggestVisible, "Topbar suggest-device control is visible in normal technician workflow.");
  assert(listFirstResult.contentGridHidden, "Technician job landing still shows the large admin/content grid.");
  assert(wetexResult.techScreen.includes("tech-screen-mimic"), "Choosing Fire Alarm did not take technician to the mimic screen.");
  assert(!diagnosticsResult.visible, `Diagnostics should be hidden for technicians: ${JSON.stringify(diagnosticsResult)}.`);
  assert(mapFocusResult.hasFocusClass, "Saving from a mimic pin did not keep the selected pin highlighted.");
  assert(mapFocusResult.trueSavedPosition, `Highlighted map pin is not at saved location: ${JSON.stringify(mapFocusResult)}.`);
  assert(autoStartItemResult.checklistOpen && !autoStartItemResult.criticalSopOpen, "Tapping a normal mimic pin did not open the focused inspection card.");
  assert(autoStartItemResult.faultFieldsHiddenBeforeFault, "Fault fields are visible before FAULT is selected.");
  assert(autoStartItemResult.questionListHidden, "Normal technician card is still showing the full checklist question block.");
  assert(autoStartItemResult.actionText.includes("PASS"), "Technician PASS action is not the primary card action.");
  assert(autoStartTapResult.backOnMimic && autoStartTapResult.checklistHidden, "PASS save did not return technician to mimic.");
  assert(autoStartTapResult.passMarkers > 0, "PASS save did not update any mimic pin status.");
  assert(!faultFieldsBefore.photosVisible && !faultFieldsBefore.notesVisible, "FAULT evidence fields were visible before FAULT selection.");
  assert(faultFieldsAfter.photosVisible && faultFieldsAfter.notesVisible, "FAULT selection did not reveal photo/description fields.");
  assert(tapResult.backOnMimic && tapResult.checklistHidden && tapResult.faultFieldsCleared, "FAULT save did not return cleanly to mimic.");
  assert(tapResult.failMarkers > 0, "FAULT save did not update any mimic pin status.");
  assert(mtbWhileWetexActiveResult.assignedPins > 0, "MTB assigned pins disappeared while another tech job was active.");
  assert(mtbWhileWetexActiveResult.title.includes("MTB"), `Expected MTB map after switching jobs, got ${mtbWhileWetexActiveResult.title}.`);
  assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);

  await context.close();

  const extraUserResults = [];
  for (const account of [
    { email: "tech2@rmtfire.local", name: "Tech 2" },
    { email: "tech3@rmtfire.local", name: "Tech 3" }
  ]) {
    const extraContext = await browser.newContext({
      ...devices["Pixel 5"],
      locale: "en-US"
    });
    await stubSaveRoutes(extraContext);
    const extraPage = await extraContext.newPage();
    await extraPage.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await loginAs(extraPage, account.email, QA_LOGIN_TEXT);
    await waitForWorkspace(extraPage);
    await waitForInitialDataLoad(extraPage);
    await showTechJobs(extraPage);
    await seedTemporaryMtbSchedule(extraPage);
    await showTechJobs(extraPage);
    const badge = await extraPage.locator("#currentUserBadge").innerText();
    const jobs = await extraPage.locator("#techAssignedJobs").innerText();
    extraUserResults.push({
      user: account.name,
      badge,
      hasWetex: jobs.includes("WETEX"),
      hasUob: jobs.includes("UOB"),
      hasMtb: jobs.includes("MTB Reality")
    });
    await extraContext.close();
  }
  extraUserResults.forEach((result) => {
    assert(result.badge.includes(result.user), `${result.user} login badge did not appear.`);
    assert(result.hasWetex && result.hasUob && result.hasMtb, `${result.user} does not see the shared test jobs.`);
  });

  const staleContext = await browser.newContext({
    ...devices["Pixel 5"],
    locale: "en-US"
  });
  await stubSaveRoutes(staleContext);
  const stalePage = await staleContext.newPage();
  stalePage.on("dialog", (dialog) => dialog.accept());
  await stalePage.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await loginAs(stalePage, "tech@rmtfire.local", QA_LOGIN_TEXT);
  await waitForWorkspace(stalePage);
  await waitForInitialDataLoad(stalePage);
  await showTechJobs(stalePage);
  await seedTemporaryMtbSchedule(stalePage);
  await stalePage.evaluate(() => {
    state.activeJob = {
      jobId: "STALE-PHONE-JOB",
      scheduleId: "OLD-PHONE-JOB",
      companyName: "Old Phone Job",
      siteName: "Old Phone Site",
      inspector: "Demo Technician",
      serviceType: "Maintenance / Inspection",
      status: "Scheduled Job Started",
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      schedule: {
        scheduleId: "OLD-PHONE-JOB",
        companyName: "Old Phone Job",
        siteName: "Old Phone Site",
        serviceType: "Maintenance / Inspection",
        scope: "full-maintenance",
        plannedDeviceIds: ["OLD.PHONE.1"],
        plannedFloorCounts: []
      },
      events: []
    };
    persistActiveJob();
    renderTechWorkPanel();
  });
  await openTechnicianSystem(stalePage, "MTB Reality", "Fire Alarm");
  const stalePick = await stalePage.evaluate(() => {
    const schedule = state.schedules.find((item) => item.scheduleId === "QA-MOBILE-MTB");
    if (schedule) {
      state.activeTechPreviewScheduleId = schedule.scheduleId;
      showTechnicianScheduleOnMap(schedule.scheduleId, { scrollToMap: false });
    }
    return {
      deviceId: getScheduledAssignedDevices(schedule)[0]?.id || "",
      schedules: state.schedules.map((item) => ({
        scheduleId: item.scheduleId,
        companyName: item.companyName,
        plannedCount: item.plannedDeviceIds?.length || 0,
        firstId: item.plannedDeviceIds?.[0] || ""
      })).slice(0, 8),
      libraryFloors: state.libraryFloors.length,
      setupDevices: state.setupDevices.length,
      syncState: document.querySelector("#syncState")?.textContent || ""
    };
  });
  const staleFirstDevice = stalePick.deviceId;
  assert(staleFirstDevice, `No assigned MTB device was available in stale phone branch: ${JSON.stringify(stalePick, null, 2)}`);
  await stalePage.evaluate(() => {
    window.confirm = () => true;
  });
  await stalePage.evaluate((deviceId) => focusTechnicianAssignedDevice(deviceId, { openChecklist: true }), staleFirstDevice);
  await stalePage.waitForFunction(() => {
    return !document.querySelector("#checklistForm")?.classList.contains("hidden")
      || document.querySelector("#workspace")?.classList.contains("critical-sop-active");
  }, null, { timeout: 15000 });
  const stalePhoneResult = await stalePage.evaluate(() => ({
    activeJobText: document.querySelector("#techActiveJobSummary")?.textContent.trim(),
    checklistOpen: !document.querySelector("#checklistForm")?.classList.contains("hidden"),
    criticalSopOpen: document.querySelector("#workspace")?.classList.contains("critical-sop-active"),
    selectedDevice: document.querySelector("#deviceName")?.textContent.trim() || document.querySelector(".critical-device-summary strong")?.textContent.trim() || "",
    syncState: document.querySelector("#syncState")?.textContent.trim() || ""
  }));
  assert(stalePhoneResult.checklistOpen || stalePhoneResult.criticalSopOpen, "Tapping the whole item card did not open checklist/SOP with stale phone job state.");
  assert(stalePhoneResult.activeJobText.includes("MTB Reality"), "Stale phone job was not switched to the selected MTB job.");
  await staleContext.close();

  await browser.close();

  console.log(JSON.stringify({
    ok: true,
    viewport: devices["Pixel 5"].viewport,
    userAgent: "Pixel 5 / Android Chrome emulation",
    wetex: wetexResult,
    uob: uobResult,
    mtb: mtbResult,
    diagnostics: diagnosticsResult,
    listFirst: listFirstResult,
    mapFocus: mapFocusResult,
    autoStartItem: autoStartItemResult,
    autoStartTap: autoStartTapResult,
    mtbWhileWetexActive: mtbWhileWetexActiveResult,
    tap: tapResult,
    extraUsers: extraUserResults,
    stalePhoneCardTap: stalePhoneResult,
    screenshots: [
      join(OUTPUT_DIR, "android-wetex-view-pins.png"),
      join(OUTPUT_DIR, "android-uob-view-pins.png"),
      join(OUTPUT_DIR, "android-mtb-view-pins.png"),
      join(OUTPUT_DIR, "android-wetex-start-tap-pin.png")
    ]
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
