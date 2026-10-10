const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260903-front-desk-v1";
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getLaunchOptions() {
  const executablePath = EDGE_PATHS.find((path) => require("node:fs").existsSync(path));
  return executablePath ? { executablePath, headless: true } : { headless: true };
}

async function login(page, email) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await signInFromLogin(page, email);
}

async function signInFromLogin(page, email) {
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", "front-desk-qa");
  await page.locator("#loginForm button[type='submit']").click();
  await page.waitForFunction(() => !document.querySelector("#workspace")?.classList.contains("hidden"), null, { timeout: 20000 });
}

async function isVisible(page, selector) {
  return page.locator(selector).first().evaluate((element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  });
}

async function assertVisible(page, selector, message) {
  assert(await isVisible(page, selector), message);
}

async function assertHidden(page, selector, message) {
  assert(!(await isVisible(page, selector)), message);
}

async function assertNoHorizontalOverflow(page, label) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  assert(result.scrollWidth <= result.clientWidth + 2, `${label} horizontal overflow: ${result.scrollWidth} > ${result.clientWidth}`);
}

async function getVisibleAdminWorkspaces(page) {
  return page.locator("#adminWorkspaceHost [data-admin-workspace]").evaluateAll((elements) => elements
    .filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    })
    .map((element) => element.dataset.adminWorkspace));
}

async function assertOnlyAdminWorkspace(page, module) {
  const visible = await getVisibleAdminWorkspaces(page);
  assert(visible.length === 1, `Expected one Admin workspace for ${module}; visible: ${visible.join(", ") || "none"}.`);
  assert(visible[0] === module, `Expected ${module} workspace; visible: ${visible[0]}.`);
  const activeNav = await page.locator("#adminMainNav [data-admin-module].active").getAttribute("data-admin-module");
  assert(activeNav === module, `Admin navigation should identify ${module} as active.`);
}

async function openAdminModule(page, module) {
  await page.locator(`#adminMainNav [data-admin-module='${module}']`).click();
  await page.waitForFunction((expected) => {
    const visible = [...document.querySelectorAll("#adminWorkspaceHost [data-admin-workspace]")]
      .filter((element) => !element.classList.contains("hidden"));
    return visible.length === 1 && visible[0].dataset.adminWorkspace === expected;
  }, module);
  await assertOnlyAdminWorkspace(page, module);
}

async function runAdminFrontDeskQa(browser) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  await login(page, "admin@rmtfire.local");
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("admin-mode"), null, { timeout: 20000 });
  await page.waitForSelector("#adminDeskMetrics .front-desk-metric", { state: "visible", timeout: 20000 });

  await assertVisible(page, "#frontDeskPanel", "Admin front desk should be visible after login.");
  await assertVisible(page, "#adminMainNav", "Admin main navigation should be visible.");
  const navLabels = await page.locator("#adminMainNav button").evaluateAll((buttons) => buttons.map((button) => button.textContent.trim()));
  ["Home", "Clients", "Schedule", "Reports", "Defects", "Mimics", "Staff", "Settings"].forEach((label) => {
    assert(navLabels.includes(label), `Missing Admin nav item: ${label}`);
  });
  const metricText = await page.locator("#adminDeskMetrics").textContent();
  ["Today's Jobs", "In Progress", "Awaiting Admin Review", "Open Faults", "Pending Suggested Pins", "Upcoming Services"].forEach((label) => {
    assert(metricText.includes(label), `Missing Admin Home metric: ${label}`);
  });
  await assertOnlyAdminWorkspace(page, "home");
  await assertHidden(page, "#schedulePanel", "Schedule panel should not dominate Admin Home.");
  await assertHidden(page, ".content-grid", "Mimic/content grid should not show on Admin Home.");
  await assertHidden(page, "#requestPanel", "Review panel should not show on Admin Home.");
  await assertHidden(page, "#staffTrackingPanel", "Staff tracking should not show on Admin Home.");
  await assertHidden(page, "#diagnosticsPanel", "Diagnostics should be hidden from normal Admin Home.");
  const legacyPanelsInsideHome = await page.locator("#adminFrontDeskHome #schedulePanel, #adminFrontDeskHome #requestPanel, #adminFrontDeskHome .content-grid, #adminFrontDeskHome #staffTrackingPanel, #adminFrontDeskHome #diagnosticsPanel").count();
  assert(legacyPanelsInsideHome === 0, "Admin Home must not contain re-stacked legacy work panels.");

  await openAdminModule(page, "schedule");
  await assertVisible(page, "#schedulePanel", "Schedule module should open existing schedule panel.");
  assert(await page.locator("#schedulePanel").evaluate((element) => element.parentElement?.id) === "adminScheduleMount", "Schedule panel must be mounted in its dedicated workspace.");

  await openAdminModule(page, "clients");
  await assertVisible(page, "#adminClientDesk", "Clients module should show client desk.");
  await page.waitForFunction(() => document.querySelectorAll("#adminClientList [data-admin-client-value]").length > 0);
  const clientTabs = await page.locator("#adminClientDesk [data-client-module]").evaluateAll((buttons) => buttons.map((button) => button.textContent.trim()));
  ["Overview", "Schedule", "Systems", "Mimic", "Reports", "Defects", "History"].forEach((label) => {
    assert(clientTabs.includes(label), `Missing client tab: ${label}`);
  });
  await page.fill("#adminClientSearch", "UOB");
  const filteredClients = page.locator("#adminClientList [data-admin-client-value]");
  assert(await filteredClients.count() > 0, "Client search should return the existing UOB site.");
  const selectedClientValue = await filteredClients.first().getAttribute("data-admin-client-value");
  await filteredClients.first().click();
  await page.locator("#adminClientDesk [data-client-module='systems']").click();
  assert(await page.locator("#adminClientDesk [data-client-module='systems']").getAttribute("class").then((value) => String(value).includes("active")), "Systems should be the active client tab.");
  await assertVisible(page, "#adminClientOverview", "Selected client tab content should remain in the Clients workspace.");

  await openAdminModule(page, "reports");
  await assertVisible(page, "#showReportBtn", "Reports module should retain the existing Generate Report action.");
  assert(await page.locator("#showReportBtn").evaluate((element) => element.parentElement?.id) === "adminReportsActions", "Generate Report must be mounted in the Reports workspace.");
  await assertVisible(page, "#requestPanel", "Reports module should open review content independently.");
  assert(await page.locator("#requestPanel").evaluate((element) => element.parentElement?.id) === "adminReportsMount", "Report review panel must be mounted in its dedicated workspace.");

  await openAdminModule(page, "defects");
  await assertVisible(page, "#adminDefectList", "Defects module should open independently.");

  await openAdminModule(page, "clients");
  assert(await page.locator("#adminClientSearch").evaluate((element) => element.value) === "UOB", "Client search should be preserved across module switching.");
  assert(await page.locator("#adminDeskClientSelect").evaluate((element) => element.value) === selectedClientValue, "Selected client should be preserved across module switching.");
  assert(String(await page.locator("#adminClientDesk [data-client-module='systems']").getAttribute("class")).includes("active"), "Selected client tab should be preserved across module switching.");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("admin-mode"), null, { timeout: 20000 });
  await page.waitForFunction(() => {
    const visible = [...document.querySelectorAll("#adminWorkspaceHost [data-admin-workspace]")]
      .filter((element) => !element.classList.contains("hidden"));
    return visible.length === 1 && visible[0].dataset.adminWorkspace === "clients";
  }, null, { timeout: 20000 });
  await assertOnlyAdminWorkspace(page, "clients");
  assert(await page.locator("#adminClientSearch").evaluate((element) => element.value) === "UOB", "Client search should survive Admin refresh.");
  const restoredClientValue = await page.locator("#adminDeskClientSelect").evaluate((element) => element.value);
  assert(restoredClientValue === selectedClientValue, `Selected client should survive Admin refresh (expected ${selectedClientValue}, got ${restoredClientValue}).`);
  assert(String(await page.locator("#adminClientDesk [data-client-module='systems']").getAttribute("class")).includes("active"), "Selected client tab should survive Admin refresh.");

  await openAdminModule(page, "mimics");
  await assertVisible(page, "#mimicSetupPanel", "Mimics module should open mimic setup.");
  await assertVisible(page, ".content-grid", "Mimics module should show the existing mimic workspace.");
  assert(await page.locator(".content-grid").evaluate((element) => element.parentElement?.id) === "adminMimicsMount", "Shared mimic workspace must be mounted in Admin Mimics.");

  await openAdminModule(page, "staff");
  await assertVisible(page, "#staffTrackingPanel", "Staff module should open staff tracking.");
  assert(await page.locator("#staffTrackingPanel").evaluate((element) => element.parentElement?.id) === "adminStaffMount", "Staff panel must be mounted in its dedicated workspace.");

  await openAdminModule(page, "settings");
  await assertVisible(page, "#diagnosticsPanel", "Settings module should expose diagnostics/admin setup.");
  assert(await page.locator("#diagnosticsPanel").evaluate((element) => element.parentElement?.id) === "adminSettingsMount", "Settings panels must be mounted in the dedicated workspace.");
  await assertNoHorizontalOverflow(page, "Admin control desk desktop");

  await page.locator("#logoutBtn").click();
  await page.waitForSelector("#loginView", { state: "visible" });
  await signInFromLogin(page, "tech@rmtfire.local");
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("technician-mode"), null, { timeout: 20000 });
  await assertHidden(page, "#frontDeskPanel", "Admin control desk must not leak after switching to Technician.");
  assert(await page.locator(".content-grid").evaluate((element) => element.parentElement?.id) === "technicianSharedWorkspaceMount", "Shared inspection workspace should move to Technician ownership.");

  await page.locator("#logoutBtn").click();
  await page.waitForSelector("#loginView", { state: "visible" });
  await signInFromLogin(page, "admin@rmtfire.local");
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("admin-mode"), null, { timeout: 20000 });
  await page.waitForFunction(() => {
    const visible = [...document.querySelectorAll("#adminWorkspaceHost [data-admin-workspace]")]
      .filter((element) => !element.classList.contains("hidden"));
    return visible.length === 1 && visible[0].dataset.adminWorkspace === "settings";
  }, null, { timeout: 20000 });
  await assertOnlyAdminWorkspace(page, "settings");
  assert(await page.locator(".content-grid").evaluate((element) => element.parentElement?.id) === "adminMimicsMount", "Shared mimic workspace should return to Admin Mimics ownership.");
  await context.close();
}

async function runAdminMobileNavigationQa(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await login(page, "admin@rmtfire.local");
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("admin-mode"), null, { timeout: 20000 });
  await page.waitForSelector("#adminDeskMetrics .front-desk-metric", { state: "visible", timeout: 20000 });
  await assertOnlyAdminWorkspace(page, "home");
  await page.locator("#adminNavToggle").click();
  assert(await page.locator("#frontDeskPanel").evaluate((element) => element.classList.contains("nav-open")), "Mobile Admin menu should open.");
  await openAdminModule(page, "schedule");
  assert(!(await page.locator("#frontDeskPanel").evaluate((element) => element.classList.contains("nav-open"))), "Mobile Admin menu should close after navigation.");
  await assertNoHorizontalOverflow(page, "Admin control desk mobile");
  await context.close();
}

async function runTechnicianFrontDeskQa(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  await login(page, "tech@rmtfire.local");
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("technician-mode"), null, { timeout: 20000 });
  await page.waitForSelector("#techFrontDeskStats .front-desk-metric", { state: "visible", timeout: 20000 });

  await assertVisible(page, "#techWorkPanel", "Technician front desk should be visible after login.");
  await assertHidden(page, "#frontDeskPanel", "Admin front desk must be hidden from Technician.");
  await assertHidden(page, "#schedulePanel", "Technician must not see Admin schedule setup.");
  await assertHidden(page, "#diagnosticsPanel", "Technician normal flow must hide diagnostics.");
  await assertVisible(page, "#techWorkflowNav", "Technician mobile bottom navigation should be visible.");
  const mobileNavLabels = await page.locator("#techWorkflowNav button strong").allTextContents();
  assert(JSON.stringify(mobileNavLabels.map((label) => label.trim())) === JSON.stringify(["Home", "Tasks", "Mimic", "Reports", "More"]), "Technician mobile navigation must match the approved V1 flow.");

  const statsText = await page.locator("#techFrontDeskStats").textContent();
  ["My Jobs Today", "Resume Current Job", "Progress", "Correction Required", "Linked Verification", "Submitted Reports"].forEach((label) => {
    assert(statsText.includes(label), `Missing Technician front desk item: ${label}`);
  });

  const jobCards = await page.locator("#techAssignedJobs .tech-job-card").count();
  if (jobCards > 0) {
    const firstJobText = await page.locator("#techAssignedJobs .tech-job-card").first().textContent();
    ["Client", "Site", "Job type", "Date / time", "Starting floor"].forEach((label) => {
      assert(firstJobText.includes(label), `Technician job card missing ${label}.`);
    });
    const actionCount = await page.locator("#techAssignedJobs [data-tech-start-schedule]").count();
    assert(actionCount > 0, "Technician job card needs Start/Resume action.");
  }
  await assertNoHorizontalOverflow(page, "Technician front desk mobile");
  assert(await page.locator(".content-grid").evaluate((element) => element.parentElement?.id) === "technicianSharedWorkspaceMount", "Shared inspection workspace should return to Technician ownership after role switch/login.");
  await context.close();
}

(async () => {
  const browser = await chromium.launch(getLaunchOptions());
  try {
    await runAdminFrontDeskQa(browser);
    await runAdminMobileNavigationQa(browser);
    await runTechnicianFrontDeskQa(browser);
    console.log("PASS qa-front-desk-v1");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
