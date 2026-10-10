const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LAB_ROOT = "C:/Users/Joey/Documents/Codex/2026-07-09/RMT-AGENT-LAB/results";
const RUN_ID = `offline-gstack-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const RUN_ROOT = path.join(LAB_ROOT, RUN_ID);
const DATA_ROOT = path.join(RUN_ROOT, "data");
const PROFILE_ROOT = path.join(RUN_ROOT, "browser-profile");
const SERVER_COPY = path.join(RUN_ROOT, "serve-isolated.mjs");
const RESULT_PATH = path.join(RUN_ROOT, "result.json");
const PORT = 8046;
const BASE = `http://127.0.0.1:${PORT}`;
const EDGE = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
].find(fs.existsSync);

function assert(value, message) {
  if (!value) throw new Error(message);
}

function jsonPath(value) {
  return JSON.stringify(path.resolve(value).replace(/\\/g, "/"));
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/diagnostics`);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Isolated verification server did not start.");
}

function prepareServerCopy() {
  fs.mkdirSync(RUN_ROOT, { recursive: true });
  const sourcePath = path.join(ROOT, "work", "serve-fire-inspection-mvp.mjs");
  let source = fs.readFileSync(sourcePath, "utf8");
  source = source
    .replace(/^const dataRoot = .*;$/m, `const dataRoot = ${jsonPath(DATA_ROOT)};`)
    .replace(/^const reportRoot = .*;$/m, `const reportRoot = ${jsonPath(path.join(RUN_ROOT, "reports"))};`)
    .replace(/^const port = .*;$/m, `const port = ${PORT};`)
    .replace(/^const host = .*;$/m, 'const host = "127.0.0.1";');
  fs.writeFileSync(SERVER_COPY, source);
}

async function clickAndWait(page, button, predicate, description) {
  await page.locator(button).click();
  await page.waitForFunction(predicate, undefined, { timeout: 10000 }).catch(async (error) => {
    const message = await page.locator("#message").textContent().catch(() => "");
    throw new Error(`${description}: ${message || error.message}`);
  });
}

async function openPoc(context, job, technician = "tech@rmtfire.local", device = "POC-DEVICE-A") {
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  await page.goto(`${BASE}/dev/offline-poc/index.html?enable=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#dbStatus")?.textContent === "Ready");
  await page.locator("#jobId").fill(job);
  await page.locator("#jobId").blur();
  await page.locator("#technician").selectOption(technician);
  await page.locator("#device").selectOption(device);
  await page.waitForFunction((expected) => document.querySelector("#currentJob")?.textContent === expected, job);
  return page;
}

async function setUiContext(page, job, technician, device) {
  await page.locator("#jobId").fill(job);
  await page.locator("#jobId").blur();
  await page.locator("#technician").selectOption(technician);
  await page.locator("#device").selectOption(device);
  await page.waitForFunction((expected) => document.querySelector("#currentJob")?.textContent === expected, job);
}

async function getServerState(job) {
  const response = await fetch(`${BASE}/api/jobs/${encodeURIComponent(job)}/state`);
  assert(response.ok, `Unable to read isolated server state for ${job}: ${response.status}`);
  return response.json();
}

async function readPocDb(page, job) {
  return page.evaluate(async (expectedJob) => {
    const db = window.RmtOfflineStore.createStore("rmt-fireapps-offline-v2-poc");
    await db.open();
    const [drafts, queue, evidence] = await Promise.all([
      db.inspections.where("jobId").equals(expectedJob).toArray(),
      db.syncQueue.where("jobId").equals(expectedJob).toArray(),
      db.evidenceMetadata.where("jobId").equals(expectedJob).toArray()
    ]);
    db.close();
    return { drafts, queue, evidence };
  }, job);
}

function evidenceFiles(job, device) {
  const folder = `${job}-${device}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const directory = path.join(DATA_ROOT, "shared-records", "inspection-evidence", folder);
  return {
    directory,
    files: fs.existsSync(directory) ? fs.readdirSync(directory).sort() : []
  };
}

function hashFiles(directory, files) {
  const crypto = require("node:crypto");
  return Object.fromEntries(files.map((name) => [
    name,
    crypto.createHash("sha256").update(fs.readFileSync(path.join(directory, name))).digest("hex")
  ]));
}

async function postInspection(job, expectedRevision, evidenceId, marker, logicalMutationId = "", captureTimestamp = new Date().toISOString()) {
  const dataUrl = `data:image/png;base64,${Buffer.from(marker).toString("base64")}`;
  const body = {
    ...(logicalMutationId ? { logicalMutationId } : {}),
    expectedRevision,
    schedule: {
      scheduleId: job,
      jobId: job,
      status: "POC_ONLY",
      plannedDeviceIds: ["POC-DEVICE-A"],
      deviceAssignments: {
        "POC-DEVICE-A": { technicianId: "tech@rmtfire.local", technicianName: "Tech A" }
      }
    },
    record: {
      recordId: `inspection::${job}::POC-DEVICE-A`,
      ...(logicalMutationId ? { logicalMutationId } : {}),
      deviceId: "POC-DEVICE-A",
      checklistItemId: "POC-DEVICE-A",
      technicianId: "tech@rmtfire.local",
      technicianName: "Tech A",
      status: "pass",
      result: "PASS",
      notes: marker,
      evidenceRefs: [{
        evidenceId,
        originalDataUrl: dataUrl,
        stampedDataUrl: dataUrl,
        captureTimestamp,
        originalImmutable: true
      }]
    }
  };
  const response = await fetch(`${BASE}/api/jobs/${encodeURIComponent(job)}/inspection-records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, payload: await response.json() };
}

(async () => {
  prepareServerCopy();
  const node = process.execPath;
  const serverLog = fs.openSync(path.join(RUN_ROOT, "server.log"), "a");
  const server = spawn(node, [SERVER_COPY], {
    cwd: ROOT,
    stdio: ["ignore", serverLog, serverLog],
    windowsHide: true
  });
  const results = { runId: RUN_ID, runRoot: RUN_ROOT, baseUrl: BASE, findings: {} };
  try {
    results.diagnostics = await waitForServer();

    // Finding 1: redeliver the exact mutation payload, then create a genuinely new technician action.
    const duplicateJob = `OFFLINE-POC-GSTACK-DUP-${Date.now()}`;
    const duplicateContext = await chromium.launchPersistentContext(path.join(RUN_ROOT, "duplicate-profile"), {
      headless: true,
      ...(EDGE ? { executablePath: EDGE } : {})
    });
    const duplicatePage = await openPoc(duplicateContext, duplicateJob);
    await clickAndWait(duplicatePage, "#saveDraft", () => document.querySelector("#draftCount")?.textContent === "1", "draft save did not finish");
    await clickAndWait(duplicatePage, "#queue", () => document.querySelector("#pendingCount")?.textContent === "1", "initial queue did not finish");
    await clickAndWait(duplicatePage, "#retry", () => document.querySelector("#syncedCount")?.textContent === "1" && document.querySelector("#pendingCount")?.textContent === "0", "initial sync did not finish");
    const duplicateState1 = await getServerState(duplicateJob);
    const duplicateDb1 = await readPocDb(duplicatePage, duplicateJob);
    const exactRetryResponse = await fetch(`${BASE}/api/jobs/${encodeURIComponent(duplicateJob)}/inspection-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(duplicateDb1.queue[0].payload)
    });
    const exactRetryPayload = await exactRetryResponse.json();
    assert(exactRetryResponse.ok && exactRetryPayload.idempotent && exactRetryPayload.alreadyProcessed, `Exact mutation retry was not idempotent: ${JSON.stringify(exactRetryPayload)}`);
    const collisionRequest = JSON.parse(JSON.stringify(duplicateDb1.queue[0].payload));
    collisionRequest.record.notes = "Different action reusing the same logical identity";
    const collisionResponse = await fetch(`${BASE}/api/jobs/${encodeURIComponent(duplicateJob)}/inspection-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collisionRequest)
    });
    const collisionPayload = await collisionResponse.json();
    assert(collisionResponse.status === 409 && collisionPayload.mutationCollision, `Logical identity collision was not rejected: ${JSON.stringify(collisionPayload)}`);
    await clickAndWait(duplicatePage, "#queue", () => document.querySelector("#message")?.textContent.includes("already queued"), "same mutation was not recognized locally");
    const duplicateState2 = await getServerState(duplicateJob);
    const duplicateDb2 = await readPocDb(duplicatePage, duplicateJob);
    await clickAndWait(duplicatePage, "#saveDraft", () => document.querySelector("#draftCount")?.textContent === "1" && document.querySelector("#message")?.textContent.includes("New logical action"), "new logical action was not created");
    const newDraft = (await readPocDb(duplicatePage, duplicateJob)).drafts[0];
    await clickAndWait(duplicatePage, "#queue", () => document.querySelector("#pendingCount")?.textContent === "1", "new action queue did not finish");
    await clickAndWait(duplicatePage, "#retry", () => document.querySelector("#pendingCount")?.textContent === "0" && document.querySelector("#syncedCount")?.textContent === "2", "new action sync did not finish");
    const newActionState = await getServerState(duplicateJob);
    const newActionDb = await readPocDb(duplicatePage, duplicateJob);
    await duplicateContext.close();
    const duplicateRecords1 = Object.values(duplicateState1.store.inspectionRecords || {});
    const duplicateRecords2 = Object.values(duplicateState2.store.inspectionRecords || {});
    const newActionRecords = Object.values(newActionState.store.inspectionRecords || {});
    results.findings.duplicateSync = {
      job: duplicateJob,
      sameLogicalAction: true,
      first: { logicalMutationId:duplicateDb1.queue[0]?.logicalMutationId, queueCount:duplicateDb1.queue.length, receiptCount:Object.keys(duplicateState1.store.mutationReceipts || {}).length, recordCount:duplicateRecords1.length, revision:duplicateRecords1[0]?.revision },
      retry: { status:exactRetryResponse.status, idempotent:exactRetryPayload.idempotent, alreadyProcessed:exactRetryPayload.alreadyProcessed, collisionStatus:collisionResponse.status, collisionRejected:collisionPayload.mutationCollision, queueCount:duplicateDb2.queue.length, syncedCount:duplicateDb2.queue.filter((item) => item.syncState === "SYNCED").length, receiptCount:Object.keys(duplicateState2.store.mutationReceipts || {}).length, recordCount:duplicateRecords2.length, revision:duplicateRecords2[0]?.revision },
      newAction: { logicalMutationId:newDraft.logicalMutationId, queueCount:newActionDb.queue.length, receiptCount:Object.keys(newActionState.store.mutationReceipts || {}).length, recordCount:newActionRecords.length, revision:newActionRecords[0]?.revision },
      passed: duplicateRecords1[0]?.revision === 1 && duplicateRecords2[0]?.revision === 1 && collisionResponse.status === 409 && collisionPayload.mutationCollision && duplicateDb2.queue.length === 1 && Object.keys(duplicateState2.store.mutationReceipts || {}).length === 1 && newActionRecords[0]?.revision === 2 && newActionDb.queue.length === 2 && newDraft.logicalMutationId !== duplicateDb1.queue[0]?.logicalMutationId
    };

    // Finding 2: close the entire persistent browser context, then launch a new process with the same profile.
    const restartJob = `OFFLINE-POC-GSTACK-RESTART-${Date.now()}`;
    let restartContext = await chromium.launchPersistentContext(PROFILE_ROOT, {
      headless: true,
      ...(EDGE ? { executablePath: EDGE } : {})
    });
    let restartPage = await openPoc(restartContext, restartJob);
    await clickAndWait(restartPage, "#saveDraft", () => document.querySelector("#draftCount")?.textContent === "1", "restart draft save did not finish");
    await clickAndWait(restartPage, "#queue", () => document.querySelector("#pendingCount")?.textContent === "1", "restart queue did not finish");
    const beforeRestart = await readPocDb(restartPage, restartJob);
    await restartContext.close();
    restartContext = await chromium.launchPersistentContext(PROFILE_ROOT, {
      headless: true,
      ...(EDGE ? { executablePath: EDGE } : {})
    });
    restartPage = await openPoc(restartContext, restartJob);
    await restartPage.waitForFunction(() => document.querySelector("#draftCount")?.textContent === "1" && document.querySelector("#pendingCount")?.textContent === "1");
    const afterRestart = await readPocDb(restartPage, restartJob);
    await clickAndWait(restartPage, "#retry", () => document.querySelector("#syncedCount")?.textContent === "1" && document.querySelector("#pendingCount")?.textContent === "0", "restart reconnect sync did not finish");
    const afterRestartSync = await readPocDb(restartPage, restartJob);
    await restartContext.close();
    results.findings.restartPersistence = {
      job: restartJob,
      beforeRestart: { drafts: beforeRestart.drafts.length, pending: beforeRestart.queue.filter((item) => item.syncState === "PENDING").length, evidence: beforeRestart.evidence.length },
      afterNewBrowserProcess: { drafts: afterRestart.drafts.length, pending: afterRestart.queue.filter((item) => item.syncState === "PENDING").length, evidence: afterRestart.evidence.length },
      afterReconnect: { synced: afterRestartSync.queue.filter((item) => item.syncState === "SYNCED").length, evidenceState: afterRestartSync.evidence[0]?.syncState },
      logicalMutationIdBefore: beforeRestart.drafts[0]?.logicalMutationId,
      logicalMutationIdAfter: afterRestart.drafts[0]?.logicalMutationId,
      passed: afterRestart.drafts.length === 1 && afterRestart.queue.some((item) => item.syncState === "PENDING") && afterRestart.evidence.length === 1 && afterRestartSync.queue.some((item) => item.syncState === "SYNCED") && beforeRestart.drafts[0]?.logicalMutationId === afterRestart.drafts[0]?.logicalMutationId
    };

    // Finding 3: retry A's immutable queued item while B/device B is the visible context.
    const ownershipJob = `OFFLINE-POC-GSTACK-OWNER-${Date.now()}`;
    const ownershipContext = await chromium.launchPersistentContext(path.join(RUN_ROOT, "ownership-profile"), {
      headless: true,
      ...(EDGE ? { executablePath: EDGE } : {})
    });
    const ownershipPage = await openPoc(ownershipContext, ownershipJob, "tech@rmtfire.local", "POC-DEVICE-A");
    await clickAndWait(ownershipPage, "#saveDraft", () => document.querySelector("#draftCount")?.textContent === "1", "A draft save did not finish");
    await clickAndWait(ownershipPage, "#queue", () => document.querySelector("#pendingCount")?.textContent === "1", "A queue did not finish");
    await setUiContext(ownershipPage, ownershipJob, "tech2@rmtfire.local", "POC-DEVICE-B");
    await clickAndWait(ownershipPage, "#saveDraft", () => document.querySelector("#draftCount")?.textContent === "2", "B draft save did not finish");
    await clickAndWait(ownershipPage, "#retry", () => document.querySelector("#pendingCount")?.textContent === "0" && document.querySelector("#syncedCount")?.textContent === "1", "A delayed retry did not finish");
    const ownershipDb = await readPocDb(ownershipPage, ownershipJob);
    const ownershipState = await getServerState(ownershipJob);
    await ownershipContext.close();
    const evidenceA = ownershipDb.evidence.find((item) => item.deviceId === "POC-DEVICE-A");
    const evidenceB = ownershipDb.evidence.find((item) => item.deviceId === "POC-DEVICE-B");
    const serverOwnerRecord = Object.values(ownershipState.store.inspectionRecords || {})[0];
    results.findings.evidenceOwnership = {
      job: ownershipJob,
      queuedOperation: ownershipDb.queue[0] && { technicianId: ownershipDb.queue[0].technicianId, entityId: ownershipDb.queue[0].entityId, syncState: ownershipDb.queue[0].syncState },
      evidenceA: evidenceA && { technicianId: evidenceA.technicianId, deviceId: evidenceA.deviceId, syncState: evidenceA.syncState, evidenceId: evidenceA.evidenceId },
      evidenceB: evidenceB && { technicianId: evidenceB.technicianId, deviceId: evidenceB.deviceId, syncState: evidenceB.syncState, evidenceId: evidenceB.evidenceId },
      serverRecord: serverOwnerRecord && { technicianId: serverOwnerRecord.technicianId, deviceId: serverOwnerRecord.deviceId, evidenceId: serverOwnerRecord.evidenceRefs?.[0]?.evidenceId, revision: serverOwnerRecord.revision },
      passed: evidenceA?.syncState === "SYNCED" && evidenceB?.syncState === "LOCAL" && serverOwnerRecord?.technicianId === "tech@rmtfire.local" && serverOwnerRecord?.deviceId === "POC-DEVICE-A"
    };

    // Finding 4: submit new evidence with a stale revision and inspect the isolated filesystem.
    const rejectedJob = `OFFLINE-POC-GSTACK-REJECT-${Date.now()}`;
    const acceptedMutationId = `mutation::${rejectedJob}::accepted`;
    const acceptedCaptureTimestamp = new Date().toISOString();
    const accepted = await postInspection(rejectedJob, 0, "EVIDENCE-ACCEPTED", "accepted-current-revision", acceptedMutationId, acceptedCaptureTimestamp);
    assert(accepted.status === 200 && accepted.payload.ok, `Accepted evidence seed failed: ${JSON.stringify(accepted)}`);
    const filesAfterAccepted = evidenceFiles(rejectedJob, "POC-DEVICE-A");
    const acceptedHashesBefore = hashFiles(filesAfterAccepted.directory, filesAfterAccepted.files);
    const acceptedRetry = await postInspection(rejectedJob, 0, "EVIDENCE-ACCEPTED", "accepted-current-revision", acceptedMutationId, acceptedCaptureTimestamp);
    assert(acceptedRetry.status === 200 && acceptedRetry.payload.idempotent && acceptedRetry.payload.alreadyProcessed, `Accepted binary retry was not idempotent: ${JSON.stringify(acceptedRetry)}`);
    const rejected = await postInspection(rejectedJob, 0, "EVIDENCE-REJECTED-STALE", "rejected-stale-revision", `mutation::${rejectedJob}::stale`);
    assert(rejected.status === 409 && rejected.payload.conflict, `Stale evidence request did not conflict: ${JSON.stringify(rejected)}`);
    const filesAfterRejected = evidenceFiles(rejectedJob, "POC-DEVICE-A");
    const acceptedHashesAfter = hashFiles(filesAfterRejected.directory, filesAfterAccepted.files);
    const rejectedState = await getServerState(rejectedJob);
    const authoritative = Object.values(rejectedState.store.inspectionRecords || {})[0];
    const newFiles = filesAfterRejected.files.filter((item) => !filesAfterAccepted.files.includes(item));
    results.findings.rejectedRevisionEvidence = {
      job: rejectedJob,
      acceptedStatus: accepted.status,
      acceptedRetryStatus: acceptedRetry.status,
      acceptedRetryIdempotent: acceptedRetry.payload.idempotent,
      rejectedStatus: rejected.status,
      conflict: rejected.payload.conflict,
      filesBeforeConflict: filesAfterAccepted.files,
      filesAfterConflict: filesAfterRejected.files,
      orphanCandidates: newFiles,
      acceptedHashesBefore,
      acceptedHashesAfter,
      acceptedFilesByteIdentical: JSON.stringify(acceptedHashesBefore) === JSON.stringify(acceptedHashesAfter),
      authoritativeRevision: authoritative?.revision,
      authoritativeEvidenceIds: (authoritative?.evidenceRefs || []).map((item) => item.evidenceId),
      rejectedEvidenceReferenced: (authoritative?.evidenceRefs || []).some((item) => item.evidenceId === "EVIDENCE-REJECTED-STALE"),
      passed: newFiles.length === 0 && JSON.stringify(acceptedHashesBefore) === JSON.stringify(acceptedHashesAfter) && !(authoritative?.evidenceRefs || []).some((item) => item.evidenceId === "EVIDENCE-REJECTED-STALE")
    };

    fs.writeFileSync(RESULT_PATH, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally {
    server.kill("SIGTERM");
    fs.closeSync(serverLog);
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
