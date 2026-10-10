const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scheduleId = "DEMO-WETEX-MULTITECH-SYNC-202609";
const schedulePayload = JSON.parse(fs.readFileSync(path.join(root, "outputs", "rmt-fire-local-data", "schedules", "service-schedules.json"), "utf8"));
const schedule = schedulePayload.schedules.find((item) => item.scheduleId === scheduleId);
assert(schedule, "Wetex physical-test schedule exists in the runtime schedule store");
assert.strictEqual(schedule.status, "Scheduled");
assert.strictEqual(schedule.scopeFrozen, true);
assert.strictEqual(schedule.mimicViewMode, "original", "Wetex physical test opens original Wetex backgrounds");
assert.strictEqual(schedule.contractFrequencyPercent, 10);
assert.strictEqual(schedule.sampledDeviceIds.length, 56);
assert.strictEqual(schedule.criticalDeviceIds.length, 9);
assert.strictEqual(schedule.mandatoryRecheckDeviceIds.length, 0);
assert.strictEqual(schedule.plannedDeviceIds.length, 65);
assert.strictEqual(new Set(schedule.plannedDeviceIds).size, 65);
assert.strictEqual(Object.keys(schedule.deviceAssignments || {}).length, 65);
const a = Object.values(schedule.deviceAssignments).filter((item) => item.technicianId === "tech@rmtfire.local").length;
const b = Object.values(schedule.deviceAssignments).filter((item) => item.technicianId === "tech2@rmtfire.local").length;
assert.strictEqual(a, 33);
assert.strictEqual(b, 32);
const library = JSON.parse(fs.readFileSync(path.join(root, "outputs", "rmt-fire-local-data", "mimic-library", "mimic-library-app-data.json"), "utf8"));
const wetex = library.floors.filter((floor) => floor.companyName === "WETEX" && floor.siteName === "WETEX");
assert.strictEqual(wetex.length, 11);
wetex.forEach((floor) => assert(floor.originalSrc && floor.originalSrc.includes("/WETEX/floors/"), `${floor.id} resolves only to an original Wetex source`));

async function verifyLiveServer() {
  const api = "http://127.0.0.1:8026";
  const schedules = await fetch(`${api}/api/schedules`).then((response) => response.json());
  const live = schedules.schedules.find((item) => item.scheduleId === scheduleId);
  assert(live, "runtime schedule API returns the Wetex physical-test job");
  assert.deepStrictEqual(live.plannedDeviceIds, schedule.plannedDeviceIds, "runtime API preserves frozen planned IDs");
  const wrongNormal = await fetch(`${api}/api/jobs/${scheduleId}/inspection-records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision: 0, record: { deviceId: "L9.EL.21", technicianId: "tech2@rmtfire.local", technicianName: "Tech 2", status: "pass" } })
  });
  assert.strictEqual(wrongNormal.status, 403, "server rejects a normal device saved by its non-assigned technician");
  const wrongCritical = await fetch(`${api}/api/jobs/${scheduleId}/critical-sop-records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision: 0, record: { deviceId: "LG.CO2.3", parentDeviceId: "LG.CO2.3", technicianId: "tech2@rmtfire.local", technicianName: "Tech 2", status: "pass" } })
  });
  assert.strictEqual(wrongCritical.status, 403, "server rejects a critical SOP saved by its non-assigned technician");
}

verifyLiveServer().then(() => {
  console.log(`PASS ${scheduleId}: 56 normal + 9 critical = 65 frozen items; assignments A=${a}, B=${b}; 11 original Wetex floors available; live ownership guards enforced.`);
}).catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
