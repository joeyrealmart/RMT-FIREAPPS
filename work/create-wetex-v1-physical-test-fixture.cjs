const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataRoot = path.join(root, "outputs", "rmt-fire-local-data");
const schedulePath = path.join(dataRoot, "schedules", "service-schedules.json");
const masterPath = path.join(dataRoot, "device-master", "wetex-wetex-device-master.json");
const scheduleId = "DEMO-WETEX-MULTITECH-SYNC-202609";

const normalIds = [
  "L9.EL.21", "R.SD.5", "LG.FS.1", "GRD.FS.3", "L1.FS.3", "L2.EL.22", "L3.FS.3", "L5.EL.17", "L6.EL.17", "L7.EL.17", "L8.EL.17", "L9.EL.20",
  "R.SD.4", "LG.MCP.6", "GRD.FS.2", "L1.FS.2", "L2.EL.21", "L3.FS.2", "L5.EL.16", "L6.EL.16", "L7.EL.16", "L8.EL.16", "L9.EL.19", "R.SD.3",
  "LG.MCP.5", "GRD.FS.1", "L1.FS.1", "L2.EL.20", "L3.FS.1", "L5.EL.15", "L6.EL.15", "L7.EL.15", "L8.EL.15", "L9.EL.18", "R.SD.2", "LG.MCP.4",
  "GRD.EL.16", "L1.EL.19", "L2.EL.19", "L3.EL.12", "L5.EL.14", "L6.EL.14", "L7.EL.14", "L8.EL.14", "L9.EL.17", "R.SD.1", "LG.MCP.3", "GRD.EL.15",
  "L1.EL.18", "L2.EL.18", "L3.EL.11", "L5.EL.13", "L6.EL.13", "L7.EL.13", "L8.EL.13", "L9.EL.16"
];
const criticalIds = ["LG.CO2.3", "LG.CO2.2", "LG.CO2.1", "LG.SPP.1", "LG.WRP.1", "GRD.MFAP.1", "GRD.CO2.2", "GRD.CO2.1", "R.CO2.1"];
const techANormalIds = [
  "L9.EL.21", "LG.FS.1", "L1.FS.3", "L3.FS.3", "L6.EL.17", "L8.EL.17", "R.SD.4", "GRD.FS.2", "L2.EL.21", "L5.EL.16", "L7.EL.16", "L9.EL.19", "LG.MCP.5", "L1.FS.1",
  "L3.FS.1", "L6.EL.15", "L8.EL.15", "R.SD.2", "GRD.EL.16", "L2.EL.19", "L5.EL.14", "L7.EL.14", "L9.EL.17", "LG.MCP.3", "L1.EL.18", "L3.EL.11", "L6.EL.13", "L8.EL.13"
];

function unique(values) { return [...new Set(values)]; }
function writeAtomic(filePath, text) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, text, "utf8");
  fs.renameSync(tempPath, filePath);
}

const schedulesPayload = JSON.parse(fs.readFileSync(schedulePath, "utf8"));
if (schedulesPayload.schedules.some((schedule) => schedule.scheduleId === scheduleId)) {
  throw new Error(`${scheduleId} already exists; this helper will not overwrite or duplicate it.`);
}
const master = JSON.parse(fs.readFileSync(masterPath, "utf8"));
const devices = new Map(master.devices.map((device) => [device.tag, device]));
const plannedDeviceIds = unique([...normalIds, ...criticalIds]);
const missing = plannedDeviceIds.filter((id) => !devices.has(id));
if (missing.length) throw new Error(`Wetex master is missing: ${missing.join(", ")}`);
if (normalIds.length !== 56 || criticalIds.length !== 9 || plannedDeviceIds.length !== 65) throw new Error("Wetex fixture counts are not 56 normal + 9 critical.");

const techA = { technicianId: "tech@rmtfire.local", technicianName: "Demo Technician" };
const techB = { technicianId: "tech2@rmtfire.local", technicianName: "Tech 2" };
const techACriticalIds = ["LG.CO2.3", "LG.CO2.2", "LG.CO2.1", "LG.SPP.1", "LG.WRP.1"];
const techBIds = plannedDeviceIds.filter((id) => !techANormalIds.includes(id) && !techACriticalIds.includes(id));
const deviceAssignments = {};
techANormalIds.concat(techACriticalIds).forEach((id) => { deviceAssignments[id] = techA; });
techBIds.forEach((id) => { deviceAssignments[id] = techB; });
if (Object.keys(deviceAssignments).length !== plannedDeviceIds.length) throw new Error("Every frozen item must have exactly one technician assignment.");

const floorIdByDevice = Object.fromEntries(master.devices.map((device) => [device.tag, device.floorId || ""]));
const plannedFloorCounts = Object.entries(plannedDeviceIds.reduce((counts, id) => {
  const floorId = floorIdByDevice[id] || "unmapped";
  counts[floorId] = (counts[floorId] || 0) + 1;
  return counts;
}, {})).map(([floorId, count]) => ({ floorId, count }));
const now = new Date().toISOString();
const schedule = {
  scheduleId,
  jobId: `JOB-${scheduleId}`,
  status: "Scheduled",
  companyName: "WETEX",
  siteName: "WETEX",
  clientSource: "Existing Client",
  address: "",
  floorId: "lib-wetex-f02",
  floorTitle: "Whole site (start: WETEX-02 / Ground)",
  floorCode: "GRD",
  startFloorId: "lib-wetex-f02",
  startFloorTitle: "WETEX-02 / Ground",
  mimicViewMode: "original",
  date: "2026-09-10",
  time: "16:45",
  technician: "Demo Technician / Tech 2",
  technicians: [techA, techB],
  deviceAssignments,
  serviceType: "Monthly Fire Protection Maintenance Test",
  scope: "maintenance-inspection",
  scopeLabel: "Monthly Fire Protection Maintenance Test",
  scopeSelectionMode: "site-wide",
  contractFrequencyPercent: 10,
  annualCycleId: "annual-2026",
  contractCycleId: "annual-2026",
  rotationHistoryKey: "10::wetex::wetex::site-wide::annual-2026",
  scopeFrozen: true,
  sampledDeviceIds: normalIds,
  mandatoryRecheckDeviceIds: [],
  criticalDeviceIds: criticalIds,
  adminForcedDeviceIds: [],
  passiveTargetCount: 56,
  plannedDeviceIds,
  plannedFloorCounts,
  deviceCount: 65,
  totalFloorDeviceCount: 569,
  totalSiteDeviceCount: 569,
  passiveCount: 56,
  activeCount: 9,
  priority: "High",
  notes: "DEMO/TEST ONLY. Frozen monthly 10% Wetex physical two-technician validation. Original Wetex backgrounds only; no master data or historical inspection data copied.",
  testFixture: true,
  activityTimeline: [
    { eventId: `${scheduleId}::JOB_ASSIGNED::tech`, type: "JOB_ASSIGNED", technicianId: techA.technicianId, technicianName: techA.technicianName, at: now },
    { eventId: `${scheduleId}::JOB_ASSIGNED::tech2`, type: "JOB_ASSIGNED", technicianId: techB.technicianId, technicianName: techB.technicianName, at: now }
  ],
  createdAt: now,
  updatedAt: now
};

schedulesPayload.schedules = [schedule, ...schedulesPayload.schedules];
schedulesPayload.savedAt = now;
schedulesPayload.savedByApp = "RMT Fire Inspection App";
writeAtomic(schedulePath, JSON.stringify(schedulesPayload, null, 2));
console.log(JSON.stringify({ scheduleId, plannedCount: plannedDeviceIds.length, normalCount: normalIds.length, criticalCount: criticalIds.length, techACount: techANormalIds.length + techACriticalIds.length, techBCount: techBIds.length, plannedDeviceIds }, null, 2));
