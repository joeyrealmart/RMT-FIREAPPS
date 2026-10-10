(() => {
  const params = new URLSearchParams(location.search);
  window.RMT_OFFLINE_V2_POC = params.get("enable") === "1";
  const enabled = window.RMT_OFFLINE_V2_POC === true;
  const dbName = "rmt-fireapps-offline-v2-poc";
  const BACKLOG_WARNING_THRESHOLD = 20;
  const api = window.RmtOfflineStore;
  const elementIds = [
    "flagState", "jobId", "technician", "device", "dbStatus", "draftCount", "pendingCount",
    "syncedCount", "failedCount", "currentJob", "currentTechnician", "lastSync",
    "lastSuccessfulSync", "lastError", "evidence", "queueState", "message", "saveDraft",
    "loadDraft", "offline", "queue", "retry", "localComplete", "conflict", "clear",
    "syncBanner", "syncStateIcon", "syncStateTitle", "syncStateSummary", "syncStateProgress",
    "syncCompletionState", "syncElapsed", "syncRetry", "syncDetails", "statusDetailsPanel"
  ];
  const el = Object.fromEntries(elementIds.map((id) => [id, document.getElementById(id)]));

  let db;
  let simulatedOffline = false;
  let reconnecting = false;
  let syncStartedAt = 0;
  let syncProgress = null;
  let activeSyncController = null;
  let syncTimer = null;
  let allSyncedUntil = 0;
  let uiError = "None";
  let latestStatusModel = null;

  const context = () => ({
    jobId: el.jobId.value.trim() || "OFFLINE-POC-ANDROID-V1",
    scheduleId: el.jobId.value.trim() || "OFFLINE-POC-ANDROID-V1",
    technicianId: el.technician.value,
    deviceId: el.device.value
  });
  const scheduleSnapshot = () => ({
    scheduleId: context().scheduleId,
    jobId: context().jobId,
    status: "POC_ONLY",
    deviceAssignments: {
      "POC-DEVICE-A": { technicianId: "tech@rmtfire.local", technicianName: "Tech A" },
      "POC-DEVICE-B": { technicianId: "tech2@rmtfire.local", technicianName: "Tech B" }
    }
  });
  const setMessage = (value) => { el.message.textContent = value; };
  const now = () => new Date().toISOString();
  const networkAvailable = () => navigator.onLine && !simulatedOffline;
  const createLogicalMutationId = (ctx) => `mutation::${ctx.scheduleId}::${ctx.deviceId}::${ctx.technicianId}::${crypto.randomUUID()}`;
  const completionId = (jobId) => `poc-completion::${jobId}`;
  const syncMetaId = (jobId) => `poc-sync-meta::${jobId}`;
  const deletePocDatabase = () => new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Unable to clear POC database."));
    request.onblocked = () => reject(new Error("Close other POC tabs before clearing POC data."));
  });

  function assertPoc(value) {
    if (!String(value || "").startsWith("OFFLINE-POC-")) throw new Error("POC job IDs must start with OFFLINE-POC-.");
  }

  function draftId(ctx = context()) {
    return `inspection::${ctx.scheduleId}::${ctx.deviceId}::${ctx.technicianId}`;
  }

  function evidenceId(logicalMutationId) {
    return `evidence::${logicalMutationId}::original`;
  }

  function formatElapsed(milliseconds) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function formatTime(value) {
    if (!value) return "Never";
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(value));
  }

  async function ensureDb() {
    if (!enabled) throw new Error("POC disabled. Add ?enable=1 to this local developer URL.");
    if (!api) throw new Error("Dexie adapter is unavailable.");
    if (!db) {
      db = api.createStore(dbName);
      await db.open();
    }
    return db;
  }

  async function updateSyncMeta(jobId, updates) {
    const store = await ensureDb();
    const id = syncMetaId(jobId);
    const current = await store.jobs.get(id);
    await store.jobs.put({ id, jobId, type: "POC_SYNC_META", ...(current || {}), ...updates, updatedAt: now() });
  }

  async function recoverInterruptedSyncs() {
    const store = await ensureDb();
    const interrupted = await store.syncQueue.where("syncState").equals("SYNCING").toArray();
    for (const item of interrupted) {
      await api.markMutation(store, item.operationId, "PENDING", {
        retryCount: item.retryCount,
        lastError: "Sync interrupted before completion; safe to retry."
      });
    }
  }

  function buildStatusModel({ queue, evidence, completion, syncMeta }) {
    const pending = queue.filter((item) => ["PENDING", "SYNCING"].includes(item.syncState));
    const syncing = queue.filter((item) => item.syncState === "SYNCING");
    const failed = queue.filter((item) => item.syncState === "FAILED");
    const synced = queue.filter((item) => item.syncState === "SYNCED");
    const pendingEvidence = evidence.filter((item) => item.syncState !== "SYNCED");
    const conflicts = failed.filter((item) => /conflict/i.test(item.lastError || ""));
    const online = networkAvailable();
    let state = "SYNCED";
    if (!online) state = "OFFLINE";
    else if (reconnecting && (pending.length || failed.length || pendingEvidence.length)) state = "RECONNECTING";
    else if (syncStartedAt || syncing.length) state = "SYNCING";
    else if (failed.length || pending.length || pendingEvidence.length) state = "INCOMPLETE";
    const unresolvedCount = pending.length + failed.length;
    return {
      state,
      online,
      pendingRecords: pending.length,
      pendingPhotos: pendingEvidence.length,
      syncedRecords: synced.length,
      failedRecords: failed.length,
      conflictRecords: conflicts.length,
      unresolvedCount,
      backlogWarning: unresolvedCount + pendingEvidence.length >= BACKLOG_WARNING_THRESHOLD,
      localComplete: completion?.localComplete === true,
      locallyCompletedAt: completion?.locallyCompletedAt || "",
      lastSyncAttemptAt: syncMeta?.lastSyncAttemptAt || "",
      lastSuccessfulSyncAt: syncMeta?.lastSuccessfulSyncAt || "",
      lastUploadedRecords: Number(syncMeta?.lastUploadedRecords || 0),
      lastUploadedEvidence: Number(syncMeta?.lastUploadedEvidence || 0),
      error: failed.at(-1)?.lastError || pending.find((item) => item.lastError)?.lastError || uiError
    };
  }

  function renderSyncStatus(model) {
    latestStatusModel = model;
    el.syncBanner.className = `sync-banner sync-${model.state.toLowerCase()}`;
    el.syncBanner.dataset.state = model.state;
    el.syncElapsed.hidden = model.state !== "SYNCING" && model.state !== "RECONNECTING";
    el.syncElapsed.textContent = syncStartedAt ? formatElapsed(Date.now() - syncStartedAt) : "00:00";
    el.syncRetry.hidden = !(model.state === "INCOMPLETE" && model.online);
    el.syncStateProgress.hidden = true;
    el.syncStateProgress.textContent = "";

    if (model.state === "OFFLINE") {
      el.syncStateIcon.textContent = "!";
      el.syncStateTitle.textContent = model.pendingRecords || model.pendingPhotos ? "OFFLINE — SAVING TO PHONE" : "OFFLINE — SAVED ON PHONE";
      el.syncStateSummary.textContent = `${model.pendingRecords} records pending • ${model.pendingPhotos} photos pending`;
    } else if (model.state === "RECONNECTING") {
      el.syncStateIcon.textContent = "↻";
      el.syncStateTitle.textContent = "CONNECTION RESTORED — SYNCING";
      el.syncStateSummary.textContent = `${model.pendingRecords + model.failedRecords} records • ${model.pendingPhotos} photos waiting`;
    } else if (model.state === "SYNCING") {
      el.syncStateIcon.textContent = "↻";
      el.syncStateTitle.textContent = "SYNCING";
      el.syncStateSummary.textContent = `${model.pendingRecords} items remaining • ${model.pendingPhotos} photos pending`;
      if (syncProgress) {
        const photoLabel = syncProgress.currentEvidence === 1 ? "1 photo" : `${syncProgress.currentEvidence} photos`;
        el.syncStateProgress.hidden = false;
        el.syncStateProgress.textContent = `Uploading record ${syncProgress.current} of ${syncProgress.total} • ${photoLabel} attached`;
      }
    } else if (model.state === "INCOMPLETE") {
      el.syncStateIcon.textContent = "!";
      el.syncStateTitle.textContent = "SYNC INCOMPLETE";
      el.syncStateSummary.textContent = `${model.pendingRecords + model.failedRecords} records pending • ${model.pendingPhotos} photos pending${model.conflictRecords ? ` • ${model.conflictRecords} conflict` : ""}`;
    } else {
      const announceAllSynced = Date.now() < allSyncedUntil && model.lastSuccessfulSyncAt;
      el.syncStateIcon.textContent = "✓";
      el.syncStateTitle.textContent = announceAllSynced ? "ALL SYNCED" : "SYNCED";
      el.syncStateSummary.textContent = announceAllSynced
        ? `${model.lastUploadedRecords} records + ${model.lastUploadedEvidence} photos uploaded • Completed ${formatTime(model.lastSuccessfulSyncAt)}`
        : model.lastSuccessfulSyncAt ? `Last successful sync ${formatTime(model.lastSuccessfulSyncAt)}` : "No work waiting to sync";
    }

    if (model.backlogWarning) el.syncStateSummary.textContent += " • MANY ITEMS WAITING TO SYNC — keep RMT open when connection returns";
    el.syncCompletionState.textContent = model.localComplete
      ? (model.unresolvedCount || model.pendingPhotos ? "LOCAL COMPLETE — SYNC PENDING" : "SUBMITTED — ALL SYNCED")
      : "Inspection still in progress";
    el.lastSync.textContent = formatTime(model.lastSyncAttemptAt);
    el.lastSuccessfulSync.textContent = formatTime(model.lastSuccessfulSyncAt);
    el.lastError.textContent = model.error || "None";
    window.__rmtOfflinePocStatus = { ...model, elapsed: el.syncElapsed.textContent };
    window.__rmtOfflinePocStateHistory ||= [];
    if (window.__rmtOfflinePocStateHistory.at(-1)?.state !== model.state) {
      window.__rmtOfflinePocStateHistory.push({ state: model.state, at: now() });
      window.__rmtOfflinePocStateHistory = window.__rmtOfflinePocStateHistory.slice(-50);
    }
  }

  function startElapsedTimer() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(() => {
      if (!syncStartedAt) return;
      el.syncElapsed.textContent = formatElapsed(Date.now() - syncStartedAt);
      if (window.__rmtOfflinePocStatus) window.__rmtOfflinePocStatus.elapsed = el.syncElapsed.textContent;
    }, 250);
  }

  function stopElapsedTimer() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
  }

  async function refresh() {
    if (!enabled) {
      el.flagState.textContent = "RMT_OFFLINE_V2_POC = false. Enable only for this browser with ?enable=1.";
      el.dbStatus.textContent = "Disabled";
      return;
    }
    await ensureDb();
    const ctx = context();
    const [drafts, queue, evidence, completion, syncMeta] = await Promise.all([
      db.inspections.where("jobId").equals(ctx.jobId).toArray(),
      db.syncQueue.where("jobId").equals(ctx.jobId).toArray(),
      db.evidenceMetadata.where("jobId").equals(ctx.jobId).toArray(),
      db.jobs.get(completionId(ctx.jobId)),
      db.jobs.get(syncMetaId(ctx.jobId))
    ]);
    const model = buildStatusModel({ queue, evidence, completion, syncMeta });
    el.flagState.textContent = "RMT_OFFLINE_V2_POC = true for this test browser only.";
    el.dbStatus.textContent = "Ready";
    el.draftCount.textContent = drafts.length;
    el.pendingCount.textContent = model.pendingRecords;
    el.syncedCount.textContent = model.syncedRecords;
    el.failedCount.textContent = model.failedRecords;
    el.currentJob.textContent = ctx.jobId;
    el.currentTechnician.textContent = ctx.technicianId;
    el.evidence.textContent = evidence.length ? JSON.stringify(evidence, null, 2) : "No POC evidence metadata";
    el.queueState.textContent = queue.length ? JSON.stringify(queue, null, 2) : "No POC queue items";
    el.localComplete.textContent = model.localComplete ? "Reopen Local Inspection" : "Mark Inspection Locally Complete";
    renderSyncStatus(model);
  }

  async function saveDraft() {
    const store = await ensureDb();
    const ctx = context();
    assertPoc(ctx.jobId);
    const id = draftId(ctx);
    const current = await store.inspections.get(id);
    const logicalMutationId = createLogicalMutationId(ctx);
    const evidenceKey = evidenceId(logicalMutationId);
    const evidence = {
      id: evidenceKey, evidenceId: evidenceKey, logicalMutationId, jobId: ctx.jobId,
      deviceId: ctx.deviceId, inspectionId: id, technicianId: ctx.technicianId,
      originalReference: `poc-original://${ctx.jobId}/${ctx.deviceId}.jpg`, originalImmutable: true,
      derivedReference: null, captureTimestamp: now(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Singapore",
      syncState: "LOCAL", updatedAt: now()
    };
    await store.evidenceMetadata.put(evidence);
    const draft = await api.putInspectionDraft(store, {
      id, logicalMutationId, jobId: ctx.jobId, scheduleId: ctx.scheduleId, deviceId: ctx.deviceId,
      technicianId: ctx.technicianId, technicianName: ctx.technicianId.startsWith("tech2") ? "Tech B" : "Tech A",
      revision: Number(current?.serverRevision || 0), serverRevision: Number(current?.serverRevision || 0),
      status: "pass", result: "PASS", notes: "Offline POC draft", evidenceRefs: [evidence],
      syncState: "LOCAL", updatedAt: now()
    });
    setMessage(`New logical action saved locally: ${draft.logicalMutationId}`);
    await refresh();
  }

  async function queueSave() {
    const store = await ensureDb();
    const ctx = context();
    assertPoc(ctx.jobId);
    const draft = await store.inspections.get(draftId(ctx));
    if (!draft?.logicalMutationId) throw new Error("Save a new test action before queueing it.");
    const operationId = `transport::${draft.logicalMutationId}`;
    const mutation = await api.enqueueMutation(store, {
      operationId, logicalMutationId: draft.logicalMutationId, entityType: "inspection", entityId: draft.id,
      jobId: ctx.jobId, technicianId: ctx.technicianId, operation: "UPSERT",
      revision: Number(draft.serverRevision || 0),
      payload: {
        logicalMutationId: draft.logicalMutationId,
        expectedRevision: Number(draft.serverRevision || 0),
        schedule: scheduleSnapshot(),
        record: {
          recordId: `inspection::${ctx.scheduleId}::${ctx.deviceId}`, logicalMutationId: draft.logicalMutationId,
          deviceId: ctx.deviceId, checklistItemId: ctx.deviceId, technicianId: ctx.technicianId,
          technicianName: draft.technicianName, status: "pass", result: "PASS",
          notes: "Offline POC draft", evidenceRefs: draft.evidenceRefs
        }
      }
    });
    await api.putInspectionDraft(store, { ...draft, syncState: mutation.syncState, updatedAt: now() });
    setMessage(mutation.duplicate ? `Logical mutation already queued (${mutation.syncState}); no duplicate created.` : "Save queued as PENDING.");
    await refresh();
  }

  async function syncOne(item, current, total) {
    const store = await ensureDb();
    const draft = await store.inspections.get(item.entityId);
    const draftMatchesMutation = draft?.logicalMutationId === item.logicalMutationId;
    if (!networkAvailable()) {
      await api.markMutation(store, item.operationId, "PENDING", { retryCount: item.retryCount + 1, lastError: "Offline — saved on phone" });
      if (draftMatchesMutation) await api.putInspectionDraft(store, { ...draft, syncState: "PENDING", updatedAt: now() });
      return;
    }
    syncProgress = { current, total, currentEvidence: (item.payload?.record?.evidenceRefs || []).length };
    await api.markMutation(store, item.operationId, "SYNCING", { retryCount: item.retryCount, lastError: "" });
    reconnecting = false;
    await refresh();
    const controller = new AbortController();
    activeSyncController = controller;
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(item.jobId)}/inspection-records`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload), signal: controller.signal
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        const detail = payload.conflict ? `CONFLICT: server revision ${payload.currentRevision}` : payload.error || `Server rejected save (${response.status})`;
        await api.markMutation(store, item.operationId, "FAILED", { retryCount: item.retryCount + 1, lastError: detail });
        if (draftMatchesMutation) await api.putInspectionDraft(store, { ...draft, syncState: "FAILED", conflict: payload.conflict === true, serverConflict: payload.current || null, updatedAt: now() });
        uiError = detail;
        return;
      }
      await api.markMutation(store, item.operationId, "SYNCED");
      if (draftMatchesMutation) await api.putInspectionDraft(store, { ...draft, serverRevision: Number(payload.record.revision || 0), revision: Number(payload.record.revision || 0), syncState: "SYNCED", updatedAt: now() });
      const evidenceIds = (item.payload?.record?.evidenceRefs || []).map((evidence) => evidence.evidenceId).filter(Boolean);
      for (const queuedEvidenceId of evidenceIds) {
        const evidence = await store.evidenceMetadata.get(queuedEvidenceId);
        if (evidence?.logicalMutationId === item.logicalMutationId) await store.evidenceMetadata.put({ ...evidence, syncState: "SYNCED", syncedAt: now(), updatedAt: now() });
      }
      uiError = "None";
    } catch (error) {
      const detail = error.name === "AbortError" ? "Connection lost during synchronization" : error.message;
      await api.markMutation(store, item.operationId, "PENDING", { retryCount: item.retryCount + 1, lastError: detail });
      if (draftMatchesMutation) await api.putInspectionDraft(store, { ...draft, syncState: "PENDING", updatedAt: now() });
      uiError = detail;
    } finally {
      if (activeSyncController === controller) activeSyncController = null;
    }
  }

  async function retrySync({ fromReconnect = false } = {}) {
    if (syncStartedAt) return;
    const store = await ensureDb();
    const ctx = context();
    const items = (await store.syncQueue.where("jobId").equals(ctx.jobId).toArray()).filter((item) => ["PENDING", "FAILED"].includes(item.syncState));
    if (!items.length) {
      reconnecting = false;
      setMessage("No pending records require synchronization.");
      await refresh();
      return;
    }
    if (!networkAvailable()) {
      reconnecting = false;
      setMessage("Offline — pending work remains saved on this phone.");
      await refresh();
      return;
    }
    syncStartedAt = Date.now();
    startElapsedTimer();
    const evidenceTotal = items.reduce((sum, item) => sum + (item.payload?.record?.evidenceRefs || []).length, 0);
    await updateSyncMeta(ctx.jobId, { lastSyncAttemptAt: now() });
    if (fromReconnect) reconnecting = true;
    await refresh();
    for (let index = 0; index < items.length; index += 1) {
      if (!networkAvailable()) break;
      await syncOne(items[index], index + 1, items.length);
      await refresh();
    }
    syncStartedAt = 0;
    syncProgress = null;
    reconnecting = false;
    stopElapsedTimer();
    const [remainingQueue, remainingEvidence] = await Promise.all([
      store.syncQueue.where("jobId").equals(ctx.jobId).toArray(),
      store.evidenceMetadata.where("jobId").equals(ctx.jobId).toArray()
    ]);
    const unresolvedQueue = remainingQueue.filter((item) => item.syncState !== "SYNCED");
    const unresolvedEvidence = remainingEvidence.filter((item) => item.syncState !== "SYNCED");
    if (!unresolvedQueue.length && !unresolvedEvidence.length) {
      const completedAt = now();
      await updateSyncMeta(ctx.jobId, { lastSuccessfulSyncAt: completedAt, lastUploadedRecords: items.length, lastUploadedEvidence: evidenceTotal });
      allSyncedUntil = Date.now() + 6000;
      setTimeout(() => refresh().catch(() => {}), 6100);
      setMessage("All queued records and evidence metadata reached authoritative server state.");
    } else if (!networkAvailable()) {
      setMessage("Connection dropped. Pending work remains saved on this phone.");
    } else {
      setMessage("Synchronization incomplete. Review the error and retry without discarding local work.");
    }
    await refresh();
  }

  async function simulateConflict() {
    const ctx = context();
    assertPoc(ctx.jobId);
    const response = await fetch(`/api/jobs/${encodeURIComponent(ctx.jobId)}/inspection-records`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedRevision: 0, schedule: scheduleSnapshot(),
        record: {
          recordId: `inspection::${ctx.scheduleId}::${ctx.deviceId}`, deviceId: ctx.deviceId,
          checklistItemId: ctx.deviceId, technicianId: ctx.technicianId,
          technicianName: "POC conflict writer", status: "fail", result: "FAULT", notes: "POC conflict seed"
        }
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Conflict seed rejected. Use a fresh POC job ID.");
    setMessage("Server revision advanced. Retrying the stale local queue will show a visible conflict without discarding local data.");
  }

  async function toggleLocalComplete() {
    const store = await ensureDb();
    const ctx = context();
    assertPoc(ctx.jobId);
    const id = completionId(ctx.jobId);
    const current = await store.jobs.get(id);
    const localComplete = current?.localComplete !== true;
    await store.jobs.put({ id, jobId: ctx.jobId, scheduleId: ctx.scheduleId, type: "POC_LOCAL_COMPLETION", localComplete, locallyCompletedAt: localComplete ? now() : "", updatedAt: now() });
    setMessage(localComplete ? "Inspection work marked complete locally. Submission is not server-safe until all pending records and photos sync." : "Local inspection reopened for POC testing.");
    await refresh();
  }

  async function setOfflineSimulation(nextOffline) {
    simulatedOffline = nextOffline;
    el.offline.textContent = `Simulate Offline: ${simulatedOffline ? "On" : "Off"}`;
    if (simulatedOffline) {
      reconnecting = false;
      activeSyncController?.abort();
      setMessage("Network unavailable. New work remains on this phone until synchronization succeeds.");
      await refresh();
      return;
    }
    reconnecting = true;
    setMessage("Connection restored. Pending work is being synchronized.");
    await refresh();
    await retrySync({ fromReconnect: true });
  }

  function handleError(error) {
    uiError = error.message;
    setMessage(error.message);
    refresh().catch(() => {});
  }

  el.saveDraft.addEventListener("click", () => saveDraft().catch(handleError));
  el.loadDraft.addEventListener("click", () => refresh().catch(handleError));
  el.queue.addEventListener("click", () => queueSave().catch(handleError));
  el.retry.addEventListener("click", () => retrySync().catch(handleError));
  el.syncRetry.addEventListener("click", () => retrySync().catch(handleError));
  el.localComplete.addEventListener("click", () => toggleLocalComplete().catch(handleError));
  el.conflict.addEventListener("click", () => simulateConflict().catch(handleError));
  el.offline.addEventListener("click", () => setOfflineSimulation(!simulatedOffline).catch(handleError));
  el.syncDetails.addEventListener("click", () => el.statusDetailsPanel.scrollIntoView({ behavior: "smooth", block: "start" }));
  el.clear.addEventListener("click", async () => {
    if (!enabled) return;
    activeSyncController?.abort();
    stopElapsedTimer();
    syncStartedAt = 0;
    syncProgress = null;
    reconnecting = false;
    if (db) { db.close(); db = null; }
    await deletePocDatabase();
    uiError = "None";
    allSyncedUntil = 0;
    setMessage("Only this browser's POC IndexedDB data was cleared. No server or production records were deleted.");
    await refresh();
  });
  [el.jobId, el.technician, el.device].forEach((input) => input.addEventListener("change", () => refresh().catch(handleError)));
  window.addEventListener("offline", () => { activeSyncController?.abort(); refresh().catch(handleError); });
  window.addEventListener("online", () => {
    if (simulatedOffline) return;
    reconnecting = true;
    refresh().then(() => retrySync({ fromReconnect: true })).catch(handleError);
  });
  window.addEventListener("beforeunload", (event) => {
    if (!syncStartedAt || !latestStatusModel || (!latestStatusModel.pendingRecords && !latestStatusModel.pendingPhotos)) return;
    event.preventDefault();
    event.returnValue = "Sync in progress. Keep RMT open until synchronization completes.";
  });

  ensureDb().then(recoverInterruptedSyncs).then(refresh).catch((error) => {
    el.dbStatus.textContent = "Error";
    handleError(error);
  });
})();
