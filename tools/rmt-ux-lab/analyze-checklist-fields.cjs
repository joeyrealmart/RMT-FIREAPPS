const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(__dirname, "../..");
const output = path.join(root, "outputs", "rmt-ux-lab", "checklist-friction.json");
const edge = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);

function pushField(fields, template, step, index, field, classification, reason) {
  fields.push({ templateId: template.id, templateTitle: template.title, step: index + 1, stepTitle: step.title, field, classification, reason });
}

(async () => {
  const browser = await chromium.launch(edge ? { executablePath: edge, headless: true } : { headless: true });
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:8026/?fresh=checklist-analysis", { waitUntil: "networkidle" });
    const templates = await page.evaluate(() => criticalSopTemplates.map((template) => ({ id: template.id, title: template.title, steps: template.steps })));
    const fields = [];
    for (const template of templates) {
      template.steps.forEach((step, index) => {
        if (!step.noConfirm) pushField(fields, template, step, index, "confirmation", "REQUIRED", "Configured ordered SOP confirmation.");
        if (step.requiresChoice) pushField(fields, template, step, index, "choice", step.autoResultFromLinkedVerifications ? "AUTO_FILL" : "REQUIRED", step.autoResultFromLinkedVerifications ? "Uses authoritative linked-verification result." : "Configured technician result.");
        if (step.requiresReading) pushField(fields, template, step, index, "reading", "REQUIRED", "Configured measured or descriptive reading.");
        if (step.requiresPhoto) pushField(fields, template, step, index, "photo", "REQUIRED", "Configured evidence requirement.");
        if (step.requiresRemark) pushField(fields, template, step, index, "remark", "REQUIRED", "Configured explanation or confirmation detail.");
        if (step.optionalRemark) pushField(fields, template, step, index, "remark", "OPTIONAL", "Explicitly configured optional remark.");
        if (step.requiresSupervisor) pushField(fields, template, step, index, "supervisor", "REQUIRED", "Existing approved configuration requires a witness/supervisor.");
        if (step.captureTechnician) pushField(fields, template, step, index, "recordedBy", "AUTO_FILL", "Logged-in technician identity is already authoritative.");
        if (step.usesStandbyConfiguration) pushField(fields, template, step, index, "standbyConfiguration", "AUTO_FILL", "Reuse the saved job/system standby type.");
      });
    }
    const sharedContext = ["technicianName", "technicianId", "accountIdentity", "client", "site", "jobId", "scheduleId", "systemId", "deviceId", "floor", "location", "timestamp"].map((field) => ({ field, classification: "AUTO_FILL", reason: "Already known from authenticated session, frozen job, selected device, or system context." }));
    const derived = ["plannedCount", "completedCount", "pendingCount", "passCount", "faultCount", "syncState", "revision", "linkedVerificationFinalState"].map((field) => ({ field, classification: "DERIVED", reason: "Calculate from authoritative shared records; never ask the technician to type it." }));
    const standardInspection = [
      { field: "PASS/FAULT", classification: "REQUIRED", reason: "Primary technician result." },
      { field: "photoEvidence", classification: "OPTIONAL", reason: "Available for PASS; required by current FAULT validation." },
      { field: "defectNotes", classification: "OPTIONAL", reason: "Optional for PASS; required by current FAULT validation." },
      { field: "correctiveAction", classification: "OPTIONAL", reason: "Retain when action is relevant; do not block ordinary PASS." }
    ];
    const removeCandidates = [
      { field: "manualTechnicianName", classification: "REMOVE_CANDIDATE", reason: "Do not duplicate authenticated technician identity in technician forms." },
      { field: "manualTechnicianId", classification: "REMOVE_CANDIDATE", reason: "Do not duplicate authenticated account/staff identifier." },
      { field: "manualJobClientSiteDeviceContext", classification: "REMOVE_CANDIDATE", reason: "Use frozen job and selected-device context." }
    ];
    const counts = [...fields, ...sharedContext, ...derived, ...standardInspection, ...removeCandidates].reduce((map, item) => ({ ...map, [item.classification]: (map[item.classification] || 0) + 1 }), {});
    const payload = { generatedAt: new Date().toISOString(), source: "current browser-loaded criticalSopTemplates plus standard inspection/context fields", policy: "No technical requirement inferred or removed automatically.", counts, sharedContext, derived, standardInspection, removeCandidates, sopFields: fields };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(JSON.stringify({ ok: true, templates: templates.length, sopFields: fields.length, counts, output }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
