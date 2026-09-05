const { existsSync } = require("node:fs");
const { chromium, devices } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || `http://127.0.0.1:8026/?fresh=20260901-annual-scope-${Date.now()}`;
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function buildFixture() {
  const profile = { companyName: "QA ANNUAL SCOPE", siteName: "ROTATION LAB", scheduleReady: true };
  const floors = Array.from({ length: 10 }, (_, index) => {
    const floorNumber = index + 1;
    return {
      id: `qa-annual-floor-${String(floorNumber).padStart(2, "0")}`,
      floorId: `qa-annual-floor-${String(floorNumber).padStart(2, "0")}`,
      companyName: profile.companyName,
      siteName: profile.siteName,
      floorCode: `L${floorNumber}`,
      floorName: `Floor ${floorNumber}`,
      title: `QA Annual Floor ${floorNumber}`,
      src: "assets/lv1-map.png",
      cleanSrc: "assets/lv1-map.png",
      active: true
    };
  });

  const passiveDevices = Array.from({ length: 100 }, (_, index) => {
    const number = index + 1;
    const floor = floors[index % floors.length];
    return {
      tag: `QA.SD.${String(number).padStart(3, "0")}`,
      type: "Smoke Detector",
      companyName: profile.companyName,
      siteName: profile.siteName,
      floor: floor.title,
      floorId: floor.id,
      floorCode: floor.floorCode,
      floorTitle: floor.title,
      location: `Corridor checkpoint ${number}`,
      status: "Confirmed",
      xPercent: 8 + (number % 10) * 8,
      yPercent: 10 + Math.floor((number - 1) / 10) * 7,
      capturedBy: "QA",
      capturedAt: new Date().toISOString()
    };
  });

  const criticalDevices = [
    ["QA.MFAP.1", "Main Fire Alarm Panel", floors[0]],
    ["QA.HRP.1", "Hose Reel Panel", floors[0]],
    ["QA.CO2.1", "CO2 System", floors[1]]
  ].map(([tag, type, floor], index) => ({
    tag,
    type,
    companyName: profile.companyName,
    siteName: profile.siteName,
    floor: floor.title,
    floorId: floor.id,
    floorCode: floor.floorCode,
    floorTitle: floor.title,
    location: `Critical system room ${index + 1}`,
    status: "Confirmed",
    xPercent: 82,
    yPercent: 15 + index * 8,
    capturedBy: "QA",
    capturedAt: new Date().toISOString()
  }));

  return {
    profile,
    floors,
    devices: [...passiveDevices, ...criticalDevices],
    passiveTags: passiveDevices.map((device) => device.tag),
    criticalTags: criticalDevices.map((device) => device.tag)
  };
}

async function createPage(browser) {
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "en-MY"
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.route("**/api/schedules", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ schedules: [] })
  }));
  await page.route("**/api/save-schedules", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, count: 1 })
  }));
  await page.route("**/api/save-inspection-run", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, runKey: "qa-annual-scope-run" })
  }));
  await page.route("**/api/device-masters", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ files: [] })
  }));
  await page.route("**/local-data/device-master/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ companyName: "QA", siteName: "QA", devices: [] })
  }));
  await page.route("**/local-data/mimic-library/mimic-library-app-data.json", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ companies: [], floors: [] })
  }));
  await page.route("**/api/jobs/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      store: {
        schemaVersion: "shared-records-v1",
        scheduleId: "qa-annual-scope",
        inspectionRecords: {},
        criticalSopRecords: {},
        itemClaims: {}
      },
      progress: { total: 0, done: 0, pass: 0, fail: 0, pending: 0, partial: 0, blocked: 0, ready: true }
    })
  }));

  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#loginView", { timeout: 15000 });
  return { context, page, browserErrors };
}

async function runTest(results, name, callback) {
  process.stdout.write(`RUN ${name}\n`);
  const value = await callback();
  results.push({ name, status: "PASS", value });
  process.stdout.write(`PASS ${name}\n`);
  return value;
}

(async () => {
  const executablePath = EDGE_PATHS.find((path) => existsSync(path));
  assert(executablePath, "No Edge/Chrome executable found for annual scope QA.");

  const browser = await chromium.launch({ headless: true, executablePath });
  const { context, page, browserErrors } = await createPage(browser);
  const fixture = buildFixture();
  const results = [];

  await runTest(results, "annual scope rotation, reservations, frozen scope and technician mimic filtering", async () => {
    return page.evaluate((fixtureData) => {
      function qaAssert(condition, message) {
        if (!condition) throw new Error(message);
      }

      const baselineDevices = fixtureData.devices.map((device) => ({ ...device }));
      const baselineFloors = fixtureData.floors.map((floor) => ({ ...floor }));

      function resetQaState(frequencyPercent = 10, year = 2026) {
        localStorage.clear();
        state.currentUser = { name: "QA Admin", role: "Admin", email: "qa-admin@rmtfire.local" };
        state.siteProfile = fixtureData.profile;
        state.mimicFloors = baselineFloors.map((floor) => ({ ...floor }));
        state.libraryFloors = [];
        state.libraryCompanies = [];
        state.setupDevices = baselineDevices.map((device) => ({ ...device }));
        state.schedules = [];
        state.inspections = {};
        state.history = {};
        state.scopeHistory = {};
        state.scopeCycle = {};
        state.activeJob = null;
        state.activeTechPreviewScheduleId = null;
        state.activeTechSystemKey = "";
        state.activeTechFloorId = "";
        state.contractRules = {
          [makeScheduleSiteValue(fixtureData.profile.companyName, fixtureData.profile.siteName)]: {
            ...fixtureData.profile,
            frequencyPercent
          }
        };
        if (scheduleDate) scheduleDate.value = `${year}-01-11`;
        writeStoredJson("tmFireSetupDevices", state.setupDevices);
        writeStoredJson("rmtMimicFloors", state.mimicFloors);
        writeStoredJson("rmtSchedules", state.schedules);
        writeStoredJson("tmFireInspections", state.inspections);
        writeStoredJson("tmFireHistory", state.history);
        writeStoredJson("tmFireScopeHistory", state.scopeHistory);
        writeStoredJson("rmtScopeCycle", state.scopeCycle);
        writeStoredJson("rmtContractRules", state.contractRules);
        invalidateRuntimeCaches();
      }

      function makeDate(year, month) {
        return `${year}-${String(month).padStart(2, "0")}-11`;
      }

      function createAnnualSchedule(frequencyPercent, visitNo, date, options = {}) {
        const profile = fixtureData.profile;
        const scopeInfo = getScheduleScopeInfo("full-maintenance");
        const pool = getScheduleDevicePoolForScope(scopeInfo, profile, fixtureData.floors[0].id);
        const scheduleId = options.scheduleId || `QA-SCOPE-${frequencyPercent}-${date}-${visitNo}`;
        const annualCycleId = getContractCycleIdForDate(date);
        const rotationHistoryKey = getScopeHistoryKey(frequencyPercent, profile, "site-wide", annualCycleId);
        const selection = getMaintenanceScopeSelection(pool, {
          profile,
          floorId: "site-wide",
          frequencyPercent,
          annualCycleId,
          rotationHistoryKey,
          date,
          scheduleId,
          commitHistory: false
        });
        const plannedDevices = selection.devices;
        const schedule = {
          scheduleId,
          status: "Scheduled",
          companyName: profile.companyName,
          siteName: profile.siteName,
          clientSource: "QA annual scope test data",
          floorId: fixtureData.floors[0].id,
          floorTitle: `Whole site (start: ${fixtureData.floors[0].title})`,
          floorCode: fixtureData.floors[0].floorCode,
          startFloorId: fixtureData.floors[0].id,
          startFloorTitle: fixtureData.floors[0].title,
          date,
          time: "09:00",
          technician: "Demo Technician",
          serviceType: "Maintenance / Inspection",
          scope: "full-maintenance",
          scopeLabel: "Full Maintenance Visit",
          scopeSelectionMode: "site-wide",
          contractFrequencyPercent: frequencyPercent,
          annualCycleId,
          contractCycleId: annualCycleId,
          rotationHistoryKey,
          scopeFrozen: true,
          sampledDeviceIds: selection.sampledPassiveDevices.map((device) => device.id),
          mandatoryRecheckDeviceIds: selection.mandatoryRecheckDevices.map((device) => device.id),
          criticalDeviceIds: selection.criticalDevices.map((device) => device.id),
          adminForcedDeviceIds: plannedDevices.filter((device) => device.forceRecheck || device.adminForcedRecheck).map((device) => device.id),
          passiveTargetCount: selection.passiveTarget,
          plannedDeviceIds: plannedDevices.map((device) => device.id),
          plannedFloorCounts: getScheduleFloorCounts(plannedDevices),
          deviceCount: plannedDevices.length,
          passiveCount: plannedDevices.filter((device) => isPassiveScopeDevice(device)).length,
          activeCount: plannedDevices.filter((device) => isActiveSystem(device.type)).length,
          totalSiteDeviceCount: pool.length,
          totalFloorDeviceCount: pool.length,
          priority: "Normal",
          notes: "QA annual scope fixture",
          createdAt: `${date}T09:00:00.000Z`,
          updatedAt: `${date}T09:00:00.000Z`
        };
        state.schedules = [schedule, ...state.schedules.filter((item) => item.scheduleId !== scheduleId)];
        reserveScheduleScope(schedule);
        if (options.complete !== false) {
          markInspected(schedule.sampledDeviceIds, date, "pass", { jobId: `JOB-${scheduleId}`, scheduleId });
          markInspected(schedule.mandatoryRecheckDeviceIds, date, "fail", { jobId: `JOB-${scheduleId}`, scheduleId });
          state.activeJob = {
            jobId: `JOB-${scheduleId}`,
            scheduleId,
            schedule,
            status: "Completed",
            checkedOutAt: `${date}T12:00:00.000Z`,
            checkedOutBy: getCurrentUserName()
          };
          schedule.status = "Completed";
          schedule.completedAt = `${date}T12:00:00.000Z`;
          schedule.completedBy = getCurrentUserName();
          completeScopeCycleSchedule(schedule);
          state.activeJob = null;
        }
        return {
          schedule,
          sampledIds: schedule.sampledDeviceIds,
          mandatoryIds: schedule.mandatoryRecheckDeviceIds,
          criticalIds: schedule.criticalDeviceIds,
          plannedPassiveIds: schedule.plannedDeviceIds.filter((id) => fixtureData.passiveTags.includes(id)),
          cycle: getScopeCycleRecord(rotationHistoryKey, getUniqueScheduleDevices(pool).filter((device) => isPassiveScopeDevice(device)), { annualCycleId })
        };
      }

      function overlap(a, b) {
        const bSet = new Set(b);
        return a.filter((id) => bSet.has(id));
      }

      function getPassiveCycleForSchedule(schedule) {
        const pool = getScheduleDevicePoolForScope(getScheduleScopeInfo("full-maintenance"), fixtureData.profile, fixtureData.floors[0].id);
        const passivePool = getUniqueScheduleDevices(pool).filter((device) => isPassiveScopeDevice(device));
        return getScopeCycleRecord(schedule.rotationHistoryKey, passivePool, { annualCycleId: schedule.annualCycleId });
      }

      function markInspected(deviceIds, date, status = "pass", meta = {}) {
        deviceIds.forEach((deviceId, index) => {
          state.inspections[deviceId] = {
            status,
            answers: ["Pass"],
            notes: `QA completed ${deviceId}`,
            action: "",
            inspectedAt: `${date}T10:${String(index).padStart(2, "0")}:00.000Z`,
            inspectedBy: "QA Technician",
            inspectedRole: "Technician",
            jobId: meta.jobId || "",
            scheduleId: meta.scheduleId || ""
          };
        });
      }

      function runMonthlyScenario() {
        resetQaState(10, 2026);
        const table = [];
        let flagged = "";
        for (let visit = 1; visit <= 10; visit += 1) {
          const result = createAnnualSchedule(10, visit, makeDate(2026, visit));
          if (visit === 1) {
            flagged = result.sampledIds[0];
            state.inspections[flagged] = {
              status: "Fail",
              notes: "Unresolved fault/defect from previous monthly visit",
              action: "Quotation required",
              inspectedAt: `${makeDate(2026, visit)}T10:00:00.000Z`,
              inspectedBy: "QA Technician"
            };
          }
          table.push({
            visit,
            sampledCount: result.sampledIds.length,
            mandatoryCount: result.mandatoryIds.length,
            criticalCount: result.criticalIds.length,
            sampledIds: result.sampledIds,
            mandatoryIds: result.mandatoryIds,
            uniqueCovered: result.cycle.coveredIds.length
          });
        }

        const sampledFirstTen = table.flatMap((row) => row.sampledIds);
        qaAssert(sampledFirstTen.length === 100, `Monthly visits 1-10 should produce 100 sampled picks, got ${sampledFirstTen.length}.`);
        qaAssert(new Set(sampledFirstTen).size === 100, "Monthly healthy sampled devices repeated before 100% unique coverage.");
        qaAssert(table[1].mandatoryIds.includes(flagged), "Visit 2 did not include unresolved Visit 1 fault as mandatory recheck.");
        qaAssert(table[1].sampledCount === 10, "Visit 2 mandatory recheck reduced the normal 10% new-device allocation.");
        qaAssert(table.every((row) => row.criticalCount === fixtureData.criticalTags.length), "Critical systems were not included 100% every monthly visit.");

        const recurring = table[0].sampledIds[1];
        const rectified = table[0].sampledIds[2];
        state.history[recurring] = [
          { status: "Fail", notes: "Recurring fault - first occurrence" },
          { status: "Fail", notes: "Recurring fault - second occurrence" }
        ];
        state.inspections[recurring] = { status: "Pass", notes: "Recurring fault monitor after repair" };
        state.inspections[rectified] = { status: "Pass", action: "Recently rectified - verify next visit" };

        const visit11 = createAnnualSchedule(10, 11, makeDate(2026, 11));
        const visit12 = createAnnualSchedule(10, 12, makeDate(2026, 12));
        table.push({
          visit: 11,
          sampledCount: visit11.sampledIds.length,
          mandatoryCount: visit11.mandatoryIds.length,
          criticalCount: visit11.criticalIds.length,
          sampledIds: visit11.sampledIds,
          mandatoryIds: visit11.mandatoryIds,
          uniqueCovered: visit11.cycle.coveredIds.length
        });
        table.push({
          visit: 12,
          sampledCount: visit12.sampledIds.length,
          mandatoryCount: visit12.mandatoryIds.length,
          criticalCount: visit12.criticalIds.length,
          sampledIds: visit12.sampledIds,
          mandatoryIds: visit12.mandatoryIds,
          uniqueCovered: visit12.cycle.coveredIds.length
        });
        qaAssert(visit11.mandatoryIds.includes(flagged), "Post-cycle unresolved fault was not mandatory.");
        qaAssert(visit11.sampledIds.includes(rectified) || visit11.sampledIds.includes(recurring), "Post-cycle repeat capacity did not prioritize useful rechecks.");

        const finalCycle = visit12.cycle;
        qaAssert(finalCycle.coveredIds.length === 100, `Monthly annual cycle should cover 100 unique devices, got ${finalCycle.coveredIds.length}.`);
        qaAssert(finalCycle.completedInspectionCount >= 122, `Monthly cycle should count sampled plus mandatory rechecks, got ${finalCycle.completedInspectionCount}.`);
        qaAssert(finalCycle.repeatInspectionCount >= 22, `Monthly repeat count should include overlap/rechecks, got ${finalCycle.repeatInspectionCount}.`);
        qaAssert(finalCycle.faultRecheckRepeatCount >= 2, `Monthly fault/recheck repeat count too low: ${finalCycle.faultRecheckRepeatCount}.`);
        const coverageSummary = getAnnualCoverageSummary(fixtureData.profile, { frequencyPercent: 10, date: "2026-12-11" });
        return { table, flagged, recurring, rectified, finalCycle, coverageSummary };
      }

      function runFixedFrequencyScenario(frequencyPercent, visits, months) {
        resetQaState(frequencyPercent, 2026);
        const table = [];
        for (let index = 0; index < visits; index += 1) {
          const result = createAnnualSchedule(frequencyPercent, index + 1, makeDate(2026, months[index]));
          table.push({
            visit: index + 1,
            sampledCount: result.sampledIds.length,
            mandatoryCount: result.mandatoryIds.length,
            criticalCount: result.criticalIds.length,
            sampledIds: result.sampledIds,
            uniqueCovered: result.cycle.coveredIds.length
          });
        }
        const flat = table.flatMap((row) => row.sampledIds);
        const finalCycle = table.at(-1);
        qaAssert(table.every((row) => row.criticalCount === fixtureData.criticalTags.length), `${frequencyPercent}% scenario did not include all critical systems every visit.`);
        return { table, totalPicked: flat.length, uniquePicked: new Set(flat).size, finalCycle };
      }

      function runFireAlarmSystemMonthlyScenario() {
        const profile = { companyName: "QA UOB FIRE", siteName: "MONTHLY SCOPE", scheduleReady: true };
        const floors = Array.from({ length: 3 }, (_, index) => {
          const floorNumber = index + 1;
          return {
            id: `qa-uob-fire-floor-${floorNumber}`,
            floorId: `qa-uob-fire-floor-${floorNumber}`,
            companyName: profile.companyName,
            siteName: profile.siteName,
            floorCode: `P${floorNumber}`,
            floorName: `Page ${floorNumber}`,
            title: `QA UOB Fire Page ${floorNumber}`,
            src: "assets/lv1-map.png",
            cleanSrc: "assets/lv1-map.png",
            active: true
          };
        });
        const fieldDevices = Array.from({ length: 60 }, (_, index) => {
          const number = index + 1;
          const floor = floors[index % floors.length];
          const type = number % 3 === 0 ? "Manual Call Point" : number % 3 === 1 ? "Smoke Detector" : "Heat Detector";
          const prefix = type === "Manual Call Point" ? "MCP" : type === "Heat Detector" ? "HD" : "SD";
          return {
            tag: `QA.UOB.${prefix}.${String(number).padStart(3, "0")}`,
            type,
            companyName: profile.companyName,
            siteName: profile.siteName,
            floor: floor.title,
            floorId: floor.id,
            floorCode: floor.floorCode,
            floorTitle: floor.title,
            location: `Fire alarm checkpoint ${number}`,
            status: "Confirmed",
            xPercent: 10 + (number % 10) * 7,
            yPercent: 12 + Math.floor((number - 1) / 10) * 8,
            capturedBy: "QA",
            capturedAt: new Date().toISOString()
          };
        });
        const mfap = {
          tag: "QA.UOB.MFAP.1",
          type: "Main Fire Alarm Panel",
          companyName: profile.companyName,
          siteName: profile.siteName,
          floor: floors[0].title,
          floorId: floors[0].id,
          floorCode: floors[0].floorCode,
          floorTitle: floors[0].title,
          location: "Fire control room",
          status: "Confirmed",
          xPercent: 80,
          yPercent: 20,
          capturedBy: "QA",
          capturedAt: new Date().toISOString()
        };

        localStorage.clear();
        state.currentUser = { name: "QA Admin", role: "Admin", email: "qa-admin@rmtfire.local" };
        state.siteProfile = profile;
        state.mimicFloors = floors.map((floor) => ({ ...floor }));
        state.libraryFloors = [];
        state.libraryCompanies = [];
        state.setupDevices = [...fieldDevices, mfap].map((device) => ({ ...device }));
        state.schedules = [];
        state.inspections = {};
        state.history = {};
        state.scopeHistory = {};
        state.scopeCycle = {};
        state.activeJob = null;
        state.contractRules = {
          [makeScheduleSiteValue(profile.companyName, profile.siteName)]: {
            ...profile,
            frequencyPercent: 10
          }
        };
        writeStoredJson("tmFireSetupDevices", state.setupDevices);
        writeStoredJson("rmtMimicFloors", state.mimicFloors);
        writeStoredJson("rmtContractRules", state.contractRules);
        writeStoredJson("rmtSchedules", state.schedules);
        writeStoredJson("tmFireInspections", state.inspections);
        writeStoredJson("tmFireHistory", state.history);
        writeStoredJson("tmFireScopeHistory", state.scopeHistory);
        writeStoredJson("rmtScopeCycle", state.scopeCycle);
        invalidateRuntimeCaches();

        function makeSystemSchedule(visit, date, options = {}) {
          const scopeInfo = getScheduleScopeInfo("fire-alarm");
          const scopeSelectionMode = getScheduleScopeSelectionMode(scopeInfo, "Maintenance / Inspection");
          const rotationScopeKey = getScheduleRotationScopeKey(scopeInfo, scopeSelectionMode, floors[0].id);
          const scheduleId = options.scheduleId || `QA-UOB-FIRE-MONTHLY-${visit}`;
          const annualCycleId = getContractCycleIdForDate(date);
          const rotationHistoryKey = getScopeHistoryKey(10, profile, rotationScopeKey, annualCycleId);
          const pool = getScheduleDevicePoolForScope(scopeInfo, profile, floors[0].id, {
            serviceType: "Maintenance / Inspection",
            scopeSelectionMode
          });
          const selection = getMaintenanceScopeSelection(pool, {
            profile,
            floorId: rotationScopeKey,
            frequencyPercent: 10,
            annualCycleId,
            rotationHistoryKey,
            date,
            scheduleId,
            commitHistory: false
          });
          const plannedDevices = selection.devices;
          const schedule = {
            scheduleId,
            status: "Scheduled",
            companyName: profile.companyName,
            siteName: profile.siteName,
            clientSource: "QA system monthly scope",
            floorId: floors[0].id,
            floorTitle: `Whole site (start: ${floors[0].title})`,
            floorCode: floors[0].floorCode,
            startFloorId: floors[0].id,
            startFloorTitle: floors[0].title,
            date,
            time: "09:00",
            technician: "Demo Technician",
            serviceType: "Maintenance / Inspection",
            scope: "fire-alarm",
            scopeLabel: "Fire Alarm Checklist",
            scopeSelectionMode,
            contractFrequencyPercent: 10,
            annualCycleId,
            contractCycleId: annualCycleId,
            rotationHistoryKey,
            scopeFrozen: true,
            sampledDeviceIds: selection.sampledPassiveDevices.map((device) => device.id),
            mandatoryRecheckDeviceIds: selection.mandatoryRecheckDevices.map((device) => device.id),
            criticalDeviceIds: selection.criticalDevices.map((device) => device.id),
            adminForcedDeviceIds: [],
            passiveTargetCount: selection.passiveTarget,
            plannedDeviceIds: plannedDevices.map((device) => device.id),
            plannedFloorCounts: getScheduleFloorCounts(plannedDevices),
            deviceCount: plannedDevices.length,
            passiveCount: plannedDevices.filter((device) => isPassiveScopeDevice(device)).length,
            activeCount: plannedDevices.filter((device) => isActiveSystem(device.type)).length,
            totalSiteDeviceCount: pool.length,
            totalFloorDeviceCount: pool.length,
            priority: "Normal",
            notes: "QA UOB Fire Alarm monthly system scope",
            createdAt: `${date}T09:00:00.000Z`,
            updatedAt: `${date}T09:00:00.000Z`
          };
          state.schedules = [schedule, ...state.schedules.filter((item) => item.scheduleId !== scheduleId)];
          reserveScheduleScope(schedule);
          return { schedule, selection, pool };
        }

        const visit1 = makeSystemSchedule(1, "2026-01-11", { scheduleId: "QA-UOB-FIRE-MONTHLY-V1" });
        qaAssert(visit1.pool.length === 61, `Fire Alarm pool should have 61 devices, got ${visit1.pool.length}.`);
        qaAssert(visit1.schedule.sampledDeviceIds.length === 6, `Monthly Fire Alarm should select 6 normal devices, got ${visit1.schedule.sampledDeviceIds.length}.`);
        qaAssert(visit1.schedule.criticalDeviceIds.length === 1 && visit1.schedule.criticalDeviceIds[0] === mfap.tag, "Monthly Fire Alarm did not include MFAP as separate 100% critical equipment.");
        qaAssert(visit1.schedule.mandatoryRecheckDeviceIds.length === 0, "Clean monthly Fire Alarm visit should not include mandatory rechecks.");
        qaAssert(visit1.schedule.plannedDeviceIds.length === 7, `Clean monthly Fire Alarm visit should have 7 total planned items, got ${visit1.schedule.plannedDeviceIds.length}.`);
        const visit1FrozenIds = [...visit1.schedule.plannedDeviceIds];
        ensureSchedulePlannedScope(visit1.schedule);
        writeStoredJson("rmtSchedules", [visit1.schedule]);
        state.schedules = readStoredJson("rmtSchedules", []);
        ensureSchedulePlannedScope(state.schedules[0]);
        qaAssert(JSON.stringify(visit1FrozenIds) === JSON.stringify(state.schedules[0].plannedDeviceIds), "Refresh/resume changed the frozen monthly Fire Alarm planned IDs.");
        visit1.schedule = state.schedules[0];

        const faultId = visit1.schedule.sampledDeviceIds[0];
        const passedIds = visit1.schedule.sampledDeviceIds.slice(1);
        markInspected(passedIds, "2026-01-11", "pass", { jobId: "JOB-QA-UOB-FIRE-MONTHLY-V1", scheduleId: visit1.schedule.scheduleId });
        markInspected([faultId], "2026-01-11", "fail", { jobId: "JOB-QA-UOB-FIRE-MONTHLY-V1", scheduleId: visit1.schedule.scheduleId });
        state.inspections[faultId] = {
          ...state.inspections[faultId],
          notes: "Unresolved fault/defect from prior Fire Alarm visit",
          action: "Quotation required"
        };
        state.activeJob = {
          jobId: "JOB-QA-UOB-FIRE-MONTHLY-V1",
          scheduleId: visit1.schedule.scheduleId,
          schedule: visit1.schedule,
          status: "Completed",
          checkedOutAt: "2026-01-11T12:00:00.000Z",
          checkedOutBy: "QA Technician"
        };
        visit1.schedule.status = "Completed";
        completeScopeCycleSchedule(visit1.schedule);
        state.activeJob = null;

        const visit2 = makeSystemSchedule(2, "2026-02-11", { scheduleId: "QA-UOB-FIRE-MONTHLY-V2" });
        const overlapWithVisit1 = overlap(visit1.schedule.sampledDeviceIds, visit2.schedule.sampledDeviceIds);
        qaAssert(overlapWithVisit1.length === 0, `Next monthly Fire Alarm visit repeated healthy sampled devices too early: ${overlapWithVisit1.join(", ")}.`);
        qaAssert(visit2.schedule.sampledDeviceIds.length === 6, "Mandatory Fire Alarm recheck reduced the next monthly 10% allocation.");
        qaAssert(visit2.schedule.mandatoryRecheckDeviceIds.includes(faultId), "Unresolved Fire Alarm fault was not added as mandatory recheck.");
        qaAssert(!visit2.schedule.sampledDeviceIds.includes(faultId), "Mandatory Fire Alarm recheck was also counted as a new sampled device.");
        qaAssert(visit2.schedule.criticalDeviceIds.includes(mfap.tag), "Visit 2 did not include MFAP.");
        qaAssert(visit2.schedule.plannedDeviceIds.length === 8, `Visit 2 should have 6 new + 1 MFAP + 1 recheck = 8, got ${visit2.schedule.plannedDeviceIds.length}.`);

        return {
          poolCount: visit1.pool.length,
          normalDeviceCount: fieldDevices.length,
          criticalDeviceCount: 1,
          visit1PlannedCount: visit1.schedule.plannedDeviceIds.length,
          visit1SampledCount: visit1.schedule.sampledDeviceIds.length,
          visit1CriticalCount: visit1.schedule.criticalDeviceIds.length,
          visit1RecheckCount: visit1.schedule.mandatoryRecheckDeviceIds.length,
          visit1PlannedIds: visit1.schedule.plannedDeviceIds,
          visit2PlannedCount: visit2.schedule.plannedDeviceIds.length,
          visit2SampledCount: visit2.schedule.sampledDeviceIds.length,
          visit2CriticalCount: visit2.schedule.criticalDeviceIds.length,
          visit2RecheckCount: visit2.schedule.mandatoryRecheckDeviceIds.length,
          visit2PlannedIds: visit2.schedule.plannedDeviceIds,
          unresolvedFaultId: faultId,
          overlapWithVisit1
        };
      }

      const monthly = runMonthlyScenario();
      const bimonthly = runFixedFrequencyScenario(20, 6, [1, 3, 5, 7, 9, 11]);
      qaAssert(bimonthly.totalPicked === 120, `Bi-monthly should select 120 sampled checks, got ${bimonthly.totalPicked}.`);
      qaAssert(new Set(bimonthly.table.slice(0, 5).flatMap((row) => row.sampledIds)).size === 100, "Bi-monthly first five visits should reach 100 unique without repeats.");
      qaAssert(bimonthly.uniquePicked === 100, `Bi-monthly annual cycle should cover 100 unique devices, got ${bimonthly.uniquePicked}.`);

      const trimonthly = runFixedFrequencyScenario(30, 4, [1, 4, 7, 10]);
      const triFirstThree = trimonthly.table.slice(0, 3).flatMap((row) => row.sampledIds);
      const triVisitFour = trimonthly.table[3];
      const triCoveredBeforeFour = new Set(triFirstThree);
      const triNewInVisitFour = triVisitFour.sampledIds.filter((id) => !triCoveredBeforeFour.has(id));
      qaAssert(trimonthly.totalPicked === 120, `Tri-monthly should select 120 sampled checks, got ${trimonthly.totalPicked}.`);
      qaAssert(new Set(triFirstThree).size === 90, "Tri-monthly first three visits should not repeat healthy sampled devices.");
      qaAssert(triNewInVisitFour.length === 10, `Tri-monthly final visit should include last 10 unique devices before repeat capacity, got ${triNewInVisitFour.length}.`);
      qaAssert(trimonthly.uniquePicked === 100, `Tri-monthly annual cycle should cover 100 unique devices, got ${trimonthly.uniquePicked}.`);

      const fireAlarmMonthly = runFireAlarmSystemMonthlyScenario();

      resetQaState(10, 2026);
      const thisYear = createAnnualSchedule(10, 1, "2026-01-11");
      const nextYear = createAnnualSchedule(10, 1, "2027-01-11");
      qaAssert(thisYear.schedule.annualCycleId === "annual-2026", `Unexpected 2026 cycle id ${thisYear.schedule.annualCycleId}.`);
      qaAssert(nextYear.schedule.annualCycleId === "annual-2027", `Unexpected 2027 cycle id ${nextYear.schedule.annualCycleId}.`);
      qaAssert(nextYear.cycle.coveredIds.length === 10, "Next annual cycle should start fresh from its own completed first visit.");

      resetQaState(10, 2026);
      const futureA = createAnnualSchedule(10, 1, "2026-06-11", { complete: false, scheduleId: "QA-FUTURE-A" });
      const futureB = createAnnualSchedule(10, 2, "2026-07-11", { complete: false, scheduleId: "QA-FUTURE-B" });
      qaAssert(overlap(futureA.sampledIds, futureB.sampledIds).length === 0, "Two future schedules unnecessarily reserved the same healthy sampled devices.");
      releaseScheduleScopeReservation(futureA.schedule);
      state.schedules = state.schedules.filter((schedule) => schedule.scheduleId !== futureA.schedule.scheduleId);
      const afterReleaseCycle = getScopeCycleRecord(futureB.schedule.rotationHistoryKey, baselineDevices.filter((device) => fixtureData.passiveTags.includes(device.tag)).map((device) => ({ ...device, id: device.tag })), { annualCycleId: "annual-2026" });
      qaAssert(!afterReleaseCycle.reservedIds.some((id) => futureA.sampledIds.includes(id)), "Deleting/cancelling future schedule did not release its reservation.");
      const futureC = createAnnualSchedule(10, 3, "2026-08-11", { complete: false, scheduleId: "QA-FUTURE-C" });
      qaAssert(overlap(futureA.sampledIds, futureC.sampledIds).length > 0, "Released reservation was not made available to a later future schedule.");

      resetQaState(10, 2026);
      const frozen = createAnnualSchedule(10, 1, "2026-02-11", { complete: false, scheduleId: "QA-FROZEN-SCOPE" });
      const beforeFrozenIds = [...frozen.schedule.plannedDeviceIds];
      for (let index = 101; index <= 150; index += 1) {
        const floor = fixtureData.floors[index % fixtureData.floors.length];
        state.setupDevices.push({
          tag: `QA.SD.${String(index).padStart(3, "0")}`,
          type: "Smoke Detector",
          companyName: fixtureData.profile.companyName,
          siteName: fixtureData.profile.siteName,
          floor: floor.title,
          floorId: floor.id,
          floorCode: floor.floorCode,
          floorTitle: floor.title,
          location: `Late imported checkpoint ${index}`,
          status: "Confirmed",
          xPercent: 20,
          yPercent: 20
        });
      }
      ensureSchedulePlannedScope(frozen.schedule);
      qaAssert(JSON.stringify(beforeFrozenIds) === JSON.stringify(frozen.schedule.plannedDeviceIds), "Frozen schedule regenerated a different plannedDeviceIds list after master data changed.");
      writeStoredJson("rmtSchedules", [frozen.schedule]);
      state.schedules = readStoredJson("rmtSchedules", []);
      ensureSchedulePlannedScope(state.schedules[0]);
      qaAssert(JSON.stringify(beforeFrozenIds) === JSON.stringify(state.schedules[0].plannedDeviceIds), "Refresh/resume did not preserve frozen plannedDeviceIds.");

      resetQaState(10, 2026);
      const mimicVisit1 = createAnnualSchedule(10, 1, "2026-03-11");
      const mandatoryTag = mimicVisit1.sampledIds[0];
      state.inspections[mandatoryTag] = { status: "Fail", notes: "Unresolved fault/defect - mandatory recheck" };
      const mimicVisit2 = createAnnualSchedule(10, 2, "2026-04-11", { complete: false, scheduleId: "QA-MIMIC-SCOPE" });
      const mandatoryDevice = state.setupDevices.find((device) => device.tag === mandatoryTag);
      const unassignedSameFloor = state.setupDevices.find((device) => {
        return device.floorId === mandatoryDevice.floorId
          && fixtureData.passiveTags.includes(device.tag)
          && !mimicVisit2.schedule.plannedDeviceIds.includes(device.tag);
      });
      qaAssert(unassignedSameFloor, "Mimic QA fixture could not find an unassigned same-floor device.");
      state.currentUser = { name: "Demo Technician", role: "Technician", email: "tech@rmtfire.local" };
      state.activeJob = {
        jobId: "JOB-QA-MIMIC-SCOPE",
        scheduleId: mimicVisit2.schedule.scheduleId,
        schedule: mimicVisit2.schedule,
        status: "Scheduled Job Started"
      };
      state.activeTechPreviewScheduleId = mimicVisit2.schedule.scheduleId;
      state.activeTechSystemKey = "fire-alarm";
      workspace.classList.remove("hidden", "admin-mode");
      workspace.classList.add("technician-mode");
      loginView.classList.add("hidden");
      setTechnicianMapFloor(mandatoryDevice.floorId, fixtureData.profile);
      setTechScreen("mimic", { scroll: false });
      renderMarkers();
      const visibleMarkers = [...document.querySelectorAll(".marker.setup-marker")].map((marker) => marker.dataset.setupTag || marker.dataset.label);
      qaAssert(visibleMarkers.includes(mandatoryTag), "Mandatory recheck pin was not visible in technician Service Scope mimic.");
      qaAssert(!visibleMarkers.includes(unassignedSameFloor.tag), "Technician Service Scope mimic showed an unrelated/unassigned master pin.");

      resetQaState(10, 2026);
      const integrityVisit1 = createAnnualSchedule(10, 1, "2026-01-11", { complete: false, scheduleId: "QA-INTEGRITY-V1" });
      const integrityInitialCycle = getPassiveCycleForSchedule(integrityVisit1.schedule);
      qaAssert(integrityInitialCycle.reservedIds.length === 10, `Visit 1 should reserve 10 planned sampled devices, got ${integrityInitialCycle.reservedIds.length}.`);
      qaAssert(integrityInitialCycle.coveredIds.length === 0, `Visit 1 should not mark coverage before inspection, got ${integrityInitialCycle.coveredIds.length}.`);
      const completedSeven = integrityVisit1.sampledIds.slice(0, 7);
      markInspected(completedSeven, "2026-01-11", "pass", { jobId: "JOB-QA-INTEGRITY-V1", scheduleId: integrityVisit1.schedule.scheduleId });
      state.inspections[integrityVisit1.sampledIds[7]] = {
        status: "pass",
        notes: "Stale local cache from another schedule must not count here.",
        inspectedAt: "2026-01-11T10:07:00.000Z",
        inspectedBy: "QA Technician",
        inspectedRole: "Technician",
        jobId: "JOB-OTHER-SCHEDULE",
        scheduleId: "QA-OTHER-SCHEDULE"
      };
      state.activeJob = {
        jobId: "JOB-QA-INTEGRITY-V1",
        scheduleId: integrityVisit1.schedule.scheduleId,
        schedule: integrityVisit1.schedule,
        status: "Completed",
        checkedOutAt: "2026-01-11T12:00:00.000Z",
        checkedOutBy: "QA Technician"
      };
      integrityVisit1.schedule.status = "Completed";
      completeScopeCycleSchedule(integrityVisit1.schedule);
      const partialCycle = getPassiveCycleForSchedule(integrityVisit1.schedule);
      qaAssert(partialCycle.coveredIds.length === 7, `Partial completion should cover only 7 inspected devices, got ${partialCycle.coveredIds.length}.`);
      qaAssert(completedSeven.every((id) => partialCycle.coveredIds.includes(id)), "Partial completion did not keep every actually inspected device in coverage.");
      qaAssert(!integrityVisit1.sampledIds.slice(7).some((id) => partialCycle.coveredIds.includes(id)), "Scheduled-but-unchecked devices were counted as covered.");
      qaAssert(!partialCycle.reservedIds.some((id) => completedSeven.includes(id)), "Completed partial schedule reservation was not cleared for completed devices.");

      const integrityFuture = createAnnualSchedule(10, 2, "2026-02-11", { complete: false, scheduleId: "QA-INTEGRITY-FUTURE" });
      const futureReservedBeforeDelete = [...getPassiveCycleForSchedule(integrityFuture.schedule).reservedIds];
      qaAssert(futureReservedBeforeDelete.some((id) => integrityFuture.sampledIds.includes(id)), "Future uncompleted schedule did not reserve its sampled devices.");
      releaseScheduleScopeReservation(integrityFuture.schedule);
      state.schedules = state.schedules.filter((schedule) => schedule.scheduleId !== integrityFuture.schedule.scheduleId);
      const afterFutureDeleteCycle = getPassiveCycleForSchedule(integrityVisit1.schedule);
      qaAssert(!afterFutureDeleteCycle.reservedIds.some((id) => integrityFuture.sampledIds.includes(id)), "Deleted future schedule reservations were not released.");
      qaAssert(completedSeven.every((id) => afterFutureDeleteCycle.coveredIds.includes(id)), "Deleting a future schedule damaged completed historical coverage.");

      const integrityVisitFull = createAnnualSchedule(10, 3, "2026-03-11", { complete: false, scheduleId: "QA-INTEGRITY-FULL" });
      markInspected(integrityVisitFull.sampledIds, "2026-03-11", "pass", { jobId: "JOB-QA-INTEGRITY-FULL", scheduleId: integrityVisitFull.schedule.scheduleId });
      state.activeJob = {
        jobId: "JOB-QA-INTEGRITY-FULL",
        scheduleId: integrityVisitFull.schedule.scheduleId,
        schedule: integrityVisitFull.schedule,
        status: "Completed",
        checkedOutAt: "2026-03-11T12:00:00.000Z",
        checkedOutBy: "QA Technician"
      };
      integrityVisitFull.schedule.status = "Completed";
      completeScopeCycleSchedule(integrityVisitFull.schedule);
      const fullCycle = getPassiveCycleForSchedule(integrityVisitFull.schedule);
      qaAssert(integrityVisitFull.sampledIds.every((id) => fullCycle.coveredIds.includes(id)), "Full completed visit did not remain in historical annual coverage.");
      qaAssert(!fullCycle.reservedIds.some((id) => integrityVisitFull.sampledIds.includes(id)), "Completed full visit was still held as a future reservation.");
      writeStoredJson("rmtScopeCycle", state.scopeCycle);
      writeStoredJson("tmFireScopeHistory", state.scopeHistory);
      state.scopeCycle = readStoredJson("rmtScopeCycle", {});
      state.scopeHistory = readStoredJson("tmFireScopeHistory", {});
      const reloadedCycle = getPassiveCycleForSchedule(integrityVisitFull.schedule);
      qaAssert(completedSeven.every((id) => reloadedCycle.coveredIds.includes(id)), "Reload lost partial completed coverage.");
      qaAssert(integrityVisitFull.sampledIds.every((id) => reloadedCycle.coveredIds.includes(id)), "Reload lost full-visit completed coverage.");
      qaAssert(!reloadedCycle.reservedIds.some((id) => integrityFuture.sampledIds.includes(id)), "Reload restored deleted future reservations.");

      resetQaState(10, 2026);
      const lifecycleVisit1 = createAnnualSchedule(10, 1, "2026-01-11");
      const lifecycleFault = lifecycleVisit1.sampledIds[0];
      state.inspections[lifecycleFault] = {
        status: "Fail",
        notes: "Unresolved fault/defect from previous visit",
        action: "Quotation required",
        inspectedAt: "2026-01-11T10:00:00.000Z",
        inspectedBy: "QA Technician",
        inspectedRole: "Technician",
        jobId: "JOB-QA-LIFECYCLE-V1",
        scheduleId: lifecycleVisit1.schedule.scheduleId
      };
      const lifecycleVisit2 = createAnnualSchedule(10, 2, "2026-02-11", { complete: false, scheduleId: "QA-LIFECYCLE-V2" });
      qaAssert(lifecycleVisit2.mandatoryIds.includes(lifecycleFault), "Unresolved fault did not become mandatory on the next visit.");
      markInspected([...lifecycleVisit2.sampledIds, ...lifecycleVisit2.mandatoryIds], "2026-02-11", "pass", {
        jobId: "JOB-QA-LIFECYCLE-V2",
        scheduleId: lifecycleVisit2.schedule.scheduleId
      });
      state.inspections[lifecycleFault] = {
        ...state.inspections[lifecycleFault],
        status: "pass",
        notes: "Resolved and successfully rechecked.",
        action: "Closed after recheck",
        inspectedAt: "2026-02-11T11:00:00.000Z"
      };
      state.activeJob = {
        jobId: "JOB-QA-LIFECYCLE-V2",
        scheduleId: lifecycleVisit2.schedule.scheduleId,
        schedule: lifecycleVisit2.schedule,
        status: "Completed",
        checkedOutAt: "2026-02-11T12:00:00.000Z",
        checkedOutBy: "QA Technician"
      };
      lifecycleVisit2.schedule.status = "Completed";
      completeScopeCycleSchedule(lifecycleVisit2.schedule);
      state.activeJob = null;
      const lifecycleVisit3 = createAnnualSchedule(10, 3, "2026-03-11", { complete: false, scheduleId: "QA-LIFECYCLE-V3" });
      qaAssert(!lifecycleVisit3.mandatoryIds.includes(lifecycleFault), "Resolved/rechecked fault stayed mandatory forever.");

      return {
        monthlyTable: monthly.table.map((row) => ({
          visit: row.visit,
          sampledCount: row.sampledCount,
          mandatoryCount: row.mandatoryCount,
          criticalCount: row.criticalCount,
          uniqueCovered: row.uniqueCovered,
          sampledIds: row.sampledIds,
          mandatoryIds: row.mandatoryIds
        })),
        bimonthlyTable: bimonthly.table.map((row) => ({
          visit: row.visit,
          sampledCount: row.sampledCount,
          mandatoryCount: row.mandatoryCount,
          criticalCount: row.criticalCount,
          uniqueCovered: row.uniqueCovered
        })),
        trimonthlyTable: trimonthly.table.map((row) => ({
          visit: row.visit,
          sampledCount: row.sampledCount,
          mandatoryCount: row.mandatoryCount,
          criticalCount: row.criticalCount,
          uniqueCovered: row.uniqueCovered
        })),
        coverageTotals: {
          eligibleSampledDevices: monthly.coverageSummary.eligibleCount,
          uniqueCovered: monthly.coverageSummary.uniqueCoveredCount,
          uniqueCoveragePercent: monthly.coverageSummary.uniqueCoveragePercent,
          totalInspections: monthly.coverageSummary.totalInspections,
          repeatInspections: monthly.coverageSummary.repeatInspections,
          faultRecheckRepeatCount: monthly.coverageSummary.faultRecheckRepeatCount,
          currentAnnualCycle: monthly.coverageSummary.annualCycleId
        },
        reservationCheck: {
          futureA: futureA.sampledIds,
          futureB: futureB.sampledIds,
          futureC: futureC.sampledIds,
          releasedOverlapWithFutureC: overlap(futureA.sampledIds, futureC.sampledIds).length
        },
        mimicScopeCheck: {
          mandatoryTag,
          unassignedSameFloor: unassignedSameFloor.tag,
          visibleMarkers
        },
        integrityCheck: {
          visit1PlannedIds: integrityVisit1.sampledIds,
          reservedImmediatelyAfterCreate: integrityInitialCycle.reservedIds,
          coveredImmediatelyAfterCreate: integrityInitialCycle.coveredIds,
          completedSeven,
          coveredAfterSevenCompleted: partialCycle.coveredIds,
          uncheckedScheduledIds: integrityVisit1.sampledIds.slice(7),
          deletedFuturePlannedIds: integrityFuture.sampledIds,
          reservedAfterFutureDelete: afterFutureDeleteCycle.reservedIds,
          fullVisitPlannedIds: integrityVisitFull.sampledIds,
          coveredAfterFullVisit: fullCycle.coveredIds,
          reloadedCoveredIds: reloadedCycle.coveredIds,
          reloadedReservedIds: reloadedCycle.reservedIds
        },
        faultRecheckLifecycle: {
          faultDeviceId: lifecycleFault,
          mandatoryInVisit2: lifecycleVisit2.mandatoryIds,
          mandatoryInVisit3: lifecycleVisit3.mandatoryIds,
          resolvedRemovedFromMandatory: !lifecycleVisit3.mandatoryIds.includes(lifecycleFault)
        },
        fireAlarmMonthly
      };
    }, fixture);
  });

  assert(!browserErrors.length, `Browser errors: ${browserErrors.join(" | ")}`);
  await context.close();
  await browser.close();

  console.log(JSON.stringify(results[0].value, null, 2));
  console.log("QA ANNUAL SCOPE COMPLETE");
})().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
});
