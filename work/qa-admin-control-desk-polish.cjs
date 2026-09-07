const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = process.env.APP_URL || "http://127.0.0.1:8026/?fresh=20260907-admin-control-desk-polish";
const EDGE_PATHS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function launchOptions() {
  const fs = require("node:fs");
  const executablePath = EDGE_PATHS.find((path) => fs.existsSync(path));
  return executablePath ? { executablePath, headless: true } : { headless: true };
}

async function login(page, email) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", "admin-desk-polish-qa");
  await page.locator("#loginForm button[type='submit']").click();
  await page.waitForFunction(() => !document.querySelector("#workspace")?.classList.contains("hidden"), null, { timeout: 20000 });
}

async function visibleWorkspaces(page) {
  return page.locator("#adminWorkspaceHost [data-admin-workspace]").evaluateAll((panels) => panels
    .filter((panel) => {
      const style = window.getComputedStyle(panel);
      const rect = panel.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    })
    .map((panel) => panel.dataset.adminWorkspace));
}

async function openModule(page, module) {
  await page.locator(`#adminMainNav [data-admin-module='${module}']`).click();
  await page.waitForFunction((expected) => {
    const visible = [...document.querySelectorAll("#adminWorkspaceHost [data-admin-workspace]")]
      .filter((panel) => !panel.classList.contains("hidden"));
    return visible.length === 1 && visible[0].dataset.adminWorkspace === expected;
  }, module);
  assert((await visibleWorkspaces(page))[0] === module, `${module} should be the only visible Admin workspace.`);
}

async function assertNoOverflow(page, label) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  assert(scrollWidth <= clientWidth + 2, `${label} has horizontal overflow (${scrollWidth}px > ${clientWidth}px).`);
}

async function runAdminDeskQa(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await login(page, "admin@rmtfire.local");
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("admin-mode"), null, { timeout: 20000 });
  await page.waitForSelector("#adminDeskMetrics .front-desk-metric", { state: "visible", timeout: 20000 });
  assert((await visibleWorkspaces(page)).join(",") === "home", "Admin Home should be the sole initial workspace.");

  const presentation = await page.evaluate(() => {
    const desk = document.querySelector("#frontDeskPanel");
    const nav = document.querySelector("#adminMainNav");
    const metric = document.querySelector("#adminDeskMetrics .front-desk-metric");
    const header = document.querySelector(".admin-desk-header");
    return {
      navBackground: getComputedStyle(nav).backgroundColor,
      navDirection: getComputedStyle(nav).flexDirection,
      metricBackground: getComputedStyle(metric).backgroundColor,
      headerVisible: header.getBoundingClientRect().height > 0,
      deskVisible: desk.getBoundingClientRect().height > 0
    };
  });
  assert(presentation.navDirection === "column", "Desktop Admin navigation should use a compact vertical sidebar.");
  assert(presentation.navBackground !== "rgba(0, 0, 0, 0)", "Desktop sidebar needs an intentional background.");
  assert(presentation.metricBackground !== "rgba(0, 0, 0, 0)", "Dashboard summary cards need a deliberate surface.");
  assert(presentation.headerVisible && presentation.deskVisible, "Control-desk header and content must be visible.");
  const homeText = await page.locator("#adminFrontDeskHome").innerText();
  ["Upcoming Schedule", "Recent Activity", "Reports Awaiting Review", "Pending Pin Suggestions", "Technician Workload"].forEach((label) => {
    assert(homeText.includes(label), `Admin Home should contain the ${label} operational panel.`);
  });
  await page.getByRole("button", { name: "Open Staff" }).click();
  await page.waitForFunction(() => !document.querySelector("[data-admin-workspace='staff']")?.classList.contains("hidden"));
  assert((await visibleWorkspaces(page)).join(",") === "staff", "Open Staff must route to the Staff workspace.");
  await openModule(page, "home");

  await openModule(page, "clients");
  await page.waitForSelector("#adminClientList [data-admin-client-value]", { state: "visible" });
  await page.fill("#adminClientSearch", "UOB");
  const selected = page.locator("#adminClientList [data-admin-client-value]").first();
  await selected.click();
  const selectedValue = await selected.getAttribute("data-admin-client-value");
  await page.locator("#adminClientDesk [data-client-module='systems']").click();
  await openModule(page, "reports");
  await openModule(page, "defects");
  await openModule(page, "mimics");
  await openModule(page, "staff");
  await openModule(page, "settings");
  await openModule(page, "clients");
  assert(await page.locator("#adminClientSearch").inputValue() === "UOB", "Client search must persist while navigating Admin workspaces.");
  assert(await page.locator("#adminDeskClientSelect").inputValue() === selectedValue, "Selected client must persist while navigating Admin workspaces.");
  assert(await page.locator("#adminClientDesk [data-client-module='systems']").evaluate((button) => button.classList.contains("active")), "Selected client tab must persist while navigating Admin workspaces.");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("admin-mode"), null, { timeout: 20000 });
  await page.waitForFunction(() => {
    const visible = [...document.querySelectorAll("#adminWorkspaceHost [data-admin-workspace]")]
      .filter((panel) => !panel.classList.contains("hidden"));
    return visible.length === 1 && visible[0].dataset.adminWorkspace === "clients";
  }, null, { timeout: 20000 });
  assert((await visibleWorkspaces(page)).join(",") === "clients", "Admin workspace must restore after refresh.");
  assert(await page.locator("#adminClientSearch").inputValue() === "UOB", "Client search must restore after refresh.");
  assert(await page.locator("#adminDeskClientSelect").inputValue() === selectedValue, "Selected client must restore after refresh.");
  await assertNoOverflow(page, "Admin desktop");
  assert(consoleErrors.length === 0, `Admin desk produced console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
}

async function runMobileAndRoleQa(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await login(page, "admin@rmtfire.local");
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("admin-mode"), null, { timeout: 20000 });
  await page.locator("#adminNavToggle").click();
  assert(await page.locator("#frontDeskPanel").evaluate((desk) => desk.classList.contains("nav-open")), "Mobile Admin navigation should expand from the Menu button.");
  await page.locator("#adminMainNav [data-admin-module='schedule']").click();
  await page.waitForFunction(() => !document.querySelector("#frontDeskPanel")?.classList.contains("nav-open"));
  await assertNoOverflow(page, "Admin mobile");

  await page.locator("#logoutBtn").click();
  await page.waitForSelector("#loginView", { state: "visible" });
  await page.fill("#loginEmail", "tech@rmtfire.local");
  await page.fill("#loginPassword", "admin-desk-polish-qa");
  await page.locator("#loginForm button[type='submit']").click();
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("technician-mode"), null, { timeout: 20000 });
  assert(await page.locator("#frontDeskPanel").evaluate((desk) => desk.classList.contains("hidden") || getComputedStyle(desk).display === "none"), "Admin control desk must not leak into Technician mode.");
  await assertNoOverflow(page, "Technician mobile");
  assert(consoleErrors.length === 0, `Mobile/role flow produced console errors: ${consoleErrors.join(" | ")}`);
  await context.close();
}

(async () => {
  const browser = await chromium.launch(launchOptions());
  try {
    await runAdminDeskQa(browser);
    await runMobileAndRoleQa(browser);
    console.log("PASS qa-admin-control-desk-polish");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
