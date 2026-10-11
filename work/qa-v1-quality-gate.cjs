const { existsSync, mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=v1-quality-gate";
const OUTPUT_DIR = path.resolve("docs/reviews/v1-quality-gate");
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function record(checks, name, passed, details = null) {
  checks.push({ name, passed: Boolean(passed), details });
}

async function seedNormalInspection(page, id, deviceType = "Smoke Detector") {
  await page.evaluate(async ({ deviceId, deviceType }) => {
    const floor = { id: "qa-quality-floor", floorId: "qa-quality-floor", title: "QA Floor", floorCode: "QA", companyName: "QA", siteName: "QA", src: defaultFloorAssets.lv1.src, active: true };
    const device = { id: deviceId, tag: deviceId, type: deviceType, location: "QA Corridor", floor: floor.title, floorId: floor.id, companyName: "QA", siteName: "QA", xPercent: 50, yPercent: 50, questions: getChecklistQuestions(deviceType) };
    const schedule = { scheduleId: "QA-V1-QUALITY-GATE", jobId: "JOB-QA-V1-QUALITY-GATE", status: "In Progress", companyName: "QA", siteName: "QA", technician: "Demo Technician", assignedTechnicianId: "tech@rmtfire.local", plannedDeviceIds: [deviceId], scopeFrozen: true, floorId: floor.id, startFloorId: floor.id };
    const technicianUser = { name: "Demo Technician", role: "Technician", email: "tech@rmtfire.local", technicianId: "tech@rmtfire.local" };
    state.currentUser = technicianUser;
    state.siteProfile = { companyName: "QA", siteName: "QA" };
    state.schedules = [schedule];
    state.activeJob = { scheduleId: schedule.scheduleId, jobId: schedule.jobId, status: "In Progress", schedule };
    state.setupDevices = [device];
    state.mimicFloors = [floor];
    state.inspections = {};
    state.history = {};
    state.sharedJobRecords = {};
    state.activeTechPreviewScheduleId = schedule.scheduleId;
    state.activeTechSystemKey = "fire-alarm";
    state.activeTechFloorId = floor.id;
    state.selectedId = null;
    clearTechnicianInspectionDirty();
    delete checklistForm.dataset.saving;
    delete checklistForm.dataset.manualFault;
    delete checklistForm.dataset.questionFault;
    workspace.classList.remove("tech-fault-entry-active", "tech-remarks-entry-active", "critical-sop-active");
    loginView.classList.add("hidden");
    workspace.classList.remove("hidden");
    applyRoleView();
    renderFloorOptions();
    setTechnicianMapFloor(floor.id, state.siteProfile);
    state.currentUser = { ...technicianUser, role: "Admin" };
    await selectDevice(deviceId, { skipDirtyCheck: true, scrollIntoView: false });
    state.currentUser = technicianUser;
    applyRoleView();
    setTechScreen("inspection", { scroll: false, renderMarkers: false });
    checklistForm.classList.remove("hidden");
  }, { deviceId: id, deviceType });
}

(async () => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const executablePath = EDGE_PATHS.find(existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.route("**/api/jobs/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, record: { revision: 1 }, progress: { ready: false } })
  }));
  const consoleErrors = [];
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
  const checks = [];
  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await seedNormalInspection(page, "QA.SD.QUALITY.1");
    const normalInitial = await page.evaluate(() => ({
      questionCount: document.querySelectorAll("#questionList .question").length,
      selectedCount: document.querySelectorAll("#questionList input[type='radio']:checked").length,
      addRemarksVisible: Boolean(document.querySelector("#toggleInspectionRemarksBtn")?.getClientRects().length)
    }));
    record(checks, "normal checklist requires explicit answers", normalInitial.questionCount > 0 && normalInitial.selectedCount === 0, normalInitial);
    record(checks, "normal checklist exposes Add Remarks", normalInitial.addRemarksVisible, normalInitial);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01-device-checklist-current.png"), fullPage: true });

    const normalException = await page.evaluate(async () => {
      document.querySelectorAll('#questionList input[value="N/A"]').forEach((input) => { input.checked = true; });
      document.querySelector('#questionList input[value="N/A"]')?.dispatchEvent(new Event("change", { bubbles: true }));
      const before = Boolean(state.inspections[state.selectedId]);
      await saveInspection(null, { openNextAssignedItem: false });
      return {
        before,
        saved: state.inspections["QA.SD.QUALITY.1"] || null,
        message: document.querySelector("#syncState")?.textContent || "",
        remarksExpanded: workspace.classList.contains("tech-remarks-entry-active")
      };
    });
    record(checks, "unjustified N/A is blocked", !normalException.saved && /remark|explanation|justif/i.test(normalException.message), normalException);

    await seedNormalInspection(page, "QA.SD.QUALITY.PASS");
    const normalPass = await page.evaluate(async () => {
      document.querySelectorAll('#questionList input[value="Pass"]').forEach((input) => { input.checked = true; });
      document.querySelector("#toggleInspectionRemarksBtn")?.click();
      document.querySelector("#notes").value = "Optional QA observation";
      document.querySelector("#actionTaken").value = "No corrective action required";
      await saveInspection(null, { openNextAssignedItem: false });
      const saved = state.inspections["QA.SD.QUALITY.PASS"];
      await selectDevice("QA.SD.QUALITY.PASS", { skipDirtyCheck: true, scrollIntoView: false });
      return {
        status: saved?.status,
        note: saved?.notes,
        action: saved?.action,
        reopenedAction: document.querySelector("#actionTaken")?.value
      };
    });
    record(checks, "explicit PASS saves and optional remarks persist", normalPass.status === "pass" && normalPass.note && normalPass.action === normalPass.reopenedAction, normalPass);

    await seedNormalInspection(page, "QA.SD.QUALITY.FAIL");
    const normalFault = await page.evaluate(async () => {
      document.querySelectorAll('#questionList input[value="Pass"]').forEach((input) => { input.checked = true; });
      await saveInspection("fail", { openNextAssignedItem: false });
      const contradictorySaved = Boolean(state.inspections["QA.SD.QUALITY.FAIL"]);
      const firstFail = document.querySelector('#questionList input[value="Fail"]');
      firstFail.checked = true;
      firstFail.dispatchEvent(new Event("change", { bubbles: true }));
      document.querySelector("#notes").value = "Detector failed functional test";
      pendingInspectionPhotoEvidence.before = {
        evidenceId: "qa-normal-fault-photo",
        originalFileName: "qa-normal-fault.jpg",
        originalDataUrl: "data:image/png;base64,AA==",
        stampedDataUrl: "data:image/png;base64,AA=="
      };
      await saveInspection("fail", { openNextAssignedItem: false });
      return {
        contradictorySaved,
        savedStatus: state.inspections["QA.SD.QUALITY.FAIL"]?.status,
        message: document.querySelector("#syncState")?.textContent || ""
      };
    });
    record(checks, "FAULT cannot be saved with an all-PASS checklist", !normalFault.contradictorySaved, normalFault);
    record(checks, "explicit FAULT remains FAULT", normalFault.savedStatus === "fail", normalFault);

    const normalRenderedMatrix = [];
    const normalTypes = [
      "Manual Call Point",
      "Smoke Detector",
      "Heat Detector",
      "Beam Detector",
      "Bell / Sounder",
      "Hose Reel",
      "Emergency Light",
      "Exit Sign",
      "Fire Door",
      "Fireman Intercom",
      "Flow Switch",
      "Other"
    ];
    for (let typeIndex = 0; typeIndex < normalTypes.length; typeIndex += 1) {
      const deviceType = normalTypes[typeIndex];
      const safeType = deviceType.replace(/[^a-z0-9]+/gi, "-").toUpperCase();
      const passId = `QA.${safeType}.PASS`;
      await seedNormalInspection(page, passId, deviceType);
      const passResult = await page.evaluate(async (deviceId) => {
        const initial = {
          questionCount: document.querySelectorAll("#questionList .question").length,
          addRemarksVisible: Boolean(document.querySelector("#toggleInspectionRemarksBtn")?.getClientRects().length),
          selectedCount: document.querySelectorAll("#questionList input:checked").length
        };
        document.querySelectorAll('#questionList input[value="Pass"]').forEach((input) => input.click());
        await saveInspection(null, { openNextAssignedItem: false });
        const saved = state.inspections[deviceId];
        await selectDevice(deviceId, { skipDirtyCheck: true, scrollIntoView: false });
        return {
          ...initial,
          status: saved?.status || "",
          notes: saved?.notes || "",
          reopenedStatus: state.inspections[deviceId]?.status || ""
        };
      }, passId);

      const faultId = `QA.${safeType}.FAULT`;
      await seedNormalInspection(page, faultId, deviceType);
      const faultResult = await page.evaluate(async (deviceId) => {
        document.querySelectorAll('#questionList input[value="Pass"]').forEach((input) => input.click());
        const firstFault = document.querySelector('#questionList input[value="Fail"]');
        firstFault?.click();
        const autoOpened = workspace.classList.contains("tech-fault-entry-active")
          && Boolean(document.querySelector("#notes")?.getClientRects().length);
        document.querySelector("#notes").value = "QA rendered fault";
        pendingInspectionPhotoEvidence.before = {
          evidenceId: `qa-${deviceId}-photo`,
          originalDataUrl: "data:image/png;base64,AA=="
        };
        await saveInspection("fail", { openNextAssignedItem: false });
        const saved = state.inspections[deviceId];
        await selectDevice(deviceId, { skipDirtyCheck: true, scrollIntoView: false });
        return {
          autoOpened,
          status: saved?.status || "",
          note: saved?.notes || "",
          reopenedStatus: state.inspections[deviceId]?.status || ""
        };
      }, faultId);

      const naId = `QA.${safeType}.NA`;
      await seedNormalInspection(page, naId, deviceType);
      const naResult = await page.evaluate(async (deviceId) => {
        document.querySelectorAll('#questionList input[value="Pass"]').forEach((input) => input.click());
        document.querySelector('#questionList input[value="N/A"]')?.click();
        const autoOpened = workspace.classList.contains("tech-remarks-entry-active")
          && Boolean(document.querySelector("#notes")?.getClientRects().length);
        document.querySelector("#notes").value = "QA N/A justification";
        await saveInspection(null, { openNextAssignedItem: false });
        const saved = state.inspections[deviceId];
        await selectDevice(deviceId, { skipDirtyCheck: true, scrollIntoView: false });
        return {
          autoOpened,
          status: saved?.status || "",
          note: saved?.notes || "",
          reopenedStatus: state.inspections[deviceId]?.status || ""
        };
      }, naId);

      normalRenderedMatrix.push({
        system: deviceType,
        checklist: "Normal device inspection",
        questionCount: passResult.questionCount,
        addRemarksVisible: passResult.addRemarksVisible,
        passWithoutRemark: passResult.status === "pass" && !passResult.notes,
        faultAutoOpensRemark: faultResult.autoOpened,
        faultRequiresCorrectData: faultResult.status === "fail" && Boolean(faultResult.note),
        naHandledCorrectly: naResult.autoOpened && naResult.status === "n/a" && Boolean(naResult.note),
        saveAndReopen: passResult.reopenedStatus === "pass" && faultResult.reopenedStatus === "fail" && naResult.reopenedStatus === "n/a",
        saveAndNext: "covered by qa-tech-save-next.cjs",
        criticalControlPreserved: "not applicable"
      });
    }
    record(checks, "all rendered normal checklist families pass integrity matrix", normalRenderedMatrix.every((item) => (
      item.questionCount > 0
      && item.addRemarksVisible
      && item.passWithoutRemark
      && item.faultAutoOpensRemark
      && item.faultRequiresCorrectData
      && item.naHandledCorrectly
      && item.saveAndReopen
    )), normalRenderedMatrix);

    const critical = await page.evaluate(() => {
      const template = criticalSopTemplates.find((item) => item.id === "sprinkler-hydrant-pump-sop");
      const unsafe = {
        insufficient: sopStepHasFault(template.steps[2], { choice: "Insufficient", fieldValues: {} }),
        structuredFail: sopStepHasFault(template.steps[10], { fieldValues: { manualResult: "Fail" } }),
        linkedFail: sopStepHasFault(template.steps[8], { choice: "Fail", autoResult: { overall: "FAIL" } })
      };
      return {
        helperExists: typeof sopStepShowsRemark === "function",
        passShowsRemark: typeof sopStepShowsRemark === "function" ? sopStepShowsRemark(template.steps[5], { choice: "Pass" }) : false,
        failShowsRemark: typeof sopStepShowsRemark === "function" ? sopStepShowsRemark(template.steps[5], { choice: "Fail" }) : false,
        unsafe
      };
    });
    record(checks, "critical remark helper exists", critical.helperExists, critical);
    record(checks, "critical PASS keeps optional remarks collapsed", !critical.passShowsRemark, critical);
    record(checks, "critical FAULT auto-shows remarks", critical.failShowsRemark, critical);
    record(checks, "structured unsafe states are detected", Object.values(critical.unsafe).every(Boolean), critical.unsafe);

    const renderedMatrix = [];
    const renderedCases = [
      ["fire-alarm-tripping-sop", "QA.MFAP.1", "Main Fire Alarm Panel", "02-mfap-checklist-current.png"],
      ["hose-reel-pump-sop", "QA.HRP.1", "Hose Reel Pump", "03-hose-reel-pump-checklist-current.png"],
      ["sprinkler-hydrant-pump-sop", "QA.SPP.1", "Sprinkler Panel", "04-pump-checklist-current.png"],
      ["gas-discharge-sop", "QA.CO2.1", "CO2 System", "05-gas-checklist-current.png"],
      ["wet-chemical-sop", "QA.WC.1", "Wet Chemical System", "06-wet-chemical-checklist-current.png"]
    ];
    for (const [templateId, deviceId, deviceType, screenshotName] of renderedCases) {
      const rendered = await page.evaluate(({ templateId, deviceId, deviceType }) => {
        const template = criticalSopTemplates.find((item) => item.id === templateId);
        state.activeCriticalSopId = template.id;
        state.activeCriticalDevice = { id: deviceId, tag: deviceId, type: deviceType, floor: "QA Floor", location: "QA Location" };
        state.criticalSops = {};
        workspace.classList.add("critical-sop-active");
        renderCriticalSop();
        return {
          templateId,
          stepCount: document.querySelectorAll("#criticalSopForm .sop-step").length,
          remarkControls: document.querySelectorAll("#criticalSopForm [data-sop-remark-toggle], #criticalSopForm [data-sop-remark-field]").length,
          demoPhotoButtons: document.querySelectorAll("#criticalSopForm .sop-demo-photo").length,
          stageRows: document.querySelectorAll("#criticalSopForm [data-pump-drawer-stage]").length
        };
      }, { templateId, deviceId, deviceType });
      renderedMatrix.push(rendered);
      await page.screenshot({ path: path.join(OUTPUT_DIR, screenshotName), fullPage: true });
    }
    record(checks, "every rendered critical step has one remark control", renderedMatrix.every((item) => item.remarkControls === item.stepCount), renderedMatrix);
    record(checks, "production critical SOP has no demo-photo controls", renderedMatrix.every((item) => item.demoPhotoButtons === 0), renderedMatrix);
    writeFileSync(path.join(OUTPUT_DIR, "rendered-checklist-coverage.json"), `${JSON.stringify({ normal: normalRenderedMatrix, critical: renderedMatrix }, null, 2)}\n`);
    record(checks, "no browser console errors", consoleErrors.length === 0, consoleErrors);
  } finally {
    await browser.close();
  }

  const result = { ok: checks.every((item) => item.passed), checks, consoleErrors };
  const resultPath = path.join(OUTPUT_DIR, "result.json");
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ ...result, resultPath }, null, 2));
  if (!result.ok) process.exit(1);
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
