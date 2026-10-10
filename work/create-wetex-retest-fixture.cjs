const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dataRoot = path.join(root, "outputs", "rmt-fire-local-data");
const schedulePath = path.join(dataRoot, "schedules", "service-schedules.json");
const sharedJobsDir = path.join(dataRoot, "shared-records", "jobs");
const sourceScheduleId = "DEMO-WETEX-MULTITECH-SYNC-202609";
const scheduleId = "DEMO-WETEX-RETEST-20260924";

function writeAtomic(filePath, text) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, text, "utf8");
  fs.renameSync(tempPath, filePath);
}

function assignment(technicianId, technicianName) {
  return { technicianId, technicianName };
}

const payload = JSON.parse(fs.readFileSync(schedulePath, "utf8"));
const source = payload.schedules.find((schedule) => schedule.scheduleId === sourceScheduleId);
if (!source) throw new Error(`Protected source schedule ${sourceScheduleId} was not found.`);
if (payload.schedules.some((schedule) => schedule.scheduleId === scheduleId)) {
  throw new Error(`${scheduleId} already exists; this helper will not overwrite it.`);
}

const plannedDeviceIds = [...(source.plannedDeviceIds || [])];
const sampledDeviceIds = [...(source.sampledDeviceIds || [])];
const criticalDeviceIds = [...(source.criticalDeviceIds || [])];
if (plannedDeviceIds.length !== 65 || sampledDeviceIds.length !== 56 || criticalDeviceIds.length !== 9) {
  throw new Error("Protected Wetex scope is not the expected 56 normal + 9 critical = 65 items.");
}
if (!plannedDeviceIds.includes("LG.SPP.1") || !plannedDeviceIds.includes("GRD.MFAP.1")) {
  throw new Error("Required Pump Room and MFAP assignments are missing from the frozen scope.");
}

const deviceAssignments = structuredClone(source.deviceAssignments || {});
deviceAssignments["LG.SPP.1"] = assignment("tech2@rmtfire.local", "Tech 2");
deviceAssignments["GRD.MFAP.1"] = assignment("tech@rmtfire.local", "Demo Technician");
const techACount = plannedDeviceIds.filter((id) => deviceAssignments[id]?.technicianId === "tech@rmtfire.local").length;
const techBCount = plannedDeviceIds.filter((id) => deviceAssignments[id]?.technicianId === "tech2@rmtfire.local").length;
if (techACount !== 33 || techBCount !== 32) {
  throw new Error(`Expected Tech A/B split 33/32, received ${techACount}/${techBCount}.`);
}

const now = new Date().toISOString();
const schedule = structuredClone(source);
Object.assign(schedule, {
  scheduleId,
  jobId: `JOB-${scheduleId}`,
  date: "2026-09-24",
  time: "16:45",
  status: "Scheduled",
  technician: "Demo Technician / Tech 2",
  technicians: [
    assignment("tech@rmtfire.local", "Demo Technician"),
    assignment("tech2@rmtfire.local", "Tech 2")
  ],
  deviceAssignments,
  plannedDeviceIds,
  sampledDeviceIds,
  criticalDeviceIds,
  scopeFrozen: true,
  notes: "DEMO/TEST ONLY. Fresh Wetex two-phone retest for Pump Room to MFAP linked indication, voltage alert, evidence, offline/reconnect and ownership validation.",
  testFixture: true,
  activityTimeline: [
    { eventId: `${scheduleId}::JOB_ASSIGNED::tech`, type: "JOB_ASSIGNED", technicianId: "tech@rmtfire.local", technicianName: "Demo Technician", at: now },
    { eventId: `${scheduleId}::JOB_ASSIGNED::tech2`, type: "JOB_ASSIGNED", technicianId: "tech2@rmtfire.local", technicianName: "Tech 2", at: now }
  ],
  createdAt: now,
  updatedAt: now
});

[
  "jobProgress", "criticalWorkflowRuns", "inspectionRecords", "criticalSopRecords",
  "linkedVerifications", "linkedVerificationSideRecords", "reportSubmission",
  "reportStatus", "reportReview", "submittedAt", "submittedBy", "signoff",
  "clientSignature", "clientAcknowledgement", "completedAt", "startedAt",
  "completionStatus", "jobAlerts", "unsyncedDrafts"
].forEach((key) => delete schedule[key]);

const sharedJobCandidates = fs.existsSync(sharedJobsDir)
  ? fs.readdirSync(sharedJobsDir).filter((name) => name.toLowerCase().includes(scheduleId.toLowerCase()))
  : [];
if (sharedJobCandidates.length) {
  throw new Error(`Fresh retest ID already has shared data: ${sharedJobCandidates.join(", ")}`);
}

payload.schedules = [schedule, ...payload.schedules];
payload.savedAt = now;
payload.savedByApp = "RMT Fire Inspection App";
writeAtomic(schedulePath, JSON.stringify(payload, null, 2));

console.log(JSON.stringify({
  scheduleId,
  sourceScheduleId,
  plannedCount: plannedDeviceIds.length,
  normalCount: sampledDeviceIds.length,
  criticalCount: criticalDeviceIds.length,
  techACount,
  techBCount,
  pumpRoomOwner: deviceAssignments["LG.SPP.1"],
  mfapOwner: deviceAssignments["GRD.MFAP.1"],
  plannedDeviceIds,
  cleanSharedRecords: true
}, null, 2));
