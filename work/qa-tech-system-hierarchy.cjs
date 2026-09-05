const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260831-tech-system-hierarchy";
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

function buildUobHierarchyFixture() {
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
  const nextSmoke = devices.find((device) => (/smoke detector/i.test(device.type || "") || /\.SD\./i.test(device.tag || "")) && getDeviceId(device) !== getDeviceId(smoke));
  const emergencyExit = devices.find((device) => /emergency light|exit sign/i.test(device.type || "") || /\.(EL|EX)\./i.test(device.tag || ""));

  assert(mfap, "UOB MFAP fixture was not found.");
  assert(mcp, "UOB MCP fixture was not found.");
  assert(smoke, "UOB smoke detector fixture was not found.");
  assert(nextSmoke, "UOB second same-floor smoke detector fixture was not found.");
  assert(emergencyExit, "UOB emergency/exit fixture was not found.");

  const selectedDevices = [mfap, mcp, smoke, nextSmoke, emergencyExit].map((device) => ({
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
  const scheduleId = `QA-UOB-HIERARCHY-${Date.now()}`;
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
      nextSmoke: selectedDevices[3].tag,
      emergencyExit: selectedDevices[4].tag
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
      scopeLabel: "UOB Hierarchy QA",
      priority: "Normal",
      contractFrequencyPercent: 100,
      scopeSelectionMode: "selected-floor",
      plannedDeviceIds,
      deviceCount: plannedDeviceIds.length,
      activeCount: 1,
      passiveCount: plannedDeviceIds.length - 1,
      plannedFloorCounts: [{ floorId: floor.id || floor.floorId, floorTitle: floor.title || floor.floorName || "UOB - Page 1", count: plannedDeviceIds.length }],
      notes: "QA UOB Fire Alarm hierarchy seed"
    }
  };
}

function buildUobServiceScopeMarkerFixture() {
  const manifest = readJson(MIMIC_MANIFEST);
  const floor = (manifest.floors || []).find((item) => item.companyName === "UOB" && item.siteName === "UOB" && /Page 1/i.test(item.title || item.floorName || ""))
    || (manifest.floors || []).find((item) => item.companyName === "UOB" && item.siteName === "UOB");
  assert(floor, "UOB service-scope marker floor fixture was not found.");

  const floorId = floor.id || floor.floorId;
  const floorTitle = floor.title || floor.floorName || "UOB - Page 1";
  const makeDevice = (tag, type, index, extra = {}) => ({
    tag,
    id: tag,
    type,
    companyName: "UOB",
    siteName: "UOB",
    floor: floorTitle,
    floorId,
    floorCode: floor.floorCode || "P1",
    floorTitle,
    location: extra.location || `QA service-scope marker ${index}`,
    status: "Confirmed",
    xPercent: 8 + ((index * 7) % 82),
    yPercent: 12 + ((index * 11) % 76),
    ...extra
  });

  const mfap = makeDevice("QA.SCOPE.MFAP.1", "Main Fire Alarm Panel", 1, { location: "QA Fire Alarm Panel" });
  const plannedFields = Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    const type = number % 3 === 0 ? "Heat Detector" : number % 2 === 0 ? "Smoke Detector" : "Manual Call Point";
    const prefix = type === "Heat Detector" ? "HD" : type === "Smoke Detector" ? "SD" : "MCP";
    return makeDevice(`QA.SCOPE.${prefix}.${String(number).padStart(3, "0")}`, type, number + 1);
  });
  const recheck = makeDevice("QA.SCOPE.SD.RECHECK", "Smoke Detector", 12, {
    location: "QA mandatory recheck device"
  });
  const plannedDevices = [mfap, ...plannedFields, recheck];
  const unassignedDevices = Array.from({ length: 88 }, (_, index) => {
    const number = index + 1;
    return makeDevice(`QA.MASTER.SD.${String(number).padStart(3, "0")}`, "Smoke Detector", number + 20, {
      location: `QA unassigned master smoke ${number}`
    });
  });
  const scheduleId = `QA-SERVICE-SCOPE-MARKERS-${Date.now()}`;

  return {
    scheduleId,
    floor: {
      ...floor,
      id: floorId,
      floorId,
      title: floorTitle,
      floorCode: floor.floorCode || "P1",
      companyName: "UOB",
      siteName: "UOB",
      active: true
    },
    devices: [...plannedDevices, ...unassignedDevices],
    tags: {
      mfap: mfap.tag,
      assigned: plannedFields[0].tag,
      assignedSmoke: plannedFields.find((device) => /Smoke Detector/i.test(device.type))?.tag || plannedFields[0].tag,
      recheck: recheck.tag,
      unassigned: unassignedDevices[0].tag,
      unassignedSameFloor: unassignedDevices[1].tag
    },
    expectedMarkerIds: plannedDevices.map((device) => device.tag).sort(),
    schedule: {
      scheduleId,
      status: "Scheduled",
      clientSource: "QA service-scope marker data",
      companyName: "UOB",
      siteName: "UOB",
      address: "QA marker-scope test only",
      floorId,
      startFloorId: floorId,
      floorTitle,
      startFloorTitle: floorTitle,
      date: new Date().toISOString().slice(0, 10),
      time: "10:30",
      technician: "Demo Technician",
      serviceType: "Maintenance / Inspection",
      scope: "full-maintenance",
      scopeLabel: "QA Service Scope Marker View",
      priority: "Normal",
      contractFrequencyPercent: 10,
      annualCycleId: "annual-2026",
      contractCycleId: "annual-2026",
      scopeSelectionMode: "selected-floor",
      plannedDeviceIds: plannedDevices.map((device) => device.tag),
      sampledDeviceIds: plannedFields.map((device) => device.tag),
      criticalDeviceIds: [mfap.tag],
      mandatoryRecheckDeviceIds: [recheck.tag],
      adminForcedDeviceIds: [],
      deviceCount: plannedDevices.length,
      activeCount: 1,
      passiveCount: plannedFields.length + 1,
      passiveTargetCount: plannedFields.length,
      plannedFloorCounts: [{ floorId, floorTitle, count: plannedDevices.length }],
      notes: "QA legacy service-scope marker DOM regression seed"
    }
  };
}

async function loginAsTech(page) {
  await page.waitForFunction(() => typeof startUserSession === "function" && Array.isArray(demoAccounts), null, { timeout: 15000 });
  await page.evaluate(async () => {
    const user = demoAccounts.find((account) => account.key === "tech");
    await startUserSession(user);
  });
  await page.waitForFunction(() => {
    return state.currentUser?.role === "Technician"
      && document.querySelector("#workspace")?.classList.contains("technician-mode")
      && document.querySelector("#loginView")?.classList.contains("hidden");
  }, null, { timeout: 15000 });
}

async function seedFixture(page, fixture) {
  await page.evaluate((fixtureData) => {
    const qaTags = fixtureData.devices.map((device) => device.tag);
    state.activeJob = null;
    state.activeTechPreviewScheduleId = "";
    state.activeTechSystemKey = "";
    state.techScreen = "jobs";
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

async function seedServiceScopeMarkerFixture(page, fixture) {
  await page.evaluate((fixtureData) => {
    const qaTags = fixtureData.devices.map((device) => device.tag);
    state.activeJob = null;
    state.activeTechPreviewScheduleId = "";
    state.activeTechSystemKey = "";
    state.activeTechFloorId = "";
    state.techScreen = "jobs";
    state.focusedMapTag = "";
    state.selectedSetupTag = "";
    state.inspections = {
      [fixtureData.tags.recheck]: {
        status: "Fail",
        notes: "QA unresolved fault/defect - mandatory recheck",
        scheduleId: "QA-PREVIOUS-SCHEDULE",
        jobId: "QA-PREVIOUS-JOB"
      }
    };
    state.criticalSops = {};
    state.systemChecks = {};
    state.siteProfile = { companyName: "UOB", siteName: "UOB" };
    state.mimicFloors = [
      fixtureData.floor,
      ...state.mimicFloors.filter((floor) => (floor.id || floor.floorId) !== fixtureData.floor.id)
    ];
    state.setupDevices = [
      ...state.setupDevices.filter((device) => !/^QA\.(SCOPE|MASTER)\./.test(device.tag || "") && !qaTags.includes(device.tag)),
      ...fixtureData.devices
    ];
    state.schedules = [
      fixtureData.schedule,
      ...state.schedules.filter((schedule) => schedule.scheduleId !== fixtureData.schedule.scheduleId && !/^QA-SERVICE-SCOPE-MARKERS-/.test(schedule.scheduleId || ""))
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
    updateWorkspaceTechScreenClass();
    renderTechWorkPanel();
  }, fixture);
}

async function getRenderedMarkerSnapshot(page) {
  return page.evaluate(() => {
    const markers = [...document.querySelectorAll(".marker.setup-marker")].map((marker) => ({
      id: marker.dataset.setupTag || marker.dataset.deviceId || marker.dataset.label || "",
      className: marker.className,
      text: marker.textContent.trim()
    })).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" }));
    return {
      count: markers.length,
      ids: markers.map((marker) => marker.id),
      assignedIds: markers.filter((marker) => marker.className.includes("assigned-scope")).map((marker) => marker.id),
      lockedIds: markers.filter((marker) => marker.className.includes("locked") || marker.className.includes("dependency-locked")).map((marker) => marker.id),
      markers
    };
  });
}

async function runServiceScopeMarkerDomRegression(page, fixture) {
  await seedServiceScopeMarkerFixture(page, fixture);
  const started = await page.evaluate(async (scheduleId) => {
    await startOrResumeTechnicianSchedule(scheduleId);
    return {
      activeId: state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "",
      jobIds: getTechnicianMaintenanceSchedules(Infinity).map((schedule) => schedule.scheduleId)
    };
  }, fixture.scheduleId);
  assert(started.activeId === fixture.scheduleId, `Service-scope marker QA could not start the seeded job: ${JSON.stringify(started)}`);
  await page.waitForFunction((scheduleId) => {
    const activeId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
    return activeId === scheduleId && document.querySelector("#techActiveJobSummary [data-tech-system='fire-alarm']");
  }, fixture.scheduleId, { timeout: 15000 });
  await page.evaluate(async (scheduleId) => {
    await openTechnicianFireSystem(scheduleId, "fire-alarm");
  }, fixture.scheduleId);
  await page.waitForSelector("#workspace.tech-screen-inspection.critical-sop-active", { timeout: 15000 });
  await page.locator("#criticalSopPanel [data-tech-critical-view-mimic]").click();
  await page.waitForSelector("#workspace.tech-screen-mimic", { timeout: 15000 });
  await page.waitForFunction((expected) => {
    const rendered = [...document.querySelectorAll(".marker.setup-marker")]
      .map((marker) => marker.dataset.setupTag || marker.dataset.deviceId || marker.dataset.label || "");
    return expected.every((id) => rendered.includes(id));
  }, fixture.expectedMarkerIds, { timeout: 15000 });

  const beforePrerequisite = await getRenderedMarkerSnapshot(page);
  const beforeIds = JSON.stringify(beforePrerequisite.ids);
  assert(beforePrerequisite.count === fixture.expectedMarkerIds.length, `Service-scope mimic rendered ${beforePrerequisite.count} setup markers before prerequisite; expected ${fixture.expectedMarkerIds.length}. IDs: ${beforeIds}`);
  assert(JSON.stringify(beforePrerequisite.ids) === JSON.stringify(fixture.expectedMarkerIds), `Service-scope marker IDs before prerequisite do not match planned scope. Expected ${JSON.stringify(fixture.expectedMarkerIds)}, got ${beforeIds}`);
  assert(beforePrerequisite.ids.includes(fixture.tags.assigned), "Assigned planned field marker is missing before prerequisite.");
  assert(beforePrerequisite.ids.includes(fixture.tags.mfap), "Critical prerequisite marker is missing before prerequisite.");
  assert(beforePrerequisite.ids.includes(fixture.tags.recheck), "Mandatory current-job recheck marker is missing before prerequisite.");
  assert(!beforePrerequisite.ids.includes(fixture.tags.unassigned), "Unassigned master marker rendered before prerequisite.");
  assert(beforePrerequisite.lockedIds.includes(fixture.tags.assigned), "Assigned field marker should be locked before MFAP prerequisite.");

  const mfapResult = await completeMfapPrerequisite(page, {
    scheduleId: fixture.scheduleId,
    tags: { mfap: fixture.tags.mfap }
  });
  assert(mfapResult.ok, `Service-scope MFAP prerequisite seed failed: ${mfapResult.reason || ""}`);
  await page.waitForFunction((assignedTag) => {
    const marker = [...document.querySelectorAll(".marker.setup-marker")]
      .find((item) => (item.dataset.setupTag || item.dataset.label) === assignedTag);
    return marker && !marker.classList.contains("locked") && !marker.classList.contains("dependency-locked");
  }, fixture.tags.assigned, { timeout: 15000 });
  const afterPrerequisite = await getRenderedMarkerSnapshot(page);
  assert(JSON.stringify(afterPrerequisite.ids) === JSON.stringify(fixture.expectedMarkerIds), `Service-scope marker IDs changed after prerequisite. Expected ${JSON.stringify(fixture.expectedMarkerIds)}, got ${JSON.stringify(afterPrerequisite.ids)}`);
  assert(!afterPrerequisite.lockedIds.includes(fixture.tags.assigned), "Assigned field marker stayed locked after MFAP prerequisite.");
  assert(!afterPrerequisite.ids.includes(fixture.tags.unassignedSameFloor), "Unassigned master marker rendered after prerequisite.");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction((scheduleId) => {
    const activeId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
    return activeId === scheduleId
      && state.activeTechSystemKey === "fire-alarm"
      && document.querySelector("#workspace")?.classList.contains("tech-screen-mimic");
  }, fixture.scheduleId, { timeout: 15000 });
  const afterRefresh = await getRenderedMarkerSnapshot(page);
  assert(JSON.stringify(afterRefresh.ids) === JSON.stringify(fixture.expectedMarkerIds), `Service-scope marker IDs changed after refresh. Expected ${JSON.stringify(fixture.expectedMarkerIds)}, got ${JSON.stringify(afterRefresh.ids)}`);

  return { beforePrerequisite, afterPrerequisite, afterRefresh };
}

async function tapMarker(page, tag) {
  const result = await page.evaluate((deviceTag) => {
    const marker = [...document.querySelectorAll(".marker.assigned-scope")]
      .find((item) => item.dataset.setupTag === deviceTag || item.dataset.deviceId === deviceTag || item.dataset.label === deviceTag);
    if (!marker) return { ok: false, reason: "marker missing" };
    marker.scrollIntoView({ block: "center", inline: "center" });
    marker.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch" }));
    return {
      ok: true,
      className: marker.className,
      title: marker.title,
      text: marker.textContent.trim()
    };
  }, tag);
  assert(result.ok, `Unable to tap marker ${tag}: ${result.reason || ""}`);
  return result;
}

async function completeMfapPrerequisite(page, fixture) {
  return page.evaluate(({ scheduleId, mfapTag }) => {
    const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
    const mfap = getScheduledAssignedDevices(schedule).find((device) => (device.id || device.tag) === mfapTag);
    ensureActiveJobCriticalWorkflows(schedule);
    const workflow = getCriticalWorkflowRunForParentDevice(mfap, schedule);
    const template = getCriticalSopTemplate(workflow?.templateId || getCriticalSopTemplateIdForDevice(mfap));
    if (!workflow || !template) return { ok: false, reason: "missing workflow/template" };
    const steps = {};
    (workflow.prerequisiteStepIndexes || []).forEach((index) => {
      const step = template.steps[index] || {};
      steps[index] = {
        confirmed: !step.noConfirm,
        title: step.title || `Step ${index + 1}`,
        critical: Boolean(step.critical),
        choice: step.requiresChoice ? (step.choices?.[0] || "Pass") : "",
        reading: step.requiresReading ? "QA reading normal" : "",
        remark: sopStepNeedsRemark(step) ? "QA prerequisite completed." : "",
        photo: step.requiresPhoto ? "qa-prerequisite-photo.jpg" : "",
        supervisor: step.requiresSupervisor ? "QA Supervisor" : ""
      };
    });
    state.criticalSops[`${template.id}::${mfapTag}`] = {
      templateId: template.id,
      templateVersion: getCriticalSopTemplateVersion(template),
      templateSnapshot: createCriticalSopTemplateSnapshot(template),
      workflowId: workflow.workflowId,
      dependencyDefinitionId: workflow.definitionId,
      title: template.title,
      deviceTag: mfapTag,
      deviceType: mfap.type,
      floor: mfap.floorTitle || mfap.floor || "",
      location: mfap.location || "",
      companyName: schedule.companyName,
      siteName: schedule.siteName,
      steps,
      beforePhoto: "",
      afterPhoto: "",
      filledBy: getCurrentUserName(),
      filledRole: getCurrentUserRole(),
      generalRemarks: "QA prerequisite only; SOP content unchanged.",
      savedAt: new Date().toISOString(),
      savedBy: getCurrentUserName()
    };
    writeStoredJson("rmtCriticalSops", state.criticalSops);
    invalidateRuntimeCaches();
    ensureActiveJobCriticalWorkflows(schedule);
    renderTechSystemStagePanel(schedule);
    renderMarkers();
    setTechScreen("mimic", { scroll: false, renderMarkers: false });
    const refreshedWorkflow = getCriticalWorkflowRunForParentDevice(mfap, schedule);
    return { ok: true, stage: getCriticalWorkflowRunState(refreshedWorkflow, schedule) };
  }, { scheduleId: fixture.scheduleId, mfapTag: fixture.tags.mfap });
}

async function getMarkerState(page, tag) {
  return page.evaluate((deviceTag) => {
    const marker = [...document.querySelectorAll(".marker.assigned-scope")]
      .find((item) => item.dataset.setupTag === deviceTag || item.dataset.deviceId === deviceTag || item.dataset.label === deviceTag);
    return marker ? { exists: true, className: marker.className, text: marker.textContent.trim() } : { exists: false };
  }, tag);
}

async function getTechnicianVisibleLayout(page) {
  return page.evaluate(() => {
    const rectInfo = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return { exists: false, display: "", visibility: "", rect: null, area: 0, viewportArea: 0, intersectsViewport: false };
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      return {
        exists: true,
        display: style.display,
        visibility: style.visibility,
        hidden: element.classList.contains("hidden"),
        rect: {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        area: Math.round(rect.width * rect.height),
        viewportArea: Math.round(visibleWidth * visibleHeight),
        intersectsViewport: visibleWidth > 20 && visibleHeight > 20
      };
    };
    return {
      techScreen: state.techScreen,
      workspaceClass: document.querySelector("#workspace")?.className || "",
      scrollY: Math.round(window.scrollY || 0),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      mapPanel: rectInfo(".map-panel"),
      mapStage: rectInfo("#mapStage"),
      mapImage: rectInfo("#mapImage"),
      criticalPanel: rectInfo("#criticalSopPanel"),
      inspectionPanel: rectInfo(".inspection-panel")
    };
  });
}

function assertMimicDominatesViewport(layout, context) {
  assert(layout.techScreen === "mimic", `${context}: expected tech screen mimic, got ${layout.techScreen}`);
  assert(layout.mapPanel.exists, `${context}: map panel missing.`);
  assert(layout.mapPanel.display !== "none", `${context}: map panel is display:none.`);
  assert(layout.mapPanel.area > 0, `${context}: map panel has zero layout area.`);
  assert(layout.mapPanel.intersectsViewport, `${context}: map panel does not intersect the visible viewport: ${JSON.stringify(layout.mapPanel)}`);
  assert(layout.mapStage.exists && layout.mapStage.intersectsViewport, `${context}: map stage is not visible in the viewport.`);
  assert(layout.mapImage.exists && layout.mapImage.area > 0, `${context}: mimic image/background has no visible size.`);
  assert(!layout.workspaceClass.includes("critical-sop-active"), `${context}: critical SOP active class still dominates mimic state.`);
  assert(!layout.criticalPanel.intersectsViewport || layout.criticalPanel.viewportArea < layout.mapPanel.viewportArea, `${context}: critical SOP remains more visible than mimic.`);
}

async function savePassFromMarker(page, tag) {
  await tapMarker(page, tag);
  await page.waitForFunction((deviceTag) => {
    return document.querySelector("#workspace")?.classList.contains("tech-screen-inspection")
      && document.querySelector("#checklistForm:not(.hidden) #deviceName")?.textContent.trim() === deviceTag;
  }, tag, { timeout: 15000 });
  await page.locator("#checklistForm button[type='submit']").click();
  await page.waitForFunction((deviceTag) => {
    const marker = [...document.querySelectorAll(".marker.assigned-scope")]
      .find((item) => item.dataset.setupTag === deviceTag || item.dataset.deviceId === deviceTag || item.dataset.label === deviceTag);
    return document.querySelector("#workspace")?.classList.contains("tech-screen-mimic")
      && document.querySelector("#checklistForm")?.classList.contains("hidden")
      && marker?.classList.contains("pass");
  }, tag, { timeout: 20000 });
}

async function savePassWithPhotoFromMarker(page, tag, photoName = "qa-pass-photo.jpg") {
  await tapMarker(page, tag);
  await page.waitForFunction((deviceTag) => {
    return document.querySelector("#workspace")?.classList.contains("tech-screen-inspection")
      && document.querySelector("#checklistForm:not(.hidden) #deviceName")?.textContent.trim() === deviceTag;
  }, tag, { timeout: 15000 });
  assert(await page.locator("#beforePhoto").isVisible(), "Photo input must be visible before PASS/FAULT selection.");
  assert(await page.locator("#viewInspectionPhotoBtn").isVisible(), "View Photo action must be visible before PASS/FAULT selection.");
  await page.locator("#beforePhoto").setInputFiles({
    name: photoName,
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  });
  await page.waitForFunction((expectedName) => {
    return document.querySelector("#photoEvidenceStatus")?.textContent.includes(expectedName);
  }, photoName, { timeout: 5000 });
  await page.locator("#checklistForm button[type='submit']").click();
  await page.waitForFunction((deviceTag) => {
    const marker = [...document.querySelectorAll(".marker.assigned-scope")]
      .find((item) => item.dataset.setupTag === deviceTag || item.dataset.deviceId === deviceTag || item.dataset.label === deviceTag);
    return document.querySelector("#workspace")?.classList.contains("tech-screen-mimic")
      && document.querySelector("#checklistForm")?.classList.contains("hidden")
      && marker?.classList.contains("pass")
      && state.inspections[deviceTag]?.beforePhoto;
  }, tag, { timeout: 20000 });
  return page.evaluate((deviceTag) => ({
    beforePhoto: state.inspections[deviceTag]?.beforePhoto || "",
    afterPhoto: state.inspections[deviceTag]?.afterPhoto || "",
    status: state.inspections[deviceTag]?.status || "",
    inspectedBy: state.inspections[deviceTag]?.inspectedBy || "",
    inspectedAt: state.inspections[deviceTag]?.inspectedAt || ""
  }), tag);
}

async function savePassWithPhotoAndNextFromMarker(page, tag, photoName = "qa-save-next-pass-photo.jpg") {
  await tapMarker(page, tag);
  await page.waitForFunction((deviceTag) => {
    return document.querySelector("#workspace")?.classList.contains("tech-screen-inspection")
      && document.querySelector("#checklistForm:not(.hidden) #deviceName")?.textContent.trim() === deviceTag;
  }, tag, { timeout: 15000 });
  assert(await page.locator("#beforePhoto").isVisible(), "Photo input must be visible before Save & Next.");
  await page.locator("#beforePhoto").setInputFiles({
    name: photoName,
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  });
  await page.locator("#saveNextInspectionBtn").click();
  await page.waitForFunction((deviceTag) => {
    return state.inspections[deviceTag]?.status === "pass"
      && state.inspections[deviceTag]?.beforePhoto;
  }, tag, { timeout: 15000 });
  await page.waitForFunction((deviceTag) => {
    const opened = document.querySelector("#checklistForm:not(.hidden) #deviceName")?.textContent.trim() || "";
    return opened && opened !== deviceTag;
  }, tag, { timeout: 15000 });
  return page.evaluate((deviceTag) => ({
    openedDevice: document.querySelector("#checklistForm:not(.hidden) #deviceName")?.textContent.trim() || "",
    saved: {
      status: state.inspections[deviceTag]?.status || "",
      beforePhoto: state.inspections[deviceTag]?.beforePhoto || "",
      inspectedBy: state.inspections[deviceTag]?.inspectedBy || "",
      inspectedAt: state.inspections[deviceTag]?.inspectedAt || ""
    }
  }), tag);
}

async function saveFaultFromMarker(page, tag) {
  const currentDevice = await page.locator("#checklistForm:not(.hidden) #deviceName").textContent().catch(() => "");
  if (currentDevice.trim() !== tag) {
    await tapMarker(page, tag);
  }
  await page.waitForFunction((deviceTag) => {
    return document.querySelector("#workspace")?.classList.contains("tech-screen-inspection")
      && document.querySelector("#checklistForm:not(.hidden) #deviceName")?.textContent.trim() === deviceTag;
  }, tag, { timeout: 15000 });
  await page.locator("#markFailBtn").click();
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("tech-fault-entry-active"), null, { timeout: 15000 });
  await page.fill("#notes", "QA fault requiring evidence.");
  await page.locator("#beforePhoto").setInputFiles({
    name: "qa-before.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  });
  await page.locator("#markFailBtn").click();
  await page.waitForFunction((deviceTag) => {
    const marker = [...document.querySelectorAll(".marker.assigned-scope")]
      .find((item) => item.dataset.setupTag === deviceTag || item.dataset.deviceId === deviceTag || item.dataset.label === deviceTag);
    return document.querySelector("#workspace")?.classList.contains("tech-screen-mimic")
      && document.querySelector("#checklistForm")?.classList.contains("hidden")
      && marker?.classList.contains("fail");
  }, tag, { timeout: 20000 });
}

async function markRemainingFireAlarmFieldDevicesComplete(page, fixture) {
  return page.evaluate((scheduleId) => {
    const schedule = getActiveTechnicianMaintenanceSchedule()
      || state.schedules.find((item) => item.scheduleId === scheduleId);
    state.activeTechSystemKey = "fire-alarm";
    ensureActiveJobCriticalWorkflows(schedule);
    const group = getTechnicianFireSystemGroups(schedule).find((item) => item.id === "fire-alarm");
    const now = new Date().toISOString();
    (group?.fieldDevices || []).forEach((device) => {
      const id = device.id || device.tag;
      if (!id || state.inspections[id]?.status === "fail") return;
      state.inspections[id] = {
        ...(state.inspections[id] || {}),
        status: "pass",
        answers: (device.questions || []).map(() => "Pass"),
        notes: state.inspections[id]?.notes || "QA field-device completion.",
        action: state.inspections[id]?.action || "No action required.",
        savedAt: state.inspections[id]?.savedAt || now,
        savedBy: state.inspections[id]?.savedBy || getCurrentUserName()
      };
    });
    writeStoredJson("tmFireInspections", state.inspections);
    invalidateRuntimeCaches();
    ensureActiveJobCriticalWorkflows(schedule);
    Object.values(state.activeJob?.criticalWorkflowRuns || {}).forEach((run) => updateCriticalWorkflowRunProgress(run, schedule));
    renderTechSystemStagePanel(schedule);
    renderMarkers();
    const refreshedGroup = getTechnicianFireSystemGroups(schedule).find((item) => item.id === "fire-alarm");
    const cards = [...document.querySelectorAll("#techSystemStagePanel .tech-stage-card")].map((card) => ({
      className: card.className,
      text: card.textContent.replace(/\s+/g, " ").trim()
    }));
    const route = getTechnicianSystemStageRoute(schedule, "fire-alarm");
    return {
      fieldTotal: refreshedGroup?.fieldDevices?.length || 0,
      fieldSummary: refreshedGroup?.stageModel?.fieldSummary || null,
      stage3Class: cards[2]?.className || "",
      stage3Text: cards[2]?.text || "",
      routeStage: route?.stage || "",
      routeScreen: route?.screen || "",
      routeDeviceId: route?.deviceId || ""
    };
  }, fixture.scheduleId);
}

async function measureStageTabSwitching(page) {
  const systems = await page.$$eval("#techSystemStagePanel [data-tech-stage-system]", (buttons) => buttons.map((button) => button.dataset.techStageSystem).filter(Boolean));
  assert(systems.includes("fire-alarm"), "Fire Alarm system tab is missing.");
  assert(systems.includes("emergency-exit"), "Emergency/Exit system tab is missing from the QA fixture.");
  const started = await page.evaluate(() => performance.now());
  for (let round = 0; round < 2; round += 1) {
    for (const systemId of systems) {
      await page.evaluate(async (id) => {
        const schedule = getActiveTechnicianMaintenanceSchedule() || getTechMarkerScopeSchedule();
        await openTechnicianFireSystem(schedule.scheduleId, id);
      }, systemId);
      await page.waitForFunction((id) => {
        const activeButton = document.querySelector(`#techSystemStagePanel [data-tech-stage-system="${CSS.escape(id)}"]`);
        const workspace = document.querySelector("#workspace");
        return state.activeTechSystemKey === id
          && activeButton?.classList.contains("active")
          && (workspace?.classList.contains("tech-screen-mimic") || workspace?.classList.contains("tech-screen-inspection"));
      }, systemId, { timeout: 12000 });
    }
  }
  await page.evaluate(async () => {
    const schedule = getActiveTechnicianMaintenanceSchedule() || getTechMarkerScopeSchedule();
    await openTechnicianFireSystem(schedule.scheduleId, "fire-alarm");
  });
  await page.waitForFunction(() => state.activeTechSystemKey === "fire-alarm", null, { timeout: 12000 });
  const finished = await page.evaluate(() => performance.now());
  return { systems, durationMs: Math.round(finished - started) };
}

(async () => {
  const executablePath = EDGE_PATHS.find((item) => existsSync(item));
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ viewport: { width: 393, height: 727 }, isMobile: true, hasTouch: true });
  const serviceScopeFixture = buildUobServiceScopeMarkerFixture();
  const fixture = buildUobHierarchyFixture();
  await context.route("**/api/schedules", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      schedules: [serviceScopeFixture.schedule, fixture.schedule],
      savedAt: new Date().toISOString(),
      savedByApp: "RMT Fire Inspection App Hierarchy QA"
    })
  }));
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await loginAsTech(page);
  const serviceScopeMarkerRegression = await runServiceScopeMarkerDomRegression(page, serviceScopeFixture);
  await seedFixture(page, fixture);

  await page.evaluate(async (scheduleId) => {
    await startOrResumeTechnicianSchedule(scheduleId);
  }, fixture.scheduleId);
  await page.waitForFunction((scheduleId) => {
    const activeId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
    return activeId === scheduleId && document.querySelector("#techActiveJobSummary [data-tech-system='fire-alarm']");
  }, fixture.scheduleId, { timeout: 15000 });

  await page.evaluate(async (scheduleId) => {
    await openTechnicianFireSystem(scheduleId, "fire-alarm");
  }, fixture.scheduleId);
  await page.waitForSelector("#workspace.tech-screen-inspection.critical-sop-active", { timeout: 15000 });
  await page.waitForFunction((mfapTag) => {
    return state.activeTechSystemKey === "fire-alarm"
      && document.querySelector("#criticalSopPanel h2")?.textContent.includes(mfapTag)
      && document.querySelector("#techSystemStagePanel:not(.hidden)")
      && document.querySelectorAll("#techSystemStagePanel .tech-stage-card").length === 3;
  }, fixture.tags.mfap, { timeout: 15000 });

  const beforePrerequisite = await page.evaluate((tags) => {
    const cards = [...document.querySelectorAll("#techSystemStagePanel .tech-stage-card")].map((card) => ({
      className: card.className,
      text: card.textContent.replace(/\s+/g, " ").trim()
    }));
    const markers = tags.map((tag) => {
      const marker = [...document.querySelectorAll(".marker.assigned-scope")]
        .find((item) => item.dataset.setupTag === tag || item.dataset.deviceId === tag || item.dataset.label === tag);
      return { tag, className: marker?.className || "", exists: Boolean(marker) };
    });
    return {
      stageTexts: cards.map((card) => card.text),
      stageClasses: cards.map((card) => card.className),
      markerStates: markers,
      activeSystem: state.activeTechSystemKey,
      activeScreen: state.techScreen,
      criticalHeading: document.querySelector("#criticalSopPanel h2")?.textContent || "",
      assignedPanelDisplay: getComputedStyle(document.querySelector("#techAssignedItemPanel")).display,
      mapPanelDisplay: getComputedStyle(document.querySelector(".map-panel")).display
    };
  }, [fixture.tags.mcp, fixture.tags.smoke]);

  assert(beforePrerequisite.activeSystem === "fire-alarm", `Expected active Fire Alarm tab, got ${beforePrerequisite.activeSystem}`);
  assert(beforePrerequisite.activeScreen === "inspection", `Expected Stage 1 inspection screen, got ${beforePrerequisite.activeScreen}`);
  assert(beforePrerequisite.criticalHeading.includes(fixture.tags.mfap), `First actionable content is not MFAP ${fixture.tags.mfap}.`);
  assert(beforePrerequisite.assignedPanelDisplay === "none", "Assigned device list must not sit above the MFAP checklist during Stage 1.");
  assert(beforePrerequisite.mapPanelDisplay === "none", "Field-device mimic must not be the first working screen during Stage 1.");
  assert(beforePrerequisite.stageTexts[0].includes(fixture.tags.mfap), `Step 1 does not show MFAP tag ${fixture.tags.mfap}.`);
  assert(beforePrerequisite.stageTexts[1].includes("MCP / Smoke / Heat"), "Step 2 field-device label is missing.");
  assert(beforePrerequisite.stageClasses[2].includes("locked"), "Step 3 must be locked before field devices/final restoration.");

  const criticalViewMimicVisible = await page.locator("#criticalSopPanel [data-tech-critical-view-mimic]").isVisible();
  assert(criticalViewMimicVisible, "Stage 1 critical SOP screen must provide a visible View Mimic reference action.");
  await page.locator("#criticalSopPanel [data-tech-critical-view-mimic]").click();
  await page.waitForFunction((tags) => {
    const findMarker = (tag) => [...document.querySelectorAll(".marker.assigned-scope")]
      .find((item) => item.dataset.setupTag === tag || item.dataset.deviceId === tag || item.dataset.label === tag);
    return document.querySelector("#workspace")?.classList.contains("tech-screen-mimic")
      && document.querySelector("#techSystemStagePanel:not(.hidden)")
      && tags.every((tag) => findMarker(tag));
  }, [fixture.tags.mcp, fixture.tags.smoke], { timeout: 15000 });
  const incompleteMimicRoute = await page.evaluate((tags) => {
    const findMarker = (tag) => [...document.querySelectorAll(".marker.assigned-scope")]
      .find((item) => item.dataset.setupTag === tag || item.dataset.deviceId === tag || item.dataset.label === tag);
    return {
      screen: state.techScreen,
      workspaceClass: document.querySelector("#workspace")?.className || "",
      mapPanelDisplay: getComputedStyle(document.querySelector(".map-panel")).display,
      stageText: document.querySelector("#techSystemStagePanel")?.textContent.replace(/\s+/g, " ").trim() || "",
      syncText: document.querySelector("#syncState")?.textContent || "",
      markerStates: tags.map((tag) => {
        const marker = findMarker(tag);
        return { tag, className: marker?.className || "", exists: Boolean(marker) };
      })
    };
  }, [fixture.tags.mcp, fixture.tags.smoke]);
  assert(incompleteMimicRoute.screen === "mimic", `View Mimic did not activate the mimic screen before prerequisite: ${incompleteMimicRoute.screen}`);
  assert(incompleteMimicRoute.mapPanelDisplay !== "none", "View Mimic did not make the actual map panel visible before prerequisite.");
  assert(incompleteMimicRoute.stageText.includes(fixture.tags.mfap), "Mimic reference view lost the System Check return card.");
  assert(incompleteMimicRoute.syncText.includes("mimic opened for reference"), `View Mimic did not explain reference/locked mode: ${incompleteMimicRoute.syncText}`);
  const incompleteMimicLayout = await getTechnicianVisibleLayout(page);
  assertMimicDominatesViewport(incompleteMimicLayout, "Stage 1 View Mimic");
  const backToSystemCheckLabel = await page.locator("#techBackToInspectionBtn").textContent();
  assert(backToSystemCheckLabel.includes("System Check"), `Expected visible Back to System Check action, got ${backToSystemCheckLabel}`);
  incompleteMimicRoute.markerStates.forEach((marker) => {
    assert(marker.exists, `${marker.tag} marker is missing in reference mimic before prerequisite.`);
    assert(marker.className.includes("locked") || marker.className.includes("dependency-locked"), `${marker.tag} is not locked in reference mimic before prerequisite.`);
  });
  await page.locator("#techBackToInspectionBtn").click();
  await page.waitForFunction((mfapTag) => {
    return document.querySelector("#workspace")?.classList.contains("tech-screen-inspection")
      && document.querySelector("#workspace")?.classList.contains("critical-sop-active")
      && document.querySelector("#criticalSopPanel h2")?.textContent.includes(mfapTag);
  }, fixture.tags.mfap, { timeout: 15000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(({ scheduleId, mfapTag }) => {
      const activeId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
      return activeId === scheduleId
        && state.activeTechSystemKey === "fire-alarm"
        && document.querySelector("#workspace")?.classList.contains("tech-screen-inspection")
        && document.querySelector("#workspace")?.classList.contains("critical-sop-active")
        && document.querySelector("#criticalSopPanel h2")?.textContent.includes(mfapTag);
    }, { scheduleId: fixture.scheduleId, mfapTag: fixture.tags.mfap }, { timeout: 15000 });
  } catch (error) {
    const debug = await page.evaluate(() => ({
      workspaceClass: document.querySelector("#workspace")?.className || "",
      currentUser: state.currentUser || null,
      activeScheduleId: state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "",
      activeTechSystemKey: state.activeTechSystemKey,
      activeCriticalDevice: state.activeCriticalDevice || null,
      criticalHeading: document.querySelector("#criticalSopPanel h2")?.textContent || "",
      syncState: document.querySelector("#syncState")?.textContent || "",
      localActiveJob: JSON.parse(localStorage.getItem("rmtActiveJob") || "null"),
      localSystem: localStorage.getItem("rmtActiveTechSystemKey"),
      localSchedule: localStorage.getItem("rmtActiveTechPreviewScheduleId")
    }));
    throw new Error(`Stage 1 refresh did not restore MFAP: ${JSON.stringify(debug, null, 2)}`);
  }

  await page.locator("#criticalSopPanel [data-tech-critical-view-mimic]").click();
  await page.waitForSelector("#workspace.tech-screen-mimic", { timeout: 15000 });
  const refreshedMimicLayout = await getTechnicianVisibleLayout(page);
  assertMimicDominatesViewport(refreshedMimicLayout, "Stage 1 View Mimic after refresh");
  const lockedMarkersAfterRefresh = await page.evaluate((tags) => tags.map((tag) => {
    const marker = [...document.querySelectorAll(".marker.assigned-scope")]
      .find((item) => item.dataset.setupTag === tag || item.dataset.deviceId === tag || item.dataset.label === tag);
    return { tag, className: marker?.className || "", exists: Boolean(marker) };
  }), [fixture.tags.mcp, fixture.tags.smoke]);
  lockedMarkersAfterRefresh.forEach((marker) => {
    assert(marker.exists, `${marker.tag} marker is missing before prerequisite.`);
    assert(marker.className.includes("locked") || marker.className.includes("dependency-locked"), `${marker.tag} is not locked before MFAP prerequisite.`);
  });

  await tapMarker(page, fixture.tags.mcp);
  await page.waitForFunction((mfapTag) => {
    const syncText = document.querySelector("#syncState")?.textContent || "";
    return syncText.includes("Blocked:")
      && syncText.includes(mfapTag)
      && document.querySelector("#workspace")?.classList.contains("critical-sop-active");
  }, fixture.tags.mfap, { timeout: 15000 });
  const lockedExplanation = await page.textContent("#syncState");

  const prerequisiteResult = await completeMfapPrerequisite(page, fixture);
  assert(prerequisiteResult.ok, `MFAP prerequisite seed failed: ${prerequisiteResult.reason || ""}`);
  await page.waitForFunction((tags) => {
    return tags.every((tag) => {
      const marker = [...document.querySelectorAll(".marker.assigned-scope")]
        .find((item) => item.dataset.setupTag === tag || item.dataset.deviceId === tag || item.dataset.label === tag);
      return marker && !marker.classList.contains("locked") && !marker.classList.contains("dependency-locked");
    });
  }, [fixture.tags.mcp, fixture.tags.smoke, fixture.tags.nextSmoke], { timeout: 15000 });

  await tapMarker(page, fixture.tags.mcp);
  await page.waitForFunction((deviceTag) => {
    return document.querySelector("#workspace")?.classList.contains("tech-screen-inspection")
      && document.querySelector("#checklistForm:not(.hidden) #deviceName")?.textContent.trim() === deviceTag;
  }, fixture.tags.mcp, { timeout: 15000 });
  assert(await page.locator("#techViewMimicBtn").isVisible(), "Normal field checklist View Mimic button is not visible.");
  await page.locator("#techViewMimicBtn").click();
  await page.waitForFunction((deviceTag) => {
    const marker = [...document.querySelectorAll(".marker.assigned-scope")]
      .find((item) => item.dataset.setupTag === deviceTag || item.dataset.deviceId === deviceTag || item.dataset.label === deviceTag);
    return document.querySelector("#workspace")?.classList.contains("tech-screen-mimic")
      && marker
      && !marker.classList.contains("locked")
      && !marker.classList.contains("dependency-locked")
      && document.querySelector("#syncState")?.textContent.includes("mimic opened");
  }, fixture.tags.mcp, { timeout: 15000 });
  const actionableMimicLayout = await getTechnicianVisibleLayout(page);
  assertMimicDominatesViewport(actionableMimicLayout, "Unlocked field checklist View Mimic");

  await page.reload({ waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction((scheduleId) => {
      const activeId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
      return activeId === scheduleId
        && state.activeTechSystemKey === "fire-alarm"
        && document.querySelector("#workspace")?.classList.contains("tech-screen-mimic")
        && !document.querySelector("#workspace")?.classList.contains("critical-sop-active");
    }, fixture.scheduleId, { timeout: 15000 });
  } catch (error) {
    const debug = await page.evaluate(() => ({
      workspaceClass: document.querySelector("#workspace")?.className || "",
      loginHidden: document.querySelector("#loginView")?.classList.contains("hidden"),
      currentUser: state.currentUser || null,
      activeJob: state.activeJob || null,
      activeTechSystemKey: state.activeTechSystemKey,
      activeTechPreviewScheduleId: state.activeTechPreviewScheduleId,
      floorValue: document.querySelector("#floorSelect")?.value || "",
      stageText: document.querySelector("#techSystemStagePanel")?.textContent.replace(/\s+/g, " ").trim() || "",
      markerIds: [...document.querySelectorAll(".marker.setup-marker")].map((marker) => marker.dataset.setupTag || marker.dataset.label || ""),
      syncState: document.querySelector("#syncState")?.textContent || "",
      localActiveJob: JSON.parse(localStorage.getItem("rmtActiveJob") || "null"),
      localContext: JSON.parse(localStorage.getItem("rmtTechActiveContext") || "null"),
      localSystem: localStorage.getItem("rmtActiveTechSystemKey"),
      localSchedule: localStorage.getItem("rmtActiveTechPreviewScheduleId")
    }));
    throw new Error(`Refresh did not restore unlocked Fire Alarm mimic: ${JSON.stringify(debug, null, 2)}`);
  }

  const smokePassPhoto = await savePassWithPhotoFromMarker(page, fixture.tags.smoke, "qa-pass-smoke.jpg");
  assert(smokePassPhoto.status === "pass", `Smoke PASS photo save did not save PASS status: ${JSON.stringify(smokePassPhoto)}`);
  assert(smokePassPhoto.beforePhoto === "qa-pass-smoke.jpg", `Smoke PASS photo name was not saved: ${JSON.stringify(smokePassPhoto)}`);
  assert(smokePassPhoto.inspectedBy === "Demo Technician", `Smoke PASS photo record lost technician attribution: ${JSON.stringify(smokePassPhoto)}`);
  assert(Boolean(smokePassPhoto.inspectedAt), "Smoke PASS photo record lost timestamp.");

  await tapMarker(page, fixture.tags.smoke);
  await page.waitForFunction((deviceTag) => {
    return document.querySelector("#checklistForm:not(.hidden) #deviceName")?.textContent.trim() === deviceTag
      && document.querySelector("#photoEvidenceStatus")?.textContent.includes("qa-pass-smoke.jpg");
  }, fixture.tags.smoke, { timeout: 15000 });
  const reopenedSmokePhoto = await page.evaluate((deviceTag) => ({
    statusText: document.querySelector("#photoEvidenceStatus")?.textContent || "",
    beforeNameText: document.querySelector("#beforePhotoSavedName")?.textContent || "",
    record: state.inspections[deviceTag] || {}
  }), fixture.tags.smoke);
  assert(reopenedSmokePhoto.beforeNameText.includes("qa-pass-smoke.jpg"), `Reopened Smoke device did not show saved PASS photo: ${JSON.stringify(reopenedSmokePhoto)}`);
  await page.locator("#techViewMimicBtn").click();
  await page.waitForSelector("#workspace.tech-screen-mimic", { timeout: 15000 });

  const saveNextPhoto = await savePassWithPhotoAndNextFromMarker(page, fixture.tags.mcp, "qa-save-next-mcp.jpg");
  assert(saveNextPhoto.saved.status === "pass", `Save & Next did not save MCP PASS status: ${JSON.stringify(saveNextPhoto)}`);
  assert(saveNextPhoto.saved.beforePhoto === "qa-save-next-mcp.jpg", `Save & Next did not keep MCP photo: ${JSON.stringify(saveNextPhoto)}`);
  assert(saveNextPhoto.saved.inspectedBy === "Demo Technician", `Save & Next lost technician attribution: ${JSON.stringify(saveNextPhoto)}`);
  assert(saveNextPhoto.openedDevice && saveNextPhoto.openedDevice !== fixture.tags.mcp, `Save & Next should open a different assigned Fire Alarm device, got ${saveNextPhoto.openedDevice}`);

  await saveFaultFromMarker(page, saveNextPhoto.openedDevice);

  const afterFieldDevices = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#techSystemStagePanel .tech-stage-card")].map((card) => ({
      className: card.className,
      text: card.textContent.replace(/\s+/g, " ").trim()
    }));
    return {
      stage3Class: cards[2]?.className || "",
      stage3Text: cards[2]?.text || "",
      summary: getAssignedCompletionSummary(getActiveTechnicianMaintenanceSchedule()),
      screen: state.techScreen
    };
  });
  assert(afterFieldDevices.screen === "mimic", `Expected return to mimic after saves, got ${afterFieldDevices.screen}`);
  assert(afterFieldDevices.stage3Class.includes("active") || afterFieldDevices.stage3Class.includes("locked"), "Step 3 lost dependency-controlled state.");
  assert(!afterFieldDevices.stage3Class.includes("complete"), "Step 3 must not be complete before final restoration.");

  const tabSwitching = await measureStageTabSwitching(page);
  assert(tabSwitching.durationMs < 8000, `System tab switching is too slow: ${tabSwitching.durationMs}ms`);

  const stage3Ready = await markRemainingFireAlarmFieldDevicesComplete(page, fixture);
  assert(stage3Ready.fieldTotal > 0, "Fire Alarm field-device scope was empty.");
  assert(stage3Ready.stage3Class.includes("active"), `Step 3 did not become active after field scope completion: ${stage3Ready.stage3Text}`);
  assert(stage3Ready.routeStage === "completion", `Stage router did not select completion after field scope completion: ${JSON.stringify(stage3Ready)}`);
  assert(stage3Ready.routeDeviceId === fixture.tags.mfap, `Completion should route back to MFAP ${fixture.tags.mfap}, got ${stage3Ready.routeDeviceId}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction((scheduleId) => {
      const activeId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
      return !document.querySelector("#workspace")?.classList.contains("hidden")
        && document.querySelector("#workspace")?.classList.contains("technician-mode")
        && activeId === scheduleId
        && state.activeTechSystemKey === "fire-alarm"
        && document.querySelector("#workspace")?.classList.contains("tech-screen-inspection")
        && document.querySelector("#workspace")?.classList.contains("critical-sop-active")
        && document.querySelector("#criticalSopPanel h2")?.textContent.includes("G.MFAP.1")
        && document.querySelector("#techSystemStagePanel:not(.hidden)")
        && document.querySelector("#techSystemStagePanel .tech-stage-card.active")?.textContent.includes("Normal Status");
    }, fixture.scheduleId, { timeout: 15000 });
  } catch (error) {
    const debug = await page.evaluate(() => ({
      workspaceClass: document.querySelector("#workspace")?.className || "",
      loginHidden: document.querySelector("#loginView")?.classList.contains("hidden"),
      currentUser: state.currentUser || null,
      activeJob: state.activeJob || null,
      activeTechSystemKey: state.activeTechSystemKey,
      activeTechPreviewScheduleId: state.activeTechPreviewScheduleId,
      floorValue: document.querySelector("#floorSelect")?.value || "",
      stageHidden: document.querySelector("#techSystemStagePanel")?.classList.contains("hidden"),
      stageText: document.querySelector("#techSystemStagePanel")?.textContent.replace(/\s+/g, " ").trim() || "",
      markerCount: document.querySelectorAll(".marker.assigned-scope").length,
      syncState: document.querySelector("#syncState")?.textContent || "",
      localActiveJob: JSON.parse(localStorage.getItem("rmtActiveJob") || "null"),
      localContext: JSON.parse(localStorage.getItem("rmtTechActiveContext") || "null")
    }));
    throw new Error(`Refresh did not restore UOB hierarchy completion stage: ${JSON.stringify(debug, null, 2)}`);
  }

  const restored = await page.evaluate(({ passTag, failTag }) => {
    const findMarker = (tag) => [...document.querySelectorAll(".marker.assigned-scope")]
      .find((item) => item.dataset.setupTag === tag || item.dataset.deviceId === tag || item.dataset.label === tag);
    return {
      activeSystem: state.activeTechSystemKey,
      screen: state.techScreen,
      activeScheduleId: state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "",
      criticalHeading: document.querySelector("#criticalSopPanel h2")?.textContent || "",
      stageText: document.querySelector("#techSystemStagePanel")?.textContent.replace(/\s+/g, " ").trim() || "",
      passMarker: findMarker(passTag)?.className || "",
      failMarker: findMarker(failTag)?.className || ""
    };
  }, { passTag: fixture.tags.mcp, failTag: saveNextPhoto.openedDevice });

  assert(restored.activeScheduleId === fixture.scheduleId, "Refresh did not restore the active UOB hierarchy schedule.");
  assert(restored.activeSystem === "fire-alarm", "Refresh did not restore the Fire Alarm system tab.");
  assert(restored.screen === "inspection", "Refresh did not restore the completion inspection screen.");
  assert(restored.criticalHeading.includes(fixture.tags.mfap), "Refresh did not route Stage 3 completion to MFAP.");
  assert(restored.stageText.includes("Panel Check") && restored.stageText.includes("MCP / Smoke / Heat"), "Refresh did not restore the stage panel.");

  assert(!consoleErrors.length, `Console errors: ${consoleErrors.join(" | ")}`);
  const prerequisiteStageSummary = prerequisiteResult.stage ? {
    status: prerequisiteResult.stage.status,
    stageLabel: prerequisiteResult.stage.stageLabel,
    prerequisiteComplete: prerequisiteResult.stage.prerequisiteComplete,
    prerequisiteFailed: prerequisiteResult.stage.prerequisiteFailed,
    finalComplete: prerequisiteResult.stage.finalComplete,
    childrenComplete: prerequisiteResult.stage.childrenComplete,
    childCompleteCount: prerequisiteResult.stage.childCompleteCount,
    childTotal: prerequisiteResult.stage.childTotal,
    sopComplete: prerequisiteResult.stage.sopComplete
  } : null;
  console.log(JSON.stringify({
    scheduleId: fixture.scheduleId,
    tags: fixture.tags,
    lockedExplanation,
    beforePrerequisite: {
      stageTexts: beforePrerequisite.stageTexts,
      stageClasses: beforePrerequisite.stageClasses,
      markerStates: beforePrerequisite.markerStates,
      activeSystem: beforePrerequisite.activeSystem,
      activeScreen: beforePrerequisite.activeScreen
    },
    prerequisiteStage: prerequisiteStageSummary,
    serviceScopeMarkerRegression: {
      scheduleId: serviceScopeFixture.scheduleId,
      expectedMarkerIds: serviceScopeFixture.expectedMarkerIds,
      beforeCount: serviceScopeMarkerRegression.beforePrerequisite.count,
      beforeIds: serviceScopeMarkerRegression.beforePrerequisite.ids,
      beforeLockedIds: serviceScopeMarkerRegression.beforePrerequisite.lockedIds,
      afterCount: serviceScopeMarkerRegression.afterPrerequisite.count,
      afterIds: serviceScopeMarkerRegression.afterPrerequisite.ids,
      afterRefreshCount: serviceScopeMarkerRegression.afterRefresh.count,
      afterRefreshIds: serviceScopeMarkerRegression.afterRefresh.ids,
      unassignedProbe: serviceScopeFixture.tags.unassigned
    },
    afterFieldDevices,
    tabSwitching,
    restored,
    consoleErrors
  }, null, 2));

  await context.close();
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
