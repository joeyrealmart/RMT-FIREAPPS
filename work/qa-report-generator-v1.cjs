const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260907-report-generator-v1";
const BASE_URL = APP_URL.replace(/\?.*$/, "").replace(/\/$/, "");
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (options.expect && response.status !== options.expect) throw new Error(`Expected ${options.expect}, got ${response.status}: ${text}`);
  if (!options.expect && response.status >= 400) throw new Error(`HTTP ${response.status}: ${text}`);
  return { status: response.status, payload };
}

async function testServerSnapshotApproval() {
  const scheduleId = `QA-REPORT-APPROVAL-${Date.now()}`;
  const schedule = {
    scheduleId,
    jobId: `JOB-${scheduleId}`,
    status: "Scheduled",
    companyName: "QA Report Client",
    siteName: "QA Report Site",
    date: new Date().toISOString().slice(0, 10),
    technician: "Demo Technician",
    serviceType: "Maintenance / Inspection",
    scope: "yearly-100",
    plannedDeviceIds: ["QA.REPORT.1"],
    deviceCount: 1,
    activeCount: 0,
    passiveCount: 1
  };
  await api(`/api/jobs/${encodeURIComponent(scheduleId)}/migrate`, { method: "POST", body: { schedule } });
  await api(`/api/jobs/${encodeURIComponent(scheduleId)}/inspection-records`, {
    method: "POST",
    body: {
      schedule,
      expectedRevision: 0,
      record: {
        scheduleId,
        jobId: schedule.jobId,
        deviceId: "QA.REPORT.1",
        checklistItemId: "QA.REPORT.1",
        technicianId: "tech@rmtfire.local",
        technicianName: "Demo Technician",
        status: "pass",
        inspectedAt: new Date().toISOString(),
        evidenceRefs: [{ type: "photo", name: "qa-pass.jpg" }]
      }
    }
  });
  await api(`/api/jobs/${encodeURIComponent(scheduleId)}/signoff`, {
    method: "POST",
    body: {
      schedule,
      expectedRevision: 0,
      signOff: {
        technicianName: "Demo Technician",
        supervisorName: "QA Client",
        signatureData: "data:image/png;base64,QA",
        signedBy: "Demo Technician"
      }
    }
  });
  await api(`/api/jobs/${encodeURIComponent(scheduleId)}/report-submission`, {
    method: "POST",
    body: {
      schedule,
      expectedRevision: 0,
      submission: {
        status: "AWAITING_ADMIN_REVIEW",
        submittedBy: "Demo Technician",
        submittedAt: new Date().toISOString(),
        clientAcknowledgement: { signatureCaptured: true }
      }
    }
  });
  const missingSnapshot = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/report-submission`, {
    method: "POST",
    expect: 409,
    body: { schedule, expectedRevision: 1, submission: { status: "APPROVED_BY_ADMIN", reviewedBy: "QA Admin" } }
  });
  assert(missingSnapshot.payload.blocked, "Admin approval must require a report snapshot.");
  const snapshot = {
    schemaVersion: "rmt-report-snapshot-v1",
    reportId: `REPORT-${scheduleId}`,
    scheduleId,
    snapshotStatus: "APPROVED_SNAPSHOT",
    header: { clientName: schedule.companyName, siteName: schedule.siteName },
    summary: { assignedCount: 1, passCount: 1, faultCount: 0 },
    dataIntegrity: { serverOnline: true, unsyncedCount: 0, unsyncedRecordIds: [] }
  };
  const approved = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/report-submission`, {
    method: "POST",
    body: {
      schedule,
      expectedRevision: 1,
      submission: { status: "APPROVED_BY_ADMIN", reviewedBy: "QA Admin", reportSnapshot: snapshot }
    }
  });
  assert(approved.payload.submission.reportSnapshot.reportId === snapshot.reportId, "Approved report snapshot was not persisted.");
  const stateAfter = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/state`);
  assert(stateAfter.payload.store.reportSubmission.reportSnapshot.summary.passCount === 1, "Approved snapshot changed after persistence.");
  return scheduleId;
}

async function seedReportFixture(page) {
  return page.evaluate(() => {
    const stamp = Date.now();
    const scheduleId = `QA-REPORT-DOM-${stamp}`;
    const floor = { id: "qa-report-l1", floorId: "qa-report-l1", title: "QA Level 1", floorCode: "L1", companyName: "QA Report Client", siteName: "QA Report Site", src: defaultFloorAssets.lv1.src, cleanSrc: defaultFloorAssets.lv1.src, active: true };
    const setupDevices = [
      { tag: "QA.MFAP.1", type: "Main Fire Alarm Panel", floor: floor.title, floorId: floor.id, floorCode: floor.floorCode, companyName: floor.companyName, siteName: floor.siteName, location: "Fire control room", xPercent: 15, yPercent: 20, status: "Confirmed" },
      { tag: "QA.SD.1", type: "Smoke Detector", floor: floor.title, floorId: floor.id, floorCode: floor.floorCode, companyName: floor.companyName, siteName: floor.siteName, location: "Lobby", xPercent: 40, yPercent: 45, status: "Confirmed" },
      { tag: "QA.MCP.1", type: "Manual Call Point", floor: floor.title, floorId: floor.id, floorCode: floor.floorCode, companyName: floor.companyName, siteName: floor.siteName, location: "Exit door", xPercent: 70, yPercent: 50, status: "Confirmed" }
    ];
    const linkedVerificationId = `${scheduleId}-LINKED`;
    const schedule = {
      scheduleId,
      jobId: `JOB-${scheduleId}`,
      status: "AWAITING_ADMIN_REVIEW",
      reportSubmissionStatus: "AWAITING_ADMIN_REVIEW",
      companyName: floor.companyName,
      siteName: floor.siteName,
      floorId: floor.id,
      floorTitle: floor.title,
      date: "2026-09-07",
      time: "09:00",
      technician: "Demo Technician",
      serviceType: "Monthly Maintenance",
      scope: "monthly-10",
      scopeFrozen: true,
      contractFrequencyPercent: 10,
      annualCycleId: "annual-2026",
      plannedDeviceIds: setupDevices.map((item) => item.tag),
      deviceCount: 3,
      activeCount: 1,
      passiveCount: 2,
      linkedVerifications: [{
        linkedVerificationId,
        verificationType: "FIRE_PUMP_INDICATION",
        title: "Fire Pump Indication",
        systemId: "fire-alarm",
        definitionVersion: "1",
        requiredSides: [
          { sideId: "PUMP_ROOM", sideName: "Pump Room", location: "Pump room", assignedTechnicianId: "tech@rmtfire.local", assignedTechnicianName: "Demo Technician" },
          { sideId: "MFAP", sideName: "MFAP", location: "Fire control room", assignedTechnicianId: "tech2@rmtfire.local", assignedTechnicianName: "Tech 2" }
        ]
      }],
      reportSubmission: {
        status: "AWAITING_ADMIN_REVIEW",
        revision: 1,
        submittedBy: "Demo Technician",
        submittedAt: "2026-09-07T10:00:00.000Z",
        clientAcknowledgement: { technicianName: "Demo Technician", witnessName: "QA Client", signatureCaptured: true, signedAt: "2026-09-07T10:00:00.000Z" }
      }
    };
    const records = {
      [`inspection::${scheduleId}::QA.SD.1`]: { recordId: `inspection::${scheduleId}::QA.SD.1`, scheduleId, deviceId: "QA.SD.1", status: "pass", technicianId: "tech@rmtfire.local", technicianName: "Demo Technician", inspectedAt: "2026-09-07T09:20:00.000Z", evidenceRefs: [{ type: "photo", name: "smoke-pass.jpg", photoUrl: "/evidence/smoke-pass.jpg" }], revision: 1 },
      [`inspection::${scheduleId}::QA.MCP.1`]: { recordId: `inspection::${scheduleId}::QA.MCP.1`, scheduleId, deviceId: "QA.MCP.1", status: "fail", technicianId: "tech2@rmtfire.local", technicianName: "Tech 2", inspectedAt: "2026-09-07T09:25:00.000Z", notes: "Glass cracked", action: "Replace glass and recheck", evidenceRefs: [{ type: "fault", name: "mcp-fault.jpg", photoUrl: "/evidence/mcp-fault.jpg" }], revision: 2 }
    };
    const criticalId = `critical-sop::${scheduleId}::fire-alarm-tripping-sop::QA.MFAP.1`;
    const critical = {
      [criticalId]: { recordId: criticalId, scheduleId, parentDeviceId: "QA.MFAP.1", deviceId: "QA.MFAP.1", templateId: "fire-alarm-tripping-sop", title: "MFAP System Check", deviceType: "Main Fire Alarm Panel", status: "pass", workflowStatus: "complete", finalRestorationComplete: true, technicianId: "tech@rmtfire.local", technicianName: "Demo Technician", updatedAt: "2026-09-07T09:10:00.000Z", beforePhoto: "mfap-before.jpg", afterPhoto: "mfap-after.jpg", definitionVersion: "approved-1", steps: { 0: { confirmed: true, title: "Approved configured panel check", choice: "Pass", reading: "Recorded" } } }
    };
    const sideAId = `linked-side::${scheduleId}::${linkedVerificationId}::PUMP_ROOM`;
    const sideBId = `linked-side::${scheduleId}::${linkedVerificationId}::MFAP`;
    const store = {
      schemaVersion: "shared-records-v1",
      scheduleId,
      scheduleSnapshot: schedule,
      inspectionRecords: records,
      criticalSopRecords: critical,
      systemCheckRecords: {},
      linkedVerificationDefinitions: { [linkedVerificationId]: schedule.linkedVerifications[0] },
      linkedVerificationSideRecords: {
        [sideAId]: { recordId: sideAId, scheduleId, linkedVerificationId, sideId: "PUMP_ROOM", status: "COMPLETE", result: "CONFIRMED", technicianName: "Demo Technician", timestamp: "2026-09-07T09:30:00.000Z", syncStatus: "SYNCED", evidenceRefs: [{ type: "photo", name: "pump.jpg" }] },
        [sideBId]: { recordId: sideBId, scheduleId, linkedVerificationId, sideId: "MFAP", status: "COMPLETE", result: "CONFIRMED", technicianName: "Tech 2", timestamp: "2026-09-07T09:31:00.000Z", syncStatus: "SYNCED", evidenceRefs: [{ type: "photo", name: "panel.jpg" }] }
      },
      linkedVerificationConflicts: {},
      extinguisherAssetSnapshot: {
        snapshotId: `${scheduleId}-EXT`, masterRevision: 3, assets: [{ assetId: "ext-1", serialNumber: "EXT-QA-001", agentType: "ABC", sizeKg: "9kg", floor: floor.title, location: "Lobby" }]
      },
      extinguisherVerificationRecords: {
        [`ext-verification::${scheduleId}::ext-1`]: { assetId: "ext-1", serialNumber: "EXT-QA-001", result: "VERIFIED", technicianName: "Demo Technician", timestamp: "2026-09-07T09:40:00.000Z", evidenceRefs: [{ type: "photo", name: "ext.jpg" }] }
      },
      extinguisherChangeProposals: {},
      signOff: { technicianName: "Demo Technician", supervisorName: "QA Client", signatureData: "data:image/png;base64,QA", signedAt: "2026-09-07T10:00:00.000Z" },
      reportSubmission: schedule.reportSubmission
    };
    state.currentUser = { name: "QA Admin", role: "Admin", email: "admin@rmtfire.local" };
    state.siteProfile = { companyName: schedule.companyName, siteName: schedule.siteName };
    state.mimicFloors = [floor];
    state.setupDevices = setupDevices;
    state.schedules = [schedule];
    state.editingScheduleId = scheduleId;
    state.activeReportScheduleId = scheduleId;
    state.requests = [
      { id: "REQ-MATCH", scheduleId, companyName: schedule.companyName, siteName: schedule.siteName, floor: floor.title, label: "Found detector", type: "Smoke Detector", location: "QA corridor", status: "PENDING_ADMIN_REVIEW", requestedBy: "Demo Technician", requestedAt: "2026-09-07T09:50:00.000Z", reason: "Not on approved mimic", photoEvidence: [{ type: "photo", name: "found.jpg" }] },
      { id: "REQ-WRONG-JOB", scheduleId: `${scheduleId}-OTHER`, companyName: schedule.companyName, siteName: schedule.siteName, floor: floor.title, label: "Wrong job", type: "Smoke Detector", location: "Other", status: "PENDING_ADMIN_REVIEW" },
      { id: "REQ-WRONG-CLIENT", scheduleId, companyName: "Other Client", siteName: schedule.siteName, floor: floor.title, label: "Wrong client", type: "Smoke Detector", location: "Other", status: "PENDING_ADMIN_REVIEW" },
      { id: "REQ-WRONG-SITE", scheduleId, companyName: schedule.companyName, siteName: "Other Site", floor: floor.title, label: "Wrong site", type: "Smoke Detector", location: "Other", status: "PENDING_ADMIN_REVIEW" },
      { id: "REQ-WRONG-FLOOR", scheduleId, companyName: schedule.companyName, siteName: schedule.siteName, floor: "Other Floor", label: "Wrong floor", type: "Smoke Detector", location: "Other", status: "PENDING_ADMIN_REVIEW" }
    ];
    state.inspections = { "QA.SD.1": inspectionRecordToLocal(records[`inspection::${scheduleId}::QA.SD.1`]), "QA.MCP.1": inspectionRecordToLocal(records[`inspection::${scheduleId}::QA.MCP.1`]) };
    state.criticalSops = {};
    state.linkedVerificationDrafts = {};
    state.extinguisherAssetDrafts = {};
    setSharedJobCache(scheduleId, { store, progress: { total: 3, done: 3, pass: 2, fail: 1, pending: 0, ready: true } }, { online: true });
    const started = performance.now();
    const snapshot = buildReportSnapshot(schedule, { forceLive: true });
    const builtAt = performance.now();
    renderReportSnapshot(snapshot);
    const renderedAt = performance.now();
    document.querySelector("#workspace").classList.add("hidden");
    document.querySelector("#reportView").classList.remove("hidden");
    return { scheduleId, snapshot, timings: { buildMs: builtAt - started, renderMs: renderedAt - builtAt } };
  });
}

async function runBrowserQa() {
  const executablePath = EDGE_PATHS.find(existsSync);
  const browser = await chromium.launch(executablePath ? { executablePath, headless: true } : { headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", "admin@rmtfire.local");
  await page.fill("#loginPassword", "qa-report-v1");
  await page.click("#loginForm button[type='submit']");
  await page.waitForSelector("#workspace.admin-mode", { timeout: 20000 });
  const fixture = await seedReportFixture(page);
  const snapshot = fixture.snapshot;
  assert(snapshot.schemaVersion === "rmt-report-snapshot-v1", "Structured report snapshot version is missing.");
  assert(snapshot.clientId && snapshot.siteId && snapshot.createdAt && snapshot.deviceResults.length === snapshot.devices.length, "Report snapshot top-level identity/record fields are incomplete.");
  assert(snapshot.summary.assignedCount === 3 && snapshot.summary.passCount === 2 && snapshot.summary.faultCount === 1, "Report totals do not match authoritative records.");
  assert(snapshot.criticalItems.length === 1 && snapshot.devices.length === 2, "Critical and normal device records were not separated.");
  assert(snapshot.faults[0].finding === "Glass cracked" && snapshot.faults[0].correctiveAction === "Replace glass and recheck", "Recorded fault/corrective details are missing.");
  assert(snapshot.devices.every((item) => item.technicianName && item.inspectedAt), "Technician identity/timestamp missing from detailed records.");
  assert(snapshot.devices.some((item) => item.evidenceRefs.some((ref) => ref.name === "smoke-pass.jpg")), "PASS evidence reference is missing.");
  assert(snapshot.extinguisher?.counts.expected === 1 && snapshot.extinguisher?.counts.verified === 1, "Extinguisher reconciliation is missing.");
  assert(snapshot.linkedVerifications[0]?.status === "VERIFIED" && snapshot.linkedVerifications[0]?.sides.length === 2, "Linked Verification integration is missing.");
  assert(snapshot.suggestedPins.length === 1 && snapshot.suggestedPins[0].requestId === "REQ-MATCH", "BUG-029: report included a suggestion outside the active job/site/floor context.");
  assert(snapshot.systems.every((system) => Number.isFinite(system.completed) && Number.isFinite(system.completionPercent)), "System completion totals are missing.");
  assert(Number.isFinite(snapshot.coverage.uniqueCoveragePercent), "Annual coverage values are missing.");
  assert(!JSON.stringify(snapshot).includes("data:image"), "Report snapshot must not duplicate evidence/signature blobs.");
  const archivePayload = await page.evaluate(() => buildInspectionRunPayload());
  assert(archivePayload.scheduleId === snapshot.scheduleId && archivePayload.requests.length === 1, "Saved report run must use the active snapshot and its filtered suggestions.");

  const dom = await page.evaluate(() => ({
    managementVisible: document.querySelector("#reportManagementPage").getBoundingClientRect().height > 0,
    detailsVisible: document.querySelector("#reportDetailsPage").getBoundingClientRect().height > 0,
    rows: document.querySelectorAll("#reportRows tr").length,
    faultRows: document.querySelectorAll("#reportRows .report-result.fault").length,
    criticalCards: document.querySelectorAll("#reportCriticalSystemDetails .critical-report-card").length,
    suggestedText: document.querySelector("#reportSetupList").innerText,
    linkedText: document.querySelector("#reportLinkedVerificationDetails").innerText,
    extinguisherText: document.querySelector("#reportExtinguisherDetails").innerText,
    width: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  assert(dom.managementVisible && dom.detailsVisible, "Report pages are not visibly rendered.");
  assert(dom.rows === 2 && dom.faultRows === 1 && dom.criticalCards === 1, "Detailed report DOM does not match report records.");
  assert(dom.suggestedText.includes("Found detector") && !dom.suggestedText.includes("Wrong job"), "BUG-029 failed in rendered report DOM.");
  assert(dom.linkedText.includes("VERIFIED") && dom.extinguisherText.includes("EXT-QA-001"), "Special workflow report sections are not rendered.");
  assert(dom.width <= dom.clientWidth + 2, `Desktop report overflow: ${dom.width} > ${dom.clientWidth}`);

  await page.emulateMedia({ media: "print" });
  const printStyle = await page.evaluate(() => ({
    pageBreak: getComputedStyle(document.querySelector("#reportManagementPage")).breakAfter,
    headerDisplay: getComputedStyle(document.querySelector("#reportView .report-header")).display
  }));
  assert(printStyle.headerDisplay === "none", "Print controls must be hidden.");
  assert(["page", "always"].includes(printStyle.pageBreak), "Page 1 does not have an A4 page break.");
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  assert(mobile.width <= mobile.clientWidth + 2, `Mobile report overflow: ${mobile.width} > ${mobile.clientWidth}`);

  const approvedStability = await page.evaluate((original) => {
    const schedule = state.schedules[0];
    schedule.reportSubmissionStatus = "APPROVED_BY_ADMIN";
    schedule.reportSubmission = { ...schedule.reportSubmission, status: "APPROVED_BY_ADMIN", reportSnapshot: original };
    state.sharedJobRecords[schedule.scheduleId].store.reportSubmission = schedule.reportSubmission;
    state.sharedJobRecords[schedule.scheduleId].store.inspectionRecords[`inspection::${schedule.scheduleId}::QA.MCP.1`].notes = "MUTATED AFTER APPROVAL";
    const frozen = buildReportSnapshot(schedule);
    return { finding: frozen.faults[0].finding, status: frozen.snapshotStatus };
  }, snapshot);
  assert(approvedStability.finding === "Glass cracked", "Approved snapshot changed when live records changed.");
  assert(approvedStability.status === "LIVE_PREVIEW" || approvedStability.status === "APPROVED_SNAPSHOT", "Approved snapshot was not reused.");
  assert(errors.length === 0, `Console/page errors: ${errors.join(" | ")}`);
  await browser.close();
  return { scheduleId: fixture.scheduleId, desktopRows: dom.rows, mobileWidth: mobile.width, timings: fixture.timings };
}

(async () => {
  try {
    const approvalScheduleId = await testServerSnapshotApproval();
    const browser = await runBrowserQa();
    console.log(JSON.stringify({ approvalScheduleId, ...browser }, null, 2));
    console.log("PASS qa-report-generator-v1");
  } catch (error) {
    console.error("FAIL qa-report-generator-v1");
    console.error(error);
    process.exit(1);
  }
})();
