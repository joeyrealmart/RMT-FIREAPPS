const { existsSync, rmSync } = require("node:fs");
const path = require("node:path");

const BASE_URL = process.env.APP_URL || "http://127.0.0.1:8026";
const DATA_ROOT = path.resolve("outputs/rmt-fire-local-data");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "file";
}

async function request(urlPath, body) {
  const response = await fetch(`${BASE_URL}${urlPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: response.status, payload: await response.json() };
}

(async () => {
  const scheduleId = `QA-V1-CRITICAL-${Date.now()}`;
  const jobFile = path.join(DATA_ROOT, "shared-records", "jobs", `${slugify(scheduleId)}.json`);
  const schedule = {
    scheduleId,
    jobId: `JOB-${scheduleId}`,
    status: "In Progress",
    companyName: "QA",
    siteName: "QA",
    plannedDeviceIds: ["QA.PUMP.1"],
    scopeFrozen: true,
    deviceAssignments: {
      "QA.PUMP.1": { technicianId: "tech@rmtfire.local", technicianName: "Demo Technician" }
    }
  };
  const snapshot = {
    id: "sprinkler-hydrant-pump-sop",
    title: "QA Pump SOP",
    requiresBeforeAfterPhotos: false,
    steps: Array.from({ length: 18 }, (_, index) => ({
      index,
      title: `Step ${index + 1}`,
      noConfirm: false,
      requiresChoice: index === 2,
      choices: index === 2 ? ["Sufficient", "Insufficient"] : []
    }))
  };
  const steps = Object.fromEntries(snapshot.steps.map((step, index) => [index, {
    confirmed: true,
    choice: index === 2 ? "Insufficient" : ""
  }]));
  const record = {
    recordId: "spoofed-record-id",
    scheduleId,
    templateId: snapshot.id,
    templateSnapshot: snapshot,
    parentDeviceId: "QA.PUMP.1",
    deviceId: "QA.PUMP.1",
    deviceTag: "QA.PUMP.1",
    technicianId: "tech@rmtfire.local",
    technicianName: "Demo Technician",
    status: "pass",
    steps,
    evidenceRefs: []
  };

  try {
    const unsafe = await request(`/api/jobs/${encodeURIComponent(scheduleId)}/critical-sop-records`, {
      schedule,
      expectedRevision: 0,
      record
    });
    assert(unsafe.status === 422, `Unsafe critical completion must return 422, got ${unsafe.status}`);
    assert(unsafe.payload.unsafe === true, "Unsafe critical completion must identify the unsafe state");

    const wrongOwner = await request(`/api/jobs/${encodeURIComponent(scheduleId)}/critical-sop-records`, {
      schedule,
      expectedRevision: 0,
      record: { ...record, technicianId: "tech2@rmtfire.local", technicianName: "Technician 2" }
    });
    assert(wrongOwner.status === 403, `Wrong-owner critical save must return 403, got ${wrongOwner.status}`);

    const partial = await request(`/api/jobs/${encodeURIComponent(scheduleId)}/critical-sop-records`, {
      schedule,
      expectedRevision: 0,
      record: { ...record, status: "partial", steps: { 0: { confirmed: true } } }
    });
    assert(partial.status === 200, `Incomplete critical draft should remain saveable, got ${partial.status}`);
    assert(partial.payload.record.status === "partial", "Server must derive incomplete critical status as partial");
    assert(partial.payload.record.recordId !== "spoofed-record-id", "Server must replace a spoofed critical record ID");

    console.log(JSON.stringify({
      ok: true,
      scheduleId,
      unsafeStatus: unsafe.status,
      wrongOwnerStatus: wrongOwner.status,
      partialStatus: partial.payload.record.status,
      canonicalRecordId: partial.payload.record.recordId
    }, null, 2));
  } finally {
    if (existsSync(jobFile)) rmSync(jobFile, { force: true });
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
