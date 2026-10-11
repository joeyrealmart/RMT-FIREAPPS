const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=physical-correction-round1&demoEvidence=1";
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];
const TINY_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mNkYPj/n4GBgYGJAQoAHgQCAZ7dV1AAAAAASUVORK5CYII=", "base64");

function check(results, name, passed, details = null) {
  results.push({ name, passed: Boolean(passed), details });
}

async function seedCriticalFixture(page, templateId, device) {
  await page.evaluate(({ templateId, device }) => {
    const floor = { id: "qa-critical-floor", floorId: "qa-critical-floor", title: "Plant Room", floorCode: "PR", companyName: "QA", siteName: "QA", src: defaultFloorAssets.lv1.src, active: true };
    const schedule = {
      scheduleId: "QA-PHYSICAL-CORRECTION-R1", jobId: "JOB-QA-PHYSICAL-CORRECTION-R1", status: "In Progress",
      companyName: "QA", siteName: "QA", date: new Date().toISOString().slice(0, 10), time: "09:00",
      technician: "Demo Technician", assignedTechnicianId: "tech@rmtfire.local", plannedDeviceIds: [device.tag], scopeFrozen: true,
      floorId: floor.id, startFloorId: floor.id
    };
    state.currentUser = { name: "Demo Technician", role: "Technician", email: "tech@rmtfire.local", technicianId: "tech@rmtfire.local" };
    state.siteProfile = { companyName: "QA", siteName: "QA" };
    state.schedules = [schedule];
    state.activeJob = { scheduleId: schedule.scheduleId, jobId: schedule.jobId, status: "In Progress", schedule };
    state.setupDevices = [{ ...device, floor: floor.title, floorId: floor.id, companyName: "QA", siteName: "QA", xPercent: 50, yPercent: 50 }];
    state.mimicFloors = [floor];
    state.criticalSops = {};
    state.sharedJobRecords = {};
    state.activeTechPreviewScheduleId = schedule.scheduleId;
    state.activeTechSystemKey = templateId === "gas-discharge-sop" ? "gas-release" : "pump-system";
    state.activeTechFloorId = floor.id;
    state.activeCriticalDevice = { ...state.setupDevices[0] };
    state.activeCriticalSopId = templateId;
    state.techSystemDrawerOpen = false;
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
  }, { templateId, device });
}

(async () => {
  const executablePath = EDGE_PATHS.find(existsSync);
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const results = [];
  const consoleErrors = [];
  const dialogs = [];
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
  page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.route("**/api/jobs/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, record: { revision: 1 }, progress: { ready: false } })
  }));

  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await seedCriticalFixture(page, "gas-discharge-sop", { id: "QA.CO2.1", tag: "QA.CO2.1", type: "CO2 System", location: "Suppression Room" });

    await page.locator("#criticalBeforePhoto").setInputFiles({ name: "before-real.png", mimeType: "image/png", buffer: TINY_PNG });
    await page.waitForFunction(() => document.querySelector("#criticalBeforePhotoName")?.textContent.includes("before-real.png"));
    await page.locator("#criticalAfterPhoto").setInputFiles({ name: "after-real.png", mimeType: "image/png", buffer: TINY_PNG });
    await page.waitForFunction(() => document.querySelector("#criticalAfterPhotoName")?.textContent.includes("after-real.png"));
    const realPhoto = await page.evaluate(() => {
      const template = criticalSopTemplates.find((item) => item.id === "gas-discharge-sop");
      const key = getCriticalSopStorageKey(template.id);
      const saved = state.criticalSops[key] || {};
      return {
        before: hasRetainedPhotoEvidence(saved.beforePhotoEvidence),
        after: hasRetainedPhotoEvidence(saved.afterPhotoEvidence),
        missing: getMissingCriticalSopEvidence(template, saved),
        beforeName: saved.beforePhoto,
        afterName: saved.afterPhoto
      };
    });
    check(results, "real browser File objects create retained before/after evidence", realPhoto.before && realPhoto.after && realPhoto.missing.length === 0, realPhoto);
    await page.evaluate(() => renderCriticalSop());
    const reopenedReal = await page.evaluate(() => {
      const template = criticalSopTemplates.find((item) => item.id === "gas-discharge-sop");
      const saved = state.criticalSops[getCriticalSopStorageKey(template.id)] || {};
      return { before: hasRetainedPhotoEvidence(saved.beforePhotoEvidence), after: hasRetainedPhotoEvidence(saved.afterPhotoEvidence), missing: getMissingCriticalSopEvidence(template, saved) };
    });
    check(results, "real evidence survives rerender/reopen", reopenedReal.before && reopenedReal.after && reopenedReal.missing.length === 0, reopenedReal);

    await page.evaluate(() => {
      window.__qaOriginalStampFn = createStampedEvidenceDataUrl;
      createStampedEvidenceDataUrl = async () => { throw new Error("QA Android decoder failure"); };
    });
    await page.locator("#criticalBeforePhoto").setInputFiles({ name: "before-android-fallback.jpg", mimeType: "image/jpeg", buffer: TINY_PNG });
    await page.waitForFunction(() => document.querySelector("#criticalBeforePhotoName")?.textContent.includes("before-android-fallback.jpg"));
    const androidFallback = await page.evaluate(() => {
      createStampedEvidenceDataUrl = window.__qaOriginalStampFn;
      const saved = state.criticalSops[getCriticalSopStorageKey("gas-discharge-sop")] || {};
      return {
        retained: hasRetainedPhotoEvidence(saved.beforePhotoEvidence),
        stampStatus: saved.beforePhotoEvidence?.stampStatus,
        hasOriginal: Boolean(saved.beforePhotoEvidence?.originalDataUrl)
      };
    });
    check(results, "Android stamp failure retains the genuine original photo", androidFallback.retained && androidFallback.hasOriginal && androidFallback.stampStatus === "ORIGINAL_RETAINED_STAMP_FAILED", androidFallback);

    const demoButtons = page.locator("[data-critical-demo-photo]");
    check(results, "test mode exposes Demo Before and Demo After", await demoButtons.count() === 2, { count: await demoButtons.count() });
    if (await demoButtons.count() === 2) {
      await page.locator('[data-critical-demo-photo="before"]').click();
      await page.locator('[data-critical-demo-photo="after"]').click();
      const demo = await page.evaluate(() => {
        const template = criticalSopTemplates.find((item) => item.id === "gas-discharge-sop");
        const saved = state.criticalSops[getCriticalSopStorageKey(template.id)] || {};
        return {
          beforeMode: saved.beforePhotoEvidence?.evidenceMode,
          afterMode: saved.afterPhotoEvidence?.evidenceMode,
          missing: getMissingCriticalSopEvidence(template, saved)
        };
      });
      check(results, "demo evidence is marked and satisfies test validation", demo.beforeMode === "DEMO_TEST" && demo.afterMode === "DEMO_TEST" && demo.missing.length === 0, demo);
      await page.evaluate(() => renderCriticalSop());
      const reopenedDemo = await page.evaluate(() => {
        const saved = state.criticalSops[getCriticalSopStorageKey("gas-discharge-sop")] || {};
        return [saved.beforePhotoEvidence?.evidenceMode, saved.afterPhotoEvidence?.evidenceMode];
      });
      check(results, "demo evidence survives save/reopen", reopenedDemo.every((mode) => mode === "DEMO_TEST"), reopenedDemo);
    }

    const filenameOnly = await page.evaluate(() => {
      const template = criticalSopTemplates.find((item) => item.id === "gas-discharge-sop");
      return getMissingCriticalSopEvidence(template, { beforePhoto: "before.jpg", afterPhoto: "after.jpg" });
    });
    check(results, "filename-only evidence remains invalid", filenameOnly.includes("before photo") && filenameOnly.includes("after photo"), filenameOnly);

    await seedCriticalFixture(page, "sprinkler-hydrant-pump-sop", { id: "QA.SPP.1", tag: "QA.SPP.1", type: "Sprinkler Panel", location: "Pump Room" });
    await page.evaluate(() => setTechSystemDrawerOpen(true));
    await page.locator("#techSystemSidebar").evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const drawer = await page.evaluate(() => {
      const sidebar = document.querySelector("#techSystemSidebar").getBoundingClientRect();
      const close = document.querySelector("#techSystemDrawerCloseBtn").getBoundingClientRect();
      return {
        closeVisible: close.top >= sidebar.top && close.bottom <= sidebar.bottom,
        sidebarScrollTop: document.querySelector("#techSystemSidebar").scrollTop,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    check(results, "Pump drawer close remains visible after scrolling", drawer.closeVisible && drawer.sidebarScrollTop > 0, drawer);
    await page.locator("#techSystemDrawerCloseBtn").click();
    check(results, "Pump drawer close works", await page.evaluate(() => !state.techSystemDrawerOpen));

    await page.evaluate(() => setTechSystemDrawerOpen(true));
    const originalUrl = page.url();
    await page.locator('#techSystemSidebar [data-tech-system-list]').click();
    const systemList = await page.evaluate(() => ({ screen: state.techScreen, system: state.activeTechSystemKey, drawerOpen: state.techSystemDrawerOpen }));
    check(results, "Back to system list uses internal navigation", page.url() === originalUrl && systemList.screen === "jobs" && !systemList.system && !systemList.drawerOpen && dialogs.length === 0, { originalUrl, currentUrl: page.url(), systemList, dialogs });

    await seedCriticalFixture(page, "sprinkler-hydrant-pump-sop", { id: "QA.SPP.1", tag: "QA.SPP.1", type: "Sprinkler Panel", location: "Pump Room" });
    await page.evaluate(() => setTechSystemDrawerOpen(true));
    await page.locator('#techSystemSidebar [data-tech-screen="mimic"]').click();
    await page.waitForFunction(() => state.techScreen === "mimic");
    const mimic = await page.evaluate(() => ({ screen: state.techScreen, visible: Boolean(document.querySelector("#mapStage")?.getClientRects().length), url: location.href }));
    check(results, "View mimic uses internal navigation", mimic.screen === "mimic" && mimic.visible && mimic.url === page.url(), mimic);
    const demoProductionGuard = await page.evaluate(() => {
      const savedSearch = location.search;
      history.replaceState(null, "", location.pathname);
      const valid = hasRetainedPhotoEvidence({ evidenceId: "DEMO-EVD-GUARD", evidenceMode: "DEMO_TEST", originalDataUrl: DEMO_CRITICAL_EVIDENCE_DATA_URL });
      history.replaceState(null, "", `${location.pathname}${savedSearch}`);
      return valid;
    });
    check(results, "demo evidence is rejected when explicit test mode is absent", demoProductionGuard === false, demoProductionGuard);
    check(results, "mobile drawer has no horizontal overflow", drawer.overflow <= 1, drawer);
    check(results, "no console errors", consoleErrors.length === 0, consoleErrors);
  } finally {
    await browser.close();
  }

  const output = { ok: results.every((item) => item.passed), results, consoleErrors };
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exit(1);
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
