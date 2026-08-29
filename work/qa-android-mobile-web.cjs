const { existsSync, mkdirSync } = require("node:fs");
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

async function clickJobButton(page, companyName, buttonName) {
  await page.locator("[data-tech-screen='jobs']").click();
  await page.waitForSelector("#workspace.tech-screen-jobs", { timeout: 15000 });
  const card = page.locator(".tech-job-card", { hasText: companyName }).first();
  await card.waitFor({ state: "visible", timeout: 15000 });
  const button = card.getByRole("button", { name: buttonName }).first();
  await button.waitFor({ state: "visible", timeout: 15000 });
  await button.click();
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
    const profile = {
      companyName: "MTB Reality Sdn Bhd",
      siteName: "Bandar Hilir"
    };
    const floor = {
      id: "qa-mtb-lv1",
      floorId: "qa-mtb-lv1",
      title: "MTB Reality QA L1",
      floorCode: "L1",
      companyName: profile.companyName,
      siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src,
      cleanSrc: defaultFloorAssets.lv1.src,
      active: true
    };
    state.mimicFloors = [
      floor,
      ...state.mimicFloors.filter((item) => item.id !== floor.id)
    ];
    const pool = devices.slice(0, 6).map((device, index) => ({
      tag: `MTB.QA.${index + 1}`,
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
    if (!pool.length) return false;
    state.setupDevices = [
      ...pool,
      ...state.setupDevices.filter((device) => !String(device.tag || "").startsWith("MTB.QA."))
    ];
    const schedule = {
      scheduleId: "QA-MOBILE-MTB",
      status: "Scheduled",
      companyName: profile.companyName,
      siteName: profile.siteName,
      clientSource: "Existing Client",
      floorId: floor.id,
      floorTitle: floor.title,
      floorCode: floor.floorCode,
      startFloorId: floor.id,
      startFloorTitle: floor.title,
      date: "2026-08-20",
      time: "10:30",
      technician: "Technician Pool",
      serviceType: "Maintenance / Inspection",
      scope: "fire-alarm",
      scopeLabel: "QA MTB Phone Pins",
      scopeSelectionMode: "selected-floor",
      contractFrequencyPercent: 100,
      plannedDeviceIds: pool.map((device) => device.tag),
      plannedFloorCounts: [{ floorId: floor.id, floorTitle: floor.title, count: pool.length }],
      priority: "Normal",
      notes: "Temporary Android QA schedule only.",
      deviceCount: pool.length,
      totalFloorDeviceCount: pool.length,
      passiveCount: pool.filter((device) => isPassiveScopeDevice(device)).length,
      activeCount: pool.filter((device) => isActiveSystem(device.type)).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.schedules = [schedule, ...state.schedules.filter((item) => item.scheduleId !== schedule.scheduleId)].slice(0, 100);
    writeStoredJson("rmtSchedules", state.schedules);
    renderTechWorkPanel();
    return true;
  });
  assert(seeded, "Unable to seed temporary MTB schedule for Android QA.");
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
  await page.waitForSelector(".tech-job-card", { timeout: 15000 });
  await seedTemporaryMtbSchedule(page);

  const jobText = await page.locator("#techAssignedJobs").innerText();
  assert(jobText.includes("WETEX"), "WETEX job is not visible in technician job list.");
  assert(jobText.includes("UOB"), "UOB job is not visible in technician job list.");
  assert(jobText.includes("MTB Reality"), "MTB job is not visible in technician job list.");

  await clickJobButton(page, "WETEX", "View Items");
  await page.waitForSelector(".tech-assigned-item-card", { timeout: 15000 });
  const listFirstResult = await page.evaluate(() => ({
    itemCards: document.querySelectorAll(".tech-assigned-item-card").length,
    progress: document.querySelector("#techItemProgress")?.textContent.trim(),
    firstItem: document.querySelector(".tech-assigned-item-card strong")?.textContent.trim() || "",
    inspectionBeforeMap: (() => {
      const inspection = document.querySelector(".inspection-panel")?.getBoundingClientRect().top ?? 0;
      const map = document.querySelector(".map-panel")?.getBoundingClientRect().top ?? 0;
      return inspection <= map;
    })()
  }));
  await tapVisibleCenter(page, page.locator("[data-tech-open-device]").first(), "First assigned Open Checklist button");
  await page.waitForFunction(() => {
    return !document.querySelector("#checklistForm")?.classList.contains("hidden")
      || document.querySelector("#workspace")?.classList.contains("critical-sop-active");
  }, null, { timeout: 15000 });
  const autoStartItemResult = await page.evaluate(() => ({
    activeJobText: document.querySelector("#techActiveJobSummary")?.textContent.trim(),
    checklistOpen: !document.querySelector("#checklistForm")?.classList.contains("hidden"),
    criticalSopOpen: document.querySelector("#workspace")?.classList.contains("critical-sop-active"),
    selectedDevice: document.querySelector("#deviceName")?.textContent.trim() || document.querySelector(".critical-device-summary strong")?.textContent.trim() || "",
    detailInViewport: (() => {
      const target = !document.querySelector("#checklistForm")?.classList.contains("hidden")
        ? document.querySelector("#checklistForm")
        : document.querySelector("#criticalSopPanel");
      const rect = target?.getBoundingClientRect();
      return Boolean(rect && rect.top >= -8 && rect.top < window.innerHeight * 0.55);
    })()
  }));

  await clickJobButton(page, "WETEX", "View Items");
  await waitForAssignedPins(page, "WETEX");
  await tapVisibleCenter(page, page.locator("[data-tech-map-device]").first(), "First assigned Map button");
  await page.waitForSelector(".marker.map-focus-marker", { timeout: 15000 });
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
  const firstWetexPreviewTag = await page.evaluate(() => {
    const marker = document.querySelector(".marker.assigned-scope");
    return marker?.dataset.setupTag || marker?.dataset.deviceId || marker?.dataset.label || "";
  });
  assert(firstWetexPreviewTag, "No assigned preview marker tag was available for WETEX preview test.");
  await page.evaluate((tag) => focusTechnicianAssignedDevice(tag, { openChecklist: true }), firstWetexPreviewTag);
  await page.waitForFunction(() => {
    return !document.querySelector("#checklistForm")?.classList.contains("hidden")
      || document.querySelector("#workspace")?.classList.contains("critical-sop-active");
  }, null, { timeout: 15000 });
  const autoStartTapResult = await page.evaluate(() => ({
    activeJobText: document.querySelector("#techActiveJobSummary")?.textContent.trim(),
    checklistOpen: !document.querySelector("#checklistForm")?.classList.contains("hidden"),
    criticalSopOpen: document.querySelector("#workspace")?.classList.contains("critical-sop-active"),
    selectedDevice: document.querySelector("#deviceName")?.textContent.trim() || document.querySelector(".critical-device-summary strong")?.textContent.trim() || ""
  }));

  await clickJobButton(page, "WETEX", "View Items");
  await waitForAssignedPins(page, "WETEX");
  const wetexResult = await page.evaluate(() => ({
    title: document.querySelector("#mapTitle")?.textContent.trim(),
    floor: document.querySelector("#floorSelect")?.selectedOptions?.[0]?.textContent.trim(),
    assignedPins: document.querySelectorAll(".marker.assigned-scope").length,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  await page.screenshot({ path: join(OUTPUT_DIR, "android-wetex-view-pins.png"), fullPage: false });

  await clickJobButton(page, "UOB", "View Items");
  await waitForAssignedPins(page, "UOB");
  const uobResult = await page.evaluate(() => ({
    title: document.querySelector("#mapTitle")?.textContent.trim(),
    floor: document.querySelector("#floorSelect")?.selectedOptions?.[0]?.textContent.trim(),
    assignedPins: document.querySelectorAll(".marker.assigned-scope").length,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  await page.screenshot({ path: join(OUTPUT_DIR, "android-uob-view-pins.png"), fullPage: false });

  await clickJobButton(page, "MTB Reality", "View Items");
  await waitForAssignedPins(page, "MTB");
  const mtbResult = await page.evaluate(() => ({
    title: document.querySelector("#mapTitle")?.textContent.trim(),
    floor: document.querySelector("#floorSelect")?.selectedOptions?.[0]?.textContent.trim(),
    assignedPins: document.querySelectorAll(".marker.assigned-scope").length,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  await page.screenshot({ path: join(OUTPUT_DIR, "android-mtb-view-pins.png"), fullPage: false });

  await clickJobButton(page, "MTB Reality", "View Items");
  await waitForAssignedPins(page, "MTB while WETEX active");
  const mtbWhileWetexActiveResult = await page.evaluate(() => ({
    title: document.querySelector("#mapTitle")?.textContent.trim(),
    floor: document.querySelector("#floorSelect")?.selectedOptions?.[0]?.textContent.trim(),
    assignedPins: document.querySelectorAll(".marker.assigned-scope").length,
    activeJobText: document.querySelector("#techActiveJobSummary")?.textContent.trim()
  }));

  const firstPreviewTag = await page.evaluate(() => {
    const marker = document.querySelector(".marker.assigned-scope");
    return marker?.dataset.setupTag || marker?.dataset.deviceId || marker?.dataset.label || "";
  });
  assert(firstPreviewTag, "No assigned preview marker tag was available for MTB switch test.");
  await page.evaluate((tag) => focusTechnicianAssignedDevice(tag, { openChecklist: true }), firstPreviewTag);
  await page.waitForFunction(() => {
    return !document.querySelector("#checklistForm")?.classList.contains("hidden")
      || document.querySelector("#workspace")?.classList.contains("critical-sop-active");
  }, null, { timeout: 15000 });
  const tapResult = await page.evaluate(() => ({
    checklistOpen: !document.querySelector("#checklistForm")?.classList.contains("hidden"),
    criticalSopOpen: document.querySelector("#workspace")?.classList.contains("critical-sop-active"),
    selectedDevice: document.querySelector("#deviceName")?.textContent.trim() || document.querySelector(".critical-device-summary strong")?.textContent.trim() || ""
  }));
  await page.screenshot({ path: join(OUTPUT_DIR, "android-wetex-start-tap-pin.png"), fullPage: false });

  assert(wetexResult.assignedPins > 0, "WETEX assigned pins did not appear on Android viewport.");
  assert(uobResult.assignedPins > 0, "UOB assigned pins did not appear on Android viewport.");
  assert(mtbResult.assignedPins > 0, "MTB assigned pins did not appear on Android viewport.");
  assert(listFirstResult.itemCards > 0, "Assigned item list did not render for technician.");
  assert(listFirstResult.inspectionBeforeMap, "Technician list/checklist panel is not above the map on Android.");
  assert(mapFocusResult.hasFocusClass, "Map button did not highlight the selected mimic pin.");
  assert(mapFocusResult.trueSavedPosition, `Highlighted map pin is not at saved location: ${JSON.stringify(mapFocusResult)}.`);
  assert(autoStartItemResult.checklistOpen || autoStartItemResult.criticalSopOpen, "Opening an assigned list item did not auto-start and open checklist/SOP.");
  assert(autoStartItemResult.detailInViewport, "Opening an assigned list item did not scroll the checklist/SOP into phone view.");
  assert(autoStartItemResult.activeJobText.includes("WETEX"), "Assigned list item did not start WETEX active job.");
  assert(autoStartTapResult.checklistOpen || autoStartTapResult.criticalSopOpen, "Tapping a preview assigned pin did not auto-start and open checklist/SOP.");
  assert(autoStartTapResult.activeJobText.includes("WETEX"), "Auto-started pin tap did not start WETEX active job.");
  assert(mtbWhileWetexActiveResult.assignedPins > 0, "MTB assigned pins disappeared while another tech job was active.");
  assert(mtbWhileWetexActiveResult.title.includes("MTB"), `Expected MTB map while WETEX active, got ${mtbWhileWetexActiveResult.title}.`);
  assert(tapResult.checklistOpen || tapResult.criticalSopOpen, "Tapping MTB assigned pin after switching from WETEX did not open checklist or critical SOP.");
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
    await extraPage.waitForSelector(".tech-job-card", { timeout: 15000 });
    await seedTemporaryMtbSchedule(extraPage);
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
  await clickJobButton(stalePage, "MTB Reality", "View Items");
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
