import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = join(workspace, "outputs", "rmt-fire-local-data");
const schedulePath = join(dataRoot, "schedules", "service-schedules.json");
const scheduleCsvPath = join(dataRoot, "schedules", "service-schedules.csv");
const libraryPath = join(dataRoot, "mimic-library", "mimic-library-app-data.json");
const today = "2026-08-11";
const technician = "Demo Technician";

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function stripSitePrefix(value, companyName, siteName) {
  let text = normalize(value);
  [companyName, siteName].map(normalize).filter(Boolean).forEach((prefix) => {
    if (text.startsWith(`${prefix} - `)) text = text.slice(prefix.length + 3).trim();
    if (text.startsWith(`${prefix}: `)) text = text.slice(prefix.length + 2).trim();
  });
  return text;
}

function isActiveSystem(type) {
  const value = normalize(type);
  if (value.includes("extinguisher")) return false;
  return [
    "main fire alarm panel",
    "fire alarm panel",
    "pump",
    "gas release",
    "fm200",
    "hose reel panel",
    "sprinkler panel",
    "wet riser panel",
    "pressurized hydrant panel",
    "co2",
    "wet chemical"
  ].some((keyword) => value.includes(keyword));
}

function isPassiveDevice(type) {
  const value = normalize(type);
  return [
    "smoke",
    "heat",
    "manual",
    "call point",
    "break glass",
    "emergency light",
    "exit",
    "hose reel",
    "extinguisher",
    "flow switch",
    "fireman intercom"
  ].some((keyword) => value.includes(keyword));
}

function isPassiveScopeDevice(device) {
  return isPassiveDevice(device?.type) && !isActiveSystem(device?.type);
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function resolveFloor(device, floors, companyName, siteName) {
  const deviceFloor = stripSitePrefix(device.floor || device.floorTitle || device.floorName || device.floorCode, companyName, siteName);
  const match = floors.find((floor) => {
    const candidates = [
      floor.id,
      floor.floorId,
      floor.title,
      floor.floorName,
      floor.floorCode
    ].map((value) => stripSitePrefix(value, companyName, siteName)).filter(Boolean);
    return candidates.some((candidate) => candidate === deviceFloor);
  });
  return match || floors[0] || {};
}

function getSiteDevices(masterFile, library, companyName, siteName) {
  const master = readJson(join(dataRoot, "device-master", masterFile), {});
  const floors = (library.floors || [])
    .filter((floor) => normalize(floor.companyName) === normalize(companyName))
    .filter((floor) => normalize(floor.siteName || companyName) === normalize(siteName))
    .map((floor) => ({
      ...floor,
      floorId: floor.floorId || floor.id
    }));

  return (master.devices || [])
    .filter((device) => device.tag && device.type)
    .filter((device) => normalize(device.companyName || master.companyName) === normalize(companyName))
    .filter((device) => normalize(device.siteName || master.siteName || companyName) === normalize(siteName))
    .map((device) => {
      const floor = resolveFloor(device, floors, companyName, siteName);
      return {
        id: device.tag,
        type: device.type,
        floor: device.floor || floor.title || "",
        floorId: floor.floorId || floor.id || "",
        floorTitle: floor.title || device.floor || "Unknown floor",
        floorCode: floor.floorCode || "",
        location: device.location || device.floor || "",
        x: firstNumber(device.xPercent, device.pinX, device.x),
        y: firstNumber(device.yPercent, device.pinY, device.y)
      };
    });
}

function sortDevices(a, b) {
  return String(a.floorTitle).localeCompare(String(b.floorTitle))
    || String(a.type).localeCompare(String(b.type))
    || String(a.id).localeCompare(String(b.id));
}

function selectBalancedByFloor(devices, targetCount) {
  const groups = new Map();
  [...devices].sort(sortDevices).forEach((device) => {
    const key = device.floorId || device.floorTitle || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(device);
  });

  const queues = [...groups.entries()]
    .map(([key, items]) => ({ key, title: items[0]?.floorTitle || key, items }))
    .sort((a, b) => String(a.title).localeCompare(String(b.title)));

  const selected = [];
  while (selected.length < targetCount && queues.some((group) => group.items.length)) {
    for (const group of queues) {
      if (selected.length >= targetCount) break;
      const next = group.items.shift();
      if (next) selected.push(next);
    }
  }
  return selected;
}

function getFloorCounts(devices) {
  const grouped = new Map();
  devices.forEach((device) => {
    const key = device.floorId || device.floorTitle || "unknown-floor";
    const current = grouped.get(key) || {
      floorId: key,
      floorTitle: device.floorTitle || key,
      count: 0
    };
    current.count += 1;
    grouped.set(key, current);
  });
  return [...grouped.values()].sort((a, b) => String(a.floorTitle).localeCompare(String(b.floorTitle)));
}

function buildMaintenanceSchedule({ scheduleId, masterFile, companyName, siteName, percent, time, notes }) {
  const library = readJson(libraryPath, { floors: [] });
  const devices = getSiteDevices(masterFile, library, companyName, siteName);
  const activeDevices = devices.filter((device) => isActiveSystem(device.type)).sort(sortDevices);
  const passiveDevices = devices.filter(isPassiveScopeDevice).sort(sortDevices);
  const passiveTarget = percent >= 100
    ? passiveDevices.length
    : Math.max(1, Math.ceil(passiveDevices.length * (percent / 100)));
  const plannedDevices = [
    ...activeDevices,
    ...selectBalancedByFloor(passiveDevices, passiveTarget)
  ];
  const firstFloor = (library.floors || [])
    .filter((floor) => normalize(floor.companyName) === normalize(companyName))
    .filter((floor) => normalize(floor.siteName || companyName) === normalize(siteName))
    .map((floor) => ({ ...floor, floorId: floor.floorId || floor.id }))[0] || {};
  const now = new Date().toISOString();

  return {
    scheduleId,
    status: "Scheduled",
    companyName,
    siteName,
    clientSource: "Existing Client",
    address: "",
    floorId: firstFloor.floorId || firstFloor.id || "",
    floorTitle: `Whole site (start: ${firstFloor.title || "First mimic page"})`,
    floorCode: firstFloor.floorCode || "",
    startFloorId: firstFloor.floorId || firstFloor.id || "",
    startFloorTitle: firstFloor.title || "First mimic page",
    date: today,
    time,
    technician,
    serviceType: "Maintenance / Inspection",
    scope: "full-maintenance",
    scopeLabel: "Full Maintenance Visit",
    scopeSelectionMode: "site-wide",
    contractFrequencyPercent: percent,
    rotationHistoryKey: `${companyName}|${siteName}::site-wide::${percent}`,
    plannedDeviceIds: plannedDevices.map((device) => device.id),
    plannedFloorCounts: getFloorCounts(plannedDevices),
    priority: "Normal",
    notes,
    extinguisherDetails: "",
    deviceCount: plannedDevices.length,
    totalFloorDeviceCount: devices.length,
    totalSiteDeviceCount: devices.length,
    passiveCount: plannedDevices.filter(isPassiveScopeDevice).length,
    activeCount: plannedDevices.filter((device) => isActiveSystem(device.type)).length,
    tracking: {
      totalUnits: 0,
      collectedUnits: 0,
      loanUnits: 0,
      returnedUnits: 0,
      loanReturnedUnits: 0,
      cashReceived: 0,
      receiptRef: ""
    },
    photoProof: {},
    photoProofCount: 0,
    createdAt: now,
    updatedAt: now
  };
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
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
    row.photoProofCount || 0,
    row.extinguisherDetails,
    row.notes,
    row.createdAt,
    row.updatedAt
  ].map(csvCell).join(","));
  return [headers.join(","), ...rows].join("\n");
}

const existing = readJson(schedulePath, { schedules: [] });
if (existsSync(schedulePath)) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  copyFileSync(schedulePath, `${schedulePath}.bak-${stamp}`);
}

const keptSchedules = (existing.schedules || []).filter((schedule) => {
  const company = normalize(schedule.companyName);
  return company !== "wetex" && company !== "uob" && !company.includes("mtb");
});

const testSchedules = [
  buildMaintenanceSchedule({
    scheduleId: "SCH-20260811-WETEX-10",
    masterFile: "wetex-wetex-device-master.json",
    companyName: "WETEX",
    siteName: "WETEX",
    percent: 10,
    time: "09:00",
    notes: "Test run: monthly 10% passive devices plus 100% critical/active systems."
  }),
  buildMaintenanceSchedule({
    scheduleId: "SCH-20260811-UOB-50",
    masterFile: "uob-uob-device-master.json",
    companyName: "UOB",
    siteName: "UOB",
    percent: 50,
    time: "14:00",
    notes: "Test run: 50% passive devices plus 100% critical/active systems."
  }),
  buildMaintenanceSchedule({
    scheduleId: "SCH-20260811-MTB-10",
    masterFile: "mtb-reality-sdn-bhd-bandar-hilir-device-master.json",
    companyName: "MTB Reality Sdn Bhd",
    siteName: "Bandar Hilir",
    percent: 10,
    time: "16:00",
    notes: "Test run: MTB monthly 10% passive devices plus 100% critical/active systems."
  })
];

const schedules = [...testSchedules, ...keptSchedules];
const saved = {
  schedules,
  savedAt: new Date().toISOString(),
  savedByApp: "RMT Fire Inspection App"
};

writeFileSync(schedulePath, JSON.stringify(saved, null, 2));
writeFileSync(scheduleCsvPath, schedulesToCsv(schedules));

console.log(JSON.stringify({
  ok: true,
  schedulePath,
  scheduleCsvPath,
  added: testSchedules.map((schedule) => ({
    scheduleId: schedule.scheduleId,
    companyName: schedule.companyName,
    percent: schedule.contractFrequencyPercent,
    deviceCount: schedule.deviceCount,
    passiveCount: schedule.passiveCount,
    activeCount: schedule.activeCount,
    floorCount: schedule.plannedFloorCounts.length
  })),
  kept: keptSchedules.length
}, null, 2));
