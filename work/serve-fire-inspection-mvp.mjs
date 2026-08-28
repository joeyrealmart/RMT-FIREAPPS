import http from "node:http";
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { networkInterfaces } from "node:os";

const root = "C:\\Users\\Joey\\Documents\\Codex\\2026-07-09\\are-u-able-to-are\\outputs\\fire-inspection-mvp";
const dataRoot = "C:\\Users\\Joey\\Documents\\Codex\\2026-07-09\\are-u-able-to-are\\outputs\\rmt-fire-local-data";
const reportRoot = "C:\\Users\\Joey\\Documents\\Codex\\2026-07-09\\are-u-able-to-are\\output\\pdf";
const port = 8026;
const host = "0.0.0.0";
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
  const urlPath = decodeURIComponent(new URL(req.url || "/", `http://127.0.0.1:${port}`).pathname);

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
  console.log(`Fire inspection prototype running at ${urls.localUrl}`);
  urls.lanUrls.forEach((url) => console.log(`Same-WiFi device URL: ${url}`));
  console.log(`Local data folder: ${dataRoot}`);
});
