const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260907-photo-timestamp-v1";
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
  const startedAt = performance.now();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (response.status >= 400) throw new Error(`HTTP ${response.status}: ${text}`);
  return { payload, durationMs: Math.round((performance.now() - startedAt) * 10) / 10 };
}

async function createEvidence(page, overrides = {}) {
  return page.evaluate(async (context) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const drawing = canvas.getContext("2d");
    drawing.fillStyle = "#e2e8f0";
    drawing.fillRect(0, 0, canvas.width, canvas.height);
    drawing.fillStyle = "#dc2626";
    drawing.fillRect(250, 100, 140, 230);
    drawing.fillStyle = "#111827";
    drawing.font = "24px Arial";
    drawing.fillText("QA DEVICE", 255, 215);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const file = new File([blob], "qa-evidence.png", { type: "image/png", lastModified: Date.now() });
    return createPhotoEvidenceFromFile(file, "qa-photo", context);
  }, overrides);
}

(async () => {
  const executablePath = EDGE_PATHS.find(existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof createPhotoEvidenceFromFile === "function");

  const captured = await createEvidence(page, {
    jobId: "JOB-QA-PHOTO",
    scheduleId: "QA-PHOTO-SCHEDULE",
    clientId: "QA-CLIENT",
    clientName: "QA Client",
    siteId: "QA-SITE",
    siteName: "QA Site",
    floorId: "QA-L1",
    floorLabel: "Level 1",
    deviceId: "QA.SD.14",
    locationLabel: "Corridor A",
    technicianId: "tech@rmtfire.local",
    technicianName: "Demo Technician",
    capturedAtUtc: "1999-01-01T00:00:00.000Z",
    gps: { permissionState: "denied" }
  });
  assert(captured.originalDataUrl.startsWith("data:image/png"), "Original evidence image was not preserved.");
  assert(captured.stampedDataUrl.startsWith("data:image/jpeg"), "Stamped display image was not generated.");
  assert(captured.originalDataUrl !== captured.stampedDataUrl, "Stamped image must be separate from the original.");
  assert(captured.originalEvidenceId !== captured.stampedEvidenceId, "Original/stamped evidence IDs must remain separate.");
  assert(captured.scheduleId === "QA-PHOTO-SCHEDULE" && captured.deviceId === "QA.SD.14", "Job/device context was not captured.");
  assert(captured.technicianId === "tech@rmtfire.local" && captured.technicianName === "Demo Technician", "Technician identity was not captured.");
  assert(captured.capturedAtUtc !== "1999-01-01T00:00:00.000Z", "Caller was able to rewrite the authoritative capture timestamp.");
  assert(/^[-+]\d{2}:\d{2}$/.test(captured.timezoneOffset), "Timezone offset was not recorded.");
  assert(captured.gps.permissionState === "denied" && captured.gps.latitude === undefined, "Denied GPS must not create fake coordinates.");
  assert(captured.stampFields.some((field) => field.value.includes("QA Client / QA Site")), "Client/site stamp context is missing.");
  assert(captured.processingTimingMs.total >= 0, "Photo processing timing was not recorded.");

  await context.setOffline(true);
  const offlineCaptured = await createEvidence(page, {
    scheduleId: "QA-OFFLINE",
    clientId: "QA",
    clientName: "QA",
    siteId: "OFFLINE",
    siteName: "Offline Site",
    floorId: "",
    floorLabel: "",
    deviceId: "QA.OFFLINE.1",
    locationLabel: "",
    technicianId: "tech2@rmtfire.local",
    technicianName: "Technician 2",
    gps: { permissionState: "denied" }
  });
  await context.setOffline(false);
  assert(offlineCaptured.syncState === "LOCAL", "Offline capture was not retained as local evidence.");
  assert(!offlineCaptured.stampFields.some((field) => /add location|unknown location/i.test(field.value)), "Missing location generated fake location text.");
  const offlineTimestamp = offlineCaptured.capturedAtUtc;

  const scheduleId = `QA-PHOTO-EVIDENCE-${Date.now()}`;
  const schedule = {
    scheduleId,
    jobId: `JOB-${scheduleId}`,
    status: "Scheduled",
    companyName: "QA Client",
    siteName: "QA Site",
    date: new Date().toISOString().slice(0, 10),
    technician: "Demo Technician",
    serviceType: "Maintenance / Inspection",
    scope: "yearly-100",
    plannedDeviceIds: ["QA.SD.14"],
    deviceCount: 1,
    activeCount: 0,
    passiveCount: 1
  };
  await api(`/api/jobs/${encodeURIComponent(scheduleId)}/migrate`, { method: "POST", body: { schedule } });
  const record = {
    recordId: `inspection::${scheduleId}::QA.SD.14`,
    scheduleId,
    jobId: schedule.jobId,
    deviceId: "QA.SD.14",
    checklistItemId: "QA.SD.14",
    technicianId: captured.technicianId,
    technicianName: captured.technicianName,
    status: "pass",
    inspectedAt: captured.capturedAtUtc,
    evidenceRefs: [{ ...captured, type: "before" }]
  };
  const firstSave = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/inspection-records`, {
    method: "POST",
    body: { schedule, expectedRevision: 0, record }
  });
  const savedEvidence = firstSave.payload.record.evidenceRefs[0];
  assert(savedEvidence.originalPhotoUrl && savedEvidence.stampedPhotoUrl, "Server did not persist original and stamped files separately.");
  assert(savedEvidence.photoUrl === savedEvidence.stampedPhotoUrl, "Stamped copy is not the preferred display reference.");
  assert(savedEvidence.syncState === "SYNCED" && savedEvidence.syncedAt, "Server sync metadata is missing.");
  assert(!savedEvidence.dataUrl && !savedEvidence.originalDataUrl && !savedEvidence.stampedDataUrl, "Shared record retained embedded image data.");

  const duplicateSave = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/inspection-records`, {
    method: "POST",
    body: { schedule, expectedRevision: 0, record }
  });
  assert(duplicateSave.payload.idempotent, "Reconnect duplicate was not handled idempotently.");
  assert(duplicateSave.payload.record.evidenceRefs.length === 1, "Reconnect duplicated the evidence record.");
  assert(duplicateSave.payload.record.evidenceRefs[0].capturedAtUtc === captured.capturedAtUtc, "Reconnect changed capture timestamp.");
  assert(offlineTimestamp === offlineCaptured.capturedAtUtc, "Offline evidence timestamp changed before sync.");

  const reportRef = await page.evaluate((photo) => getReportEvidenceRefs({ evidenceRefs: [photo] })[0], savedEvidence);
  assert(reportRef.photoUrl === savedEvidence.stampedPhotoUrl, "Report did not prefer stamped display evidence.");
  assert(reportRef.originalPhotoUrl === savedEvidence.originalPhotoUrl, "Report lost the original audit reference.");

  await page.click("[data-demo-login='tech']");
  await page.fill("#loginPassword", new Date().toISOString());
  await page.click("#loginForm button[type='submit']");
  await page.waitForSelector("#workspace.technician-mode", { timeout: 15000 });
  const uiRules = await page.evaluate(() => ({
    passOptional: document.querySelector(".photo-evidence-header span")?.textContent.includes("Optional for PASS"),
    faultRequired: document.querySelector(".photo-evidence-header span")?.textContent.includes("required for FAULT"),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  assert(uiRules.passOptional, "PASS photo behavior is no longer optional.");
  assert(uiRules.faultRequired, "FAULT photo requirement label changed.");
  assert(uiRules.overflow <= 1, `Mobile page has horizontal overflow (${uiRules.overflow}px).`);
  assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(" | ")}`);

  console.log(JSON.stringify({
    result: "PASS",
    evidenceId: captured.evidenceId,
    processingTimingMs: captured.processingTimingMs,
    sharedSaveMs: firstSave.durationMs,
    duplicateSaveMs: duplicateSave.durationMs,
    originalBytesApprox: Math.round(captured.originalDataUrl.length * 0.75),
    stampedBytesApprox: Math.round(captured.stampedDataUrl.length * 0.75),
    originalPhotoUrl: savedEvidence.originalPhotoUrl,
    stampedPhotoUrl: savedEvidence.stampedPhotoUrl
  }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
