const fs = require("node:fs");
const net = require("node:net");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const loopbackUrl = "http://127.0.0.1:8026";
const lanUrl = process.env.RMT_LAN_URL || "http://192.168.0.129:8026";
const scheduleId = "DEMO-WETEX-RETEST-20260924";
const browserPaths = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function requestOk(url) {
  const response = await fetch(url, { cache: "no-store" });
  assert(response.ok, `${url} returned HTTP ${response.status}.`);
  return response;
}

async function login(page, email) {
  await page.goto(`${lanUrl}/?demoEvidence=1`, { waitUntil: "networkidle" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", "round2-stability-test");
  await page.click("#loginForm button[type='submit']");
  await page.waitForFunction(() => document.querySelector("#workspace")?.classList.contains("technician-mode"), null, { timeout: 20000 });
  await page.waitForSelector(`[data-tech-start-schedule="${scheduleId}"]`, { state: "visible", timeout: 20000 });
}

async function openJob(page) {
  const button = page.locator(`[data-tech-start-schedule="${scheduleId}"]`).first();
  await button.click();
  await page.waitForFunction((id) => {
    const activeId = state.activeJob?.scheduleId || state.activeJob?.schedule?.scheduleId || "";
    return activeId === id && document.querySelectorAll("#techActiveJobSummary [data-tech-system]").length > 0;
  }, scheduleId, { timeout: 20000 });
}

async function openSystem(page, systemKey) {
  const button = page.locator(`#techActiveJobSummary [data-tech-system="${systemKey}"]`).first();
  await button.waitFor({ state: "visible", timeout: 15000 });
  await button.click();
  await page.waitForFunction((key) => state.activeTechSystemKey === key && !document.querySelector("#criticalSopPanel")?.classList.contains("hidden"), systemKey, { timeout: 20000 });
}

async function backToSystems(page) {
  const button = page.locator("[data-tech-critical-system-list]").first();
  await button.waitFor({ state: "visible", timeout: 15000 });
  await button.click();
  await page.waitForFunction(() => state.activeTechSystemKey === "" && document.querySelector("#workspace")?.classList.contains("tech-screen-jobs"), null, { timeout: 15000 });
}

async function abortPartialRequest() {
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: 8026 }, () => {
      socket.write("POST /api/save-schedules HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 1000\r\n\r\n{\"partial\":");
      socket.destroy();
      resolve();
    });
    socket.once("error", reject);
  });
}

(async () => {
  const executablePath = browserPaths.find(fs.existsSync);
  assert(executablePath, "No supported Chromium browser was found.");

  const diagnosticsBefore = await (await requestOk(`${loopbackUrl}/api/diagnostics`)).json();
  await requestOk(`${lanUrl}/`);

  const browser = await chromium.launch({ headless: true, executablePath });
  const gasContext = await browser.newContext({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true });
  const mfapContext = await browser.newContext({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true });
  const gas = await gasContext.newPage();
  const mfap = await mfapContext.newPage();
  const consoleErrors = [];
  let sharedStatePolls = 0;
  [gas, mfap].forEach((page) => page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  }));
  [gas, mfap].forEach((page) => page.on("request", (request) => {
    if (request.method() === "GET" && request.url().includes(`/api/jobs/${scheduleId}/state`)) sharedStatePolls += 1;
  }));

  try {
    await login(gas, "tech2@rmtfire.local");
    await openJob(gas);
    await openSystem(gas, "gas-release");
    const initialGas = await gas.evaluate(() => ({
      stepCount: document.querySelectorAll("#criticalSopForm [data-sop-step-index]").length,
      activeStage: document.querySelector("#criticalSopForm")?.dataset.activePumpStage || "",
      device: state.activeCriticalDevice?.tag || state.activeCriticalDevice?.id || ""
    }));
    assert(initialGas.stepCount === 16, `Normal Gas route rendered ${initialGas.stepCount} steps instead of 16.`);
    assert(initialGas.activeStage === "gas-preparation", `Normal Gas route opened ${initialGas.activeStage || "no stage"} instead of preparation.`);

    for (let iteration = 0; iteration < 3; iteration += 1) {
      await backToSystems(gas);
      await openSystem(gas, "gas-release");
    }

    await login(mfap, "tech@rmtfire.local");
    await openJob(mfap);
    const fireAlarmButton = mfap.locator('#techActiveJobSummary [data-tech-system="fire-alarm"]').first();
    await fireAlarmButton.waitFor({ state: "visible", timeout: 15000 });
    await fireAlarmButton.click();
    await mfap.waitForFunction(() => state.activeTechSystemKey === "fire-alarm", null, { timeout: 20000 });
    assert(
      await mfap.locator("#workspace.tech-screen-mimic, #criticalSopPanel:not(.hidden)").count() >= 1,
      "Fire Alarm did not open its current workflow stage through normal navigation."
    );

    for (let iteration = 0; iteration < 12; iteration += 1) {
      await Promise.all([requestOk(`${loopbackUrl}/api/diagnostics`), requestOk(`${lanUrl}/api/diagnostics`)]);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await abortPartialRequest();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const diagnosticsAfter = await (await requestOk(`${loopbackUrl}/api/diagnostics`)).json();
    await requestOk(`${lanUrl}/`);

    assert(diagnosticsAfter.startedAt === diagnosticsBefore.startedAt, "The preview server restarted during the stability test.");
    assert(sharedStatePolls >= 2, `Expected shared-state heartbeat requests from both sessions; observed ${sharedStatePolls}.`);
    assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(" | ")}`);
    console.log(JSON.stringify({
      ok: true,
      loopback: "PASS",
      lan: "PASS",
      scheduleId,
      normalNavigation: "PASS",
      gasFirstTapEntries: 4,
      gasStepCount: initialGas.stepCount,
      gasFirstStage: initialGas.activeStage,
      mfap: "PASS",
      heartbeatSeconds: 12,
      sharedStatePolls,
      repeatedHttpRequests: 24,
      disconnectedClientContained: true,
      serverStartedAt: diagnosticsAfter.startedAt
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
