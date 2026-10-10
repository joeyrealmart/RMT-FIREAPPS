const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260906-extinguisher-assets-v1";
const BASE_URL = APP_URL.replace(/\?.*$/, "").replace(/\/$/, "");
const SCHEDULE_PATH = join(__dirname, "..", "outputs", "rmt-fire-local-data", "schedules", "service-schedules.json");
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
  if (options.expect && response.status !== options.expect) throw new Error(`Expected ${options.expect}, got ${response.status}: ${text}`);
  if (!options.expect && response.status >= 400) throw new Error(`HTTP ${response.status}: ${text}`);
  return { status: response.status, payload };
}

function buildAssets(prefix, count = 5) {
  return Array.from({ length: count }, (_, index) => ({
    serialNumber: `${prefix}-${String(index + 1).padStart(3, "0")}`,
    brand: "RMT QA",
    agentType: index % 2 ? "CO2" : "ABC",
    sizeKg: index % 2 ? "2kg" : "9kg",
    floor: "Level 1",
    location: `QA Location ${index + 1}`,
    expiryDate: "2027-12-31",
    registeredAddress: "QA only",
    rawQrPayload: `QA:${prefix}:${index + 1}`
  }));
}

function buildSchedule(scheduleId, companyName, siteName) {
  return {
    scheduleId,
    jobId: `JOB-${scheduleId}`,
    status: "Scheduled",
    companyName,
    siteName,
    clientSource: "Existing Client",
    floorId: "extinguisher-standalone",
    floorTitle: "Extinguisher Asset Verification",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    technician: "Demo Technician",
    serviceType: "Fire Extinguisher Collection",
    scope: "extinguisher-collection",
    scopeLabel: "Extinguisher Collection / Delivery",
    plannedDeviceIds: [],
    deviceCount: 0,
    tracking: {},
    photoProof: {},
    notes: "QA only: frozen extinguisher asset verification"
  };
}

function verification(schedule, asset, result, extra = {}) {
  return {
    assetId: asset.assetId,
    serialNumber: asset.serialNumber,
    result,
    technicianId: "tech@rmtfire.local",
    technicianName: "Demo Technician",
    timestamp: new Date().toISOString(),
    notes: `QA ${result}`,
    evidenceRefs: [],
    ...extra
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  Object.entries(entries).forEach(([name, text]) => {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(text);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  });
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function buildQaXlsxBase64() {
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
      <row r="1"><c r="A1" t="inlineStr"><is><t>serial_number</t></is></c><c r="B1" t="inlineStr"><is><t>location</t></is></c><c r="C1" t="inlineStr"><is><t>agent_type</t></is></c></row>
      <row r="2"><c r="A2" t="inlineStr"><is><t>XLSX-QA-001</t></is></c><c r="B2" t="inlineStr"><is><t>Excel Lobby</t></is></c><c r="C2" t="inlineStr"><is><t>ABC</t></is></c></row>
    </sheetData></worksheet>`;
  return makeStoredZip({ "xl/worksheets/sheet1.xml": sheet }).toString("base64");
}

async function runServerQa() {
  const stamp = Date.now();
  const companyName = `QA EXT ASSETS ${stamp}`;
  const siteName = "QA SERIAL SITE";
  const schedule = buildSchedule(`QA-EXT-ASSET-${stamp}`, companyName, siteName);
  const assets = buildAssets(`SER${stamp}`, 5);
  const imported = await api("/api/extinguisher-assets/master-import", {
    method: "POST",
    body: {
      companyName,
      siteName,
      expectedRevision: 0,
      assets,
      importedBy: "QA Admin",
      sourceDocument: {
        name: "qa-extinguisher-register.csv",
        type: "CSV_IMPORT",
        reference: "QA-REGISTER-001",
        size: 512,
        dataUrl: `data:text/csv;base64,${Buffer.from("serial_number,location\nQA,QA").toString("base64")}`
      }
    }
  });
  assert(imported.payload.master.assets.length === 5, "Master import should contain five serial-based assets.");
  assert(imported.payload.master.sourceDocuments[0].reference === "QA-REGISTER-001", "Source reference was not retained.");

  const frozen = await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/extinguisher-freeze`, {
    method: "POST",
    body: { schedule, frozenBy: "QA Admin" }
  });
  assert(frozen.payload.snapshot.assets.length === 5, "Frozen job should contain five assets.");
  const frozenSerials = frozen.payload.snapshot.assets.map((asset) => asset.serialNumber);
  const secondImport = await api("/api/extinguisher-assets/master-import", {
    method: "POST",
    body: {
      companyName,
      siteName,
      expectedRevision: imported.payload.master.revision,
      assets: [...assets, ...buildAssets(`LATE${stamp}`, 1)],
      importedBy: "QA Admin",
      sourceDocument: { name: "qa-revision.xlsx", type: "XLSX_IMPORT", reference: "QA-REGISTER-002", size: 1024 }
    }
  });
  assert(secondImport.payload.master.assets.length === 6, "Updated master should contain six assets.");
  const refrozen = await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/extinguisher-freeze`, { method: "POST", body: { schedule, frozenBy: "QA Admin" } });
  assert(refrozen.payload.idempotent && refrozen.payload.snapshot.assets.length === 5, "Existing job snapshot must remain frozen after master edits.");
  assert(JSON.stringify(refrozen.payload.snapshot.assets.map((asset) => asset.serialNumber)) === JSON.stringify(frozenSerials), "Frozen serial list changed after master import.");

  const frozenAssets = frozen.payload.snapshot.assets;
  const saves = [
    verification(schedule, frozenAssets[0], "VERIFIED"),
    verification(schedule, frozenAssets[1], "MISSING", { proposeRemoval: true, proposalId: `${schedule.scheduleId}-REMOVE` }),
    verification(schedule, frozenAssets[2], "MOVED", { currentLocation: "QA New Corridor", proposalId: `${schedule.scheduleId}-MOVE` }),
    verification(schedule, frozenAssets[3], "FAULT"),
    verification(schedule, frozenAssets[4], "REPLACED", { replacementSerial: `REPL-${stamp}`, proposalId: `${schedule.scheduleId}-REPLACE` })
  ];
  for (const record of saves) {
    await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/extinguisher-verifications`, { method: "POST", body: { schedule, expectedRevision: 0, record } });
  }
  const found = await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/extinguisher-verifications`, {
    method: "POST",
    body: {
      schedule,
      expectedRevision: 0,
      record: {
        assetId: `ext-found::new-${stamp}`,
        serialNumber: `NEW-${stamp}`,
        result: "NEW_UNIT_FOUND",
        technicianId: "tech2@rmtfire.local",
        technicianName: "Tech 2",
        timestamp: new Date().toISOString(),
        currentLocation: "QA New Unit Location",
        notes: "QA site-found unit",
        evidenceRefs: [],
        proposalId: `${schedule.scheduleId}-NEW`
      }
    }
  });
  assert(found.payload.reconciliation.expected === 5, "New unit must not change frozen expected count.");
  assert(found.payload.reconciliation.completed === 5 && found.payload.reconciliation.newUnitFound === 1, "Reconciliation counts are incorrect.");
  assert(found.payload.reconciliation.pendingMasterChanges === 4, "Expected remove, move, replace and add proposals.");

  const masterBeforeReview = await api(`/api/extinguisher-assets/master?companyName=${encodeURIComponent(companyName)}&siteName=${encodeURIComponent(siteName)}`);
  assert(masterBeforeReview.payload.master.assets.length === 6, "Technician proposals must not mutate the master automatically.");
  const stateBeforeReview = await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/state`);
  assert(stateBeforeReview.payload.store.extinguisherAudit.some((entry) => entry.result === "FAULT" && entry.technicianId === "tech@rmtfire.local" && entry.notes === "QA FAULT"), "Verification audit must retain technician, result and notes.");

  await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/extinguisher-proposal-review`, {
    method: "POST",
    body: { proposalId: `${schedule.scheduleId}-NEW`, action: "APPROVE", reviewedBy: "QA Admin" }
  });
  await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/extinguisher-proposal-review`, {
    method: "POST",
    body: { proposalId: `${schedule.scheduleId}-MOVE`, action: "REJECT", reviewedBy: "QA Admin" }
  });
  await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/extinguisher-proposal-review`, {
    method: "POST",
    body: { proposalId: `${schedule.scheduleId}-REPLACE`, action: "ADJUST", reviewedBy: "QA Admin", proposedChanges: { replacementSerial: `ADJ-${stamp}` } }
  });
  await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/extinguisher-proposal-review`, {
    method: "POST",
    body: { proposalId: `${schedule.scheduleId}-REPLACE`, action: "APPROVE", reviewedBy: "QA Admin" }
  });
  const masterAfterReview = await api(`/api/extinguisher-assets/master?companyName=${encodeURIComponent(companyName)}&siteName=${encodeURIComponent(siteName)}`);
  assert(masterAfterReview.payload.master.assets.some((asset) => asset.serialNumber === `NEW-${stamp}`), "Approved new unit was not added to master.");
  assert(masterAfterReview.payload.master.assets.some((asset) => asset.serialNumber === `ADJ-${stamp}`), "Adjusted replacement was not added to master.");
  const stateAfterReview = await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/state`);
  assert(stateAfterReview.payload.store.extinguisherAssetSnapshot.assets.length === 5, "Admin approval must not alter historical frozen job scope.");

  const duplicate = await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/extinguisher-verifications`, {
    method: "POST",
    body: { schedule, expectedRevision: 0, record: saves[0] }
  });
  assert(duplicate.payload.idempotent, "An exact duplicate save should be idempotent.");
  const revised = await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/extinguisher-verifications`, {
    method: "POST",
    body: { schedule, expectedRevision: 1, record: { ...saves[0], result: "FAULT", notes: "QA follow-up fault" } }
  });
  assert(revised.payload.record.revision === 2, "A valid follow-up verification should advance the record revision.");
  const auditState = await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/state`);
  const assetAudit = auditState.payload.store.extinguisherAudit.filter((entry) => entry.assetId === frozenAssets[0].assetId && entry.event === "ASSET_VERIFICATION_SAVED");
  assert(assetAudit.length === 2 && assetAudit[0].result === "VERIFIED" && assetAudit[1].result === "FAULT", "Prior extinguisher audit entries must remain append-only after a revision.");
  const staleChanged = await api(`/api/jobs/${encodeURIComponent(schedule.scheduleId)}/extinguisher-verifications`, {
    method: "POST",
    body: { schedule, expectedRevision: 1, record: { ...saves[0], notes: "Changed stale payload" } },
    expect: 409
  });
  assert(staleChanged.payload.conflict, "A changed stale extinguisher verification must return a conflict.");

  return { schedule, companyName, siteName, frozenCount: 5, reconciliation: found.payload.reconciliation };
}

async function loginAsTech(page) {
  await page.click("[data-demo-login='tech']");
  await page.fill("#loginPassword", "qa-local");
  await page.click("#loginForm button[type='submit']");
  await page.waitForSelector("#workspace.technician-mode", { timeout: 20000 });
}

async function runBrowserQa(browser, serverFixture) {
  const scheduleId = `${serverFixture.schedule.scheduleId}-UI`;
  const schedule = buildSchedule(scheduleId, serverFixture.companyName, serverFixture.siteName);
  const frozen = await api(`/api/jobs/${encodeURIComponent(scheduleId)}/extinguisher-freeze`, { method: "POST", body: { schedule, frozenBy: "QA Admin" } });
  schedule.extinguisherAssetSnapshotId = frozen.payload.snapshot.snapshotId;
  schedule.plannedExtinguisherAssetIds = frozen.payload.snapshot.assetIds;
  schedule.extinguisherAssetCount = frozen.payload.snapshot.assetIds.length;
  schedule.extinguisherScopeFrozen = true;

  const context = await browser.newContext({ viewport: { width: 393, height: 727 }, userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 Chrome/121 Mobile Safari/537.36" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await loginAsTech(page);
  const importParsers = await page.evaluate(async (xlsxBase64) => {
    const csvRows = await parseExtinguisherAssetFile(new File(["serial_number,location\nCSV-QA-001,CSV Lobby"], "qa.csv", { type: "text/csv" }));
    const binary = Uint8Array.from(atob(xlsxBase64), (character) => character.charCodeAt(0));
    const xlsxRows = await parseExtinguisherAssetFile(new File([binary], "qa.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    return { csvRows, xlsxRows };
  }, buildQaXlsxBase64());
  assert(importParsers.csvRows[0].serial_number === "CSV-QA-001", "CSV structured import parser failed.");
  assert(importParsers.xlsxRows[0].serial_number === "XLSX-QA-001" && importParsers.xlsxRows[0].location === "Excel Lobby", "XLSX structured import parser failed.");
  await page.evaluate((seed) => {
    state.schedules = [seed];
    writeStoredJson("rmtSchedules", state.schedules);
    renderSchedulePanel();
  }, schedule);
  await page.click(`.tech-ext-load-btn[data-schedule-id="${scheduleId}"]`);
  await page.waitForSelector("#techExtinguisherPanel:not(.hidden) .ext-asset-item", { timeout: 15000 });
  const initial = await page.evaluate(() => ({
    cards: document.querySelectorAll("#techExtAssetList .ext-asset-item").length,
    serials: [...document.querySelectorAll("#techExtAssetList .ext-asset-item-head strong")].map((node) => node.textContent.trim()),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  assert(initial.cards === schedule.extinguisherAssetCount, "Technician list does not match frozen asset count.");
  assert(initial.scrollWidth <= initial.clientWidth + 1, "Extinguisher asset workflow causes Android horizontal overflow.");
  await page.fill("#techExtCollectedUnits", "1");
  await page.click("#saveTechExtinguisherBtn");
  await page.waitForFunction(() => document.querySelector("#syncState")?.textContent.includes("missing collection photo"));
  assert(await page.locator("#techExtinguisherPanel:not(.hidden)").count() === 1, "Existing form should remain open when required collection evidence is missing.");
  await page.fill("#techExtCollectedUnits", "0");
  await page.locator(".ext-asset-verify-btn").first().click();
  await page.waitForFunction(() => document.querySelector("#techExtAssetList .status-pill")?.textContent.includes("VERIFIED"));
  await page.fill("#techExtAssetSearch", initial.serials[0]);
  assert(await page.locator("#techExtAssetList .ext-asset-item").count() === 1, "Serial search should show one matching asset.");
  await page.fill("#techExtAssetSearch", "");
  await page.locator(".ext-asset-exception-btn").nth(1).click();
  const exception = page.locator("[data-ext-exception-form]:not(.hidden)").first();
  await exception.locator("[data-ext-result]").selectOption({ label: "Replaced" });
  await exception.locator("[data-ext-replacement-serial]").fill("");
  await exception.locator("button[type='submit']").click();
  await page.waitForFunction(() => document.querySelector("#syncState")?.textContent.includes("Replacement serial is required"));
  const invalidDraftCount = await page.evaluate(() => Object.keys(state.extinguisherAssetDrafts || {}).length);
  assert(invalidDraftCount === 0, "A server validation rejection must not be stored as an offline draft.");
  await exception.locator("[data-ext-result]").selectOption({ label: "Moved" });
  await exception.locator("[data-ext-current-location]").fill("QA UI New Location");
  await exception.locator("button[type='submit']").click();
  await page.waitForFunction(() => [...document.querySelectorAll("#techExtAssetList .status-pill")].some((node) => node.textContent.includes("MOVED")));
  const verificationRoute = `**/api/jobs/${scheduleId}/extinguisher-verifications`;
  await page.route(verificationRoute, (route) => route.abort("internetdisconnected"));
  await page.locator(".ext-asset-verify-btn").nth(2).click();
  await page.waitForFunction(() => [...document.querySelectorAll("#techExtAssetList .status-pill")].some((node) => node.textContent.includes("UNSYNCED")));
  assert(await page.evaluate(() => Object.keys(state.extinguisherAssetDrafts || {}).length) === 1, "Offline verification draft was not retained.");
  await page.unroute(verificationRoute);
  assert(await page.evaluate(() => syncExtinguisherAssetDrafts()) === 1, "Reconnect did not sync the independent extinguisher draft.");
  assert(await page.evaluate(() => Object.keys(state.extinguisherAssetDrafts || {}).length) === 0, "Synced extinguisher draft was not cleared.");
  await page.click("#showNewExtAssetBtn");
  await page.fill("#newExtAssetSerial", `UI-FOUND-${Date.now()}`);
  await page.fill("#newExtAssetLocation", "QA UI Found Location");
  await page.fill("#newExtAssetType", "ABC");
  await page.click("#newExtAssetForm button[type='submit']");
  await page.waitForFunction(() => document.querySelector("#techExtAssetList")?.textContent.includes("Additional Site-Found Units"));

  const frozenIdsBeforeFormSave = [...schedule.plannedExtinguisherAssetIds];
  await page.click("#saveTechExtinguisherBtn");
  const preserved = await page.evaluate((id) => JSON.parse(localStorage.getItem("rmtSchedules") || "[]").find((item) => item.scheduleId === id), scheduleId);
  assert(JSON.stringify(preserved.plannedExtinguisherAssetIds) === JSON.stringify(frozenIdsBeforeFormSave), "Existing extinguisher form save dropped frozen asset metadata.");
  assert(!errors.length, `Browser errors: ${errors.join(" | ")}`);
  await context.close();
  return initial;
}

async function runAdminBrowserQa(browser, serverFixture) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.click("[data-demo-login='admin']");
  await page.fill("#loginPassword", "qa-local");
  await page.click("#loginForm button[type='submit']");
  await page.waitForSelector("#workspace.admin-mode", { timeout: 20000 });
  await page.click("[data-admin-module='schedule']");
  const adminView = await page.evaluate(async ({ companyName, siteName }) => {
    const masterResponse = await fetch(`/api/extinguisher-assets/master?${new URLSearchParams({ companyName, siteName })}`);
    const masterResult = await masterResponse.json();
    const proposalResponse = await fetch("/api/extinguisher-assets/proposals");
    const proposalResult = await proposalResponse.json();
    state.extinguisherAssetMaster = masterResult.master;
    state.extinguisherAssetProposals = proposalResult.proposals;
    renderExtinguisherAssetAdminPanel();
    return {
      role: getCurrentUserRole(),
      masterCompany: state.extinguisherAssetMaster?.companyName,
      masterSite: state.extinguisherAssetMaster?.siteName,
      masterCount: state.extinguisherAssetMaster?.assets?.length || 0,
      proposalCount: state.extinguisherAssetProposals.length,
      matchingCount: state.extinguisherAssetProposals.filter((proposal) => proposal.companyName === companyName && proposal.siteName === siteName).length,
      renderedCount: document.querySelectorAll("#extAssetProposalList .ext-asset-proposal").length
    };
  }, serverFixture);
  assert(await page.locator("#extAssetAdminPanel").isVisible(), "Admin extinguisher asset panel is not visible.");
  assert(adminView.renderedCount >= 1, `Admin proposal review list is empty: ${JSON.stringify(adminView)}`);
  await page.selectOption("#scheduleClientMode", "new");
  await page.fill("#scheduleManualClient", serverFixture.companyName);
  await page.fill("#scheduleManualPlace", serverFixture.siteName);
  await page.selectOption("#scheduleServiceType", { label: "Fire Extinguisher Collection" });
  await page.fill("#scheduleTechnician", "Demo Technician");
  await page.click("#saveScheduleBtn");
  await page.waitForFunction((companyName) => state.schedules.some((schedule) => schedule.companyName === companyName && schedule.extinguisherScopeFrozen), serverFixture.companyName, { timeout: 15000 });
  const scheduled = await page.evaluate((companyName) => state.schedules.find((schedule) => schedule.companyName === companyName && schedule.extinguisherScopeFrozen), serverFixture.companyName);
  assert(scheduled.extinguisherAssetCount === adminView.masterCount, "Admin schedule did not freeze the current master asset list.");
  const scheduledState = await api(`/api/jobs/${encodeURIComponent(scheduled.scheduleId)}/state`);
  assert(scheduledState.payload.store.extinguisherAssetSnapshot.assetIds.length === scheduled.extinguisherAssetCount, "Scheduled asset IDs do not match the authoritative frozen snapshot.");
  assert(!errors.length, `Admin browser errors: ${errors.join(" | ")}`);
  await context.close();
}

(async () => {
  const scheduleSnapshot = readFileSync(SCHEDULE_PATH, "utf8");
  let browser = null;
  try {
    const server = await runServerQa();
    const executablePath = EDGE_PATHS.find(existsSync);
    assert(executablePath, "No Edge/Chrome executable found.");
    browser = await chromium.launch({ headless: true, executablePath });
    const ui = await runBrowserQa(browser, server);
    await runAdminBrowserQa(browser, server);
    console.log("PASS qa-extinguisher-assets-v1");
    console.log(JSON.stringify({ server: { scheduleId: server.schedule.scheduleId, frozenCount: server.frozenCount, reconciliation: server.reconciliation }, mobile: ui }, null, 2));
  } catch (error) {
    console.error(`FAIL qa-extinguisher-assets-v1: ${error.stack || error.message}`);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    writeFileSync(SCHEDULE_PATH, scheduleSnapshot, "utf8");
  }
})();
