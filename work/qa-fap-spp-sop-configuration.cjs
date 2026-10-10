const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260916-fap-spp-sop";
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function definition(id, verificationType) {
  return {
    linkedVerificationId: id,
    verificationType,
    title: verificationType === "FIRE_PUMP_INDICATION" ? "Pump indication" : "CO2 indication",
    requiredSides: [{ sideId: "A" }, { sideId: "B" }]
  };
}

(async () => {
  const executablePath = EDGE_PATHS.find(existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage();
  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    const result = await page.evaluate(() => {
      const schedule = { scheduleId: "QA-FAP-SPP-SOP", linkedVerifications: [
        {
          linkedVerificationId: "QA-PUMP", verificationType: "FIRE_PUMP_INDICATION", title: "Pump indication",
          requiredSides: [{ sideId: "A" }, { sideId: "B" }]
        },
        {
          linkedVerificationId: "QA-CO2", verificationType: "CO2_GAS_RELEASE_INDICATION", title: "CO2 indication",
          requiredSides: [{ sideId: "A" }, { sideId: "B" }]
        }
      ] };
      const record = (verificationId, sideId, result) => ({ linkedVerificationId: verificationId, sideId, status: "COMPLETE", result });
      state.schedules = [schedule];
      state.activeJob = { scheduleId: schedule.scheduleId, schedule };
      state.sharedJobRecords[schedule.scheduleId] = {
        store: {
          linkedVerificationDefinitions: Object.fromEntries(schedule.linkedVerifications.map((item) => [item.linkedVerificationId, item])),
          linkedVerificationSideRecords: {
            p1: record("QA-PUMP", "A", "CONFIRMED"), p2: record("QA-PUMP", "B", "CONFIRMED"),
            c1: record("QA-CO2", "A", "CONFIRMED"), c2: record("QA-CO2", "B", "CONFIRMED")
          },
          linkedVerificationConflicts: {}
        }
      };
      const fap = criticalSopTemplates.find((template) => template.id === "fire-alarm-tripping-sop");
      const spp = criticalSopTemplates.find((template) => template.id === "sprinkler-hydrant-pump-sop");
      const pass = getSopLinkedVerificationAutoState(fap.steps[7], schedule);
      state.currentUser = { name: "QA Technician", role: "Technician", email: "qa@example.test" };
      const technicianState = getSopStepDomState(spp.steps[2], 2, spp.id);
      const savedStandby = getSavedSopStandbyConfiguration(spp, { steps: { 7: { choice: "Diesel Engine" } } });
      state.sharedJobRecords[schedule.scheduleId].store.linkedVerificationSideRecords.c2.result = "NOT_CONFIRMED";
      const fail = getSopLinkedVerificationAutoState(fap.steps[7], schedule);
      return {
        pass,
        fail,
        technicianState,
        savedStandby,
        fapBattery: fap.steps[5],
        sppSteps: spp.steps.map((step) => ({ title: step.title, choices: step.choices || [], fields: step.fields || [], requiresChoice: Boolean(step.requiresChoice), requiresSupervisor: Boolean(step.requiresSupervisor), captureTechnician: Boolean(step.captureTechnician), optionalRemark: Boolean(step.optionalRemark), changeableConfiguration: Boolean(step.changeableConfiguration), usesStandbyConfiguration: Boolean(step.usesStandbyConfiguration), linkedPumpTestKey: step.linkedPumpTestKey || "" })),
        waterFinalIndexes: criticalDependencyDefinitions.find((item) => item.id === "water-based-pump").finalStepIndexes,
        flowRuleInWaterSystem: criticalDependencyDefinitions.find((item) => item.id === "water-based-pump").childRules.some((rule) => rule.id === "flow-switch-water-function"),
        flowRuleInFap: criticalDependencyDefinitions.find((item) => item.id === "fire-alarm").childRules.some((rule) => rule.id === "flow-switch-mfap-indication"),
        technicianTemplateText: JSON.stringify([fap, spp])
      };
    });

    assert(result.pass.choice === "Pass", "Confirmed Pump and CO2 linked records must auto-fill FAP step 8 as Pass.");
    assert(result.fail.choice === "Fail", "A negative linked record must auto-fill FAP step 8 as Fail.");
    assert(!result.sppSteps[2].captureTechnician, "SPP step 3 must not ask who confirmed the water storage condition.");
    assert(!result.technicianState.recordedBy, "SPP step 3 must rely on record-level technician identity without an extra confirmation field.");
    assert(!result.sppSteps[3].requiresSupervisor, "SPP step 4 must not require a supervisor.");
    assert(result.sppSteps[6].title === "Optional Review" && result.sppSteps[6].optionalRemark && !result.sppSteps[6].requiresChoice, "SPP step 7 must be optional remarks without a mandatory result.");
    assert(result.sppSteps[7].changeableConfiguration && JSON.stringify(result.sppSteps[7].choices) === JSON.stringify(["Electrical", "Diesel Engine"]), "SPP standby type must be persisted but explicitly changeable.");
    assert(result.savedStandby === "Diesel Engine", "Saved standby configuration must be reused by the remaining pump workflow.");
    assert(result.sppSteps.slice(8, 11).map((step) => step.title).join("|") === "Test Jockey Pump on Manual|Test Duty Pump on Manual|Test Standby Pump on Manual", "SPP test sequence must be Jockey, Duty, then configured Standby.");
    assert(result.sppSteps[10].usesStandbyConfiguration, "Standby test must use the saved standby configuration.");
    assert(result.sppSteps.slice(8, 11).every((step) => step.linkedPumpTestKey), "Each manual pump test must retain its own linked-verification identity.");
    assert(result.sppSteps[4].fields.map((field) => field.id).join("|") === "phaseRy|phaseYb|phaseBr", "SPP step 5 must store all three phase readings separately.");
    assert(result.fapBattery.requiresReading && result.fapBattery.readingType === "number" && result.fapBattery.readingStep === "0.1" && result.fapBattery.readingUnit === "V", "FAP battery charging voltage must use decimal numeric input with volts.");
    assert(!result.technicianTemplateText.includes("10%") && !result.technicianTemplateText.includes("20%") && !result.technicianTemplateText.includes("30%"), "Technician SOP templates must not expose sampling percentages.");
    assert(!result.flowRuleInWaterSystem && result.flowRuleInFap, "Flow Switch must be controlled through the FAP sampled-device path, not embedded in the SPP workflow.");
    assert(JSON.stringify(result.waterFinalIndexes) === JSON.stringify([15, 16, 17]), "Water-system final restoration indexes must match the corrected pump template.");
    console.log(JSON.stringify({ ok: true, result }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
