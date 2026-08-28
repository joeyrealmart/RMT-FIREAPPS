const { existsSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("playwright");

const APP_URL = "http://127.0.0.1:8026/?fresh=20260813-critical-report";
const OUTPUT_PDF = join(__dirname, "..", "output", "pdf", "realmart-letterhead-sample-report.pdf");
const OUTPUT_PNG = join(__dirname, "..", "output", "pdf", "realmart-letterhead-sample-report-preview.png");
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeWetexData() {
  const floors = Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    const padded = String(number).padStart(2, "0");
    return {
      id: `wetex-floor-${padded}`,
      companyName: "WETEX",
      siteName: "WETEX",
      floorCode: `L${number}`,
      floorName: `Floor ${padded}`,
      title: `WETEX - Floor ${padded}`,
      src: "assets/lv1-map.png",
      cleanSrc: "assets/lv1-map.png"
    };
  });

  const devices = [];
  floors.forEach((floor, floorIndex) => {
    const floorNumber = floorIndex + 1;
    for (let index = 1; index <= 4; index += 1) {
      devices.push({
        tag: `W${floorNumber}.SD.${index}`,
        type: "Smoke Detector",
        floor: floor.title,
        companyName: "WETEX",
        siteName: "WETEX",
        location: `Corridor ${index}`,
        status: "Confirmed",
        xPercent: 10 + index * 6,
        yPercent: 12 + floorNumber,
        capturedBy: "Report Sample",
        capturedAt: new Date().toISOString()
      });
    }
    devices.push({
      tag: `W${floorNumber}.EL.${floorNumber}`,
      type: "Emergency Light",
      floor: floor.title,
      companyName: "WETEX",
      siteName: "WETEX",
      location: `Lift lobby level ${floorNumber}`,
      status: "Confirmed",
      xPercent: 54,
      yPercent: 20 + floorNumber,
      capturedBy: "Report Sample",
      capturedAt: new Date().toISOString()
    });
  });

  devices.push(
    {
      tag: "W1.MFAP.1",
      type: "Main Fire Alarm Panel",
      floor: floors[0].title,
      companyName: "WETEX",
      siteName: "WETEX",
      location: "Security counter",
      status: "Confirmed",
      xPercent: 70,
      yPercent: 20,
      capturedBy: "Report Sample",
      capturedAt: new Date().toISOString()
    },
    {
      tag: "W2.HRP.1",
      type: "Hose Reel Panel",
      floor: floors[1].title,
      companyName: "WETEX",
      siteName: "WETEX",
      location: "Pump room",
      status: "Confirmed",
      xPercent: 75,
      yPercent: 25,
      capturedBy: "Report Sample",
      capturedAt: new Date().toISOString()
    },
    {
      tag: "W3.CO2.1",
      type: "CO2 System",
      floor: floors[2].title,
      companyName: "WETEX",
      siteName: "WETEX",
      location: "CO2 protected room",
      status: "Confirmed",
      xPercent: 78,
      yPercent: 38,
      capturedBy: "Report Sample",
      capturedAt: new Date().toISOString()
    }
  );

  return { floors, devices };
}

(async () => {
  mkdirSync(join(__dirname, "..", "output", "pdf"), { recursive: true });
  const executablePath = EDGE_PATHS.find((path) => existsSync(path));
  assert(executablePath, "No Edge/Chrome executable found for PDF generation.");

  const { floors, devices } = makeWetexData();
  const browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });

  await context.addInitScript(({ floors, devices }) => {
    localStorage.clear();
    localStorage.setItem("rmtMimicFloors", JSON.stringify(floors));
    localStorage.setItem("tmFireSetupDevices", JSON.stringify(devices));
    localStorage.setItem("rmtSiteProfile", JSON.stringify({ companyName: "WETEX", siteName: "WETEX" }));
    localStorage.setItem("rmtContractRules", JSON.stringify({
      "WETEX|WETEX": {
        companyName: "WETEX",
        siteName: "WETEX",
        frequencyPercent: 10
      }
    }));
  }, { floors, devices });

  const page = await context.newPage();
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.click("#loginForm button[type=\"submit\"]");
  await page.waitForSelector("#workspace:not(.hidden)", { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll("#scheduleFloor option").length >= 10);
  await page.evaluate(({ devices }) => {
    state.setupDevices = devices;
    writeStoredJson("tmFireSetupDevices", state.setupDevices);
    renderSetupDevices();
    renderFloorOptions("wetex-floor-01", { companyName: "WETEX", siteName: "WETEX" });
  }, { devices });
  await page.selectOption("#scheduleScope", "full-maintenance");
  await page.fill("#scheduleTechnician", "Admin");
  await page.evaluate(async () => {
    const schedule = buildSchedulePayload();
    schedule.technician = getCurrentUserName();
    state.schedules = [schedule];
    persistSchedules();
    const started = await startScheduledJob(schedule.scheduleId);
    if (!started) {
      throw new Error(document.querySelector("#syncState")?.textContent || "Unable to start sample schedule");
    }
  });

  await page.evaluate(() => {
    const planned = getInspectionDevicesForRun();
    const now = new Date().toISOString();
    planned.slice(0, 8).forEach((device, index) => {
      state.inspections[device.id] = {
        status: index === 2 ? "fail" : "pass",
        answers: {},
        notes: index === 2 ? "Sample defect: emergency light battery weak, replacement recommended." : "Checked and found normal.",
        action: index === 2 ? "Prepare quotation for battery replacement." : "No action required.",
        beforePhoto: `sample-before-${device.id}.jpg`,
        afterPhoto: `sample-after-${device.id}.jpg`,
        inspectedAt: now,
        inspectedBy: getCurrentUserName()
      };
    });
    writeStoredJson("tmFireInspections", state.inspections);
    state.setupDevices = state.setupDevices.map((device) => ({
      ...device,
      status: device.status || "Confirmed"
    }));
    writeStoredJson("tmFireSetupDevices", state.setupDevices);

    const findDevice = (tag) => state.setupDevices.find((device) => device.tag === tag || device.id === tag) || {};
    const readingForStep = (templateId, title) => {
      const value = title.toLowerCase();
      if (templateId === "fire-alarm-tripping-sop") {
        if (value.includes("panel type")) return "Addressable panel / 18 zones used / 2 spare / panel normal";
        if (value.includes("power supply")) return "AC normal / standby battery 26.8V / charger normal";
        if (value.includes("manual call")) return "W1.MCP.1-W1.MCP.4 tested / correct indication";
        if (value.includes("smoke")) return "W1.SD.1-W1.SD.4 tested / correct indication";
      }
      if (templateId === "hose-reel-pump-sop") {
        if (value.includes("3-phase")) return "R-Y 415V / Y-B 414V / B-R 416V";
        if (value.includes("starting pressure")) return "95 PSI";
        if (value.includes("duty pump manual")) return "Running current normal / no abnormal sound";
        if (value.includes("duty pump auto")) return "Cut in 80 PSI / cut out 120 PSI";
        if (value.includes("battery")) return "12.8V / charger charging normal";
        if (value.includes("standby pump manual")) return "Started normal / no leakage observed";
        if (value.includes("standby pump auto")) return "Cut in 70 PSI / cut out 120 PSI";
        if (value.includes("hose reel points")) return "HR-1 to HR-6 sampled / flow normal";
        if (value.includes("final pressure")) return "120 PSI / panel normal";
      }
      if (templateId === "gas-discharge-sop") {
        if (value.includes("power")) return "AC normal / standby battery 26.7V / charger charging normal";
        if (value.includes("discharge delay")) return "28 seconds timer observed / no actual discharge";
      }
      return "Checked normal";
    };

    const makeCriticalSop = (templateId, deviceTag, remarks) => {
      const template = criticalSopTemplates.find((item) => item.id === templateId);
      const device = findDevice(deviceTag);
      const steps = {};
      template.steps.forEach((step, index) => {
        steps[index] = {
          confirmed: true,
          title: step.title,
          critical: Boolean(step.critical),
          choice: step.requiresChoice ? (step.choices?.[0] || "Pass") : "",
          reading: step.requiresReading ? readingForStep(templateId, step.title) : "",
          remark: sopStepNeedsRemark(step) ? "Checked and confirmed normal." : "",
          photo: step.requiresPhoto ? `sample-critical-${deviceTag}-step-${index + 1}.jpg` : "",
          supervisor: step.requiresSupervisor ? "Joey Ho W.C" : ""
        };
      });
      return {
        templateId,
        title: template.title,
        deviceTag,
        deviceType: device.type || "",
        floor: device.floor || "",
        location: device.location || "",
        companyName: "WETEX",
        siteName: "WETEX",
        steps,
        beforePhoto: `${deviceTag}-before-test.jpg`,
        afterPhoto: `${deviceTag}-after-normal.jpg`,
        filledBy: "Admin",
        filledRole: "admin",
        evidenceAt: now,
        generalRemarks: remarks,
        savedAt: now,
        savedBy: "Admin"
      };
    };

    state.criticalSops = {
      "fire-alarm-tripping-sop::W1.MFAP.1": makeCriticalSop("fire-alarm-tripping-sop", "W1.MFAP.1", "Panel normal after testing. Tripping isolation restored and confirmed with client representative."),
      "hose-reel-pump-sop::W2.HRP.1": makeCriticalSop("hose-reel-pump-sop", "W2.HRP.1", "Pump selector returned to AUTO. Suction and delivery valves confirmed open. No abnormal vibration or leakage observed."),
      "gas-discharge-sop::W3.CO2.1": makeCriticalSop("gas-discharge-sop", "W3.CO2.1", "CO2 discharge output safely isolated during test. Discharge timer observed only. System restored to normal before leaving site.")
    };
    writeStoredJson("rmtCriticalSops", state.criticalSops);
  });

  await page.click("#showReportBtn");
  await page.waitForSelector("#reportView:not(.hidden)", { timeout: 15000 });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: OUTPUT_PDF,
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", right: "10mm", bottom: "12mm", left: "10mm" }
  });
  await page.screenshot({ path: OUTPUT_PNG, fullPage: true });
  await browser.close();

  console.log(JSON.stringify({ ok: true, pdf: OUTPUT_PDF, preview: OUTPUT_PNG }, null, 2));
})();
