import http from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { networkInterfaces } from "node:os";

const root = "C:\\Users\\Joey\\Documents\\Codex\\2026-07-09\\are-u-able-to-are\\outputs\\fire-inspection-mvp";
const dataRoot = "C:\\Users\\Joey\\Documents\\Codex\\2026-07-09\\are-u-able-to-are\\outputs\\rmt-fire-local-data";
const reportRoot = "C:\\Users\\Joey\\Documents\\Codex\\2026-07-09\\are-u-able-to-are\\output\\pdf";
const port = 8026;
const host = "0.0.0.0";
const serverStartedAt = new Date().toISOString();
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8"
};

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
  "Surrogate-Control": "no-store"
};

mkdirSync(join(dataRoot, "mimics"), { recursive: true });
mkdirSync(join(dataRoot, "device-master"), { recursive: true });
mkdirSync(join(dataRoot, "inspection-runs"), { recursive: true });
mkdirSync(join(dataRoot, "schedules"), { recursive: true });
mkdirSync(join(dataRoot, "schedules", "photo-proof"), { recursive: true });
mkdirSync(join(dataRoot, "requests"), { recursive: true });
mkdirSync(join(dataRoot, "requests", "photo-proof"), { recursive: true });
mkdirSync(join(dataRoot, "shared-records", "jobs"), { recursive: true });
mkdirSync(join(dataRoot, "shared-records", "linked-verification-evidence"), { recursive: true });
mkdirSync(join(dataRoot, "extinguisher-assets"), { recursive: true });
mkdirSync(join(dataRoot, "shared-records", "extinguisher-evidence"), { recursive: true });
mkdirSync(reportRoot, { recursive: true });

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...noCacheHeaders });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  res.writeHead(200, {
    "Content-Type": mime[extname(filePath).toLowerCase()] || "application/octet-stream",
    ...noCacheHeaders
  });
  createReadStream(filePath).pipe(res);
}

function sendNotFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...noCacheHeaders });
  res.end("Not found");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "file";
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 80 * 1024 * 1024) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function readJsonFile(filePath, fallback) {
  try {
    if (!existsSync(filePath)) return fallback;
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    console.warn(`Unable to read JSON file ${filePath}`, error);
    return fallback;
  }
}

function atomicWriteJson(filePath, payload) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, JSON.stringify(payload, null, 2));
  renameSync(tempPath, filePath);
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    if (["revision", "expectedRevision", "createdAt", "updatedAt", "savedAt", "serverReceivedAt"].includes(key)) {
      return acc;
    }
    acc[key] = stableJsonValue(value[key]);
    return acc;
  }, {});
}

function equivalentRecordPayload(current, incoming) {
  if (!current || !incoming) return false;
  return JSON.stringify(stableJsonValue(current)) === JSON.stringify(stableJsonValue(incoming));
}

function getSharedJobPath(scheduleId) {
  return join(dataRoot, "shared-records", "jobs", `${slugify(scheduleId)}.json`);
}

function getInspectionRecordId(scheduleId, deviceId) {
  return `inspection::${scheduleId}::${deviceId}`;
}

function getCriticalSopRecordId(scheduleId, templateId, deviceId) {
  return `critical-sop::${scheduleId}::${templateId}::${deviceId || templateId}`;
}

function getItemClaimId(scheduleId, itemId) {
  return `claim::${scheduleId}::${itemId}`;
}

function createEmptySharedJobStore(scheduleId) {
  const now = new Date().toISOString();
  return {
    schemaVersion: "shared-records-v1",
    scheduleId,
    createdAt: now,
    updatedAt: now,
    scheduleSnapshot: null,
    migration: {
      migratedFromJobProgress: false,
      migratedAt: ""
    },
    inspectionRecords: {},
    criticalSopRecords: {},
    systemCheckRecords: {},
    itemClaims: {},
    linkedVerificationDefinitions: {},
    linkedVerificationSideRecords: {},
    linkedVerificationConflicts: {},
    linkedVerificationAudit: [],
    extinguisherAssetSnapshot: null,
    extinguisherVerificationRecords: {},
    extinguisherChangeProposals: {},
    extinguisherAudit: [],
    signOff: null,
    reportSubmission: null
  };
}

function readSavedSchedules() {
  const schedulePath = join(dataRoot, "schedules", "service-schedules.json");
  const payload = readJsonFile(schedulePath, { schedules: [] });
  return Array.isArray(payload.schedules) ? payload.schedules : [];
}

function findSavedSchedule(scheduleId) {
  return readSavedSchedules().find((schedule) => schedule.scheduleId === scheduleId) || null;
}

function readSharedJobStore(scheduleId) {
  const store = readJsonFile(getSharedJobPath(scheduleId), null) || createEmptySharedJobStore(scheduleId);
  store.schemaVersion = store.schemaVersion || "shared-records-v1";
  store.scheduleId = store.scheduleId || scheduleId;
  store.inspectionRecords = store.inspectionRecords || {};
  store.criticalSopRecords = store.criticalSopRecords || {};
  store.systemCheckRecords = store.systemCheckRecords || {};
  store.itemClaims = store.itemClaims || {};
  store.linkedVerificationDefinitions = store.linkedVerificationDefinitions || {};
  store.linkedVerificationSideRecords = store.linkedVerificationSideRecords || {};
  store.linkedVerificationConflicts = store.linkedVerificationConflicts || {};
  store.linkedVerificationAudit = Array.isArray(store.linkedVerificationAudit) ? store.linkedVerificationAudit : [];
  store.extinguisherAssetSnapshot = store.extinguisherAssetSnapshot || null;
  store.extinguisherVerificationRecords = store.extinguisherVerificationRecords || {};
  store.extinguisherChangeProposals = store.extinguisherChangeProposals || {};
  store.extinguisherAudit = Array.isArray(store.extinguisherAudit) ? store.extinguisherAudit : [];
  store.reportSubmission = store.reportSubmission || null;
  store.migration = store.migration || { migratedFromJobProgress: false, migratedAt: "" };
  return store;
}

function getMissingRequestStorePath() {
  return join(dataRoot, "requests", "missing-device-requests.json");
}

function readMissingDeviceRequests() {
  const payload = readJsonFile(getMissingRequestStorePath(), { requests: [] });
  return Array.isArray(payload.requests) ? payload.requests : [];
}

function writeMissingDeviceRequests(requests = []) {
  atomicWriteJson(getMissingRequestStorePath(), {
    schemaVersion: "missing-device-requests-v1",
    savedAt: new Date().toISOString(),
    requests
  });
}

function writeMissingRequestPhoto(requestId, photo = {}, index = 0) {
  const image = dataUrlToFile(photo?.dataUrl, "jpg");
  const clean = { ...(photo || {}) };
  delete clean.dataUrl;
  if (!image) return clean;
  const safeRequest = slugify(requestId || "missing-request");
  const photoDir = join(dataRoot, "requests", "photo-proof", safeRequest);
  mkdirSync(photoDir, { recursive: true });
  const photoName = `${String(index + 1).padStart(2, "0")}-${slugify(photo.name || "missing-device-proof")}.${image.ext}`;
  const photoPath = join(photoDir, photoName);
  writeFileSync(photoPath, image.bytes);
  return {
    ...clean,
    photoPath,
    photoUrl: `/local-data/requests/photo-proof/${safeRequest}/${photoName}`,
    savedToPc: true
  };
}

function saveMissingDeviceRequestRecord(incoming = {}, expectedRevision = null) {
  const now = new Date().toISOString();
  const requests = readMissingDeviceRequests();
  const id = incoming.id || incoming.requestId || `REQ-${Date.now()}`;
  const index = requests.findIndex((request) => request.id === id);
  const current = index >= 0 ? requests[index] : null;
  const currentRevision = Number(current?.revision || 0);
  const requestedRevision = Number(expectedRevision ?? incoming.expectedRevision ?? currentRevision);
  if (current && requestedRevision !== currentRevision) {
    return {
      ok: false,
      conflict: true,
      expectedRevision: requestedRevision,
      currentRevision,
      current
    };
  }

  const rawPhotoEvidence = Array.isArray(incoming.photoEvidence) ? incoming.photoEvidence : [];
  const savedPhotoEvidence = rawPhotoEvidence
    .map((photo, photoIndex) => writeMissingRequestPhoto(id, photo, photoIndex))
    .filter(Boolean);
  const retainedPhotoEvidence = savedPhotoEvidence.length
    ? savedPhotoEvidence
    : Array.isArray(current?.photoEvidence)
      ? current.photoEvidence
      : [];
  const saved = {
    ...(current || {}),
    ...incoming,
    id,
    requestId: id,
    schemaVersion: "missing-device-request-v1",
    status: incoming.status || current?.status || "PENDING_ADMIN_REVIEW",
    photo: incoming.photo || savedPhotoEvidence[0]?.name || current?.photo || "",
    photoEvidence: retainedPhotoEvidence,
    revision: currentRevision + 1,
    createdAt: current?.createdAt || incoming.createdAt || incoming.requestedAt || now,
    updatedAt: now,
    serverReceivedAt: now
  };
  delete saved.expectedRevision;
  if (saved.photoEvidence) {
    saved.photoEvidence = saved.photoEvidence.map((photo) => {
      const clean = { ...photo };
      delete clean.dataUrl;
      return clean;
    });
  }
  if (index >= 0) {
    requests[index] = saved;
  } else {
    requests.unshift(saved);
  }
  writeMissingDeviceRequests(requests);
  return { ok: true, request: saved, count: requests.length };
}

function writeSharedJobStore(store) {
  store.updatedAt = new Date().toISOString();
  atomicWriteJson(getSharedJobPath(store.scheduleId), store);
}

function normalizeExtinguisherSerial(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function getExtinguisherMasterPath(companyName, siteName) {
  return join(dataRoot, "extinguisher-assets", `${slugify(`${companyName || "client"}-${siteName || "site"}`)}-master.json`);
}

function getExtinguisherMasterId(companyName, siteName) {
  return `ext-master::${slugify(companyName)}::${slugify(siteName)}`;
}

function readExtinguisherMaster(companyName, siteName) {
  const masterId = getExtinguisherMasterId(companyName, siteName);
  const stored = readJsonFile(getExtinguisherMasterPath(companyName, siteName), null);
  return stored || {
    schemaVersion: "extinguisher-asset-master-v1",
    masterId,
    companyName: companyName || "",
    siteName: siteName || "",
    revision: 0,
    assets: [],
    sourceDocuments: [],
    audit: [],
    createdAt: "",
    updatedAt: ""
  };
}

function normalizeExtinguisherAsset(masterId, incoming = {}, index = 0) {
  const serialNumber = normalizeExtinguisherSerial(incoming.serialNumber || incoming.serial || incoming.serial_no || incoming.serial_number);
  if (!serialNumber) return null;
  return {
    assetId: incoming.assetId || `ext-asset::${masterId}::${slugify(serialNumber)}`,
    serialNumber,
    brand: String(incoming.brand || "").trim(),
    agentType: String(incoming.agentType || incoming.agent || incoming.type || "").trim(),
    sizeKg: String(incoming.sizeKg || incoming.size || incoming.capacity || "").trim(),
    location: String(incoming.location || incoming.area || "").trim(),
    floor: String(incoming.floor || incoming.floorArea || "").trim(),
    manufactureMonthYear: String(incoming.manufactureMonthYear || incoming.manufacture_date || "").trim(),
    expiryDate: String(incoming.expiryDate || incoming.expiry || "").trim(),
    registeredAddress: String(incoming.registeredAddress || incoming.registered_address || "").trim(),
    bombaQr: {
      serialNumber: normalizeExtinguisherSerial(incoming.bombaQr?.serialNumber || serialNumber),
      expiryDate: String(incoming.bombaQr?.expiryDate || incoming.expiryDate || incoming.expiry || "").trim(),
      registeredAddress: String(incoming.bombaQr?.registeredAddress || incoming.registeredAddress || incoming.registered_address || "").trim(),
      rawPayload: String(incoming.bombaQr?.rawPayload || incoming.rawQrPayload || incoming.raw_qr_payload || "")
    },
    status: incoming.status || "ACTIVE",
    sourceRow: Number(incoming.sourceRow || index + 2)
  };
}

function saveExtinguisherMasterImport(payload = {}) {
  const companyName = String(payload.companyName || "").trim();
  const siteName = String(payload.siteName || "").trim();
  if (!companyName || !siteName) return { ok: false, error: "Company and site are required" };
  const current = readExtinguisherMaster(companyName, siteName);
  const expectedRevision = Number(payload.expectedRevision ?? current.revision ?? 0);
  if (expectedRevision !== Number(current.revision || 0)) {
    return { ok: false, conflict: true, expectedRevision, currentRevision: Number(current.revision || 0), current };
  }
  const masterId = current.masterId || getExtinguisherMasterId(companyName, siteName);
  const imported = (Array.isArray(payload.assets) ? payload.assets : [])
    .map((asset, index) => normalizeExtinguisherAsset(masterId, asset, index))
    .filter(Boolean);
  const seen = new Set();
  const duplicateSerials = [];
  imported.forEach((asset) => {
    if (seen.has(asset.serialNumber)) duplicateSerials.push(asset.serialNumber);
    seen.add(asset.serialNumber);
  });
  if (duplicateSerials.length) {
    return { ok: false, error: `Duplicate serial number(s): ${[...new Set(duplicateSerials)].join(", ")}` };
  }
  const now = new Date().toISOString();
  let sourceDocument = payload.sourceDocument ? {
    sourceDocumentId: payload.sourceDocument.sourceDocumentId || `ext-source::${Date.now()}`,
    name: String(payload.sourceDocument.name || "Source document"),
    type: String(payload.sourceDocument.type || "reference"),
    reference: String(payload.sourceDocument.reference || ""),
    size: Number(payload.sourceDocument.size || 0),
    importedAt: now,
    importedBy: String(payload.importedBy || "Admin")
  } : null;
  if (sourceDocument && payload.sourceDocument?.dataUrl) {
    const file = dataUrlToFile(payload.sourceDocument.dataUrl, sourceDocument.type === "PDF_REFERENCE" ? "pdf" : "bin");
    if (file) {
      const sourceDir = join(dataRoot, "extinguisher-assets", "sources", slugify(masterId));
      mkdirSync(sourceDir, { recursive: true });
      const sourceName = `${sourceDocument.sourceDocumentId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${slugify(sourceDocument.name)}.${file.ext}`;
      writeFileSync(join(sourceDir, sourceName), file.bytes);
      sourceDocument = { ...sourceDocument, sourceUrl: `/local-data/extinguisher-assets/sources/${slugify(masterId)}/${sourceName}`, savedToPc: true };
    }
  }
  const nextAssets = imported.length ? imported : current.assets;
  const saved = {
    ...current,
    schemaVersion: "extinguisher-asset-master-v1",
    masterId,
    companyName,
    siteName,
    revision: Number(current.revision || 0) + 1,
    assets: nextAssets,
    sourceDocuments: sourceDocument ? [...(current.sourceDocuments || []), sourceDocument] : current.sourceDocuments || [],
    audit: [...(current.audit || []), {
      event: imported.length ? "MASTER_LIST_IMPORTED" : "SOURCE_REFERENCE_ATTACHED",
      by: String(payload.importedBy || "Admin"),
      at: now,
      assetCount: nextAssets.length,
      sourceDocumentId: sourceDocument?.sourceDocumentId || ""
    }],
    createdAt: current.createdAt || now,
    updatedAt: now
  };
  atomicWriteJson(getExtinguisherMasterPath(companyName, siteName), saved);
  return { ok: true, master: saved };
}

function getExtinguisherVerificationRecordId(scheduleId, assetId) {
  return `ext-verification::${scheduleId}::${assetId}`;
}

function writeExtinguisherEvidence(scheduleId, recordId, evidence = [], currentEvidence = []) {
  const incoming = Array.isArray(evidence) ? evidence : [];
  if (!incoming.length) return Array.isArray(currentEvidence) ? currentEvidence : [];
  const folderName = slugify(`${scheduleId}-${recordId}`);
  const evidenceDir = join(dataRoot, "shared-records", "extinguisher-evidence", folderName);
  mkdirSync(evidenceDir, { recursive: true });
  return incoming.map((photo, index) => {
    const image = dataUrlToFile(photo?.dataUrl, "jpg");
    const clean = { ...(photo || {}) };
    delete clean.dataUrl;
    if (!image) return clean;
    const name = `${String(index + 1).padStart(2, "0")}-${slugify(photo.name || "extinguisher-evidence")}.${image.ext}`;
    writeFileSync(join(evidenceDir, name), image.bytes);
    return { ...clean, photoUrl: `/local-data/shared-records/extinguisher-evidence/${folderName}/${name}`, savedToPc: true };
  });
}

function freezeExtinguisherJob(store, schedule = {}, payload = {}) {
  if (store.extinguisherAssetSnapshot) {
    return { ok: true, idempotent: true, snapshot: store.extinguisherAssetSnapshot, reconciliation: calculateExtinguisherReconciliation(store) };
  }
  const companyName = schedule.companyName || store.scheduleSnapshot?.companyName || payload.companyName || "";
  const siteName = schedule.siteName || store.scheduleSnapshot?.siteName || payload.siteName || "";
  const master = readExtinguisherMaster(companyName, siteName);
  const selectedIds = new Set(Array.isArray(payload.selectedAssetIds) ? payload.selectedAssetIds : []);
  const assets = (master.assets || [])
    .filter((asset) => asset.status !== "REMOVED")
    .filter((asset) => !selectedIds.size || selectedIds.has(asset.assetId))
    .map((asset) => JSON.parse(JSON.stringify(asset)));
  const now = new Date().toISOString();
  store.extinguisherAssetSnapshot = {
    schemaVersion: "extinguisher-job-snapshot-v1",
    snapshotId: `ext-snapshot::${store.scheduleId}`,
    scheduleId: store.scheduleId,
    masterId: master.masterId,
    masterRevision: Number(master.revision || 0),
    companyName,
    siteName,
    sourceDocumentRefs: (master.sourceDocuments || []).map((source) => ({ ...source })),
    assetIds: assets.map((asset) => asset.assetId),
    assets,
    frozenAt: now,
    frozenBy: String(payload.frozenBy || "Admin")
  };
  store.extinguisherAudit.push({ event: "JOB_ASSET_LIST_FROZEN", at: now, by: String(payload.frozenBy || "Admin"), assetCount: assets.length, masterRevision: master.revision || 0 });
  return { ok: true, snapshot: store.extinguisherAssetSnapshot, reconciliation: calculateExtinguisherReconciliation(store) };
}

function calculateExtinguisherReconciliation(store) {
  const expectedAssets = store.extinguisherAssetSnapshot?.assets || [];
  const records = Object.values(store.extinguisherVerificationRecords || {});
  const expectedIds = new Set(expectedAssets.map((asset) => asset.assetId));
  const latestByAsset = new Map(records.map((record) => [record.assetId, record]));
  const counts = { expected: expectedAssets.length, verified: 0, missing: 0, moved: 0, newUnitFound: 0, fault: 0, replaced: 0, pending: 0, pendingMasterChanges: 0 };
  expectedAssets.forEach((asset) => {
    const status = String(latestByAsset.get(asset.assetId)?.result || "").toUpperCase();
    if (!status) counts.pending += 1;
    else if (status === "VERIFIED") counts.verified += 1;
    else if (status === "MISSING") counts.missing += 1;
    else if (status === "MOVED") counts.moved += 1;
    else if (status === "FAULT") counts.fault += 1;
    else if (status === "REPLACED") counts.replaced += 1;
  });
  records.filter((record) => record.result === "NEW_UNIT_FOUND" && !expectedIds.has(record.assetId)).forEach(() => { counts.newUnitFound += 1; });
  counts.pendingMasterChanges = Object.values(store.extinguisherChangeProposals || {}).filter((proposal) => proposal.status === "PENDING_ADMIN_REVIEW").length;
  counts.completed = counts.expected - counts.pending;
  counts.ready = counts.pending === 0;
  return counts;
}

function createExtinguisherProposal(store, incoming = {}) {
  const now = new Date().toISOString();
  const proposalId = incoming.proposalId || `EXT-PROP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const current = store.extinguisherChangeProposals[proposalId];
  if (current) return { ok: true, idempotent: true, proposal: current };
  const proposal = {
    proposalId,
    scheduleId: store.scheduleId,
    assetId: incoming.assetId || "",
    serialNumber: normalizeExtinguisherSerial(incoming.serialNumber),
    proposalType: incoming.proposalType || "ADD_NEW",
    proposedChanges: incoming.proposedChanges || {},
    reason: String(incoming.reason || ""),
    technicianId: String(incoming.technicianId || ""),
    technicianName: String(incoming.technicianName || ""),
    evidenceRefs: Array.isArray(incoming.evidenceRefs) ? incoming.evidenceRefs : [],
    status: "PENDING_ADMIN_REVIEW",
    revision: 1,
    auditHistory: [{ event: "PROPOSED", by: String(incoming.technicianName || incoming.technicianId || "Technician"), at: now }],
    createdAt: now,
    updatedAt: now
  };
  store.extinguisherChangeProposals[proposalId] = proposal;
  store.extinguisherAudit.push({ event: "MASTER_CHANGE_PROPOSED", proposalId, proposalType: proposal.proposalType, technicianId: proposal.technicianId, at: now });
  return { ok: true, proposal };
}

function saveExtinguisherVerification(store, incoming = {}, expectedRevision = 0) {
  const resultName = String(incoming.result || "").toUpperCase();
  if (!["VERIFIED", "MISSING", "MOVED", "FAULT", "REPLACED", "NEW_UNIT_FOUND"].includes(resultName)) return { ok: false, error: "Unsupported extinguisher verification result" };
  const snapshotAssets = store.extinguisherAssetSnapshot?.assets || [];
  const serialNumber = normalizeExtinguisherSerial(incoming.serialNumber);
  const frozenAsset = snapshotAssets.find((asset) => asset.assetId === incoming.assetId || asset.serialNumber === serialNumber);
  if (resultName !== "NEW_UNIT_FOUND" && !frozenAsset) return { ok: false, error: "Asset is not part of the frozen extinguisher job list" };
  if (resultName === "NEW_UNIT_FOUND" && !serialNumber) return { ok: false, error: "Serial number is required for a new unit" };
  if (resultName === "MOVED" && !String(incoming.currentLocation || "").trim()) return { ok: false, error: "Current location is required for a moved unit" };
  if (resultName === "REPLACED" && !normalizeExtinguisherSerial(incoming.replacementSerial)) return { ok: false, error: "Replacement serial is required" };
  const assetId = frozenAsset?.assetId || incoming.assetId || `ext-found::${slugify(serialNumber)}`;
  const recordId = getExtinguisherVerificationRecordId(store.scheduleId, assetId);
  const current = store.extinguisherVerificationRecords[recordId] || null;
  const evidenceRefs = writeExtinguisherEvidence(store.scheduleId, recordId, incoming.evidenceRefs, current?.evidenceRefs);
  const record = {
    ...incoming,
    recordId,
    scheduleId: store.scheduleId,
    assetId,
    serialNumber: frozenAsset?.serialNumber || serialNumber,
    result: resultName,
    technicianId: String(incoming.technicianId || ""),
    technicianName: String(incoming.technicianName || ""),
    timestamp: incoming.timestamp || new Date().toISOString(),
    notes: String(incoming.notes || ""),
    currentLocation: String(incoming.currentLocation || ""),
    replacementSerial: normalizeExtinguisherSerial(incoming.replacementSerial),
    evidenceRefs,
    syncState: "SYNCED"
  };
  const result = saveRevisionedRecord(store, "extinguisherVerificationRecords", record, expectedRevision);
  if (!result.ok) return result;
  if (!result.idempotent) store.extinguisherAudit.push({
    event: "ASSET_VERIFICATION_SAVED",
    recordId,
    assetId,
    serialNumber: record.serialNumber,
    result: resultName,
    technicianId: record.technicianId,
    technicianName: record.technicianName,
    notes: record.notes,
    evidenceRefs: record.evidenceRefs,
    currentLocation: record.currentLocation,
    replacementSerial: record.replacementSerial,
    at: result.record.updatedAt,
    revision: result.record.revision
  });
  let proposal = null;
  if (resultName === "NEW_UNIT_FOUND") proposal = createExtinguisherProposal(store, { ...record, proposalId: incoming.proposalId, proposalType: "ADD_NEW", proposedChanges: { serialNumber: record.serialNumber, location: record.currentLocation, agentType: incoming.agentType || "", sizeKg: incoming.sizeKg || "" }, evidenceRefs });
  if (resultName === "MOVED") proposal = createExtinguisherProposal(store, { ...record, proposalId: incoming.proposalId, proposalType: "MOVE_LOCATION", proposedChanges: { location: record.currentLocation }, evidenceRefs });
  if (resultName === "REPLACED") proposal = createExtinguisherProposal(store, { ...record, proposalId: incoming.proposalId, proposalType: "REPLACE_SERIAL", proposedChanges: { replacementSerial: record.replacementSerial, location: record.currentLocation || frozenAsset?.location || "", agentType: incoming.agentType || frozenAsset?.agentType || "", sizeKg: incoming.sizeKg || frozenAsset?.sizeKg || "" }, evidenceRefs });
  if (resultName === "MISSING" && incoming.proposeRemoval) proposal = createExtinguisherProposal(store, { ...record, proposalId: incoming.proposalId, proposalType: "MARK_REMOVED", proposedChanges: {}, evidenceRefs });
  return { ok: true, record: result.record, idempotent: Boolean(result.idempotent), proposal: proposal?.proposal || null, reconciliation: calculateExtinguisherReconciliation(store) };
}

function reviewExtinguisherProposal(store, proposalId, payload = {}) {
  const proposal = store.extinguisherChangeProposals?.[proposalId];
  if (!proposal) return { ok: false, error: "Proposal not found" };
  const action = String(payload.action || "").toUpperCase();
  const now = new Date().toISOString();
  if (action === "ADJUST") {
    proposal.proposedChanges = { ...(proposal.proposedChanges || {}), ...(payload.proposedChanges || {}) };
    proposal.reason = String(payload.reason || proposal.reason || "");
    proposal.revision = Number(proposal.revision || 0) + 1;
    proposal.updatedAt = now;
    proposal.auditHistory = [...(proposal.auditHistory || []), { event: "ADJUSTED", by: String(payload.reviewedBy || "Admin"), at: now }];
    store.extinguisherAudit.push({ event: "MASTER_CHANGE_ADJUSTED", proposalId, by: String(payload.reviewedBy || "Admin"), at: now });
    return { ok: true, proposal, masterChanged: false };
  }
  if (!["APPROVE", "REJECT"].includes(action)) return { ok: false, error: "Unsupported review action" };
  if (proposal.status !== "PENDING_ADMIN_REVIEW") return { ok: false, error: "Proposal was already reviewed" };
  proposal.status = action === "APPROVE" ? "APPROVED" : "REJECTED";
  proposal.reviewedAt = now;
  proposal.reviewedBy = String(payload.reviewedBy || "Admin");
  proposal.revision = Number(proposal.revision || 0) + 1;
  proposal.updatedAt = now;
  proposal.auditHistory = [...(proposal.auditHistory || []), { event: proposal.status, by: proposal.reviewedBy, at: now }];
  let master = null;
  if (action === "APPROVE") {
    const snapshot = store.extinguisherAssetSnapshot || {};
    master = readExtinguisherMaster(snapshot.companyName, snapshot.siteName);
    const assets = [...(master.assets || [])];
    const index = assets.findIndex((asset) => asset.assetId === proposal.assetId || asset.serialNumber === proposal.serialNumber);
    const changes = proposal.proposedChanges || {};
    if (proposal.proposalType === "ADD_NEW") {
      const added = normalizeExtinguisherAsset(master.masterId, changes, assets.length);
      if (!added) return { ok: false, error: "Approved new unit is missing a serial number" };
      if (!assets.some((asset) => asset.serialNumber === added.serialNumber)) assets.push(added);
      proposal.approvedAssetId = added.assetId;
    } else if (proposal.proposalType === "MOVE_LOCATION" && index >= 0) {
      assets[index] = { ...assets[index], location: String(changes.location || assets[index].location || "") };
    } else if (proposal.proposalType === "MARK_REMOVED" && index >= 0) {
      assets[index] = { ...assets[index], status: "REMOVED" };
    } else if (proposal.proposalType === "REPLACE_SERIAL" && index >= 0) {
      assets[index] = { ...assets[index], status: "REPLACED", replacedBySerial: normalizeExtinguisherSerial(changes.replacementSerial) };
      const replacement = normalizeExtinguisherAsset(master.masterId, { ...assets[index], ...changes, serialNumber: changes.replacementSerial, status: "ACTIVE" }, assets.length);
      if (replacement && !assets.some((asset) => asset.serialNumber === replacement.serialNumber)) assets.push(replacement);
      proposal.approvedAssetId = replacement?.assetId || "";
    }
    master = {
      ...master,
      assets,
      revision: Number(master.revision || 0) + 1,
      updatedAt: now,
      audit: [...(master.audit || []), { event: "TECHNICIAN_PROPOSAL_APPROVED", proposalId, proposalType: proposal.proposalType, by: proposal.reviewedBy, at: now }]
    };
    atomicWriteJson(getExtinguisherMasterPath(master.companyName, master.siteName), master);
  }
  store.extinguisherAudit.push({ event: action === "APPROVE" ? "MASTER_CHANGE_APPROVED" : "MASTER_CHANGE_REJECTED", proposalId, by: proposal.reviewedBy, at: now });
  return { ok: true, proposal, masterChanged: action === "APPROVE", master };
}

function getLinkedVerificationSideRecordId(scheduleId, linkedVerificationId, sideId) {
  return `linked-side::${scheduleId}::${linkedVerificationId}::${sideId}`;
}

function normalizeLinkedVerificationSide(side = {}) {
  const sideId = String(side.sideId || side.id || "").trim();
  return {
    ...side,
    sideId,
    sideName: String(side.sideName || side.name || sideId).trim(),
    location: String(side.location || side.sideName || side.name || sideId).trim(),
    assignedTechnicianId: String(side.assignedTechnicianId || side.technicianId || "").trim(),
    assignedTechnicianName: String(side.assignedTechnicianName || side.technicianName || "").trim(),
    evidenceRequired: Boolean(side.evidenceRequired)
  };
}

function normalizeLinkedVerificationDefinition(scheduleId, definition = {}, schedule = null) {
  const linkedVerificationId = String(definition.linkedVerificationId || definition.id || "").trim();
  const requiredSides = (Array.isArray(definition.requiredSides) ? definition.requiredSides : [])
    .map(normalizeLinkedVerificationSide)
    .filter((side) => side.sideId);
  return {
    ...definition,
    linkedVerificationId,
    scheduleId,
    jobId: definition.jobId || schedule?.jobId || `JOB-${scheduleId}`,
    clientId: definition.clientId || schedule?.clientId || schedule?.companyName || "",
    siteId: definition.siteId || schedule?.siteId || schedule?.siteName || "",
    companyName: definition.companyName || schedule?.companyName || "",
    siteName: definition.siteName || schedule?.siteName || "",
    systemId: String(definition.systemId || definition.system || "").trim(),
    verificationType: String(definition.verificationType || "GENERIC_LINKED_VERIFICATION").trim(),
    title: String(definition.title || "Linked Verification").trim(),
    requiredSides,
    requiredSideIds: requiredSides.map((side) => side.sideId),
    definitionVersion: String(definition.definitionVersion || definition.version || "1"),
    reconciliationMode: definition.reconciliationMode === "ADMIN_REVIEW" ? "ADMIN_REVIEW" : "MATCHING_RESULTS",
    evidenceRequired: Boolean(definition.evidenceRequired)
  };
}

function ensureLinkedVerificationDefinitions(store, schedule = null) {
  const configured = Array.isArray(schedule?.linkedVerifications)
    ? schedule.linkedVerifications
    : Array.isArray(store.scheduleSnapshot?.linkedVerifications)
      ? store.scheduleSnapshot.linkedVerifications
      : [];
  configured.forEach((item) => {
    const definition = normalizeLinkedVerificationDefinition(store.scheduleId, item, schedule || store.scheduleSnapshot);
    if (!definition.linkedVerificationId || definition.requiredSides.length < 2) return;
    const current = store.linkedVerificationDefinitions[definition.linkedVerificationId];
    if (current) return;
    store.linkedVerificationDefinitions[definition.linkedVerificationId] = {
      ...definition,
      createdAt: definition.createdAt || new Date().toISOString(),
      updatedAt: definition.updatedAt || new Date().toISOString()
    };
  });
  return store;
}

function getLinkedVerificationSideRecords(store, linkedVerificationId) {
  return Object.values(store.linkedVerificationSideRecords || {})
    .filter((record) => record.linkedVerificationId === linkedVerificationId);
}

function isLinkedVerificationSideComplete(record) {
  return Boolean(record && String(record.status || "").toUpperCase() === "COMPLETE" && record.result);
}

function calculateLinkedVerificationStatus(store, linkedVerificationId) {
  const definition = store.linkedVerificationDefinitions?.[linkedVerificationId];
  if (!definition) return { status: "NOT_STARTED", definition: null, sides: [] };
  const records = getLinkedVerificationSideRecords(store, linkedVerificationId);
  const sideById = new Map(records.map((record) => [record.sideId, record]));
  const sides = definition.requiredSides.map((side) => ({ ...side, record: sideById.get(side.sideId) || null }));
  const completed = sides.filter((side) => isLinkedVerificationSideComplete(side.record));
  const hasConflict = Boolean(store.linkedVerificationConflicts?.[linkedVerificationId]?.unresolved);
  let status = "NOT_STARTED";
  if (hasConflict) {
    status = "MISMATCH_REVIEW_REQUIRED";
  } else if (!completed.length && records.length) {
    status = "IN_PROGRESS";
  } else if (completed.length < sides.length) {
    status = completed.length ? "AWAITING_COUNTERPART" : "NOT_STARTED";
  } else {
    const results = new Set(completed.map((side) => String(side.record.result || "").trim().toUpperCase()));
    status = results.size > 1
      ? "MISMATCH_REVIEW_REQUIRED"
      : definition.reconciliationMode === "ADMIN_REVIEW"
        ? "READY_FOR_RECONCILIATION"
        : "VERIFIED";
  }
  return {
    linkedVerificationId,
    status,
    definition,
    sides,
    completedSideCount: completed.length,
    requiredSideCount: sides.length,
    updatedAt: records.map((record) => record.updatedAt || "").sort().at(-1) || definition.updatedAt || ""
  };
}

function listLinkedVerificationStates(store) {
  return Object.keys(store.linkedVerificationDefinitions || {})
    .map((linkedVerificationId) => calculateLinkedVerificationStatus(store, linkedVerificationId));
}

function writeLinkedVerificationEvidence(scheduleId, linkedVerificationId, sideId, evidence = [], currentEvidence = []) {
  const incoming = Array.isArray(evidence) ? evidence : [];
  if (!incoming.length) return Array.isArray(currentEvidence) ? currentEvidence : [];
  const folderName = slugify(`${scheduleId}-${linkedVerificationId}-${sideId}`);
  const evidenceDir = join(dataRoot, "shared-records", "linked-verification-evidence", folderName);
  mkdirSync(evidenceDir, { recursive: true });
  return incoming.map((item, index) => {
    if (!item?.dataUrl) return item;
    const image = dataUrlToFile(item.dataUrl, "jpg");
    if (!image) return null;
    const photoName = `${String(index + 1).padStart(2, "0")}-${slugify(item.name || "linked-verification")}.${image.ext}`;
    const photoPath = join(evidenceDir, photoName);
    writeFileSync(photoPath, image.bytes);
    const clean = { ...item };
    delete clean.dataUrl;
    return {
      ...clean,
      photoPath,
      photoUrl: `/local-data/shared-records/linked-verification-evidence/${folderName}/${photoName}`,
      savedToPc: true
    };
  }).filter(Boolean);
}

function technicianMatchesLinkedSide(side, technicianId, technicianName) {
  const assignedId = String(side?.assignedTechnicianId || "").trim().toLowerCase();
  const assignedName = String(side?.assignedTechnicianName || "").trim().toLowerCase();
  const actualId = String(technicianId || "").trim().toLowerCase();
  const actualName = String(technicianName || "").trim().toLowerCase();
  return Boolean((assignedId && assignedId === actualId) || (assignedName && assignedName === actualName));
}

function saveLinkedVerificationSide(store, incoming = {}, expectedRevision = 0) {
  const linkedVerificationId = String(incoming.linkedVerificationId || "").trim();
  const sideId = String(incoming.sideId || "").trim();
  const definition = store.linkedVerificationDefinitions?.[linkedVerificationId];
  const side = definition?.requiredSides?.find((item) => item.sideId === sideId);
  if (!definition || !side) {
    return { ok: false, invalid: true, reason: "Unknown linked verification or side." };
  }
  if (!technicianMatchesLinkedSide(side, incoming.technicianId, incoming.technicianName)) {
    return { ok: false, forbidden: true, reason: "This linked-verification side is assigned to another technician." };
  }
  const recordId = getLinkedVerificationSideRecordId(store.scheduleId, linkedVerificationId, sideId);
  const current = store.linkedVerificationSideRecords?.[recordId] || null;
  const currentRevision = Number(current?.revision || 0);
  const expected = Number(expectedRevision ?? incoming.expectedRevision ?? 0);
  if (current && incoming.submissionId && incoming.submissionId === current.submissionId) {
    return { ok: true, idempotent: true, record: current };
  }
  if (expected !== currentRevision) {
    const now = new Date().toISOString();
    store.linkedVerificationConflicts[linkedVerificationId] = {
      linkedVerificationId,
      unresolved: true,
      status: "MISMATCH_REVIEW_REQUIRED",
      attemptedSideId: sideId,
      attemptedBy: incoming.technicianId || incoming.technicianName || "",
      expectedRevision: expected,
      currentRevision,
      detectedAt: now
    };
    store.linkedVerificationAudit.push({
      event: "SIDE_SAVE_CONFLICT",
      linkedVerificationId,
      sideId,
      technicianId: incoming.technicianId || "",
      technicianName: incoming.technicianName || "",
      timestamp: now,
      expectedRevision: expected,
      currentRevision
    });
    return { ok: false, conflict: true, current, expectedRevision: expected, currentRevision };
  }
  const evidenceRefs = writeLinkedVerificationEvidence(
    store.scheduleId,
    linkedVerificationId,
    sideId,
    incoming.evidenceRefs,
    current?.evidenceRefs
  );
  if ((definition.evidenceRequired || side.evidenceRequired) && !evidenceRefs.length) {
    return { ok: false, invalid: true, reason: "Photo evidence is required for this linked-verification side." };
  }
  if (!incoming.result) {
    return { ok: false, invalid: true, reason: "A result is required for this linked-verification side." };
  }
  const now = new Date().toISOString();
  const record = {
    ...(current || {}),
    ...incoming,
    recordId,
    scheduleId: store.scheduleId,
    linkedVerificationId,
    sideId,
    sideName: side.sideName,
    sideLocation: side.location,
    assignedTechnicianId: side.assignedTechnicianId,
    assignedTechnicianName: side.assignedTechnicianName,
    status: "COMPLETE",
    syncStatus: "SYNCED",
    evidenceRefs,
    revision: currentRevision + 1,
    createdAt: current?.createdAt || incoming.createdAt || now,
    localCompletedAt: incoming.localCompletedAt || incoming.timestamp || now,
    timestamp: incoming.timestamp || incoming.localCompletedAt || now,
    updatedAt: now,
    serverReceivedAt: now
  };
  delete record.expectedRevision;
  store.linkedVerificationSideRecords[recordId] = record;
  store.linkedVerificationAudit.push({
    event: "SIDE_SYNCED",
    linkedVerificationId,
    sideId,
    technicianId: record.technicianId || "",
    technicianName: record.technicianName || "",
    result: record.result,
    timestamp: now,
    revision: record.revision
  });
  return { ok: true, record };
}

function normalizeScheduleSnapshot(schedule = null) {
  if (!schedule || typeof schedule !== "object") return null;
  const { jobProgress, photoProof, ...snapshot } = schedule;
  return {
    ...snapshot,
    plannedDeviceIds: Array.isArray(schedule.plannedDeviceIds) ? schedule.plannedDeviceIds : [],
    plannedFloorCounts: Array.isArray(schedule.plannedFloorCounts) ? schedule.plannedFloorCounts : [],
    deviceCount: Number(schedule.deviceCount || schedule.plannedDeviceIds?.length || 0),
    activeCount: Number(schedule.activeCount || 0),
    passiveCount: Number(schedule.passiveCount || 0)
  };
}

function migrateLegacyProgressToSharedStore(store, schedule = null) {
  const legacy = schedule?.jobProgress || null;
  const hasRecords = Object.keys(store.inspectionRecords || {}).length
    || Object.keys(store.criticalSopRecords || {}).length
    || Object.keys(store.systemCheckRecords || {}).length;
  if (!legacy || typeof legacy !== "object" || !Object.keys(legacy).length || hasRecords || store.migration?.migratedFromJobProgress) return store;

  const now = new Date().toISOString();
  const jobId = legacy.activeJob?.jobId || schedule?.jobId || `JOB-${store.scheduleId}`;
  Object.entries(legacy.inspections || {}).forEach(([deviceId, inspection]) => {
    const recordId = getInspectionRecordId(store.scheduleId, deviceId);
    store.inspectionRecords[recordId] = {
      recordId,
      jobId,
      scheduleId: store.scheduleId,
      deviceId,
      checklistItemId: deviceId,
      technicianId: inspection.inspectedBy || legacy.updatedBy || "legacy",
      technicianName: inspection.inspectedBy || legacy.updatedBy || "Legacy Import",
      status: inspection.status || "pending",
      answers: inspection.answers || [],
      notes: inspection.notes || "",
      action: inspection.action || "",
      evidenceRefs: [],
      source: "legacy-jobProgress",
      originalSnapshot: inspection,
      revision: 1,
      createdAt: inspection.inspectedAt || legacy.updatedAt || now,
      updatedAt: inspection.inspectedAt || legacy.updatedAt || now
    };
  });

  Object.entries(legacy.criticalSops || {}).forEach(([key, sop]) => {
    const deviceId = sop.deviceTag || key.split("::").pop() || sop.templateId || "critical";
    const templateId = sop.templateId || key.split("::")[0] || "critical-sop";
    const recordId = getCriticalSopRecordId(store.scheduleId, templateId, deviceId);
    store.criticalSopRecords[recordId] = {
      ...sop,
      recordId,
      jobId,
      scheduleId: store.scheduleId,
      parentDeviceId: deviceId,
      deviceId,
      technicianId: sop.filledBy || sop.savedBy || legacy.updatedBy || "legacy",
      technicianName: sop.filledBy || sop.savedBy || legacy.updatedBy || "Legacy Import",
      status: sop.workflowStatus === "complete" ? "pass" : "partial",
      source: "legacy-jobProgress",
      revision: 1,
      createdAt: sop.savedAt || legacy.updatedAt || now,
      updatedAt: sop.savedAt || legacy.updatedAt || now
    };
  });

  Object.entries(legacy.systemChecks || {}).forEach(([templateId, check]) => {
    const recordId = `system-check::${store.scheduleId}::${templateId}`;
    store.systemCheckRecords[recordId] = {
      ...check,
      recordId,
      jobId,
      scheduleId: store.scheduleId,
      templateId,
      technicianId: check.savedBy || legacy.updatedBy || "legacy",
      technicianName: check.savedBy || legacy.updatedBy || "Legacy Import",
      revision: 1,
      createdAt: check.savedAt || legacy.updatedAt || now,
      updatedAt: check.savedAt || legacy.updatedAt || now
    };
  });

  store.migration = {
    migratedFromJobProgress: true,
    migratedAt: now,
    legacyUpdatedAt: legacy.updatedAt || ""
  };
  return store;
}

function getOrCreateSharedJobStore(scheduleId, schedule = null) {
  const store = readSharedJobStore(scheduleId);
  const scheduleSnapshot = normalizeScheduleSnapshot(schedule) || normalizeScheduleSnapshot(findSavedSchedule(scheduleId));
  if (scheduleSnapshot) {
    store.scheduleSnapshot = {
      ...(store.scheduleSnapshot || {}),
      ...scheduleSnapshot
    };
  }
  migrateLegacyProgressToSharedStore(store, schedule || findSavedSchedule(scheduleId));
  ensureLinkedVerificationDefinitions(store, schedule || scheduleSnapshot || findSavedSchedule(scheduleId));
  return store;
}

function normalizeSharedInspectionRecord(scheduleId, incoming = {}) {
  const deviceId = incoming.deviceId || incoming.checklistItemId || incoming.itemId || "";
  return {
    ...incoming,
    recordId: incoming.recordId || getInspectionRecordId(scheduleId, deviceId),
    scheduleId,
    deviceId,
    checklistItemId: incoming.checklistItemId || deviceId,
    status: incoming.status || "pending",
    evidenceRefs: Array.isArray(incoming.evidenceRefs) ? incoming.evidenceRefs : []
  };
}

function normalizeSharedCriticalSopRecord(scheduleId, incoming = {}) {
  const templateId = incoming.templateId || "critical-sop";
  const deviceId = incoming.parentDeviceId || incoming.deviceId || incoming.deviceTag || templateId;
  return {
    ...incoming,
    recordId: incoming.recordId || getCriticalSopRecordId(scheduleId, templateId, deviceId),
    scheduleId,
    templateId,
    parentDeviceId: incoming.parentDeviceId || deviceId,
    deviceId,
    status: incoming.status || (incoming.workflowStatus === "complete" ? "pass" : "partial"),
    evidenceRefs: Array.isArray(incoming.evidenceRefs) ? incoming.evidenceRefs : []
  };
}

function saveRevisionedRecord(store, collectionName, incomingRecord, expectedRevision) {
  const collection = store[collectionName] || {};
  const current = collection[incomingRecord.recordId] || null;
  const currentRevision = Number(current?.revision || 0);
  const expected = Number(expectedRevision ?? incomingRecord.expectedRevision ?? 0);
  const now = new Date().toISOString();
  const candidate = {
    ...(current || {}),
    ...incomingRecord,
    expectedRevision: undefined,
    revision: currentRevision + 1,
    createdAt: current?.createdAt || incomingRecord.createdAt || now,
    updatedAt: now,
    serverReceivedAt: now
  };

  if (expected !== currentRevision) {
    if (current && equivalentRecordPayload(current, candidate)) {
      return {
        ok: true,
        idempotent: true,
        record: current,
        currentRevision
      };
    }
    return {
      ok: false,
      conflict: true,
      current,
      expectedRevision: expected,
      currentRevision
    };
  }

  collection[incomingRecord.recordId] = candidate;
  store[collectionName] = collection;
  return {
    ok: true,
    record: candidate,
    currentRevision: candidate.revision
  };
}

function getSharedInspectionByDevice(store, deviceId) {
  return Object.values(store.inspectionRecords || {}).find((record) => record.deviceId === deviceId || record.checklistItemId === deviceId) || null;
}

function getSharedCriticalSopByDevice(store, deviceId) {
  return Object.values(store.criticalSopRecords || {}).find((record) => {
    return record.parentDeviceId === deviceId || record.deviceId === deviceId || record.deviceTag === deviceId;
  }) || null;
}

function calculateSharedProgress(store, schedule = null) {
  const scheduleSnapshot = normalizeScheduleSnapshot(schedule) || store.scheduleSnapshot || {};
  const plannedDeviceIds = Array.isArray(scheduleSnapshot.plannedDeviceIds) ? scheduleSnapshot.plannedDeviceIds : [];
  const summary = {
    total: plannedDeviceIds.length,
    done: 0,
    pass: 0,
    fail: 0,
    partial: 0,
    pending: 0,
    blocked: 0,
    ready: false,
    updatedAt: store.updatedAt || ""
  };

  plannedDeviceIds.forEach((deviceId) => {
    const sopRecord = getSharedCriticalSopByDevice(store, deviceId);
    const inspectionRecord = getSharedInspectionByDevice(store, deviceId);
    const status = String(sopRecord?.status || inspectionRecord?.status || "pending").toLowerCase();
    if (status === "pass" || status === "done" || status === "completed") {
      summary.pass += 1;
      summary.done += 1;
    } else if (status === "fail" || status === "fault") {
      summary.fail += 1;
      summary.done += 1;
    } else if (status === "locked" || status === "blocked") {
      summary.blocked += 1;
    } else if (status === "partial" || status === "started" || status === "in-progress") {
      summary.partial += 1;
    } else {
      summary.pending += 1;
    }
  });

  summary.ready = summary.total > 0
    && summary.done === summary.total
    && summary.pending === 0
    && summary.partial === 0
    && summary.blocked === 0;
  return summary;
}

function dataUrlToFile(dataUrl, fallbackExt = "png") {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1];
  const ext = mimeType.includes("jpeg") ? "jpg" : mimeType.includes("webp") ? "webp" : fallbackExt;
  return {
    ext,
    bytes: Buffer.from(match[2], "base64")
  };
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function devicesToCsv(devices = []) {
  const headers = ["company_name", "site_name", "device_tag", "device_type", "floor_area", "location", "brand_model", "serial_barcode", "expiry_date", "status", "remarks", "x_percent", "y_percent", "captured_by", "captured_at"];
  const rows = devices.map((row) => [
    row.companyName,
    row.siteName,
    row.tag,
    row.type,
    row.floor,
    row.location,
    row.brandModel,
    row.serialBarcode,
    row.expiryDate,
    row.status,
    row.remarks,
    row.xPercent,
    row.yPercent,
    row.capturedBy,
    row.capturedAt
  ].map(csvCell).join(","));
  return [headers.join(","), ...rows].join("\n");
}

function schedulesToCsv(schedules = []) {
  const headers = ["schedule_id", "status", "client_source", "company_name", "site_name", "address", "floor_area", "date", "time", "technician", "service_type", "scope", "priority", "device_count", "active_count", "passive_count", "total_units", "collected_units", "loan_units", "returned_units", "loan_returned_units", "cash_received", "receipt_ref", "photo_proof_count", "extinguisher_details", "notes", "created_at", "updated_at"];
  const rows = schedules.map((row) => [
    row.scheduleId,
    row.status,
    row.clientSource,
    row.companyName,
    row.siteName,
    row.address,
    row.floorTitle,
    row.date,
    row.time,
    row.technician,
    row.serviceType,
    row.scopeLabel,
    row.priority,
    row.deviceCount,
    row.activeCount,
    row.passiveCount,
    row.tracking?.totalUnits,
    row.tracking?.collectedUnits,
    row.tracking?.loanUnits,
    row.tracking?.returnedUnits,
    row.tracking?.loanReturnedUnits,
    row.tracking?.cashReceived,
    row.tracking?.receiptRef,
    row.photoProofCount || Object.values(row.photoProof || {}).reduce((total, photos) => total + (Array.isArray(photos) ? photos.length : 0), 0),
    row.extinguisherDetails,
    row.notes,
    row.createdAt,
    row.updatedAt
  ].map(csvCell).join(","));
  return [headers.join(","), ...rows].join("\n");
}

function getNetworkUrls() {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((address) => address && address.family === "IPv4" && !address.internal)
    .map((address) => `http://${address.address}:${port}/`);
  return {
    host,
    port,
    listeningAddress: `${host}:${port}`,
    localUrl: `http://127.0.0.1:${port}/`,
    lanUrls: [...new Set(addresses)]
  };
}

function writeInspectionPhoto(runKey, deviceId, label, dataUrl) {
  const image = dataUrlToFile(dataUrl, "jpg");
  if (!image) return null;

  const photoDir = join(dataRoot, "inspection-runs", `${runKey}-photos`);
  mkdirSync(photoDir, { recursive: true });
  const photoName = `${slugify(deviceId)}-${label}.${image.ext}`;
  const photoPath = join(photoDir, photoName);
  writeFileSync(photoPath, image.bytes);
  return {
    photoPath,
    photoUrl: `/local-data/inspection-runs/${runKey}-photos/${photoName}`
  };
}

function prepareInspectionRun(payload, runKey) {
  const inspections = {};
  Object.entries(payload.inspections || {}).forEach(([deviceId, inspection]) => {
    const next = { ...inspection };
    const beforePhoto = writeInspectionPhoto(runKey, deviceId, "before", next.beforePhotoData);
    const afterPhoto = writeInspectionPhoto(runKey, deviceId, "after", next.afterPhotoData);

    if (beforePhoto) {
      next.beforePhotoPath = beforePhoto.photoPath;
      next.beforePhotoUrl = beforePhoto.photoUrl;
      next.beforePhotoCaptured = true;
    }
    if (afterPhoto) {
      next.afterPhotoPath = afterPhoto.photoPath;
      next.afterPhotoUrl = afterPhoto.photoUrl;
      next.afterPhotoCaptured = true;
    }
    delete next.beforePhotoData;
    delete next.afterPhotoData;
    inspections[deviceId] = next;
  });

  return {
    ...payload,
    runKey,
    inspections,
    savedAt: new Date().toISOString(),
    savedByApp: "RMT Fire Inspection App"
  };
}

function writeSchedulePhoto(scheduleId, category, photo, index) {
  const image = dataUrlToFile(photo?.dataUrl, "jpg");
  if (!image) return photo || null;

  const safeSchedule = slugify(scheduleId || "extinguisher-job");
  const safeCategory = slugify(category || "photo");
  const photoDir = join(dataRoot, "schedules", "photo-proof", safeSchedule);
  mkdirSync(photoDir, { recursive: true });
  const photoName = `${safeCategory}-${String(index + 1).padStart(2, "0")}-${slugify(photo.name || "proof")}.${image.ext}`;
  const photoPath = join(photoDir, photoName);
  writeFileSync(photoPath, image.bytes);
  return {
    ...photo,
    dataUrl: undefined,
    photoPath,
    photoUrl: `/local-data/schedules/photo-proof/${safeSchedule}/${photoName}`,
    savedToPc: true
  };
}

function prepareScheduleRecord(schedule = {}) {
  const photoProof = {};
  Object.entries(schedule.photoProof || {}).forEach(([category, photos]) => {
    photoProof[category] = (Array.isArray(photos) ? photos : [])
      .map((photo, index) => writeSchedulePhoto(schedule.scheduleId, category, photo, index))
      .filter(Boolean)
      .map((photo) => {
        const next = { ...photo };
        delete next.dataUrl;
        return next;
      });
  });
  return {
    ...schedule,
    photoProof,
    photoProofCount: Object.values(photoProof).reduce((total, photos) => total + photos.length, 0)
  };
}

function inspectionRunToCsv(run = {}) {
  const headers = [
    "run_id",
    "job_status",
    "service_type",
    "company_name",
    "site_name",
    "inspector",
    "device_tag",
    "device_type",
    "floor_area",
    "location",
    "status",
    "notes",
    "action",
    "before_photo",
    "after_photo",
    "inspected_at",
    "x_percent",
    "y_percent"
  ];
  const inspections = run.inspections || {};
  const rows = (run.devices || []).map((device) => {
    const inspection = inspections[device.id] || {};
    return [
      run.runId,
      run.jobStatus,
      run.serviceType,
      run.companyName,
      run.siteName,
      run.inspector,
      device.id,
      device.type,
      device.floor,
      device.location,
      inspection.status || "pending",
      inspection.notes,
      inspection.action,
      inspection.beforePhotoPath || inspection.beforePhoto || "",
      inspection.afterPhotoPath || inspection.afterPhoto || "",
      inspection.inspectedAt,
      device.xPercent,
      device.yPercent
    ].map(csvCell).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  const urlPath = decodeURIComponent(requestUrl.pathname);
  const jobRoute = urlPath.match(/^\/api\/jobs\/([^/]+)\/([^/]+)$/);

  if (req.method === "GET" && urlPath === "/api/diagnostics") {
    const urls = getNetworkUrls();
    sendJson(res, 200, {
      ok: true,
      app: "RMT FIREAPPS",
      mode: "local-prototype",
      serverMode: "online-shared-records",
      storageMode: "local-json",
      sharedRecords: "authoritative-per-item",
      revisionProtection: true,
      offlineConflictSync: false,
      host: urls.host,
      port: urls.port,
      listeningAddress: urls.listeningAddress,
      localUrl: urls.localUrl,
      lanUrls: urls.lanUrls,
      startedAt: serverStartedAt,
      serverTime: new Date().toISOString()
    });
    return;
  }

  if (jobRoute) {
    const scheduleId = decodeURIComponent(jobRoute[1]);
    const action = jobRoute[2];
    try {
      if (req.method === "GET" && (action === "state" || action === "progress")) {
        const store = getOrCreateSharedJobStore(scheduleId);
        writeSharedJobStore(store);
        const progress = calculateSharedProgress(store);
        sendJson(res, 200, { ok: true, scheduleId, store, progress, linkedVerifications: listLinkedVerificationStates(store) });
        return;
      }

      if (req.method === "POST" && action === "migrate") {
        const payload = await readRequestJson(req);
        const schedule = payload.schedule || {};
        if (payload.legacyJobProgress && !schedule.jobProgress) {
          schedule.jobProgress = payload.legacyJobProgress;
        }
        const store = getOrCreateSharedJobStore(scheduleId, schedule);
        writeSharedJobStore(store);
        sendJson(res, 200, {
          ok: true,
          scheduleId,
          migrated: Boolean(store.migration?.migratedFromJobProgress),
          store,
          progress: calculateSharedProgress(store, schedule),
          linkedVerifications: listLinkedVerificationStates(store)
        });
        return;
      }

      if (req.method === "POST" && action === "extinguisher-freeze") {
        const payload = await readRequestJson(req);
        const store = getOrCreateSharedJobStore(scheduleId, payload.schedule || null);
        const result = freezeExtinguisherJob(store, payload.schedule || store.scheduleSnapshot || {}, payload);
        if (!result.ok) {
          sendJson(res, 400, result);
          return;
        }
        writeSharedJobStore(store);
        sendJson(res, 200, { ...result, scheduleId, store });
        return;
      }

      if (req.method === "POST" && action === "extinguisher-verifications") {
        const payload = await readRequestJson(req);
        const store = getOrCreateSharedJobStore(scheduleId, payload.schedule || null);
        if (!store.extinguisherAssetSnapshot) freezeExtinguisherJob(store, payload.schedule || store.scheduleSnapshot || {}, payload);
        const result = saveExtinguisherVerification(store, payload.record || payload, payload.expectedRevision);
        if (!result.ok) {
          sendJson(res, result.conflict ? 409 : 400, { ...result, scheduleId, type: "extinguisher-verification" });
          return;
        }
        writeSharedJobStore(store);
        sendJson(res, 200, { ...result, scheduleId });
        return;
      }

      if (req.method === "POST" && action === "extinguisher-proposals") {
        const payload = await readRequestJson(req);
        const store = getOrCreateSharedJobStore(scheduleId, payload.schedule || null);
        const result = createExtinguisherProposal(store, payload.proposal || payload);
        if (!result.ok) {
          sendJson(res, 400, result);
          return;
        }
        writeSharedJobStore(store);
        sendJson(res, 200, { ...result, scheduleId, reconciliation: calculateExtinguisherReconciliation(store) });
        return;
      }

      if (req.method === "POST" && action === "extinguisher-proposal-review") {
        const payload = await readRequestJson(req);
        const store = getOrCreateSharedJobStore(scheduleId, payload.schedule || null);
        const result = reviewExtinguisherProposal(store, payload.proposalId, payload);
        if (!result.ok) {
          sendJson(res, 400, result);
          return;
        }
        writeSharedJobStore(store);
        sendJson(res, 200, { ...result, scheduleId, reconciliation: calculateExtinguisherReconciliation(store) });
        return;
      }

      if (req.method === "POST" && action === "linked-verification-sides") {
        const payload = await readRequestJson(req);
        const store = getOrCreateSharedJobStore(scheduleId, payload.schedule || null);
        const result = saveLinkedVerificationSide(store, payload.record || payload, payload.expectedRevision);
        if (!result.ok) {
          if (result.conflict) {
            writeSharedJobStore(store);
            sendJson(res, 409, {
              ok: false,
              conflict: true,
              type: "linked-verification-side",
              scheduleId,
              current: result.current,
              expectedRevision: result.expectedRevision,
              currentRevision: result.currentRevision,
              linkedVerification: calculateLinkedVerificationStatus(store, payload.record?.linkedVerificationId || payload.linkedVerificationId)
            });
            return;
          }
          sendJson(res, result.forbidden ? 403 : 400, result);
          return;
        }
        writeSharedJobStore(store);
        sendJson(res, 200, {
          ok: true,
          scheduleId,
          record: result.record,
          idempotent: Boolean(result.idempotent),
          linkedVerification: calculateLinkedVerificationStatus(store, result.record.linkedVerificationId)
        });
        return;
      }

      if (req.method === "POST" && action === "inspection-records") {
        const payload = await readRequestJson(req);
        const store = getOrCreateSharedJobStore(scheduleId, payload.schedule || null);
        const record = normalizeSharedInspectionRecord(scheduleId, payload.record || payload);
        const result = saveRevisionedRecord(store, "inspectionRecords", record, payload.expectedRevision);
        if (!result.ok) {
          sendJson(res, 409, {
            ok: false,
            conflict: true,
            type: "inspection",
            scheduleId,
            recordId: record.recordId,
            expectedRevision: result.expectedRevision,
            currentRevision: result.currentRevision,
            current: result.current
          });
          return;
        }
        writeSharedJobStore(store);
        sendJson(res, 200, {
          ok: true,
          scheduleId,
          record: result.record,
          idempotent: Boolean(result.idempotent),
          progress: calculateSharedProgress(store, payload.schedule || null)
        });
        return;
      }

      if (req.method === "POST" && action === "critical-sop-records") {
        const payload = await readRequestJson(req);
        const store = getOrCreateSharedJobStore(scheduleId, payload.schedule || null);
        const record = normalizeSharedCriticalSopRecord(scheduleId, payload.record || payload);
        const result = saveRevisionedRecord(store, "criticalSopRecords", record, payload.expectedRevision);
        if (!result.ok) {
          sendJson(res, 409, {
            ok: false,
            conflict: true,
            type: "critical-sop",
            scheduleId,
            recordId: record.recordId,
            expectedRevision: result.expectedRevision,
            currentRevision: result.currentRevision,
            current: result.current
          });
          return;
        }
        writeSharedJobStore(store);
        sendJson(res, 200, {
          ok: true,
          scheduleId,
          record: result.record,
          idempotent: Boolean(result.idempotent),
          progress: calculateSharedProgress(store, payload.schedule || null)
        });
        return;
      }

      if (req.method === "POST" && action === "item-claims") {
        const payload = await readRequestJson(req);
        const store = getOrCreateSharedJobStore(scheduleId, payload.schedule || null);
        const itemId = payload.itemId || payload.deviceId || payload.record?.itemId || "";
        const recordId = getItemClaimId(scheduleId, itemId);
        const current = store.itemClaims[recordId] || {};
        const now = new Date().toISOString();
        const incomingClaimedBy = payload.claimedBy || payload.record?.claimedBy || "";
        const currentExpiresAt = current.expiresAt ? Date.parse(current.expiresAt) : 0;
        const currentStillActive = current.status === "active"
          && current.claimedBy
          && current.claimedBy !== incomingClaimedBy
          && (!currentExpiresAt || currentExpiresAt > Date.now());
        if (currentStillActive) {
          sendJson(res, 200, {
            ok: true,
            warning: true,
            scheduleId,
            claim: current,
            activeClaim: current,
            progress: calculateSharedProgress(store, payload.schedule || null)
          });
          return;
        }
        const claim = {
          ...current,
          ...(payload.record || {}),
          recordId,
          scheduleId,
          itemId,
          deviceId: payload.deviceId || payload.record?.deviceId || itemId,
          claimedBy: incomingClaimedBy,
          claimedByName: payload.claimedByName || payload.record?.claimedByName || "",
          claimedAt: current.claimedAt || now,
          lastSeenAt: now,
          expiresAt: payload.expiresAt || payload.record?.expiresAt || "",
          status: payload.status || payload.record?.status || "active",
          revision: Number(current.revision || 0) + 1
        };
        store.itemClaims[recordId] = claim;
        writeSharedJobStore(store);
        sendJson(res, 200, { ok: true, scheduleId, claim, progress: calculateSharedProgress(store, payload.schedule || null) });
        return;
      }

      if (req.method === "POST" && action === "signoff") {
        const payload = await readRequestJson(req);
        const store = getOrCreateSharedJobStore(scheduleId, payload.schedule || null);
        const progress = calculateSharedProgress(store, payload.schedule || null);
        if (!progress.ready) {
          sendJson(res, 409, {
            ok: false,
            blocked: true,
            reason: "Shared job progress is incomplete. Sign-off rejected by server.",
            progress
          });
          return;
        }
        const currentRevision = Number(store.signOff?.revision || 0);
        const expectedRevision = Number(payload.expectedRevision ?? payload.signOff?.expectedRevision ?? 0);
        if (expectedRevision !== currentRevision) {
          sendJson(res, 409, {
            ok: false,
            conflict: true,
            type: "signoff",
            expectedRevision,
            currentRevision,
            current: store.signOff
          });
          return;
        }
        const now = new Date().toISOString();
        store.signOff = {
          ...(payload.signOff || {}),
          recordId: `signoff::${scheduleId}`,
          scheduleId,
          revision: currentRevision + 1,
          signedAt: payload.signOff?.signedAt || now,
          updatedAt: now,
          serverReceivedAt: now,
          progress
        };
        store.status = "Completed";
        store.completedAt = store.signOff.signedAt;
        store.completedBy = store.signOff.signedBy || store.signOff.technicianName || "";
        writeSharedJobStore(store);
        sendJson(res, 200, { ok: true, scheduleId, signOff: store.signOff, progress });
        return;
      }

      if (req.method === "POST" && action === "report-submission") {
        const payload = await readRequestJson(req);
        const store = getOrCreateSharedJobStore(scheduleId, payload.schedule || null);
        const progress = calculateSharedProgress(store, payload.schedule || null);
        const incoming = payload.submission || payload;
        const requestedStatus = incoming.status || "AWAITING_ADMIN_REVIEW";
        const reviewStatuses = new Set(["RETURNED_FOR_CORRECTION", "APPROVED_BY_ADMIN"]);
        const isReviewAction = reviewStatuses.has(requestedStatus);
        if (!isReviewAction && !progress.ready) {
          sendJson(res, 409, {
            ok: false,
            blocked: true,
            reason: "Shared job progress is incomplete. Report submission rejected by server.",
            progress
          });
          return;
        }
        if (!isReviewAction && !store.signOff?.signatureData && !store.signOff?.supervisorSignatureData) {
          sendJson(res, 409, {
            ok: false,
            blocked: true,
            reason: "Client/supervisor acknowledgement is missing. Report submission rejected by server.",
            progress
          });
          return;
        }
        if (requestedStatus === "APPROVED_BY_ADMIN" && !store.reportSubmission) {
          sendJson(res, 409, {
            ok: false,
            blocked: true,
            reason: "No technician submission is available for admin approval.",
            progress
          });
          return;
        }
        if (requestedStatus === "APPROVED_BY_ADMIN" && !incoming.reportSnapshot) {
          sendJson(res, 409, {
            ok: false,
            blocked: true,
            reason: "An authoritative report snapshot is required before Admin approval.",
            progress
          });
          return;
        }
        if (requestedStatus === "APPROVED_BY_ADMIN" && Number(incoming.reportSnapshot?.dataIntegrity?.unsyncedCount || 0) > 0) {
          sendJson(res, 409, {
            ok: false,
            blocked: true,
            reason: "Unsynced report records remain. Admin approval is blocked.",
            progress
          });
          return;
        }
        const currentRevision = Number(store.reportSubmission?.revision || 0);
        const expectedRevision = Number(payload.expectedRevision ?? incoming.expectedRevision ?? currentRevision);
        if (expectedRevision !== currentRevision) {
          sendJson(res, 409, {
            ok: false,
            conflict: true,
            type: "report-submission",
            expectedRevision,
            currentRevision,
            current: store.reportSubmission
          });
          return;
        }
        const now = new Date().toISOString();
        store.reportSubmission = {
          ...(store.reportSubmission || {}),
          ...incoming,
          recordId: `report-submission::${scheduleId}`,
          scheduleId,
          status: requestedStatus,
          revision: currentRevision + 1,
          progress,
          signOffRevision: Number(store.signOff?.revision || 0),
          submittedAt: incoming.submittedAt || store.reportSubmission?.submittedAt || now,
          updatedAt: now,
          serverReceivedAt: now
        };
        store.status = requestedStatus;
        if (requestedStatus === "RETURNED_FOR_CORRECTION") {
          store.returnedForCorrectionAt = now;
          store.returnedForCorrectionBy = incoming.reviewedBy || incoming.adminName || "";
        }
        if (requestedStatus === "APPROVED_BY_ADMIN") {
          store.approvedAt = now;
          store.approvedBy = incoming.reviewedBy || incoming.adminName || "";
        }
        writeSharedJobStore(store);
        sendJson(res, 200, { ok: true, scheduleId, submission: store.reportSubmission, progress });
        return;
      }
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
      return;
    }
  }

  if (req.method === "GET" && urlPath === "/api/linked-verifications") {
    try {
      const jobDir = join(dataRoot, "shared-records", "jobs");
      const requestedScheduleIds = String(requestUrl.searchParams.get("scheduleIds") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const files = requestedScheduleIds.length
        ? requestedScheduleIds.map((scheduleId) => getSharedJobPath(scheduleId)).filter(existsSync)
        : readdirSync(jobDir).filter((name) => name.toLowerCase().endsWith(".json")).map((name) => join(jobDir, name));
      const linkedVerifications = files.flatMap((filePath) => {
          const store = readJsonFile(filePath, null);
          if (!store?.scheduleId) return [];
          const hydrated = readSharedJobStore(store.scheduleId);
          ensureLinkedVerificationDefinitions(hydrated, hydrated.scheduleSnapshot || findSavedSchedule(hydrated.scheduleId));
          return listLinkedVerificationStates(hydrated);
        });
      sendJson(res, 200, { ok: true, linkedVerifications });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message, linkedVerifications: [] });
    }
    return;
  }

  if (req.method === "GET" && urlPath === "/api/extinguisher-assets/master") {
    try {
      const companyName = requestUrl.searchParams.get("companyName") || "";
      const siteName = requestUrl.searchParams.get("siteName") || "";
      sendJson(res, 200, { ok: true, master: readExtinguisherMaster(companyName, siteName) });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && urlPath === "/api/extinguisher-assets/master-import") {
    try {
      const payload = await readRequestJson(req);
      const result = saveExtinguisherMasterImport(payload);
      sendJson(res, result.ok ? 200 : result.conflict ? 409 : 400, result);
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "GET" && urlPath === "/api/extinguisher-assets/proposals") {
    try {
      const jobDir = join(dataRoot, "shared-records", "jobs");
      const proposals = readdirSync(jobDir)
        .filter((name) => name.toLowerCase().endsWith(".json"))
        .flatMap((name) => {
          const store = readJsonFile(join(jobDir, name), null);
          if (!store?.scheduleId) return [];
          return Object.values(store.extinguisherChangeProposals || {}).map((proposal) => ({
            ...proposal,
            companyName: store.extinguisherAssetSnapshot?.companyName || store.scheduleSnapshot?.companyName || "",
            siteName: store.extinguisherAssetSnapshot?.siteName || store.scheduleSnapshot?.siteName || ""
          }));
        });
      sendJson(res, 200, { ok: true, proposals });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message, proposals: [] });
    }
    return;
  }

  if (req.method === "GET" && urlPath === "/api/missing-device-requests") {
    try {
      sendJson(res, 200, { ok: true, requests: readMissingDeviceRequests() });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message, requests: [] });
    }
    return;
  }

  if (req.method === "POST" && urlPath === "/api/missing-device-requests") {
    try {
      const payload = await readRequestJson(req);
      const result = saveMissingDeviceRequestRecord(payload.request || payload, payload.expectedRevision);
      if (!result.ok && result.conflict) {
        sendJson(res, 409, result);
        return;
      }
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && urlPath === "/api/save-mimic-floor") {
    try {
      const payload = await readRequestJson(req);
      const image = dataUrlToFile(payload.src);
      if (!image) {
        sendJson(res, 400, { ok: false, error: "Missing image data" });
        return;
      }

      const folderName = slugify(`${payload.companyName}-${payload.siteName}-${payload.floorCode}-${payload.floorName}`);
      const floorDir = join(dataRoot, "mimics", folderName);
      mkdirSync(floorDir, { recursive: true });
      const imageName = `mimic-${slugify(payload.floorCode)}.${image.ext}`;
      const imagePath = join(floorDir, imageName);
      const metaPath = join(floorDir, "mimic-meta.json");
      writeFileSync(imagePath, image.bytes);
      writeFileSync(metaPath, JSON.stringify({ ...payload, src: undefined, savedImage: imageName, savedAt: new Date().toISOString() }, null, 2));
      sendJson(res, 200, {
        ok: true,
        folder: floorDir,
        imagePath,
        metaPath,
        imageUrl: `/local-data/mimics/${folderName}/${imageName}`,
        metaUrl: `/local-data/mimics/${folderName}/mimic-meta.json`
      });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && urlPath === "/api/save-device-master") {
    try {
      const payload = await readRequestJson(req);
      const key = slugify(`${payload.companyName || "rmt"}-${payload.siteName || "site"}`);
      const jsonPath = join(dataRoot, "device-master", `${key}-device-master.json`);
      const csvPath = join(dataRoot, "device-master", `${key}-device-master.csv`);
      writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
      writeFileSync(csvPath, devicesToCsv(payload.devices));
      sendJson(res, 200, { ok: true, jsonPath, csvPath });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && urlPath === "/api/save-inspection-run") {
    try {
      const payload = await readRequestJson(req);
      const runId = payload.runId || new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
      const key = slugify(`${payload.companyName || "rmt"}-${payload.siteName || "site"}-${runId}`);
      const run = prepareInspectionRun({ ...payload, runId }, key);
      const runDir = join(dataRoot, "inspection-runs");
      const jsonName = `${key}-inspection-run.json`;
      const csvName = `${key}-inspection-results.csv`;
      const jsonPath = join(runDir, jsonName);
      const csvPath = join(runDir, csvName);
      writeFileSync(jsonPath, JSON.stringify(run, null, 2));
      writeFileSync(csvPath, inspectionRunToCsv(run));
      sendJson(res, 200, {
        ok: true,
        runKey: key,
        jsonPath,
        csvPath,
        jsonUrl: `/local-data/inspection-runs/${jsonName}`,
        csvUrl: `/local-data/inspection-runs/${csvName}`
      });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && urlPath === "/api/save-schedules") {
    try {
      const payload = await readRequestJson(req);
      const scheduleDir = join(dataRoot, "schedules");
      const jsonPath = join(scheduleDir, "service-schedules.json");
      const csvPath = join(scheduleDir, "service-schedules.csv");
      const schedules = Array.isArray(payload.schedules) ? payload.schedules.map(prepareScheduleRecord) : [];
      const saved = {
        schedules,
        savedAt: new Date().toISOString(),
        savedByApp: "RMT Fire Inspection App"
      };
      writeFileSync(jsonPath, JSON.stringify(saved, null, 2));
      writeFileSync(csvPath, schedulesToCsv(schedules));
      sendJson(res, 200, {
        ok: true,
        count: schedules.length,
        jsonPath,
        csvPath,
        jsonUrl: "/local-data/schedules/service-schedules.json",
        csvUrl: "/local-data/schedules/service-schedules.csv"
      });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "GET" && urlPath === "/api/schedules") {
    const schedulePath = join(dataRoot, "schedules", "service-schedules.json");
    if (!existsSync(schedulePath)) {
      sendJson(res, 200, { ok: true, schedules: [] });
      return;
    }
    sendFile(res, schedulePath);
    return;
  }

  if (req.method === "GET" && urlPath === "/api/inspection-runs") {
    try {
      const runDir = join(dataRoot, "inspection-runs");
      const files = readdirSync(runDir)
        .filter((name) => name.toLowerCase().endsWith("-inspection-run.json"))
        .sort((a, b) => statSync(join(runDir, b)).mtimeMs - statSync(join(runDir, a)).mtimeMs)
        .map((name) => {
          const filePath = join(runDir, name);
          return {
            name,
            url: `/local-data/inspection-runs/${name}`,
            updatedAt: statSync(filePath).mtime.toISOString()
          };
        });
      sendJson(res, 200, { ok: true, files });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message, files: [] });
    }
    return;
  }

  if (req.method === "GET" && urlPath === "/api/network-info") {
    sendJson(res, 200, { ok: true, ...getNetworkUrls() });
    return;
  }

  if (req.method === "GET" && urlPath === "/api/device-masters") {
    try {
      const masterDir = join(dataRoot, "device-master");
      const files = readdirSync(masterDir)
        .filter((name) => name.toLowerCase().endsWith("-device-master.json"))
        .sort()
        .map((name) => ({
          name,
          url: `/local-data/device-master/${name}`
        }));
      sendJson(res, 200, { ok: true, files });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message, files: [] });
    }
    return;
  }

  if (urlPath.startsWith("/local-data/")) {
    const requestedData = urlPath.replace("/local-data/", "");
    const filePath = normalize(join(dataRoot, requestedData));
    if (!filePath.startsWith(dataRoot) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      sendNotFound(res);
      return;
    }
    sendFile(res, filePath);
    return;
  }

  if (urlPath.startsWith("/reports/")) {
    const requestedReport = urlPath.replace("/reports/", "");
    const filePath = normalize(join(reportRoot, requestedReport));
    if (!filePath.startsWith(reportRoot) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      sendNotFound(res);
      return;
    }
    sendFile(res, filePath);
    return;
  }

  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = normalize(join(root, requested));

  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    sendNotFound(res);
    return;
  }

  sendFile(res, filePath);
});

server.listen(port, host, () => {
  const urls = getNetworkUrls();
  console.log("RMT FIREAPPS local preview server is running.");
  console.log(`Listening on ${urls.listeningAddress}`);
  console.log(`PC browser URL: ${urls.localUrl}`);
  if (urls.lanUrls.length) {
    urls.lanUrls.forEach((url) => console.log(`Android phone same-WiFi URL: ${url}`));
  } else {
    console.log("Android phone same-WiFi URL: no LAN IPv4 address detected. Check Wi-Fi/network sharing.");
  }
  console.log(`Local data folder: ${dataRoot}`);
});
