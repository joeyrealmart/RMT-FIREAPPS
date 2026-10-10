const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260905-linked-verification-v1";
const BASE_URL = APP_URL.replace(/\?.*$/, "").replace(/\/$/, "");
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (options.expect && response.status !== options.expect) {
    throw new Error(`Expected HTTP ${options.expect} for ${path}, got ${response.status}: ${text}`);
  }
  if (!options.expect && response.status >= 400) {
    throw new Error(`HTTP ${response.status} for ${path}: ${text}`);
  }
  return { status: response.status, payload };
}

function linkedDefinitions(prefix) {
  return [
    {
      linkedVerificationId: `${prefix}-PUMP`,
      verificationType: "FIRE_PUMP_INDICATION",
      title: "QA Fire Pump Indication",
      systemId: "pump-system",
      definitionVersion: "qa-1",
      reconciliationMode: "MATCHING_RESULTS",
      requiredSides: [
        {
          sideId: "PUMP_ROOM",
          sideName: "Pump Room",
          location: "QA pump control equipment",
          assignedTechnicianId: "tech@rmtfire.local",
          assignedTechnicianName: "Demo Technician"
        },
        {
          sideId: "MFAP",
          sideName: "MFAP",
          location: "QA main fire alarm panel",
          assignedTechnicianId: "tech2@rmtfire.local",
          assignedTechnicianName: "Tech 2"
        }
      ]
    },
    {
      linkedVerificationId: `${prefix}-GAS`,
      verificationType: "CO2_GAS_RELEASE_INDICATION",
      title: "QA CO2 / Gas Release Indication",
      systemId: "gas-release",
      definitionVersion: "qa-1",
      reconciliationMode: "MATCHING_RESULTS",
      requiredSides: [
        {
          sideId: "SUPPRESSION_SYSTEM_LOCATION",
          sideName: "Suppression System Location",
          location: "QA CO2 system room",
          assignedTechnicianId: "tech@rmtfire.local",
          assignedTechnicianName: "Demo Technician"
        },
        {
          sideId: "REMOTE_PANEL_OR_MFAP",
          sideName: "Remote Panel / MFAP",
          location: "QA remote monitoring panel",
          assignedTechnicianId: "tech2@rmtfire.local",
          assignedTechnicianName: "Tech 2"
        }
      ]
    }
  ];
}

function buildSchedule(scheduleId, definitions = linkedDefinitions(scheduleId)) {
  return {
    scheduleId,
    jobId: `JOB-${scheduleId}`,
    status: "Scheduled",
    clientSource: "existing",
    companyName: "QA Linked Verification",
    siteName: "QA Two Location Site",
    floorId: "qa-linked-l1",
    startFloorId: "qa-linked-l1",
    floorTitle: "QA Linked Level 1",
    startFloorTitle: "QA Linked Level 1",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    technician: "Technician Pool",
    serviceType: "Maintenance / Inspection",
    scope: "yearly-100",
    scopeLabel: "QA Linked Verification",
    contractFrequencyPercent: 100,
    scopeSelectionMode: "site-wide",
    scopeFrozen: true,
    plannedDeviceIds: ["QA.LV.PUMP.1", "QA.LV.CO2.1"],
    plannedFloorCounts: [{ floorId: "qa-linked-l1", floorTitle: "QA Linked Level 1", count: 2 }],
    deviceCount: 2,
    activeCount: 2,
    passiveCount: 0,
    linkedVerifications: definitions,
    notes: "QA only: linked verification V1"
  };
}

function sideRecord(schedule, definition, side, technician, result, submissionId) {
  return {
    linkedVerificationId: definition.linkedVerificationId,
    jobId: schedule.jobId,
    scheduleId: schedule.scheduleId,
    clientId: schedule.companyName,
    siteId: schedule.siteName,
    systemId: definition.systemId,
    verificationType: definition.verificationType,
    definitionVersion: definition.definitionVersion,
    sideId: side.sideId,
    technicianId: technician.id,
    technicianName: technician.name,
    technicianRole: "Technician",
    result,
    notes: "QA linked side result",
    evidenceRefs: [],
    localCompletedAt: new Date().toISOString(),
    timestamp: new Date().toISOString(),
    submissionId
  };
}

async function runServerRegression() {
  const scheduleId = `QA-LINKED-SERVER-${Date.now()}`;
  const schedule = buildSchedule(scheduleId);
  const [pump, gas] = schedule.linkedVerifications;
  const techA = { id: "tech@rmtfire.local", name: "Demo Technician" };
  const techB = { id: "tech2@rmtfire.local", name: "Tech 2" };

  const migrated = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/migrate`, {
    method: "POST",
    expect: 200,
    body: { schedule }
  });
  assert(migrated.payload.linkedVerifications.length === 2, "Both generic linked-verification definitions should be stored.");

  const wrongSide = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/linked-verification-sides`, {
    method: "POST",
    expect: 403,
    body: {
      schedule,
      expectedRevision: 0,
      record: sideRecord(schedule, pump, pump.requiredSides[1], techA, "CONFIRMED", "wrong-side")
    }
  });
  assert(wrongSide.payload.forbidden, "Tech A must not be able to save Tech B's side.");

  const tamperedSchedule = JSON.parse(JSON.stringify(schedule));
  tamperedSchedule.linkedVerifications[0].requiredSides[1].assignedTechnicianId = techA.id;
  tamperedSchedule.linkedVerifications[0].requiredSides[1].assignedTechnicianName = techA.name;
  const tamperedAssignment = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/linked-verification-sides`, {
    method: "POST",
    expect: 403,
    body: {
      schedule: tamperedSchedule,
      expectedRevision: 0,
      record: sideRecord(tamperedSchedule, tamperedSchedule.linkedVerifications[0], tamperedSchedule.linkedVerifications[0].requiredSides[1], techA, "CONFIRMED", "tampered-side")
    }
  });
  assert(tamperedAssignment.payload.forbidden, "A client payload must not be able to reassign a frozen linked-verification side.");

  const pumpARecord = sideRecord(schedule, pump, pump.requiredSides[0], techA, "CONFIRMED", "pump-a-1");
  const pumpA = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/linked-verification-sides`, {
    method: "POST",
    expect: 200,
    body: { schedule, expectedRevision: 0, record: pumpARecord }
  });
  assert(pumpA.payload.linkedVerification.status === "AWAITING_COUNTERPART", "One completed pump side must await its counterpart.");
  assert(pumpA.payload.record.technicianId === techA.id, "Pump Side A must retain technician identity.");
  assert(pumpA.payload.record.localCompletedAt, "Pump Side A must retain its local completion time.");

  const duplicate = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/linked-verification-sides`, {
    method: "POST",
    expect: 200,
    body: { schedule, expectedRevision: 0, record: pumpARecord }
  });
  assert(duplicate.payload.idempotent === true, "A duplicate side submission must be idempotent.");
  assert(duplicate.payload.record.revision === 1, "An idempotent side submission must not increment revision.");

  const pumpB = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/linked-verification-sides`, {
    method: "POST",
    expect: 200,
    body: {
      schedule,
      expectedRevision: 0,
      record: sideRecord(schedule, pump, pump.requiredSides[1], techB, "CONFIRMED", "pump-b-1")
    }
  });
  assert(pumpB.payload.linkedVerification.status === "VERIFIED", "Matching synced pump sides must reconcile to VERIFIED.");
  assert(pumpB.payload.linkedVerification.sides.every((side) => side.record), "Reconciled pump event must preserve both side records.");

  const gasA = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/linked-verification-sides`, {
    method: "POST",
    expect: 200,
    body: {
      schedule,
      expectedRevision: 0,
      record: sideRecord(schedule, gas, gas.requiredSides[0], techA, "CONFIRMED", "gas-a-1")
    }
  });
  assert(gasA.payload.linkedVerification.status === "AWAITING_COUNTERPART", "One gas side must await its counterpart.");

  const gasB = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/linked-verification-sides`, {
    method: "POST",
    expect: 200,
    body: {
      schedule,
      expectedRevision: 0,
      record: sideRecord(schedule, gas, gas.requiredSides[1], techB, "NOT_CONFIRMED", "gas-b-1")
    }
  });
  assert(gasB.payload.linkedVerification.status === "MISMATCH_REVIEW_REQUIRED", "Different gas-side results must require mismatch review.");

  const stale = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/linked-verification-sides`, {
    method: "POST",
    expect: 409,
    body: {
      schedule,
      expectedRevision: 0,
      record: sideRecord(schedule, gas, gas.requiredSides[0], techA, "NOT_CONFIRMED", "gas-a-stale")
    }
  });
  assert(stale.payload.conflict, "A stale same-side save must conflict rather than overwrite.");
  assert(stale.payload.current.result === "CONFIRMED", "The authoritative same-side result must survive a stale save.");
  assert(stale.payload.linkedVerification.status === "MISMATCH_REVIEW_REQUIRED", "A side revision conflict must flag Admin review.");

  const finalState = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/state`, { expect: 200 });
  assert(Object.keys(finalState.payload.store.linkedVerificationSideRecords).length === 4, "Pump and gas events must retain four independent side records.");
  assert(finalState.payload.store.linkedVerificationAudit.some((item) => item.event === "SIDE_SAVE_CONFLICT"), "Side conflict must be preserved in audit history.");
  return { scheduleId, pumpStatus: pumpB.payload.linkedVerification.status, gasStatus: stale.payload.linkedVerification.status };
}

async function login(page, email) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", "linked-verification-qa");
  await page.locator("#loginForm button[type='submit']").click();
  await page.waitForFunction(() => !document.querySelector("#workspace")?.classList.contains("hidden"), null, { timeout: 20000 });
}

async function seedBrowserFixture(page, schedule, systemId) {
  await page.evaluate(async ({ schedule, systemId }) => {
    const floor = {
      id: schedule.floorId,
      floorId: schedule.floorId,
      title: schedule.floorTitle,
      floorCode: "L1",
      companyName: schedule.companyName,
      siteName: schedule.siteName,
      src: defaultFloorAssets.lv1.src,
      cleanSrc: defaultFloorAssets.lv1.src,
      active: true
    };
    const devices = [
      {
        tag: "QA.LV.PUMP.1",
        type: "Fire Pump",
        short: "PUMP",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: schedule.companyName,
        siteName: schedule.siteName,
        location: "QA pump room",
        xPercent: 30,
        yPercent: 40,
        status: "Confirmed"
      },
      {
        tag: "QA.LV.CO2.1",
        type: "CO2 System",
        short: "CO2",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: schedule.companyName,
        siteName: schedule.siteName,
        location: "QA suppression room",
        xPercent: 65,
        yPercent: 45,
        status: "Confirmed"
      }
    ];
    state.schedules = [schedule];
    state.siteProfile = { companyName: schedule.companyName, siteName: schedule.siteName };
    state.mimicFloors = [floor];
    state.setupDevices = devices;
    state.activeJob = {
      jobId: schedule.jobId,
      scheduleId: schedule.scheduleId,
      schedule,
      status: "Started",
      inspector: getCurrentUserName(),
      teamMembers: [getCurrentUserName()],
      startedAt: new Date().toISOString(),
      events: []
    };
    state.activeTechPreviewScheduleId = schedule.scheduleId;
    state.activeTechSystemKey = systemId;
    state.activeTechFloorId = floor.id;
    browserDataState.fieldLoaded = true;
    browserDataState.runLoaded = true;
    browserDataState.loadedDeviceMasterProfiles.add(getProfileCacheKey(state.siteProfile));
    await requestSharedJobState(schedule, { migrate: false, apply: true });
    renderFloorOptions(floor.id, state.siteProfile, { renderSchedule: false });
    setTechScreen("mimic", { scroll: false, renderMarkers: false });
    renderTechWorkPanel();
    renderTechSystemStagePanel(schedule);
  }, { schedule, systemId });
}

async function runBrowserOfflineRegression() {
  const scheduleId = `QA-LINKED-BROWSER-${Date.now()}`;
  const definitions = linkedDefinitions(scheduleId).slice(0, 1);
  const schedule = buildSchedule(scheduleId, definitions);
  await api(`/api/jobs/${encodeURIComponent(scheduleId)}/migrate`, {
    method: "POST",
    expect: 200,
    body: { schedule }
  });

  const executablePath = EDGE_PATHS.find(existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  const contextA = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const contextB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  try {
    await login(pageA, "tech@rmtfire.local");
    await login(pageB, "tech2@rmtfire.local");
    await seedBrowserFixture(pageA, schedule, "pump-system");
    await seedBrowserFixture(pageB, schedule, "pump-system");

    await pageA.evaluate(() => setTechScreen("jobs", { scroll: false }));
    assert(await pageA.locator("#techLinkedVerificationDesk").isVisible(), "Technician Front Desk must show linked work.");
    assert(await pageB.locator("#adminLinkedVerificationPanel").isHidden(), "Admin linked controls must not leak into Technician view.");
    await pageA.evaluate(() => setTechScreen("mimic", { scroll: false, renderMarkers: false }));

    const routePattern = `**/api/jobs/${scheduleId}/linked-verification-sides`;
    await pageA.route(routePattern, (route) => route.abort("failed"));
    await pageB.route(routePattern, (route) => route.abort("failed"));
    const editableSidesA = await pageA.evaluate((schedule) => {
      const definition = getScheduleLinkedVerificationDefinitions(schedule)[0];
      return definition.requiredSides.filter((side) => linkedVerificationTechnicianMatches(side)).map((side) => side.sideId);
    }, schedule);
    const editableSidesB = await pageB.evaluate((schedule) => {
      const definition = getScheduleLinkedVerificationDefinitions(schedule)[0];
      return definition.requiredSides.filter((side) => linkedVerificationTechnicianMatches(side)).map((side) => side.sideId);
    }, schedule);
    assert(JSON.stringify(editableSidesA) === JSON.stringify(["PUMP_ROOM"]), "Tech A must edit only Pump Room.");
    assert(JSON.stringify(editableSidesB) === JSON.stringify(["MFAP"]), "Tech B must edit only MFAP.");

    await pageA.evaluate(async (schedule) => {
      const definition = getScheduleLinkedVerificationDefinitions(schedule)[0];
      const side = definition.requiredSides.find((item) => linkedVerificationTechnicianMatches(item));
      await saveLinkedVerificationSide(schedule, definition, side, { result: "CONFIRMED", notes: "Offline Pump Room QA", evidenceRefs: [] });
    }, schedule);
    await pageB.evaluate(async (schedule) => {
      const definition = getScheduleLinkedVerificationDefinitions(schedule)[0];
      const side = definition.requiredSides.find((item) => linkedVerificationTechnicianMatches(item));
      await saveLinkedVerificationSide(schedule, definition, side, { result: "CONFIRMED", notes: "Offline MFAP QA", evidenceRefs: [] });
    }, schedule);
    await pageA.waitForFunction(() => Object.keys(state.linkedVerificationDrafts || {}).length === 1);
    await pageB.waitForFunction(() => Object.keys(state.linkedVerificationDrafts || {}).length === 1);
    const [draftA, draftB] = await Promise.all([
      pageA.evaluate(() => Object.values(state.linkedVerificationDrafts)[0]),
      pageB.evaluate(() => Object.values(state.linkedVerificationDrafts)[0])
    ]);
    assert(draftA.technicianId === "tech@rmtfire.local" && draftA.sideId === "PUMP_ROOM", "Tech A offline draft must retain identity and side.");
    assert(draftB.technicianId === "tech2@rmtfire.local" && draftB.sideId === "MFAP", "Tech B offline draft must retain identity and side.");
    assert(draftA.localCompletedAt && draftB.localCompletedAt, "Both offline drafts must retain local completion time.");
    assert(draftA.result === "CONFIRMED" && draftB.result === "CONFIRMED", "Both offline drafts must retain result.");

    await pageA.unroute(routePattern);
    await pageB.unroute(routePattern);
    const syncA = await pageA.evaluate(() => syncLinkedVerificationDrafts());
    assert(syncA.synced === 1, "Tech A offline side should sync independently.");
    const afterA = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/state`, { expect: 200 });
    assert(afterA.payload.linkedVerifications[0].status === "AWAITING_COUNTERPART", "One synced offline side must not verify the event.");
    const syncB = await pageB.evaluate(() => syncLinkedVerificationDrafts());
    assert(syncB.synced === 1, "Tech B offline side should sync independently.");
    const afterB = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/state`, { expect: 200 });
    assert(afterB.payload.linkedVerifications[0].status === "VERIFIED", "Both matching synced offline sides must reconcile to VERIFIED.");
    assert(Object.keys(afterB.payload.store.linkedVerificationSideRecords).length === 2, "Reconciliation must preserve two separate side records.");

    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const adminPage = await adminContext.newPage();
    await login(adminPage, "admin@rmtfire.local");
    await adminPage.evaluate(async (schedule) => {
      state.schedules = [schedule];
      await loadLinkedVerificationIndex();
      setAdminModule("staff");
      renderAdminLinkedVerificationPanel();
    }, schedule);
    await adminPage.waitForSelector("#adminLinkedVerificationPanel");
    const adminText = await adminPage.locator("#adminLinkedVerificationPanel").innerText();
    assert(adminText.includes("Demo Technician") && adminText.includes("Tech 2"), "Admin must see both technician identities.");
    assert(adminText.includes("Pump Room") && adminText.includes("MFAP"), "Admin must see both linked side locations.");
    assert(adminText.includes("Verified"), "Admin must see final reconciliation status.");
    await adminContext.close();

    await browser.close();
    return { scheduleId, offlineSides: 2, finalStatus: afterB.payload.linkedVerifications[0].status };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

(async () => {
  try {
    const server = await runServerRegression();
    const browser = await runBrowserOfflineRegression();
    console.log("PASS qa-linked-verification-v1");
    console.log(JSON.stringify({ server, browser }, null, 2));
  } catch (error) {
    console.error("FAIL qa-linked-verification-v1");
    console.error(error);
    process.exit(1);
  }
})();
