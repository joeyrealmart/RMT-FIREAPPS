/*
 * Feature-flagged Dexie adapter prototype.
 * This file is deliberately not loaded by the main application yet. Existing
 * localStorage and revision-protected server saves remain the V1 paths.
 */
(function attachRmtOfflineStore(global) {
  const DB_NAME = "rmt-fireapps-offline-v1";
  const SYNC_STATES = new Set(["LOCAL", "PENDING", "SYNCING", "SYNCED", "FAILED"]);

  function requireDexie() {
    if (!global.Dexie) throw new Error("Dexie is not available. Load vendor/dexie.min.js before the offline adapter.");
    return global.Dexie;
  }

  function now() {
    return new Date().toISOString();
  }

  function createStore(name = DB_NAME) {
    const Dexie = requireDexie();
    const db = new Dexie(name);
    db.version(1).stores({
      jobs: "id, jobId, scheduleId, updatedAt",
      jobScopes: "id, jobId, scheduleId, deviceId, updatedAt",
      devices: "id, deviceId, clientId, siteId, updatedAt",
      inspections: "id, jobId, scheduleId, deviceId, technicianId, updatedAt, syncState",
      evidenceMetadata: "id, jobId, deviceId, inspectionId, updatedAt, syncState",
      syncQueue: "id, &operationId, jobId, entityType, entityId, technicianId, syncState, createdAt",
      activityEvents: "id, jobId, technicianId, createdAt",
      mimicMetadata: "id, clientId, siteId, floorId, updatedAt"
    });
    db.version(2).stores({
      jobs: "id, jobId, scheduleId, updatedAt",
      jobScopes: "id, jobId, scheduleId, deviceId, updatedAt",
      devices: "id, deviceId, clientId, siteId, updatedAt",
      inspections: "id, jobId, scheduleId, deviceId, technicianId, logicalMutationId, updatedAt, syncState",
      evidenceMetadata: "id, jobId, deviceId, inspectionId, logicalMutationId, updatedAt, syncState",
      syncQueue: "id, &operationId, &logicalMutationId, jobId, entityType, entityId, technicianId, syncState, createdAt",
      activityEvents: "id, jobId, technicianId, createdAt",
      mimicMetadata: "id, clientId, siteId, floorId, updatedAt"
    });
    return db;
  }

  function normalizeSyncState(value) {
    const normalized = String(value || "LOCAL").toUpperCase();
    if (!SYNC_STATES.has(normalized)) throw new Error(`Invalid offline sync state: ${value}`);
    return normalized;
  }

  async function putInspectionDraft(db, draft) {
    if (!draft?.id || !draft?.jobId || !draft?.deviceId || !draft?.technicianId) {
      throw new Error("Inspection draft requires id, jobId, deviceId and technicianId.");
    }
    const record = { ...draft, updatedAt: draft.updatedAt || now(), syncState: normalizeSyncState(draft.syncState || "LOCAL") };
    const current = await db.inspections.get(record.id);
    if (current && Number(current.revision || 0) > Number(record.revision || 0)) {
      throw new Error("A newer local inspection draft already exists; draft was not overwritten.");
    }
    await db.inspections.put(record);
    return record;
  }

  async function enqueueMutation(db, mutation) {
    if (!mutation?.operationId || !mutation?.logicalMutationId || !mutation?.entityType || !mutation?.entityId || !mutation?.jobId || !mutation?.technicianId) {
      throw new Error("Queued mutation requires operationId, logicalMutationId, entityType, entityId, jobId and technicianId.");
    }
    const existingLogicalMutation = await db.syncQueue.where("logicalMutationId").equals(mutation.logicalMutationId).first();
    if (existingLogicalMutation) return { ...existingLogicalMutation, duplicate: true };
    const existing = await db.syncQueue.where("operationId").equals(mutation.operationId).first();
    if (existing) return { ...existing, duplicate: true };
    const record = {
      id: mutation.id || `queue::${mutation.operationId}`,
      operationId: mutation.operationId,
      logicalMutationId: mutation.logicalMutationId,
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      jobId: mutation.jobId,
      technicianId: mutation.technicianId,
      operation: mutation.operation || "UPSERT",
      payload: mutation.payload || {},
      createdAt: mutation.createdAt || now(),
      updatedAt: now(),
      syncState: normalizeSyncState(mutation.syncState || "PENDING"),
      retryCount: Number(mutation.retryCount || 0),
      lastError: mutation.lastError || "",
      revision: Number(mutation.revision || 0)
    };
    await db.syncQueue.add(record);
    return record;
  }

  async function markMutation(db, operationId, syncState, options = {}) {
    const record = await db.syncQueue.where("operationId").equals(operationId).first();
    if (!record) throw new Error(`Queued mutation ${operationId} was not found.`);
    const next = {
      ...record,
      syncState: normalizeSyncState(syncState),
      retryCount: options.retryCount === undefined ? record.retryCount : Number(options.retryCount),
      lastError: options.lastError || "",
      updatedAt: now()
    };
    await db.syncQueue.put(next);
    return next;
  }

  async function migrateLegacyDrafts(db, legacyKey) {
    const markerId = `migration::${legacyKey}`;
    if (await db.activityEvents.get(markerId)) return { migrated: 0, alreadyMigrated: true };
    const raw = global.localStorage?.getItem(legacyKey);
    const candidates = raw ? JSON.parse(raw) : [];
    const drafts = Array.isArray(candidates) ? candidates : Object.values(candidates || {});
    let migrated = 0;
    for (const draft of drafts) {
      if (!draft?.id || !draft?.jobId || !draft?.deviceId || !draft?.technicianId) continue;
      await putInspectionDraft(db, { ...draft, syncState: draft.syncState || "LOCAL", legacySourceKey: legacyKey });
      migrated += 1;
    }
    await db.activityEvents.put({ id: markerId, type: "LEGACY_DRAFT_READ_ONLY_MIGRATION", legacyKey, migrated, createdAt: now() });
    return { migrated, alreadyMigrated: false };
  }

  global.RmtOfflineStore = {
    DB_NAME,
    SYNC_STATES: [...SYNC_STATES],
    createStore,
    putInspectionDraft,
    enqueueMutation,
    markMutation,
    migrateLegacyDrafts
  };
})(window);
