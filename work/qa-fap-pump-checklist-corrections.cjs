const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260919-fap-pump-corrections";
const BROWSER_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:8026${path}`, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();
  if (options.expect && response.status !== options.expect) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  return { status: response.status, payload };
}

(async () => {
  const executablePath = BROWSER_PATHS.find(existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    const qaScheduleId = `QA-FAP-PUMP-CORRECTIONS-${Date.now()}`;
    const result = await page.evaluate((scheduleId) => {
      const fap = criticalSopTemplates.find((template) => template.id === "fire-alarm-tripping-sop");
      const pump = criticalSopTemplates.find((template) => template.id === "sprinkler-hydrant-pump-sop");
      const schedule = {
        scheduleId,
        companyName: "QA CLIENT",
        siteName: "QA SITE",
        plannedDeviceIds: ["QA.SPP.1", "QA.MFAP.1"],
        technicians: [
          { technicianId: "tech@rmtfire.local", technicianName: "Demo Technician" },
          { technicianId: "tech2@rmtfire.local", technicianName: "Tech 2" }
        ],
        deviceAssignments: {
          "QA.SPP.1": { technicianId: "tech@rmtfire.local", technicianName: "Demo Technician" },
          "QA.MFAP.1": { technicianId: "tech2@rmtfire.local", technicianName: "Tech 2" }
        }
      };
      state.currentUser = { name: "Demo Technician", role: "Technician", email: "tech@rmtfire.local" };
      state.setupDevices = [
        { tag: "QA.SPP.1", type: "Sprinkler Panel", floor: "Pump Room", floorId: "lv1", location: "Pump Room" },
        { tag: "QA.MFAP.1", type: "Main Fire Alarm Panel", floor: "Control Room", floorId: "lv1", location: "Control Room" }
      ];
      state.schedules = [schedule];
      state.activeJob = { scheduleId: schedule.scheduleId, schedule };
      state.activeCriticalDevice = { id: "QA.SPP.1", tag: "QA.SPP.1", type: "Sprinkler Panel", floor: "Pump Room", location: "Pump Room" };

      const definitions = getScheduleLinkedVerificationDefinitions(schedule);
      const phaseAlert = buildPumpPhaseSupplyAlert({
        fieldValues: { phaseRy: "415", phaseYb: "0", phaseBr: "414" }
      }, schedule, state.activeCriticalDevice);
      const normalPhaseAlert = buildPumpPhaseSupplyAlert({
        fieldValues: { phaseRy: "415", phaseYb: "415", phaseBr: "414" }
      }, schedule, state.activeCriticalDevice);
      const abnormalPhaseMissing = getMissingSopRequirements(pump.steps[4], {
        fieldValues: { phaseRy: "415", phaseYb: "20", phaseBr: "415" },
        remark: "Abnormal phase supply observed and reported."
      }, pump, 4, { steps: {} });
      const abnormalPhaseComplete = isSopStepComplete(pump.steps[4], {
        fieldValues: { phaseRy: "415", phaseYb: "20", phaseBr: "415" },
        remark: "Abnormal phase supply observed and reported."
      }, pump, 4, { steps: {} });
      const abnormalPhaseNeedsRemark = getMissingSopRequirements(pump.steps[4], {
        fieldValues: { phaseRy: "415", phaseYb: "20", phaseBr: "415" },
        remark: ""
      }, pump, 4, { steps: {} });
      const lowBoundaryAbnormal = getPumpPhaseSupplyState({ fieldValues: { phaseRy: "375", phaseYb: "415", phaseBr: "415" } }).abnormal;
      const highBoundaryAbnormal = getPumpPhaseSupplyState({ fieldValues: { phaseRy: "415", phaseYb: "441", phaseBr: "415" } }).abnormal;
      const normalPhaseComplete = isSopStepComplete(pump.steps[4], {
        fieldValues: { phaseRy: "415", phaseYb: "415", phaseBr: "415" }
      }, pump, 4, { steps: {} });
      const calculatedTank = applySopDerivedFieldValues(pump.steps[2], {
        tankType: "RCC / Concrete Tank",
        capacityMethod: "Calculate from dimensions",
        tankLengthFt: "12",
        tankWidthFt: "4",
        tankHeightFt: "8"
      });
      const step15PassMissing = getMissingSopRequirements(pump.steps[14], { choice: "Pass", remark: "" }, pump, 14, { steps: {} });
      const step15FailMissing = getMissingSopRequirements(pump.steps[14], { choice: "Fail", remark: "" }, pump, 14, { steps: {} });
      const decimalComplete = isSopStepComplete(fap.steps[5], {
        reading: "26.5",
        confirmed: false
      }, fap, 5, { steps: {} });
      const fapStep7Missing = getMissingSopRequirements(fap.steps[6], {
        choice: "Pass",
        remark: ""
      }, fap, 6, { steps: {} });
      const electricalFields = getEffectiveSopFields(pump.steps[10], {
        steps: { 7: { choice: "Electrical" } }
      });
      const dieselFields = getEffectiveSopFields(pump.steps[10], {
        steps: { 7: { choice: "Diesel Engine" } }
      });
      const sprinklerAuto = getEffectiveSopFields(pump.steps[12], { steps: {} }, state.activeCriticalDevice);

      return {
        fapStep4: fap.steps[3],
        fapStep8: fap.steps[7],
        decimalComplete,
        fapStep7Missing,
        pumpSteps: pump.steps,
        definitions: definitions.map((item) => ({
          id: item.linkedVerificationId,
          key: item.pumpTestKey,
          systemIds: item.systemIds,
          sides: item.requiredSides
        })),
        phaseAlert,
        normalPhaseAlert,
        abnormalPhaseMissing,
        abnormalPhaseComplete,
        abnormalPhaseNeedsRemark,
        lowBoundaryAbnormal,
        highBoundaryAbnormal,
        normalPhaseComplete,
        calculatedTank,
        step15PassMissing,
        step15FailMissing,
        electricalFields,
        dieselFields,
        sprinklerAuto,
        finalIndexes: criticalDependencyDefinitions.find((item) => item.id === "water-based-pump").finalStepIndexes
        ,snapshot: getScheduleSnapshotForSharedApi(schedule)
      };
    }, qaScheduleId);

    assert(result.fapStep4.fields?.find((field) => field.id === "testMode")?.choices?.join("|") === "Silence Test|Alarm Test|Actual Test", "FAP Step 4 must expose Silence, Alarm, and Actual test modes.");
    assert(result.decimalComplete, "FAP Step 6 must accept decimal voltage and complete without a checkbox.");
    assert(result.fapStep7Missing.includes("remark"), "FAP Step 7 must block blank remarks.");
    assert(result.fapStep8.readOnlyLinkedSummary === true, "FAP Step 8 must be a read-only linked summary.");

    assert(result.pumpSteps[2].configurationKey === "waterStorage", "Pump Step 3 must use persisted water-storage configuration.");
    assert(!result.pumpSteps[2].captureTechnician && !result.pumpSteps[2].captureSupervisor, "Pump Step 3 must not ask who confirmed the water-storage condition.");
    assert(result.pumpSteps[2].fields.find((field) => field.id === "capacityUnit")?.choices?.join("|") === "L|m³", "Pump Step 3 must store capacity in L or m³.");
    assert(result.pumpSteps[2].tankCapacityCalculation === true, "Pump Step 3 must expose tank-dimension capacity calculation.");
    assert(result.calculatedTank.capacity === "2400" && result.calculatedTank.capacityUnit === "gal" && result.calculatedTank.capacityGallons === "2400", "Pump Step 3 must calculate 12ft x 4ft x 8ft as 2400 imperial gallons.");
    assert(result.pumpSteps[4].fields?.map((field) => field.id).join("|") === "phaseRy|phaseYb|phaseBr", "Pump Step 5 must store three separate phase readings.");
    assert(result.phaseAlert?.severity === "critical", "A zero phase must create a shared critical alert.");
    assert(result.normalPhaseAlert === null, "Normal three-phase readings must not create an alert without an approved imbalance threshold.");
    assert(result.abnormalPhaseMissing.includes("R-Y / Y-B / B-R readings within 376-440 V") && !result.abnormalPhaseComplete, "Pump Step 5 must block 415/20/415 while retaining the raw readings.");
    assert(result.abnormalPhaseNeedsRemark.includes("phase supply acknowledgement remark"), "An abnormal phase set must require acknowledgement remarks.");
    assert(result.lowBoundaryAbnormal && result.highBoundaryAbnormal, "Pump Step 5 must reject 375 V and 441 V boundary failures.");
    assert(result.normalPhaseComplete, "Pump Step 5 must allow 415/415/415 to continue.");
    assert(result.step15PassMissing.length === 0, "Pump Step 15 PASS must not require remarks.");
    assert(result.step15FailMissing.includes("remark"), "Pump Step 15 FAIL must require remarks.");
    assert(result.pumpSteps[5].title === "Starter Panel Pilot Lamp Check", "Pump Step 6 must be the starter-panel pilot-lamp check.");
    assert(result.pumpSteps[5].remarkOnChoices?.includes("Fail") && result.pumpSteps[5].photoOnChoices?.includes("Fail"), "Pump Step 6 FAIL must require a remark and photo.");
    assert(result.pumpSteps[6].optionalRemark, "Pump Step 7 must remain optional.");
    assert(result.pumpSteps[7].changeableConfiguration === true, "Pump Step 8 must allow an explicit controlled correction.");
    assert(result.pumpSteps[8].linkedPumpTestKey === "JOCKEY_MANUAL", "Pump Step 9 must link the jockey manual test.");
    assert(result.pumpSteps[8].remarkOnChoices?.includes("Fail"), "Pump Step 9 FAIL must require a remark.");
    assert(result.pumpSteps[9].linkedPumpTestKey === "DUTY_MANUAL", "Pump Step 10 must link the duty manual test.");
    assert(result.pumpSteps[9].remarkOnChoices?.includes("Fail"), "Pump Step 10 FAIL must require a remark.");
    assert(result.pumpSteps[10].linkedPumpTestKey === "STANDBY_MANUAL", "Pump Step 11 must link the standby manual test.");
    assert(result.electricalFields.some((field) => field.id === "manualResult"), "Electrical standby must expose one manual result.");
    assert(result.electricalFields.find((field) => field.id === "manualResult")?.requiresRemarkOn?.includes("Fail"), "Electrical standby FAIL must require a remark.");
    assert(result.dieselFields.some((field) => field.id === "batteryCharging") && result.dieselFields.some((field) => field.id === "coolingType"), "Diesel standby must expose battery and cooling checks.");
    assert(result.dieselFields.find((field) => field.id === "manualResult")?.requiresRemarkOn?.includes("Fail"), "Diesel standby FAIL must require a remark.");
    assert(result.pumpSteps[11].fields.some((field) => field.id === "cutInPsi") && result.pumpSteps[11].fields.some((field) => field.id === "cutOutPsi"), "Jockey auto must store cut-in and cut-out PSI.");
    assert(result.pumpSteps.slice(11, 14).every((step) => step.remarkOnChoices?.includes("Fail")), "Pump auto Steps 12-14 must require remarks on FAIL.");
    assert(result.sprinklerAuto.some((field) => field.id === "manualStop"), "Sprinkler duty auto must show manual stop instead of forcing cut-out PSI.");
    assert(JSON.stringify(result.finalIndexes) === JSON.stringify([15, 16, 17]), "Pump final-restoration indexes must move with the corrected checklist.");

    assert(result.definitions.length === 3, "Jockey, duty, and standby must keep separate linked-verification identities.");
    assert(new Set(result.definitions.map((item) => item.id)).size === 3, "Pump linked-verification IDs must be stable and unique per pump test.");
    assert(result.definitions.every((item) => item.sides[0].assignedTechnicianId === "tech@rmtfire.local" && item.sides[1].assignedTechnicianId === "tech2@rmtfire.local"), "Pump and MFAP ownership must remain separate and frozen.");

    const fapJourney = await page.evaluate(async (scheduleId) => {
      const linkedVerifications = [
        { linkedVerificationId: `${scheduleId}-PUMP`, verificationType: "FIRE_PUMP_INDICATION", title: "Pump Indication", requiredSides: [{ sideId: "PUMP_ROOM" }, { sideId: "MFAP" }] },
        { linkedVerificationId: `${scheduleId}-CO2`, verificationType: "CO2_GAS_RELEASE_INDICATION", title: "CO2 Indication", requiredSides: [{ sideId: "SUPPRESSION_SYSTEM_LOCATION" }, { sideId: "REMOTE_PANEL_OR_MFAP" }] }
      ];
      const schedule = {
        scheduleId,
        companyName: "QA CLIENT",
        siteName: "QA SITE",
        technician: "Demo Technician",
        status: "In Progress",
        plannedDeviceIds: ["QA.MFAP.DOM"],
        linkedVerifications,
        deviceAssignments: { "QA.MFAP.DOM": { technicianId: "tech@rmtfire.local", technicianName: "Demo Technician" } }
      };
      const sideRecord = (linkedVerificationId, sideId) => ({ linkedVerificationId, sideId, status: "COMPLETE", result: "CONFIRMED" });
      state.setupDevices = [{ tag: "QA.MFAP.DOM", type: "Main Fire Alarm Panel", floor: "Control Room", floorId: "lv1", location: "Control Room" }];
      state.schedules = [schedule];
      state.activeJob = { scheduleId, schedule, status: "In Progress" };
      state.currentUser = { name: "Demo Technician", role: "Technician", email: "tech@rmtfire.local" };
      state.activeCriticalSopId = "fire-alarm-tripping-sop";
      state.activeCriticalDevice = { id: "QA.MFAP.DOM", tag: "QA.MFAP.DOM", type: "Main Fire Alarm Panel", floor: "Control Room", location: "Control Room" };
      state.sharedJobRecords[scheduleId] = {
        store: {
          linkedVerificationDefinitions: Object.fromEntries(linkedVerifications.map((item) => [item.linkedVerificationId, item])),
          linkedVerificationSideRecords: {
            p1: sideRecord(`${scheduleId}-PUMP`, "PUMP_ROOM"), p2: sideRecord(`${scheduleId}-PUMP`, "MFAP"),
            c1: sideRecord(`${scheduleId}-CO2`, "SUPPRESSION_SYSTEM_LOCATION"), c2: sideRecord(`${scheduleId}-CO2`, "REMOTE_PANEL_OR_MFAP")
          },
          linkedVerificationConflicts: {}
        }
      };
      const key = getCriticalSopStorageKey("fire-alarm-tripping-sop");
      state.criticalSops[key] = {
        templateId: "fire-alarm-tripping-sop",
        deviceTag: "QA.MFAP.DOM",
        steps: {
          0: { confirmed: true, remark: "Client informed" },
          1: { confirmed: true, reading: "Addressable / normal" },
          2: { confirmed: true, photo: "before.jpg", photoEvidence: { evidenceId: "qa-fap-before", originalDataUrl: "data:image/png;base64,AA==" } },
          3: { fieldValues: { testMode: "Silence Test", testResult: "Pass" }, fieldRemarks: {} },
          4: { confirmed: true, photo: "isolation.jpg", photoEvidence: { evidenceId: "qa-fap-isolation", originalDataUrl: "data:image/png;base64,AA==" } }
        }
      };
      renderCriticalSop();
      const before = {
        batteryDisabled: document.querySelector('[name="sop-reading-5"]')?.disabled,
        step7Locked: document.querySelectorAll("#criticalSopForm fieldset.sop-step")[6]?.classList.contains("locked")
      };
      document.querySelector('[name="sop-reading-5"]').value = "26.5";
      await saveCriticalSop(false);
      renderCriticalSop();
      const afterBattery = {
        step7Locked: document.querySelectorAll("#criticalSopForm fieldset.sop-step")[6]?.classList.contains("locked"),
        savedVoltage: state.criticalSops[key]?.steps?.[5]?.reading
      };
      document.querySelector('[name="sop-choice-6"]').value = "Pass";
      await saveCriticalSop(false);
      renderCriticalSop();
      const blankRemarkBlocks = document.querySelectorAll("#criticalSopForm fieldset.sop-step")[7]?.classList.contains("locked");
      document.querySelector('[name="sop-remark-6"]').value = "Mimic and panel lamps checked";
      await saveCriticalSopAndOpenNext();
      renderCriticalSop();
      const linkedStep = criticalSopTemplates.find((template) => template.id === "fire-alarm-tripping-sop").steps[7];
      const passAuto = getSopLinkedVerificationAutoState(linkedStep, schedule);
      delete state.sharedJobRecords[scheduleId].store.linkedVerificationSideRecords.c2;
      const pendingAuto = getSopLinkedVerificationAutoState(linkedStep, schedule);
      state.sharedJobRecords[scheduleId].store.linkedVerificationSideRecords.c2 = sideRecord(`${scheduleId}-CO2`, "REMOTE_PANEL_OR_MFAP");
      state.sharedJobRecords[scheduleId].store.linkedVerificationSideRecords.c2.result = "NOT_CONFIRMED";
      const failAuto = getSopLinkedVerificationAutoState(linkedStep, schedule);
      state.sharedJobRecords[scheduleId].store.linkedVerificationSideRecords.c2.result = "CONFIRMED";
      renderCriticalSop();
      return {
        before,
        afterBattery,
        blankRemarkBlocks,
        step8Locked: document.querySelectorAll("#criticalSopForm fieldset.sop-step")[7]?.classList.contains("locked"),
        linkedSummaryVisible: Boolean(document.querySelector(".sop-linked-summary")),
        manualStep8Select: Boolean(document.querySelector('[name="sop-choice-7"]')),
        linkedOverall: document.querySelector(".sop-linked-summary .overall strong")?.textContent,
        autoStates: { pass: passAuto.overall, pending: pendingAuto.overall, fail: failAuto.overall }
      };
    }, `${qaScheduleId}-FAP-DOM`);
    if (process.env.QA_DEBUG) console.log(JSON.stringify({ fapJourney }, null, 2));
    assert(fapJourney.before.batteryDisabled === false && fapJourney.before.step7Locked, "FAP Step 6 must be actionable while Step 7 remains locked.");
    assert(fapJourney.afterBattery.savedVoltage === "26.5" && !fapJourney.afterBattery.step7Locked, "Saving decimal battery voltage must unlock Step 7.");
    assert(fapJourney.blankRemarkBlocks, "FAP Step 7 with blank remarks must keep Step 8 locked.");
    assert(fapJourney.linkedSummaryVisible && !fapJourney.manualStep8Select && fapJourney.linkedOverall === "PASS", "FAP Step 8 must remain a read-only linked PASS summary while staged navigation controls its visible section.");
    assert(JSON.stringify(fapJourney.autoStates) === JSON.stringify({ pass: "PASS", pending: "PENDING", fail: "FAIL" }), "FAP Step 8 must derive PASS, PENDING, and FAIL from authoritative linked records.");

    const pumpDeviceId = `QA.SPP.CONFIG.${Date.now()}`;
    const firstConfig = await api("/api/pump-configurations", {
      method: "POST",
      expect: 200,
      body: {
        expectedRevision: 0,
        configuration: {
          companyName: "QA CLIENT",
          siteName: "QA SITE",
          pumpDeviceId,
          waterStorage: { tankType: "RCC / Concrete Tank", capacity: "45", capacityUnit: "m³" },
          standbyType: "Electrical",
          updatedBy: "QA Technician"
        }
      }
    });
    assert(firstConfig.payload.configuration.revision === 1, "First pump setup must create revision 1.");
    const loadedConfig = await api(`/api/pump-configurations?companyName=QA%20CLIENT&siteName=QA%20SITE&pumpDeviceId=${encodeURIComponent(pumpDeviceId)}`, { expect: 200 });
    assert(loadedConfig.payload.configuration.waterStorage.capacity === "45", "A future visit must load the saved tank capacity.");
    const correctedConfig = await api("/api/pump-configurations", {
      method: "POST",
      expect: 200,
      body: {
        expectedRevision: 1,
        configuration: { ...loadedConfig.payload.configuration, standbyType: "Diesel Engine", updatedBy: "QA Technician" }
      }
    });
    assert(correctedConfig.payload.configuration.revision === 2 && correctedConfig.payload.configuration.standbyType === "Diesel Engine", "Controlled configuration correction must create a new revision.");
    const staleConfig = await api("/api/pump-configurations", {
      method: "POST",
      expect: 409,
      body: {
        expectedRevision: 1,
        configuration: { ...loadedConfig.payload.configuration, standbyType: "Electrical", updatedBy: "Stale Phone" }
      }
    });
    assert(staleConfig.payload.conflict && staleConfig.payload.current.revision === 2, "A stale pump-configuration save must not overwrite the current revision.");

    const migrated = await api(`/api/jobs/${encodeURIComponent(qaScheduleId)}/migrate`, {
      method: "POST",
      expect: 200,
      body: { schedule: result.snapshot }
    });
    assert(migrated.payload.linkedVerifications.filter((item) => item.definition.verificationType === "FIRE_PUMP_INDICATION").length === 3, "The shared store must freeze three pump/MFAP linked definitions.");
    const linkedDefinition = (key) => result.snapshot.linkedVerifications.find((item) => item.pumpTestKey === key);
    const sideRecord = (definition, side, technicianId, technicianName, linkedResult, submissionId) => ({
      linkedVerificationId: definition.linkedVerificationId,
      sideId: side.sideId,
      technicianId,
      technicianName,
      status: "COMPLETE",
      result: linkedResult,
      submissionId,
      localCompletedAt: new Date().toISOString()
    });
    const saveSide = (definition, sideIndex, technicianId, technicianName, linkedResult, submissionId) => api(`/api/jobs/${encodeURIComponent(qaScheduleId)}/linked-verification-sides`, {
      method: "POST",
      expect: 200,
      body: {
        schedule: result.snapshot,
        expectedRevision: 0,
        record: sideRecord(definition, definition.requiredSides[sideIndex], technicianId, technicianName, linkedResult, submissionId)
      }
    });
    const jockey = linkedDefinition("JOCKEY_MANUAL");
    const pumpSide = await api(`/api/jobs/${encodeURIComponent(qaScheduleId)}/linked-verification-sides`, {
      method: "POST",
      expect: 200,
      body: {
        schedule: result.snapshot,
        expectedRevision: 0,
        record: sideRecord(jockey, jockey.requiredSides[0], "tech@rmtfire.local", "Demo Technician", "CONFIRMED", "qa-jockey-pump")
      }
    });
    assert(pumpSide.payload.linkedVerification.status === "AWAITING_COUNTERPART", "Pump side alone must await MFAP.");
    const duplicate = await api(`/api/jobs/${encodeURIComponent(qaScheduleId)}/linked-verification-sides`, {
      method: "POST",
      expect: 200,
      body: {
        schedule: result.snapshot,
        expectedRevision: 0,
        record: sideRecord(jockey, jockey.requiredSides[0], "tech@rmtfire.local", "Demo Technician", "CONFIRMED", "qa-jockey-pump")
      }
    });
    assert(duplicate.payload.idempotent, "Duplicate logical pump-side save must be idempotent.");
    const mfapSide = await api(`/api/jobs/${encodeURIComponent(qaScheduleId)}/linked-verification-sides`, {
      method: "POST",
      expect: 200,
      body: {
        schedule: result.snapshot,
        expectedRevision: 0,
        record: sideRecord(jockey, jockey.requiredSides[1], "tech2@rmtfire.local", "Tech 2", "CONFIRMED", "qa-jockey-mfap")
      }
    });
    assert(mfapSide.payload.linkedVerification.status === "VERIFIED", "Matching Pump and MFAP sides must reconcile to VERIFIED.");
    const duty = linkedDefinition("DUTY_MANUAL");
    const dutyPump = await saveSide(duty, 0, "tech@rmtfire.local", "Demo Technician", "CONFIRMED", "qa-duty-pump");
    assert(dutyPump.payload.linkedVerification.status === "AWAITING_COUNTERPART", "Duty Pump must retain its own awaiting-counterpart state.");
    const dutyMfap = await saveSide(duty, 1, "tech2@rmtfire.local", "Tech 2", "NOT_CONFIRMED", "qa-duty-mfap");
    assert(dutyMfap.payload.linkedVerification.status === "MISMATCH_REVIEW_REQUIRED", "A Pump/MFAP disagreement must require mismatch review.");
    const standby = linkedDefinition("STANDBY_MANUAL");
    const standbyPump = await saveSide(standby, 0, "tech@rmtfire.local", "Demo Technician", "CONFIRMED", "qa-standby-pump");
    assert(standbyPump.payload.linkedVerification.status === "AWAITING_COUNTERPART", "Standby Pump must retain its own awaiting-counterpart state.");
    const standbyMfap = await saveSide(standby, 1, "tech2@rmtfire.local", "Tech 2", "CONFIRMED", "qa-standby-mfap");
    assert(standbyMfap.payload.linkedVerification.status === "VERIFIED", "Standby Pump and MFAP matching records must verify independently.");
    assert(consoleErrors.length === 0, `Console errors found: ${consoleErrors.join(" | ")}`);

    console.log(JSON.stringify({
      ok: true,
      fap: { step4: "PASS", step6Decimal: "PASS", step7RequiredRemark: "PASS", step8ReadOnly: "PASS" },
      pump: { configurationRevision: correctedConfig.payload.configuration.revision, linkedDefinitions: result.definitions.length, phaseAlert: result.phaseAlert.title },
      linked: {
        jockey: mfapSide.payload.linkedVerification.status,
        duty: dutyMfap.payload.linkedVerification.status,
        standby: standbyMfap.payload.linkedVerification.status,
        pumpOnly: pumpSide.payload.linkedVerification.status,
        duplicate: duplicate.payload.idempotent
      },
      consoleErrors
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
