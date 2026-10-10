const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { existsSync } = require("node:fs");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:8026";
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) { if (!condition) throw new Error(message); }

(async () => {
  const executablePath = EDGE_PATHS.find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext();
  const page = await context.newPage();
  const dbName = `rmt-offline-qa-${Date.now()}`;
  try {
    await page.goto(`${BASE_URL}/offline/rmt-offline-adapter-test.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.RmtOfflineStore?.createStore === "function");
    const result = await page.evaluate(async ({ dbName }) => {
      const api = window.RmtOfflineStore;
      const db = api.createStore(dbName);
      await db.open();
      const inspection = { id: "inspection::qa-job::qa-device", jobId: "qa-job", scheduleId: "qa-schedule", deviceId: "qa-device", technicianId: "tech@rmtfire.local", revision: 3, result: "PASS" };
      await api.putInspectionDraft(db, inspection);
      const operation = { operationId: "transport::qa::1", logicalMutationId: "mutation::qa::1", entityType: "inspection", entityId: inspection.id, jobId: "qa-job", technicianId: "tech@rmtfire.local", payload: inspection, revision: 3 };
      const first = await api.enqueueMutation(db, operation);
      const duplicate = await api.enqueueMutation(db, operation);
      const duplicateWithDifferentTransport = await api.enqueueMutation(db, { ...operation, id: "queue::transport::qa::retry", operationId: "transport::qa::retry" });
      const newAction = await api.enqueueMutation(db, { ...operation, id: "queue::transport::qa::2", operationId: "transport::qa::2", logicalMutationId: "mutation::qa::2" });
      const syncing = await api.markMutation(db, operation.operationId, "SYNCING");
      await api.markMutation(db, operation.operationId, "PENDING", { retryCount: 1, lastError: "offline" });
      await db.close();
      const reopened = api.createStore(dbName);
      await reopened.open();
      const persistedInspection = await reopened.inspections.get(inspection.id);
      const queue = await reopened.syncQueue.where("operationId").equals(operation.operationId).first();
      const reconciled = await api.markMutation(reopened, operation.operationId, "SYNCED");
      await reopened.delete();
      return { firstId: first.id, duplicate: duplicate.duplicate === true, duplicateLogicalMutation: duplicateWithDifferentTransport.duplicate === true, newActionId: newAction.id, syncing: syncing.syncState, persistedInspection, queue, reconciled, states: api.SYNC_STATES };
    }, { dbName });
    assert(result.duplicate, "Duplicate operation was queued instead of being idempotent.");
    assert(result.duplicateLogicalMutation, "Same logical mutation with a different transport ID was queued twice.");
    assert(result.newActionId === "queue::transport::qa::2", "Genuinely new logical action was incorrectly deduplicated.");
    assert(result.persistedInspection?.result === "PASS", "Inspection draft did not survive database reopen.");
    assert(result.queue?.syncState === "PENDING" && result.queue.retryCount === 1, "Queue sync state/retry metadata was not preserved.");
    assert(result.reconciled?.syncState === "SYNCED", "Queued mutation did not retain its idempotent identity through a reconnect transition.");
    assert(result.states.includes("FAILED") && result.states.includes("SYNCED"), "Required sync states are missing.");
    console.log(JSON.stringify({ ok: true, result }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
