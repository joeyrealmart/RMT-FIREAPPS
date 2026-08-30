const { existsSync } = require("node:fs");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = "http://127.0.0.1:8026/?fresh=20260820-signature-flow";
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const executablePath = EDGE_PATHS.find((item) => existsSync(item));
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await page.route("**/api/save-schedules", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, count: 1 })
  }));
  await page.route("**/api/save-inspection-run", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, runKey: "qa-run" })
  }));
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.removeItem("rmtActiveJob");
    localStorage.removeItem("tmFireInspections");
    localStorage.removeItem("rmtCriticalSops");
    localStorage.removeItem("rmtSystemChecks");
    localStorage.removeItem("tmFireRequests");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.click("[data-demo-login='tech']");
  await page.fill("#loginPassword", new Date().toISOString());
  await page.click("#loginForm button[type='submit']");
  await page.waitForSelector("#workspace.technician-mode");

  const testSchedule = await page.evaluate(() => {
    const profile = {
      companyName: "QA Signoff",
      siteName: "QA Signoff"
    };
    const floor = {
      id: "qa-signoff-l1",
      floorId: "qa-signoff-l1",
      title: "QA Signoff L1",
      floorCode: "L1",
      companyName: profile.companyName,
      siteName: profile.siteName,
      src: defaultFloorAssets.lv1.src,
      cleanSrc: defaultFloorAssets.lv1.src,
      active: true
    };
    const pool = [
      {
        tag: "QA.EL.SIGN1",
        type: "Emergency Light",
        short: "EL",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Lobby",
        xPercent: 30,
        yPercent: 40,
        status: "Confirmed"
      },
      {
        tag: "QA.EL.SIGN2",
        type: "Emergency Light",
        short: "EL",
        floor: floor.title,
        floorId: floor.id,
        floorCode: floor.floorCode,
        companyName: profile.companyName,
        siteName: profile.siteName,
        location: "Rear corridor",
        xPercent: 60,
        yPercent: 50,
        status: "Confirmed"
      }
    ];
    state.siteProfile = profile;
    state.mimicFloors = [
      floor,
      ...state.mimicFloors.filter((item) => item.id !== floor.id)
    ];
    state.setupDevices = [
      ...pool,
      ...state.setupDevices.filter((device) => !String(device.tag || "").startsWith("QA.EL.SIGN"))
    ];
    const schedule = {
      scheduleId: "QA-SIGNOFF",
      status: "Scheduled",
      companyName: profile.companyName,
      siteName: profile.siteName,
      floorId: floor.id,
      startFloorId: floor.id,
      floorTitle: floor.title,
      serviceType: "Maintenance / Inspection",
      scope: "full-maintenance",
      scopeLabel: "QA Flow Test",
      scopeSelectionMode: "site-wide",
      date: "2026-08-20",
      time: "09:00",
      technician: "Demo Technician",
      contractFrequencyPercent: 100,
      plannedDeviceIds: pool.map((device) => device.tag),
      deviceCount: pool.length,
      plannedFloorCounts: [{ floorId: floor.id, title: floor.title, count: pool.length }]
    };
    state.schedules = [schedule];
    writeStoredJson("rmtMimicFloors", state.mimicFloors);
    writeStoredJson("tmFireSetupDevices", state.setupDevices);
    writeStoredJson("rmtSchedules", state.schedules);
    selectClientProfile(profile);
    renderTechWorkPanel();
    return { firstId: pool[0].tag, secondId: pool[1].tag };
  });

  await page.click("[data-tech-start-schedule='QA-SIGNOFF']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rmtActiveJob") || "null")?.scheduleId === "QA-SIGNOFF");
  await page.click(`[data-tech-open-device="${testSchedule.firstId}"]`);
  await page.waitForSelector("#checklistForm:not(.hidden)");

  await page.waitForSelector("#questionList .question input[value='Fail']");
  const failChoice = page.locator("#questionList .question").first().locator("input[value='Fail']");
  await failChoice.scrollIntoViewIfNeeded();
  const beforeScroll = await page.evaluate(() => window.scrollY);
  await failChoice.check();
  await page.waitForTimeout(250);
  const afterScroll = await page.evaluate(() => window.scrollY);
  assert(Math.abs(afterScroll - beforeScroll) < 12, `Checklist radio caused scroll from ${beforeScroll} to ${afterScroll}`);

  await page.evaluate(async () => {
    const schedule = state.schedules[0];
    for (const device of getScheduledAssignedDevices(schedule)) {
      state.inspections[device.id] = {
        status: "pass",
        answers: (device.questions || []).map(() => "Pass"),
        notes: "QA completed",
        action: "",
        beforePhoto: "",
        afterPhoto: "",
        inspectedAt: new Date().toISOString(),
        inspectedBy: getCurrentUserName(),
        inspectedRole: getCurrentUserRole()
      };
      await saveSharedInspectionRecord(device, state.inspections[device.id], schedule);
    }
    writeStoredJson("tmFireInspections", state.inspections);
    syncActiveJobProgressToSchedule();
    persistActiveJob();
    renderMarkers();
    renderTechAssignedItemList();
  });

  await page.click("[data-tech-screen='complete']");
  await page.waitForSelector("#workspace.tech-screen-complete");
  await page.waitForSelector("#techCompletionPanel");
  await page.waitForFunction(() => {
    const panel = document.querySelector("#techCompletionPanel");
    if (!panel) return false;
    const rect = panel.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  await page.fill("#techSignSupervisor", "QA Supervisor");
  const signatureBox = await page.locator("#techSignatureCanvas").boundingBox();
  const signature = page.locator("#techSignatureCanvas");
  await signature.dispatchEvent("pointerdown", {
    clientX: signatureBox.x + 24,
    clientY: signatureBox.y + 70,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true
  });
  await signature.dispatchEvent("pointermove", {
    clientX: signatureBox.x + 120,
    clientY: signatureBox.y + 45,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true
  });
  await signature.dispatchEvent("pointermove", {
    clientX: signatureBox.x + 210,
    clientY: signatureBox.y + 95,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true
  });
  await signature.dispatchEvent("pointerup", {
    clientX: signatureBox.x + 210,
    clientY: signatureBox.y + 95,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true
  });
  await page.waitForFunction(() => Boolean(document.querySelector("#techSignatureData")?.value));
  const confirmRow = page.locator(".tech-sign-confirm");
  const confirmPoint = await confirmRow.evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "center" });
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.left + 24),
      y: Math.round(rect.top + Math.min(28, rect.height / 2)),
      rect: {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        bottom: Math.round(rect.bottom),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };
  });
  await page.waitForTimeout(150);
  const confirmHit = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return {
      ok: Boolean(element?.closest(".tech-sign-confirm")),
      description: element ? `${element.tagName}.${element.className || element.id || ""}` : "nothing"
    };
  }, confirmPoint);
  assert(confirmHit.ok, `Sign-off confirm row is covered by ${confirmHit.description} at ${JSON.stringify(confirmPoint.rect)}`);
  await page.evaluate(({ x, y }) => {
    document.querySelector(".tech-sign-confirm")?.dispatchEvent(new PointerEvent("pointerup", {
      pointerId: 31,
      pointerType: "touch",
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true
    }));
  }, confirmPoint);
  await page.waitForFunction(() => document.querySelector("#techSignConfirm")?.checked);
  await page.evaluate(() => {
    const button = document.querySelector("#techCompleteJobBtn");
    if (!button || button.disabled) throw new Error("Complete Job button is not enabled");
    button.click();
  });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("rmtActiveJob") || "null")?.status === "Completed");

  const result = await page.evaluate(() => {
    const job = JSON.parse(localStorage.getItem("rmtActiveJob") || "null");
    return {
      status: job?.status,
      signSupervisor: job?.signOff?.supervisorName,
      signatureCaptured: Boolean(job?.signOff?.supervisorSignatureData),
      teamMembers: job?.teamMembers || [],
      syncState: document.querySelector("#syncState")?.textContent
    };
  });
  assert(result.status === "Completed", "Job was not completed after sign-off");
  assert(result.signSupervisor === "QA Supervisor", "Sign-off supervisor was not saved");
  assert(result.signatureCaptured, "Signature was not saved");
  console.log(JSON.stringify({ beforeScroll, afterScroll, ...result }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
