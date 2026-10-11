const { existsSync, mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=pump-staged-checklist";
const BASELINE = process.env.PUMP_UI_BASELINE === "1";
const OUTPUT_DIR = path.resolve("outputs/fire-inspection-mvp/technician-ui-qa/pump-staged-checklist");
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function seedPumpFixture(page) {
  await page.evaluate(() => {
    const floor = { id: "qa-pump-l1", floorId: "qa-pump-l1", title: "Pump Room", floorCode: "PR", companyName: "QA PUMP", siteName: "QA PUMP", src: defaultFloorAssets.lv1.src, active: true };
    const pump = { tag: "QA.SPP.1", id: "QA.SPP.1", type: "Sprinkler Panel", location: "Pump Room", floor: floor.title, floorId: floor.id, companyName: "QA PUMP", siteName: "QA PUMP", xPercent: 45, yPercent: 45, status: "Confirmed" };
    const schedule = {
      scheduleId: "QA-PUMP-STAGED-CHECKLIST", jobId: "JOB-QA-PUMP-STAGED-CHECKLIST", status: "In Progress",
      companyName: "QA PUMP", siteName: "QA PUMP", date: new Date().toISOString().slice(0, 10), time: "09:00",
      technician: "Demo Technician", assignedTechnicianId: "tech@rmtfire.local", plannedDeviceIds: [pump.tag], scopeFrozen: true,
      floorId: floor.id, startFloorId: floor.id
    };
    state.currentUser = { name: "Demo Technician", role: "Technician", email: "tech@rmtfire.local", technicianId: "tech@rmtfire.local" };
    state.siteProfile = { companyName: "QA PUMP", siteName: "QA PUMP" };
    state.schedules = [schedule];
    state.activeJob = { scheduleId: schedule.scheduleId, jobId: schedule.jobId, status: "In Progress", schedule };
    state.setupDevices = [pump];
    state.mimicFloors = [floor];
    state.criticalSops = {};
    state.sharedJobRecords = {};
    state.activeTechPreviewScheduleId = schedule.scheduleId;
    state.activeTechSystemKey = "pump-system";
    state.activeTechFloorId = floor.id;
    state.activeCriticalDevice = { ...pump, questions: getChecklistQuestions(pump.type) };
    state.activeCriticalSopId = "sprinkler-hydrant-pump-sop";
    loginView.classList.add("hidden");
    workspace.classList.remove("hidden");
    workspace.classList.add("critical-sop-active");
    checklistForm.classList.add("hidden");
    emptyState.classList.add("hidden");
    applyRoleView();
    renderFloorOptions();
    setTechnicianMapFloor(floor.id, state.siteProfile);
    renderCriticalSop();
    setTechScreen("inspection", { skipDirtyCheck: true, scroll: false });
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const visible = (element) => Boolean(element && element.getClientRects().length && getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden");
    const panel = document.querySelector("#criticalSopPanel");
    const form = document.querySelector("#criticalSopForm");
    const stageShell = document.querySelector(".pump-sop-stage-shell");
    const visibleSteps = [...document.querySelectorAll("#criticalSopForm .sop-step")].filter(visible);
    const visibleControls = [...document.querySelectorAll("#criticalSopForm input, #criticalSopForm select, #criticalSopForm textarea, #criticalSopForm button")].filter((item) => visible(item) && !item.disabled);
    const textInputs = visibleControls.filter((item) => item.matches("textarea, input:not([type]), input[type='text'], input[type='number']"));
    const linked = [...document.querySelectorAll("#criticalSopForm [data-sop-inline-linked-step]")].filter(visible);
    const photos = [...document.querySelectorAll("#criticalSopForm input[type='file']")].filter(visible);
    return {
      documentHeight: Math.round(document.documentElement.scrollHeight),
      panelHeight: Math.round(panel?.getBoundingClientRect().height || 0),
      formHeight: Math.round(form?.getBoundingClientRect().height || 0),
      activeStageHeight: Math.round(stageShell?.querySelector(".pump-sop-stage-content")?.getBoundingClientRect().height || form?.getBoundingClientRect().height || 0),
      totalSopSteps: document.querySelectorAll("#criticalSopForm .sop-step").length,
      visibleSopSteps: visibleSteps.length,
      visibleLargeCards: visibleSteps.filter((item) => item.getBoundingClientRect().height > 120).length,
      visibleControls: visibleControls.length,
      visibleTextInputs: textInputs.length,
      linkedVerificationHeight: Math.round(linked.reduce((sum, item) => sum + item.getBoundingClientRect().height, 0)),
      visiblePhotoInputs: photos.length,
      stageRows: document.querySelectorAll("[data-pump-drawer-stage]").length,
      expandedStages: document.querySelectorAll(".pump-drawer-stage.active").length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
}

(async () => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const executablePath = EDGE_PATHS.find(existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const consoleErrors = [];
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await seedPumpFixture(page);
    const initial = await measure(page);
    const screenshot = path.join(OUTPUT_DIR, BASELINE ? "00-before-long-form.png" : "01-top-and-active-stage.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    if (BASELINE) {
      writeFileSync(path.join(OUTPUT_DIR, "baseline.json"), `${JSON.stringify(initial, null, 2)}\n`);
      console.log(JSON.stringify({ ok: true, mode: "baseline", initial, screenshot, consoleErrors }, null, 2));
      return;
    }

    assert(initial.stageRows === 7, `Expected 7 Pump stages, got ${initial.stageRows}.`);
    assert(initial.expandedStages === 1, `Expected one expanded Pump stage, got ${initial.expandedStages}.`);
    assert(initial.totalSopSteps === 18, `Pump SOP lost a step: ${initial.totalSopSteps}/18.`);
    assert(initial.visibleSopSteps === 2, `Initial stage should expose only steps 1-2, got ${initial.visibleSopSteps}.`);
    assert(initial.overflow <= 1, `Pump checklist has ${initial.overflow}px horizontal overflow.`);
    await page.evaluate(() => setTechSystemDrawerOpen(true));
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01b-stage-drawer-open.png"), fullPage: false });
    await page.evaluate(() => setTechSystemDrawerOpen(false));

    const stageState = await page.evaluate(() => {
      const template = criticalSopTemplates.find((item) => item.id === "sprinkler-hydrant-pump-sop");
      const key = getCriticalSopStorageKey(template.id);
      state.criticalSops[key] = {
        templateId: template.id,
        deviceTag: state.activeCriticalDevice.tag,
        steps: {
          0: { confirmed: true, remark: "Client informed" },
          1: { confirmed: true, photo: "qa-panel-before.jpg", photoEvidence: { evidenceId: "qa-panel-before", originalDataUrl: "data:image/png;base64,AA==" } }
        }
      };
      renderCriticalSop();
      return [...document.querySelectorAll("[data-pump-drawer-stage]")].map((row) => ({ id: row.dataset.pumpDrawerStage, className: row.className, active: row.classList.contains("active"), text: row.textContent.replace(/\s+/g, " ").trim() }));
    });
    assert(stageState[0].className.includes("complete"), `Completed stage did not collapse: ${JSON.stringify(stageState[0])}`);
    assert(stageState[1].active, `Next incomplete stage did not become active: ${JSON.stringify(stageState[1])}`);
    assert(stageState[6].className.includes("locked"), `Final restoration unlocked before prior stages completed: ${JSON.stringify(stageState[6])}`);
    await page.evaluate(() => setTechSystemDrawerOpen(true));
    await page.locator('[data-pump-drawer-stage="pump-restore-complete"]').click();
    const lockedMessage = await page.locator("#syncState").textContent();
    assert(lockedMessage.includes("is locked"), `Locked stage did not explain its prerequisite: ${lockedMessage}`);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "02-completed-stage-collapsed.png"), fullPage: true });

    await page.evaluate(() => setTechSystemDrawerOpen(true));
    await page.locator('[data-pump-drawer-stage="pump-preparation-panel"]').click();
    const reopened = await measure(page);
    assert(reopened.visibleSopSteps === 2 && reopened.expandedStages === 1, "Completed Pump stage could not be reopened.");

    const faultStage = await page.evaluate(() => {
      const template = criticalSopTemplates.find((item) => item.id === "sprinkler-hydrant-pump-sop");
      const key = getCriticalSopStorageKey(template.id);
      const record = state.criticalSops[key];
      record.steps = {
        ...record.steps,
        2: { choice: "Sufficient", fieldValues: { tankType: "RCC / Concrete Tank", capacityMethod: "Calculate from dimensions", tankLengthFt: "10", tankWidthFt: "8", tankHeightFt: "6" } },
        3: { confirmed: true, choice: "Fully Open", remark: "Valves confirmed open", photo: "qa-valves.jpg", photoEvidence: { evidenceId: "qa-valves", originalDataUrl: "data:image/png;base64,AA==" }, recordedBy: "Demo Technician" },
        4: { fieldValues: { phaseRy: "415", phaseYb: "415", phaseBr: "415" } },
        5: { choice: "Fail", remark: "Pilot lamp not operating", photo: "qa-pilot-fault.jpg", photoEvidence: { evidenceId: "qa-pilot-fault", originalDataUrl: "data:image/png;base64,AA==" } },
        6: {},
        7: { choice: "Electrical" }
      };
      state.pumpSopStageSelection = { [key]: "pump-water-electrical" };
      renderCriticalSop();
      return {
        rows: [...document.querySelectorAll("[data-pump-drawer-stage]")].map((row) => row.textContent.replace(/\s+/g, " ").trim()),
        collapsedChecks: document.querySelectorAll(".pump-sop-step-collapsed").length
      };
    });
    assert(faultStage.rows[1].includes("1 fault"), `Fault stage summary is missing: ${JSON.stringify(faultStage.rows)}`);
    assert(faultStage.collapsedChecks >= 4, `Completed checks did not collapse inside the Pump stage: ${JSON.stringify(faultStage)}`);
    const faultDisclosure = await page.evaluate(() => ({
      faultRemarkVisible: Boolean(document.querySelector('input[name="sop-remark-5"]')?.getClientRects().length),
      faultPhotoVisible: Boolean(document.querySelector('input[name="sop-photo-5"]')?.getClientRects().length),
      finalStageLocked: document.querySelector('[data-pump-drawer-stage="pump-restore-complete"]')?.classList.contains("locked")
    }));
    assert(faultDisclosure.faultRemarkVisible && faultDisclosure.faultPhotoVisible, `FAULT review did not reveal its required details: ${JSON.stringify(faultDisclosure)}`);
    assert(faultDisclosure.finalStageLocked, "An unsafe Pump result must keep later stages locked.");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "03-fault-expanded.png"), fullPage: true });

    const finalRestore = await page.evaluate(() => {
      const template = criticalSopTemplates.find((item) => item.id === "sprinkler-hydrant-pump-sop");
      const key = getCriticalSopStorageKey(template.id);
      const record = state.criticalSops[key];
      record.steps[5] = { choice: "Pass" };
      record.steps[8] = { choice: "Pass" };
      record.steps[9] = { choice: "Pass" };
      record.steps[10] = { fieldValues: { manualResult: "Pass" } };
      record.steps[11] = { choice: "Pass", fieldValues: { cutInPsi: "80", cutOutPsi: "120" } };
      record.steps[12] = { choice: "Pass", fieldValues: { cutInPsi: "75" } };
      record.steps[13] = { choice: "Pass", fieldValues: { cutInPsi: "70" } };
      record.steps[14] = { confirmed: true, choice: "Pass" };
      delete state.pumpSopStageSelection[key];
      renderCriticalSop();
      const stages = getPumpSopStageStates(template, record, state.activeCriticalDevice);
      return {
        activeStage: document.querySelector("#criticalSopForm")?.dataset.activePumpStage,
        stages: stages.map((stage) => ({
          id: stage.id,
          complete: stage.complete,
          accessible: stage.accessible,
          steps: stage.stepStates.map((item) => ({ index: item.index, complete: item.complete, missing: getMissingSopRequirements(item.step, item.stepState, template, item.index, record) }))
        })),
        finalVisibleSteps: [...document.querySelectorAll('.sop-step:not(.pump-sop-step-hidden)')].map((step) => step.querySelector("legend")?.textContent)
      };
    });
    assert(finalRestore.activeStage === "pump-restore-complete", `Final restoration did not become the active stage: ${JSON.stringify(finalRestore)}`);
    assert(finalRestore.finalVisibleSteps.length === 3, `Final restoration must show its three existing checks: ${JSON.stringify(finalRestore)}`);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "04-final-restore.png"), fullPage: true });

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: path.join(OUTPUT_DIR, "05-tablet-portrait.png"), fullPage: false });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.screenshot({ path: path.join(OUTPUT_DIR, "06-tablet-landscape.png"), fullPage: false });
    const tabletOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(tabletOverflow <= 1, `Tablet Pump checklist has ${tabletOverflow}px horizontal overflow.`);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(async () => {
      clearTechnicianInspectionDirty();
      await focusTechnicianSystemMimic("QA-PUMP-STAGED-CHECKLIST", "pump-system", { scroll: false, skipDirtyCheck: true });
    });
    assert(await page.locator("#mapStage").isVisible(), "Drawing did not become visible from the Pump checklist.");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "07-checklist-to-drawing.png"), fullPage: false });
    await page.evaluate(async () => selectDevice("QA.SPP.1", { skipDirtyCheck: true, scrollIntoView: false }));
    assert(await page.locator("#criticalSopForm .pump-sop-stage-shell").isVisible(), "Pump pin did not return to the staged checklist.");
    await page.screenshot({ path: path.join(OUTPUT_DIR, "08-drawing-to-checklist.png"), fullPage: false });

    const conditional = await page.evaluate(() => {
      const template = criticalSopTemplates.find((item) => item.id === "sprinkler-hydrant-pump-sop");
      const pilot = template.steps[5];
      return {
        passRemark: sopStepShowsRemark(pilot, { choice: "Pass" }),
        failRemark: sopStepShowsRemark(pilot, { choice: "Fail" }),
        passPhoto: sopStepRequiresPhoto(pilot, { choice: "Pass" }),
        failPhoto: sopStepRequiresPhoto(pilot, { choice: "Fail" })
      };
    });
    assert(!conditional.passRemark && conditional.failRemark, `Pilot-lamp fault remark disclosure is wrong: ${JSON.stringify(conditional)}`);
    assert(!conditional.passPhoto && conditional.failPhoto, `Pilot-lamp fault photo disclosure is wrong: ${JSON.stringify(conditional)}`);

    const finalState = await page.evaluate(() => {
      const finalRow = document.querySelector('[data-pump-drawer-stage="pump-restore-complete"]');
      return { className: finalRow?.className || "", disabled: finalRow?.disabled, text: finalRow?.textContent.replace(/\s+/g, " ").trim() || "" };
    });
    assert(finalState.className.includes("active") && !finalState.disabled, `Final restoration should be active only after prior stages complete: ${JSON.stringify(finalState)}`);
    assert(consoleErrors.length === 0, `Console errors: ${consoleErrors.join(" | ")}`);
    console.log(JSON.stringify({ ok: true, mode: "staged", initial, stageState, reopened, faultStage, faultDisclosure, finalRestore, conditional, finalState, tabletOverflow, screenshot, consoleErrors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
