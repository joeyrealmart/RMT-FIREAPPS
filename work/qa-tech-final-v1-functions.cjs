const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260902-tech-final-v1";
const SCHEDULE_PATH = join(__dirname, "..", "outputs", "rmt-fire-local-data", "schedules", "service-schedules.json");
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loginAsTech(page) {
  await page.click("[data-demo-login='tech']");
  await page.fill("#loginPassword", new Date().toISOString());
  await page.click("#loginForm button[type='submit']");
  await page.waitForSelector("#workspace.technician-mode", { timeout: 15000 });
}

async function seedFinalV1Fixture(page) {
  return page.evaluate(() => {
    localStorage.removeItem("rmtActiveJob");
    localStorage.removeItem("tmFireInspections");
    localStorage.removeItem("rmtCriticalSops");
    localStorage.removeItem("tmFireRequests");
    const profile = { companyName: "QA FINAL V1", siteName: "QA FINAL V1" };
    const floor = {
      id: "qa-final-v1-l1",
      floorId: "qa-final-v1-l1",
      title: "QA Final V1 L1",
      floorCode: "L1",
      companyName: profile.companyName,
      siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src,
      cleanSrc: defaultFloorAssets.lv1.src,
      active: true
    };
    const makeDevice = (tag, type, x, y) => ({
      id: tag,
      tag,
      type,
      short: getShortCode({ type, tag }),
      companyName: profile.companyName,
      siteName: profile.siteName,
      floor: floor.title,
      floorId: floor.id,
      floorCode: floor.floorCode,
      floorTitle: floor.title,
      location: `${tag} QA location`,
      status: "Confirmed",
      xPercent: x,
      yPercent: y,
      questions: getChecklistQuestions(type)
    });
    const devices = [
      makeDevice("QA.FINAL.MFAP.1", "Main Fire Alarm Panel", 14, 16),
      makeDevice("QA.FINAL.MCP.1", "Manual Call Point", 24, 32),
      makeDevice("QA.FINAL.MCP.2", "Manual Call Point", 34, 36),
      makeDevice("QA.FINAL.SD.1", "Smoke Detector", 44, 42),
      makeDevice("QA.FINAL.SD.2", "Smoke Detector", 54, 46),
      makeDevice("QA.FINAL.HD.1", "Heat Detector", 64, 52),
      makeDevice("QA.FINAL.HD.2", "Heat Detector", 74, 58)
    ];
    const scheduleId = `QA-FINAL-V1-${Date.now()}`;
    const schedule = {
      scheduleId,
      status: "Scheduled",
      clientSource: "qa",
      companyName: profile.companyName,
      siteName: profile.siteName,
      floorId: floor.id,
      startFloorId: floor.id,
      floorTitle: floor.title,
      startFloorTitle: floor.title,
      date: new Date().toISOString().slice(0, 10),
      time: "09:00",
      technician: "Demo Technician",
      serviceType: "Maintenance / Inspection",
      scope: "yearly-100",
      scopeLabel: "QA Final V1",
      scopeSelectionMode: "selected-floor",
      priority: "Normal",
      contractFrequencyPercent: 100,
      plannedDeviceIds: devices.map((device) => device.tag),
      deviceCount: devices.length,
      activeCount: 1,
      passiveCount: 6,
      plannedFloorCounts: [{ floorId: floor.id, floorTitle: floor.title, count: devices.length }],
      linkedVerifications: [
        {
          linkedVerificationId: `${scheduleId}::PUMP`,
          verificationType: "FIRE_PUMP_INDICATION",
          title: "QA Pump Indication",
          reconciliationMode: "MATCHING_RESULTS",
          requiredSides: [
            { sideId: "PUMP_ROOM", sideName: "Pump Room", assignedTechnicianId: "tech@rmtfire.local", assignedTechnicianName: "Demo Technician" },
            { sideId: "MFAP", sideName: "MFAP", assignedTechnicianId: "tech2@rmtfire.local", assignedTechnicianName: "Tech 2" }
          ]
        },
        {
          linkedVerificationId: `${scheduleId}::CO2`,
          verificationType: "CO2_GAS_RELEASE_INDICATION",
          title: "QA CO2 Indication",
          reconciliationMode: "MATCHING_RESULTS",
          requiredSides: [
            { sideId: "SUPPRESSION_SYSTEM_LOCATION", sideName: "Suppression", assignedTechnicianId: "tech@rmtfire.local", assignedTechnicianName: "Demo Technician" },
            { sideId: "REMOTE_PANEL_OR_MFAP", sideName: "Remote Panel", assignedTechnicianId: "tech2@rmtfire.local", assignedTechnicianName: "Tech 2" }
          ]
        }
      ],
      notes: "QA only: technician final V1 functions"
    };
    state.siteProfile = profile;
    state.mimicFloors = [floor, ...state.mimicFloors.filter((item) => item.id !== floor.id)];
    state.setupDevices = [
      ...devices,
      ...state.setupDevices.filter((device) => !String(device.tag || "").startsWith("QA.FINAL."))
    ];
    state.schedules = [schedule];
    state.requests = [];
    state.inspections = {};
    state.criticalSops = {};
    state.activeJob = null;
    state.activeTechSystemKey = "";
    state.activeTechPreviewScheduleId = null;
    state.activeTechFloorId = "";
    browserDataState.fieldLoaded = true;
    browserDataState.loadedDeviceMasterProfiles.add(getProfileCacheKey(profile));
    writeStoredJson("rmtMimicFloors", state.mimicFloors);
    writeStoredJson("tmFireSetupDevices", state.setupDevices);
    writeStoredJson("rmtSchedules", state.schedules);
    writeStoredJson("tmFireRequests", state.requests);
    renderFloorOptions(floor.id, profile, { renderSchedule: false });
    renderTechWorkPanel();
    return {
      scheduleId: schedule.scheduleId,
      floorId: floor.id,
      plannedIds: schedule.plannedDeviceIds,
      mfap: "QA.FINAL.MFAP.1",
      firstField: "QA.FINAL.MCP.1"
    };
  });
}

async function openQaFireAlarm(page, fixture) {
  await page.click(`[data-tech-start-schedule="${fixture.scheduleId}"]`);
  await page.waitForFunction((scheduleId) => state.activeJob?.scheduleId === scheduleId, fixture.scheduleId, { timeout: 15000 });
  await page.click("#techActiveJobSummary [data-tech-system='fire-alarm']");
  await page.waitForFunction((mfap) => {
    const workspace = document.querySelector("#workspace");
    const sopPanel = document.querySelector("#criticalSopPanel");
    return Boolean(
      workspace?.classList.contains("tech-screen-inspection")
      && workspace.classList.contains("critical-sop-active")
      && sopPanel
      && getComputedStyle(sopPanel).display !== "none"
      && sopPanel.textContent.includes(mfap)
    );
  }, fixture.mfap, { timeout: 15000 });
}

async function openMimic(page) {
  const mimicButton = page.locator("#techViewMimicBtn");
  await mimicButton.waitFor({ state: "visible", timeout: 15000 });
  await mimicButton.click();
  await page.waitForSelector("#workspace.tech-screen-mimic", { timeout: 15000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#mapCanvas")?.getBoundingClientRect();
    return Boolean(canvas?.width && canvas.height && canvas.top < window.innerHeight && canvas.bottom > 0);
  }, null, { timeout: 15000 });
}

async function getEmptyRequestPinTapPoint(page) {
  return page.evaluate(() => {
    const layer = document.querySelector("#markersLayer");
    if (!layer) return { error: "markersLayer missing" };
    const rect = layer.getBoundingClientRect();
    const candidates = [
      [90, 82],
      [52, 86],
      [88, 52],
      [12, 88],
      [82, 28],
      [50, 24]
    ];
    const checked = [];
    for (const [xPercent, yPercent] of candidates) {
      const x = Math.round(rect.left + (rect.width * xPercent) / 100);
      const y = Math.round(rect.top + (rect.height * yPercent) / 100);
      const layerX = Math.round((rect.width * xPercent) / 100);
      const layerY = Math.round((rect.height * yPercent) / 100);
      const topElement = document.elementFromPoint(x, y);
      const item = {
        x,
        y,
        layerX,
        layerY,
        xPercent,
        yPercent,
        inViewport: x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight,
        topId: topElement?.id || "",
        topClass: String(topElement?.className || ""),
        pointerEvents: getComputedStyle(layer).pointerEvents
      };
      checked.push(item);
      if (item.inViewport && topElement === layer) return { ...item, checked };
    }
    return { error: "No empty visible marker-layer point found", rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, checked };
  });
}

async function completeQaSharedJob(page, fixture) {
  await page.evaluate(async ({ scheduleId, mfap }) => {
    const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
    await requestSharedJobState(schedule, { migrate: false, apply: true });
    for (const definition of schedule.linkedVerifications || []) {
      for (const side of definition.requiredSides || []) {
        const response = await fetch(`/api/jobs/${encodeURIComponent(scheduleId)}/linked-verification-sides`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schedule: getScheduleSnapshotForSharedApi(schedule),
            expectedRevision: 0,
            record: {
              linkedVerificationId: definition.linkedVerificationId,
              sideId: side.sideId,
              technicianId: side.assignedTechnicianId,
              technicianName: side.assignedTechnicianName,
              status: "COMPLETE",
              result: "CONFIRMED",
              submissionId: `${definition.linkedVerificationId}::${side.sideId}::qa-complete`,
              localCompletedAt: new Date().toISOString()
            }
          })
        });
        if (!response.ok) throw new Error(`Unable to seed linked verification ${definition.linkedVerificationId}/${side.sideId}`);
      }
    }
    await requestSharedJobState(schedule, { migrate: false, apply: true });
    const devices = getScheduledAssignedDevices(schedule);
    for (const device of devices.filter((item) => item.tag !== mfap)) {
      state.inspections[device.id] = {
        status: "pass",
        answers: (device.questions || []).map(() => "Pass"),
        notes: "QA completed",
        action: "",
        beforePhoto: "qa-pass-photo.jpg",
        afterPhoto: "",
        inspectedAt: new Date().toISOString(),
        inspectedBy: getCurrentUserName(),
        inspectedRole: getCurrentUserRole()
      };
      await saveSharedInspectionRecord(device, state.inspections[device.id], schedule);
    }
    const mfapDevice = devices.find((device) => device.tag === mfap);
    const templateId = getCriticalSopTemplateIdForDevice(mfapDevice);
    const template = getCriticalSopTemplate(templateId);
    const steps = {};
    template.steps.forEach((step, index) => {
      steps[index] = {
        title: step.title,
        confirmed: true,
        choice: step.choices?.[0] || step.options?.[0] || "Pass",
        reading: step.requiresReading ? (step.readingType === "number" ? "26.7" : "QA completed") : "",
        remark: "QA completed",
        photo: step.requiresPhoto ? "qa-step-photo.jpg" : "",
        photoEvidence: step.requiresPhoto ? { evidenceId: `qa-final-mfap-${index}`, originalDataUrl: "data:image/png;base64,AA==" } : null,
        supervisor: step.requiresSupervisor ? "QA Supervisor" : "",
        fieldValues: Object.fromEntries((step.fields || []).map((field) => [
          field.id,
          field.kind === "number" ? "1" : field.choices?.[0] || "QA value"
        ])),
        fieldRemarks: {}
      };
    });
    const record = {
      templateId,
      templateVersion: getCriticalSopTemplateVersion(template),
      templateSnapshot: createCriticalSopTemplateSnapshot(template),
      workflowId: `QA-FLOW-${scheduleId}`,
      dependencyDefinitionId: "fire-alarm",
      title: template.title,
      deviceTag: mfapDevice.tag,
      deviceType: mfapDevice.type,
      floor: mfapDevice.floor,
      location: mfapDevice.location,
      companyName: schedule.companyName,
      siteName: schedule.siteName,
      steps,
      beforePhoto: "qa-before.jpg",
      afterPhoto: "qa-after.jpg",
      filledBy: getCurrentUserName(),
      filledRole: getCurrentUserRole(),
      evidenceAt: new Date().toISOString(),
      generalRemarks: "QA final restoration complete",
      savedAt: new Date().toISOString(),
      savedBy: getCurrentUserName(),
      workflowStatus: "complete",
      prerequisiteComplete: true,
      finalRestorationComplete: true,
      linkedDeviceCount: 6,
      linkedDeviceCompleteCount: 6
    };
    const key = getCriticalSopStorageKey(templateId, mfapDevice.tag);
    state.criticalSops[key] = record;
    await saveSharedCriticalSopRecord(record, schedule);
    await requestSharedJobState(schedule, { migrate: false, apply: true });
    renderTechWorkPanel();
  }, fixture);
}

(async () => {
  const scheduleSnapshot = readFileSync(SCHEDULE_PATH, "utf8");
  const executablePath = EDGE_PATHS.find((item) => existsSync(item));
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.on("dialog", async (dialog) => dialog.accept());

  const tempPhoto = join(tmpdir(), `rmt-final-v1-photo-${Date.now()}.png`);
  writeFileSync(tempPhoto, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADggGOSHzRgAAAAABJRU5ErkJggg==", "base64"));

  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await loginAsTech(page);
    const fixture = await seedFinalV1Fixture(page);
    await openQaFireAlarm(page, fixture);

    await page.evaluate(() => setTechScreen("complete", { scroll: false }));
    await page.waitForSelector("#techCompletionPanel:not(.hidden)");
    const incompleteText = await page.textContent("#techCompletionPanel");
    assert(/still pending|locked|not ready/i.test(incompleteText), "Incomplete job did not show a blocked final submission state.");

    await openMimic(page);
    await page.click("#techSuggestMissingBtn");
    await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("request-pin-mode"), null, { timeout: 15000 });
    const point = await getEmptyRequestPinTapPoint(page);
    assert(!point.error, `Unable to locate a tappable empty mimic point: ${JSON.stringify(point)}`);
    await page.evaluate(() => {
      window.__requestPinEvents = [];
      const layer = document.querySelector("#markersLayer");
      ["pointerdown", "pointerup", "touchstart", "touchend", "click"].forEach((type) => {
        layer.addEventListener(type, (event) => {
          window.__requestPinEvents.push({
            type,
            targetId: event.target?.id || "",
            targetClass: String(event.target?.className || ""),
            requestPinMode: state.requestPinMode,
            pending: Boolean(state.pendingRequestPin)
          });
        }, { capture: true });
      });
    });
    await page.locator("#markersLayer").tap({ position: { x: point.layerX, y: point.layerY } });
    await page.waitForTimeout(500);
    const requestTapState = await page.evaluate(() => ({
      modalOpen: !document.querySelector("#requestModal")?.classList.contains("hidden"),
      requestPinMode: state.requestPinMode,
      pendingRequestPin: state.pendingRequestPin,
      events: window.__requestPinEvents || []
    }));
    assert(requestTapState.modalOpen, `Request modal did not open after mimic tap: ${JSON.stringify({ point, requestTapState })}`);
    await page.selectOption("#requestType", { label: "Smoke Detector" });
    await page.fill("#requestLocation", "QA missing detector beside lift lobby");
    await page.fill("#requestReason", "QA site-found device not shown on service-scope mimic");
    await page.click("#requestForm button[type='submit']");
    await page.waitForFunction(() => /needs at least one photo/i.test(document.querySelector("#syncState")?.textContent || ""), null, { timeout: 15000 });
    const noPhotoRequestCount = await page.evaluate(() => state.requests.length);
    assert(noPhotoRequestCount === 0, "Missing-device request was accepted without photo evidence.");

    await page.setInputFiles("#requestPhoto", tempPhoto);
    await page.click("#requestForm button[type='submit']");
    await page.waitForFunction(() => state.requests.length === 1 && state.requests[0].status === "PENDING_ADMIN_REVIEW", null, { timeout: 15000 });
    const missingRequestState = await page.evaluate((scheduleId) => {
      const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
      return {
        plannedCount: schedule.plannedDeviceIds.length,
        request: state.requests[0],
        pendingMarkers: document.querySelectorAll(".marker.request-marker.pending-review").length
      };
    }, fixture.scheduleId);
    assert(missingRequestState.plannedCount === 7, `Missing-device request changed planned scope to ${missingRequestState.plannedCount}.`);
    assert((missingRequestState.request.photoEvidence || []).length >= 1, "Missing-device request did not retain photo evidence.");

    await page.evaluate(() => {
      state.currentUser = { name: "Admin", role: "Admin", email: "admin@rmtfire.local", loggedInAt: new Date().toISOString() };
      applyRoleView();
      renderRequests();
    });
    const requestId = await page.evaluate(() => state.requests[0]?.id || "");
    assert(requestId, "Missing-device request ID was not available for Admin review.");
    await page.evaluate((id) => openRequestModal(id), requestId);
    await page.waitForSelector("#requestModal:not(.hidden)");
    await page.fill("#requestLocation", "QA adjusted detector beside lift lobby");
    await page.evaluate(() => document.querySelector("#requestForm").requestSubmit());
    await page.waitForFunction(() => /adjusted detector/i.test(state.requests[0]?.location || ""), null, { timeout: 15000 });
    await page.evaluate((id) => approveMissingDeviceRequest(id), requestId);
    await page.waitForFunction(() => state.requests[0]?.status === "APPROVED_TO_MASTER", null, { timeout: 15000 });
    const approvalState = await page.evaluate((scheduleId) => {
      const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
      return {
        plannedCount: schedule.plannedDeviceIds.length,
        approvedTag: state.requests[0].approvedTag,
        approvedDeviceExists: state.setupDevices.some((device) => device.tag === state.requests[0].approvedTag)
      };
    }, fixture.scheduleId);
    assert(approvalState.plannedCount === 7, "Admin approval changed the historical frozen planned scope.");
    assert(approvalState.approvedTag && approvalState.approvedDeviceExists, "Admin approval did not create a master device record.");
    const rejectionState = await page.evaluate(async ({ sourceId, scheduleId }) => {
      const source = state.requests.find((item) => item.id === sourceId);
      const rejectRequest = {
        ...source,
        id: `REQ-REJECT-${Date.now()}`,
        label: "QA reject request",
        status: "PENDING_ADMIN_REVIEW",
        approvedTag: "",
        approvedAt: "",
        approvedBy: "",
        rejectedAt: "",
        rejectedBy: "",
        revision: 0,
        reviewHistory: []
      };
      const saveResult = await saveMissingDeviceRequestRecord(rejectRequest);
      const saved = saveResult.request || rejectRequest;
      upsertMissingDeviceRequest(saved);
      await rejectMissingDeviceRequest(saved.id);
      const rejected = state.requests.find((item) => item.id === saved.id);
      const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
      return {
        status: rejected?.status || "",
        historyCount: rejected?.reviewHistory?.length || 0,
        plannedCount: schedule?.plannedDeviceIds?.length || 0
      };
    }, { sourceId: requestId, scheduleId: fixture.scheduleId });
    assert(rejectionState.status === "REJECTED", "Admin reject did not retain a rejected request history.");
    assert(rejectionState.historyCount >= 1, "Rejected request did not preserve review history.");
    assert(rejectionState.plannedCount === 7, "Admin rejection changed the historical frozen planned scope.");

    await page.evaluate(() => {
      state.currentUser = { name: "Demo Technician", role: "Technician", email: "tech@rmtfire.local", loggedInAt: new Date().toISOString() };
      applyRoleView();
      renderTechWorkPanel();
    });
    await completeQaSharedJob(page, fixture);
    await page.evaluate(() => setTechScreen("complete", { scroll: false }));
    await page.waitForSelector("#techCompleteJobBtn:not([disabled])", { timeout: 15000 });
    await page.fill("#techSignTechnician", "Demo Technician");
    await page.fill("#techSignSupervisor", "QA Witness");
    await page.fill("#techSignClient", "QA FINAL V1");
    await page.fill("#techSignRemarks", "QA final V1 completed.");
    await page.evaluate(() => {
      state.techSignOffSignatureData = "data:image/png;base64,iVBORw0KGgo=";
      document.querySelector("#techSignatureData").value = state.techSignOffSignatureData;
      document.querySelector("#techSignConfirm").checked = true;
    });
    await page.click("#techCompleteJobBtn");
    await page.waitForTimeout(1000);
    const submitProbe = await page.evaluate((scheduleId) => {
      const schedule = state.schedules.find((item) => item.scheduleId === scheduleId);
      const cache = getSharedJobCache(scheduleId);
      return {
        firstScheduleId: state.schedules[0]?.scheduleId || "",
        scheduleStatus: schedule?.status || "",
        reportSubmissionStatus: schedule?.reportSubmissionStatus || "",
        reportSubmission: schedule?.reportSubmission || null,
        syncState: document.querySelector("#syncState")?.textContent || "",
        buttonText: document.querySelector("#techCompleteJobBtn")?.textContent || "",
        buttonDisabled: Boolean(document.querySelector("#techCompleteJobBtn")?.disabled),
        sharedProgress: cache?.progress || null,
        sharedSignOff: cache?.store?.signOff || null
      };
    }, fixture.scheduleId);
    assert(submitProbe.reportSubmissionStatus === "AWAITING_ADMIN_REVIEW", `Schedule did not enter Awaiting Admin Review: ${JSON.stringify(submitProbe)}`);
    const submittedState = await page.evaluate(() => ({
      scheduleStatus: state.schedules[0].status,
      reportStatus: state.schedules[0].reportSubmissionStatus,
      readOnly: isTechnicianReportReadOnly(state.schedules[0]),
      submittedBy: state.schedules[0].reportSubmission?.submittedBy || ""
    }));
    assert(submittedState.scheduleStatus === "AWAITING_ADMIN_REVIEW", "Schedule did not enter Awaiting Admin Review.");
    assert(submittedState.readOnly, "Technician submitted job is not read-only.");
    assert(submittedState.submittedBy === "Demo Technician", "Report submission did not retain technician identity.");

    await page.evaluate(async (deviceId) => {
      await selectDevice(deviceId);
      await saveInspection("pass");
    }, fixture.firstField);
    const lockMessage = await page.textContent("#syncState");
    assert(/awaiting Admin Review/i.test(lockMessage), "Submitted job did not block technician edits.");

    await page.evaluate(async (scheduleId) => {
      state.currentUser = { name: "Admin", role: "Admin", email: "admin@rmtfire.local", loggedInAt: new Date().toISOString() };
      applyRoleView();
      await returnSubmittedReportForCorrection(scheduleId);
    }, fixture.scheduleId);
    await page.waitForFunction(() => state.schedules[0]?.reportSubmissionStatus === "RETURNED_FOR_CORRECTION", null, { timeout: 15000 });
    await page.evaluate(() => {
      state.currentUser = { name: "Demo Technician", role: "Technician", email: "tech@rmtfire.local", loggedInAt: new Date().toISOString() };
      applyRoleView();
    });
    const returnedEditable = await page.evaluate(() => !isTechnicianReportReadOnly(state.schedules[0]));
    assert(returnedEditable, "Returned job remained read-only for technician.");

    await page.evaluate(() => setTechScreen("complete", { scroll: false }));
    await page.waitForSelector("#techCompleteJobBtn:not([disabled])", { timeout: 15000 });
    await page.fill("#techSignTechnician", "Demo Technician");
    await page.fill("#techSignSupervisor", "QA Witness");
    await page.evaluate(() => {
      state.techSignOffSignatureData = "data:image/png;base64,iVBORw0KGgo=";
      document.querySelector("#techSignatureData").value = state.techSignOffSignatureData;
      document.querySelector("#techSignConfirm").checked = true;
    });
    await page.click("#techCompleteJobBtn");
    await page.waitForFunction(() => state.schedules[0]?.reportSubmissionStatus === "AWAITING_ADMIN_REVIEW", null, { timeout: 15000 });
    await page.evaluate(async (scheduleId) => {
      state.currentUser = { name: "Admin", role: "Admin", email: "admin@rmtfire.local", loggedInAt: new Date().toISOString() };
      applyRoleView();
      await approveSubmittedReport(scheduleId);
    }, fixture.scheduleId);
    await page.waitForFunction(() => state.schedules[0]?.status === "Completed" && state.schedules[0]?.reportSubmissionStatus === "APPROVED_BY_ADMIN", null, { timeout: 15000 });

    console.log("PASS qa-tech-final-v1-functions");
  } catch (error) {
    console.error("FAIL qa-tech-final-v1-functions");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
    writeFileSync(SCHEDULE_PATH, scheduleSnapshot, "utf8");
  }
})();
