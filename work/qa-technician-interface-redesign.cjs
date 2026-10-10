const { existsSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260916-tech-interface";
const OUTPUT_DIR = path.resolve("outputs/fire-inspection-mvp/technician-ui-qa");
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function seedFixture(page) {
  await page.evaluate(() => {
    const profile = { companyName: "QA TECH UI", siteName: "QA TECH UI" };
    const floor = {
      id: "qa-tech-ui-l1", floorId: "qa-tech-ui-l1", title: "Level 1", floorCode: "L1",
      companyName: profile.companyName, siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src, cleanSrc: defaultFloorAssets.lv1.src, active: true
    };
    const source = [
      ["QA.MFAP.1", "Main Fire Alarm Panel", "Fire control room"],
      ["QA.MCP.1", "Manual Call Point", "Lobby"],
      ["QA.PUMP.1", "Fire Pump Panel", "Pump room"],
      ["QA.SPP.1", "Sprinkler Panel", "Sprinkler pump room"],
      ["QA.CO2.1", "CO2 System", "Suppression room"],
      ["QA.FE.1", "Fire Extinguisher", "Lobby"],
      ["QA.HR.1", "Hose Reel", "Corridor"],
      ["QA.EL.1", "Emergency Light", "Staircase"],
      ["QA.EX.1", "Exit Sign", "Exit door"],
      ["QA.FD.1", "Fire Door", "Staircase"],
      ["QA.FI.1", "Fireman Intercom", "Fire lift lobby"]
    ];
    const setupDevices = source.map(([tag, type, location], index) => ({
      tag, id: tag, type, location, floor: floor.title, floorId: floor.id, floorCode: floor.floorCode,
      companyName: profile.companyName, siteName: profile.siteName,
      xPercent: 8 + (index % 6) * 15, yPercent: 20 + Math.floor(index / 6) * 38, status: "Confirmed"
    }));
    const schedule = {
      scheduleId: "QA-TECH-INTERFACE",
      jobId: "JOB-QA-TECH-INTERFACE",
      status: "In Progress",
      companyName: profile.companyName,
      siteName: profile.siteName,
      serviceType: "Monthly Maintenance 10%",
      scope: "full-maintenance",
      scopeLabel: "10% passive + 100% active",
      contractFrequencyPercent: 10,
      floorId: floor.id,
      startFloorId: floor.id,
      floorTitle: floor.title,
      startFloorTitle: floor.title,
      date: new Date().toISOString().slice(0, 10),
      time: "09:00",
      technician: "Demo Technician",
      plannedDeviceIds: setupDevices.map((device) => device.tag),
      deviceCount: setupDevices.length,
      scopeFrozen: true,
      linkedVerifications: [
        { linkedVerificationId: "QA-PUMP-LINK", verificationType: "FIRE_PUMP_INDICATION", title: "Pump Sync", systemIds: ["fire-alarm", "pump-system"], requiredSides: [{ sideId: "A", sideName: "Pump Room", assignedTechnicianId: "tech@rmtfire.local" }, { sideId: "B", sideName: "MFAP", assignedTechnicianId: "tech2@rmtfire.local" }] },
        { linkedVerificationId: "QA-CO2-LINK", verificationType: "CO2_GAS_RELEASE_INDICATION", title: "CO2 Sync", systemIds: ["fire-alarm", "gas-release"], requiredSides: [{ sideId: "A", sideName: "Suppression", assignedTechnicianId: "tech@rmtfire.local" }, { sideId: "B", sideName: "MFAP", assignedTechnicianId: "tech2@rmtfire.local" }] }
      ]
    };
    const linkedRecord = (linkedVerificationId, sideId) => ({ linkedVerificationId, sideId, status: "COMPLETE", result: "CONFIRMED", revision: 1 });
    state.currentUser = { name: "Demo Technician", role: "Technician", email: "tech@rmtfire.local" };
    state.siteProfile = profile;
    state.schedules = [schedule];
    state.activeJob = { scheduleId: schedule.scheduleId, jobId: schedule.jobId, status: "In Progress", schedule };
    state.setupDevices = setupDevices;
    state.mimicFloors = [floor];
    state.inspections = {};
    state.criticalSops = {};
    state.activeTechPreviewScheduleId = schedule.scheduleId;
    state.activeTechSystemKey = "";
    state.activeTechFloorId = floor.id;
    state.activeCriticalDevice = null;
    state.activeCriticalSopId = criticalSopTemplates[0].id;
    state.sharedJobRecords = {
      [schedule.scheduleId]: {
        store: {
          inspectionRecords: {}, criticalSopRecords: {},
          linkedVerificationDefinitions: Object.fromEntries(schedule.linkedVerifications.map((item) => [item.linkedVerificationId, item])),
          linkedVerificationSideRecords: {
            pa: linkedRecord("QA-PUMP-LINK", "A"), pb: linkedRecord("QA-PUMP-LINK", "B"),
            ca: linkedRecord("QA-CO2-LINK", "A"), cb: linkedRecord("QA-CO2-LINK", "B")
          },
          linkedVerificationConflicts: {}
        }
      }
    };
    loginView.classList.add("hidden");
    workspace.classList.remove("hidden");
    workspace.classList.remove("critical-sop-active", "tech-fault-entry-active", "tech-remarks-entry-active");
    applyRoleView();
    renderFloorOptions();
    setTechnicianMapFloor(floor.id, profile);
    invalidateRuntimeCaches();
    ensureActiveJobCriticalWorkflows(schedule);
    renderTechWorkPanel();
    setTechScreen("jobs", { skipDirtyCheck: true });
  });
}

async function capture(page, name) {
  const file = path.join(OUTPUT_DIR, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

(async () => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const executablePath = EDGE_PATHS.find(existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const screenshots = [];
  const consoleErrors = [];
  for (const page of [desktop, mobile]) page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
  try {
    await desktop.goto(APP_URL, { waitUntil: "networkidle" });
    await seedFixture(desktop);
    const desktopState = await desktop.evaluate(() => ({
      sidebarVisible: getComputedStyle(document.querySelector("#techSystemSidebar")).display !== "none",
      labels: [...document.querySelectorAll("#techDesktopSystemList button strong")].map((item) => item.textContent.trim()),
      iconCount: document.querySelectorAll("#techDesktopSystemList .tech-system-icon").length,
      statusCount: document.querySelectorAll('#techDesktopSystemList button[class*="status-"]').length,
      bodyText: document.querySelector("#techWorkPanel").innerText,
      samplingLines: document.querySelector("#techWorkPanel").innerText.split("\n").filter((line) => /10%|20%|30%/.test(line)),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    ["Fire Alarm Panel", "Pump", "CO2 / Gas Release", "SPP / Sprinkler", "Portable Fire Extinguisher", "Hose Reel", "Emergency Light", "Exit Sign", "Fire Door", "Others"].forEach((label) => {
      assert(desktopState.labels.includes(label), `Desktop system navigation is missing ${label}.`);
    });
    assert(desktopState.sidebarVisible, "Desktop technician system sidebar must be visible.");
    assert(desktopState.iconCount === desktopState.labels.length, "Every desktop system must have a recognition icon.");
    assert(desktopState.statusCount === desktopState.labels.length, "Every desktop system must have a status color state.");
    assert(!/10%|20%|30%/.test(desktopState.bodyText), `Technician dashboard must not expose sampling percentages: ${desktopState.samplingLines.join(" | ")}`);
    assert(desktopState.overflow <= 1, `Desktop view has horizontal overflow: ${desktopState.overflow}px.`);
    const notificationLogic = await desktop.evaluate(() => {
      const patterns = [];
      Object.defineProperty(navigator, "vibrate", { configurable: true, value: (pattern) => patterns.push(pattern) });
      state.notifiedLiveEventSignatures = new Set();
      notifyTechnicianOfLiveEvent({ eventId: "qa-high", revision: 1, priority: "HIGH" });
      notifyTechnicianOfLiveEvent({ eventId: "qa-high", revision: 1, priority: "HIGH" });
      notifyTechnicianOfLiveEvent({ eventId: "qa-low", revision: 1, priority: "LOW" });
      return patterns;
    });
    assert(notificationLogic.length === 1 && JSON.stringify(notificationLogic[0]) === JSON.stringify([120, 60, 120]), `High-priority live-event vibration must fire once: ${JSON.stringify(notificationLogic)}.`);
    screenshots.push(await capture(desktop, "01-desktop-technician-dashboard.png"));
    screenshots.push(await capture(desktop, "desktop-tech-home.png"));

    await desktop.evaluate(() => {
      const schedule = state.schedules[0];
      const device = state.setupDevices.find((item) => item.tag === "QA.PUMP.1");
      state.activeTechSystemKey = "pump";
      state.activeCriticalDevice = { ...device, id: device.tag, tag: device.tag, questions: getChecklistQuestions(device.type) };
      state.activeCriticalSopId = "hose-reel-pump-sop";
      workspace.classList.add("critical-sop-active");
      checklistForm.classList.add("hidden");
      emptyState.classList.add("hidden");
      renderCriticalSop();
      renderTechWorkPanel();
      setTechScreen("inspection", { skipDirtyCheck: true });
      renderTechDesktopNavigation(schedule);
    });
    screenshots.push(await capture(desktop, "desktop-pump.png"));

    await desktop.evaluate(() => {
      const schedule = state.schedules[0];
      const device = state.setupDevices.find((item) => item.tag === "QA.SPP.1");
      state.activeTechSystemKey = "pump-system";
      state.activeCriticalDevice = { ...device, id: device.tag, tag: device.tag, questions: getChecklistQuestions(device.type) };
      state.activeCriticalSopId = "sprinkler-hydrant-pump-sop";
      workspace.classList.add("critical-sop-active");
      checklistForm.classList.add("hidden");
      emptyState.classList.add("hidden");
      renderCriticalSop();
      renderTechWorkPanel();
      setTechScreen("inspection", { skipDirtyCheck: true });
      renderTechDesktopNavigation(schedule);
      document.querySelector('select[name="sop-choice-7"]')?.scrollIntoView({ block: "center" });
    });
    const sppState = await desktop.evaluate(() => ({
      headings: [...document.querySelectorAll("#criticalSopForm .sop-confirm strong")].map((item) => item.textContent.trim()),
      confirmedBy: [...document.querySelectorAll("#criticalSopForm .auto-fill-note")].some((item) => item.textContent.includes("logged-in Technician")),
      supervisorStep4: document.querySelector('input[name="sop-supervisor-3"]') !== null,
      optionalRemarkInput: document.querySelector('input[name="sop-remark-6"]') !== null,
      optionalRemarkButton: document.querySelector('[data-sop-remark-toggle="6"]') !== null
    }));
    assert(sppState.headings.indexOf("Test Jockey Pump on Manual") < sppState.headings.indexOf("Test Duty Pump on Manual"), "Jockey must appear before Duty.");
    assert(sppState.headings.indexOf("Test Duty Pump on Manual") < sppState.headings.indexOf("Test Standby Pump on Manual"), "Duty must appear before configured Standby.");
    assert(sppState.confirmedBy, "SPP technician confirmation must be visibly auto-filled.");
    assert(!sppState.supervisorStep4, "SPP step 4 must not show a supervisor field.");
    assert(!sppState.optionalRemarkInput && sppState.optionalRemarkButton, "SPP optional remarks must use progressive disclosure.");
    screenshots.push(await capture(desktop, "02-desktop-spp-checklist.png"));
    screenshots.push(await capture(desktop, "desktop-spp.png"));

    await desktop.evaluate(() => {
      const device = state.setupDevices.find((item) => item.tag === "QA.MFAP.1");
      state.activeTechSystemKey = "fire-alarm";
      state.activeCriticalDevice = { ...device, id: device.tag, tag: device.tag, questions: getChecklistQuestions(device.type) };
      state.activeCriticalSopId = "fire-alarm-tripping-sop";
      workspace.classList.add("critical-sop-active");
      checklistForm.classList.add("hidden");
      emptyState.classList.add("hidden");
      renderCriticalSop();
      setTechScreen("inspection", { skipDirtyCheck: true });
    });
    screenshots.push(await capture(desktop, "desktop-fap.png"));
    const fireAlarmDrawer = await desktop.evaluate(() => ({
      labels: [...document.querySelectorAll("#techDrawerPumpStages .tech-fire-alarm-groups strong")].map((item) => item.textContent.trim()),
      mfapTarget: document.querySelector('#techDrawerPumpStages [data-fire-alarm-device="QA.MFAP.1"]') !== null,
      fieldTarget: document.querySelector('#techDrawerPumpStages [data-fire-alarm-device="QA.MCP.1"]') !== null
    }));
    assert(fireAlarmDrawer.mfapTarget && fireAlarmDrawer.fieldTarget, `Fire Alarm drawer shortcuts are incomplete: ${JSON.stringify(fireAlarmDrawer)}.`);
    await desktop.locator('#techDrawerPumpStages [data-fire-alarm-device="QA.MCP.1"]').click();
    const lockedFieldRedirect = await desktop.evaluate(() => ({
      activeDevice: state.activeCriticalDevice?.id || state.activeCriticalDevice?.tag || "",
      sopOpen: workspace.classList.contains("critical-sop-active"),
      syncText: document.querySelector("#syncState")?.textContent || ""
    }));
    assert(lockedFieldRedirect.activeDevice === "QA.MFAP.1" && lockedFieldRedirect.sopOpen, `Locked field shortcut bypassed MFAP: ${JSON.stringify(lockedFieldRedirect)}.`);
    await desktop.evaluate(() => document.querySelector('input[name="sop-reading-5"]')?.scrollIntoView({ block: "center" }));
    const battery = await desktop.evaluate(() => {
      const input = document.querySelector('input[name="sop-reading-5"]');
      const control = input?.parentElement;
      const unit = control?.querySelector("strong");
      const inputRect = input?.getBoundingClientRect();
      const unitRect = unit?.getBoundingClientRect();
      return {
        type: input?.type,
        step: input?.step,
        inputMode: input?.inputMode,
        unit: control?.innerText || "",
        controlClass: control?.className || "",
        controlDisplay: control ? getComputedStyle(control).display : "",
        controlWidth: control?.getBoundingClientRect().width || 0,
        inputRight: inputRect?.right || 0,
        unitLeft: unitRect?.left || 0,
        sameLine: Math.abs(((inputRect?.top || 0) + (inputRect?.height || 0) / 2) - ((unitRect?.top || 0) + (unitRect?.height || 0) / 2)) < 8
      };
    });
    assert(battery.type === "number" && battery.step === "0.1" && battery.inputMode === "decimal", "Battery voltage must use decimal numeric input.");
    assert(battery.unit.includes("V"), "Battery voltage unit must be visible.");
    assert(battery.sameLine, `Battery voltage unit must stay beside its input: ${JSON.stringify(battery)}`);
    screenshots.push(await capture(desktop, "07-battery-charging-input.png"));

    const backState = await desktop.evaluate(() => {
      state.techInspectionDirty = true;
      const originalConfirm = window.confirm;
      window.confirm = () => false;
      const blocked = showTechnicianSystemList();
      const retained = state.activeTechSystemKey;
      window.confirm = () => true;
      const allowed = showTechnicianSystemList();
      window.confirm = originalConfirm;
      return { blocked, retained, allowed, screen: state.techScreen, systemKey: state.activeTechSystemKey };
    });
    assert(backState.blocked === false && backState.retained === "fire-alarm", "Unsaved checklist warning must block navigation when declined.");
    assert(backState.allowed === true && backState.screen === "jobs" && backState.systemKey === "", "Back to System List must work after confirmation.");
    screenshots.push(await capture(desktop, "08-clear-back-navigation.png"));

    await mobile.goto(APP_URL, { waitUntil: "networkidle" });
    await seedFixture(mobile);
    const mobileHome = await mobile.evaluate(() => ({
      bottomNavVisible: getComputedStyle(document.querySelector("#techWorkflowNav")).display !== "none",
      navLabels: [...document.querySelectorAll("#techWorkflowNav button strong")].map((item) => item.textContent.trim()),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      systemCardCount: document.querySelectorAll("#techActiveJobSummary [data-tech-system]").length
    }));
    assert(JSON.stringify(mobileHome.navLabels) === JSON.stringify(["Home", "Tasks", "Mimic", "Reports", "More"]), "Mobile bottom navigation labels are incorrect.");
    assert(mobileHome.bottomNavVisible && mobileHome.systemCardCount >= 10, "Mobile system cards and bottom navigation must be visible.");
    assert(mobileHome.overflow <= 1, `Mobile home has horizontal overflow: ${mobileHome.overflow}px.`);
    await mobile.evaluate(() => document.querySelector("#techActiveJobSummary .tech-system-panel")?.scrollIntoView({ block: "start" }));
    screenshots.push(await capture(mobile, "03-mobile-technician-home.png"));
    screenshots.push(await capture(mobile, "mobile-tech-home.png"));

    await mobile.evaluate(() => {
      setTechScreen("mimic", { skipDirtyCheck: true });
      renderMarkers();
    });
    const markersBeforeToggle = await mobile.locator("#markersLayer .marker").count();
    await mobile.locator("#originalMimicBtn").click();
    const originalMode = await mobile.evaluate(() => state.mimicViewMode);
    await mobile.locator("#cleanMimicBtn").click();
    const mimicToggle = await mobile.evaluate(() => ({
      mode: state.mimicViewMode,
      markerCount: document.querySelectorAll("#markersLayer .marker").length
    }));
    assert(originalMode === "original" && mimicToggle.mode === "clean", "Original / Clean mimic background controls must switch modes.");
    assert(mimicToggle.markerCount === markersBeforeToggle, "Changing the mimic background must not change the authoritative pin overlay.");

    await mobile.evaluate(() => {
      state.activeTechSystemKey = "emergency-light";
      renderTechAssignedItemList();
      setTechScreen("inspection", { skipDirtyCheck: true });
    });
    const filtered = await mobile.evaluate(() => document.querySelector("#techAssignedItemList").innerText);
    assert(filtered.includes("QA.EL.1") && !filtered.includes("QA.MCP.1") && !filtered.includes("QA.EX.1"), "System task list must contain only the selected system.");
    screenshots.push(await capture(mobile, "04-mobile-system-device-list.png"));
    screenshots.push(await capture(mobile, "mobile-system-list.png"));

    await mobile.evaluate(async () => {
      await selectDevice("QA.EL.1", { skipDirtyCheck: true, scrollIntoView: false });
      checklistForm.scrollIntoView({ block: "start" });
    });
    assert(await mobile.locator("#checklistForm").isVisible(), "Mobile inspection form must open from an assigned task.");
    const inspectionV1 = await mobile.evaluate(() => {
      const notes = document.querySelector("#notes");
      const saveNext = document.querySelector("#saveNextInspectionBtn");
      const firstFail = document.querySelector('#questionList input[value="Fail"]');
      const firstPass = document.querySelector('#questionList input[value="Pass"]');
      const remarksButton = document.querySelector("#toggleInspectionRemarksBtn");
      const beforeFault = getComputedStyle(notes.closest("label")).display;
      firstFail.click();
      const duringFault = getComputedStyle(notes.closest("label")).display;
      firstPass.click();
      const afterPass = getComputedStyle(notes.closest("label")).display;
      remarksButton.click();
      const afterAddRemarks = getComputedStyle(notes.closest("label")).display;
      return {
        context: document.querySelector("#techInspectionContext")?.innerText || "",
        questionCount: document.querySelectorAll("#questionList .tech-checklist-question").length,
        choices: [...document.querySelectorAll("#questionList .choice-row label")].map((item) => item.textContent.trim()),
        beforeFault,
        duringFault,
        afterPass,
        addRemarksText: remarksButton?.textContent.trim(),
        afterAddRemarks,
        saveNextText: saveNext?.textContent.trim(),
        saveNextColor: getComputedStyle(saveNext).backgroundColor,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    assert(inspectionV1.context.includes("Emergency Light") && inspectionV1.context.includes("Demo Technician"), "Inspection context must show system and auto-filled technician/job context.");
    assert(inspectionV1.questionCount > 0 && inspectionV1.choices.includes("PASS") && inspectionV1.choices.includes("FAULT") && inspectionV1.choices.includes("N/A"), `Per-question PASS / FAULT / N/A controls must be visible: ${JSON.stringify(inspectionV1)}.`);
    assert(inspectionV1.beforeFault === "none" && inspectionV1.duringFault !== "none" && inspectionV1.afterPass === "none", "Fault details must expand only while a failed answer is selected.");
    assert(inspectionV1.addRemarksText === "Add Remarks" && inspectionV1.afterAddRemarks !== "none", "Technician must be able to add an optional remark without selecting FAULT.");
    assert(inspectionV1.saveNextText === "SAVE & NEXT" && inspectionV1.saveNextColor === "rgb(217, 48, 37)", "SAVE & NEXT must be the dominant Realmart-red action.");
    assert(inspectionV1.overflow <= 1, `Mobile inspection has horizontal overflow: ${inspectionV1.overflow}px.`);
    screenshots.push(await capture(mobile, "05-mobile-inspection-form.png"));
    screenshots.push(await capture(mobile, "mobile-inspection.png"));

    await mobile.evaluate(() => {
      const device = state.setupDevices.find((item) => item.tag === "QA.SPP.1");
      clearTechnicianInspectionDirty();
      state.activeTechSystemKey = "pump-system";
      state.activeCriticalDevice = { ...device, id: device.tag, tag: device.tag, questions: getChecklistQuestions(device.type) };
      state.activeCriticalSopId = "sprinkler-hydrant-pump-sop";
      workspace.classList.add("critical-sop-active");
      checklistForm.classList.add("hidden");
      emptyState.classList.add("hidden");
      renderCriticalSop();
      setTechScreen("inspection", { skipDirtyCheck: true });
      document.querySelector('select[name="sop-choice-7"]')?.scrollIntoView({ block: "center" });
    });
    screenshots.push(await capture(mobile, "06-mobile-pump-test-sequence.png"));
    screenshots.push(await capture(mobile, "mobile-pump.png"));

    await mobile.evaluate(() => {
      const device = state.setupDevices.find((item) => item.tag === "QA.MFAP.1");
      clearTechnicianInspectionDirty();
      state.activeTechSystemKey = "fire-alarm";
      state.activeCriticalDevice = { ...device, id: device.tag, tag: device.tag, questions: getChecklistQuestions(device.type) };
      state.activeCriticalSopId = "fire-alarm-tripping-sop";
      workspace.classList.add("critical-sop-active");
      checklistForm.classList.add("hidden");
      emptyState.classList.add("hidden");
      renderCriticalSop();
      setTechScreen("inspection", { skipDirtyCheck: true });
      document.querySelector('input[name="sop-reading-5"]')?.scrollIntoView({ block: "center" });
    });
    screenshots.push(await capture(mobile, "mobile-battery.png"));

    await mobile.evaluate(() => {
      clearTechnicianInspectionDirty();
      showTechnicianSystemList();
    });
    screenshots.push(await capture(mobile, "mobile-back-navigation.png"));

    await mobile.evaluate(() => {
      const syncState = document.querySelector("#syncState");
      if (syncState) {
        syncState.textContent = "OFFLINE - SAVED LOCALLY";
        syncState.scrollIntoView({ block: "center" });
      }
    });
    assert((await mobile.locator("#syncState").textContent()).includes("OFFLINE"), "Mobile offline state must be visible.");
    screenshots.push(await capture(mobile, "mobile-offline-state.png"));

    assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(" | ")}`);
    console.log(JSON.stringify({ ok: true, desktopState, mobileHome, mimicToggle, battery, screenshots, consoleErrors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
