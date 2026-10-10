const { writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("C:/Users/Joey/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL = "http://127.0.0.1:8026/?checklist-audit=1";
const OUTPUT = join(__dirname, "checklist-inventory.json");
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

function summarizeQuestion(question, index) {
  if (typeof question === "string") {
    return {
      index,
      text: question,
      type: "pass-fault-na",
      required: true,
      photoRequired: false,
      readingRequired: false,
      supervisorRequired: false,
      options: [],
      fieldKeys: [],
      autofill: null,
      linkedVerification: null
    };
  }
  return {
    index,
    text: question.text || question.label || question.title || question.task || question.description || "",
    type: question.type || question.inputType || question.responseType || "",
    required: Boolean(question.required),
    photoRequired: Boolean(question.photoRequired || question.requirePhoto),
    readingRequired: Boolean(question.readingRequired || question.requireReading),
    supervisorRequired: Boolean(question.supervisorRequired || question.requireSupervisor),
    options: Array.isArray(question.options) ? question.options : [],
    fieldKeys: Array.isArray(question.fields)
      ? question.fields.map((field) => field.key || field.id || field.name || field.label || "").filter(Boolean)
      : Object.keys(question.fields || {}),
    autofill: question.autofill || question.autoFill || null,
    linkedVerification: question.linkedVerification || question.linkedVerificationType || null
  };
}

function summarizeTemplate(name, template) {
  const questions = Array.isArray(template) ? template : (template.questions || template.steps || template.items || []);
  return {
    name: template.id || template.systemKey || template.key || name,
    title: template.title || template.label || name,
    count: questions.length,
    questions: questions.map(summarizeQuestion)
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE_PATH });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    if (["GET", "HEAD"].includes(request.method())) return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, auditOnly: true }) });
  });
  const page = await context.newPage();
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#loginForm", { timeout: 20000 });
  const raw = await page.evaluate(() => ({
    checklistTemplates: typeof checklistTemplates === "object" ? checklistTemplates : {},
    systemChecklistTemplates: typeof systemChecklistTemplates === "object" ? systemChecklistTemplates : {},
    criticalSopTemplates: typeof criticalSopTemplates === "object" ? criticalSopTemplates : {}
  }));
  const output = {
    capturedAt: new Date().toISOString(),
    checklistTemplates: Object.entries(raw.checklistTemplates).map(([name, template]) => summarizeTemplate(name, template)),
    systemChecklistTemplates: Object.entries(raw.systemChecklistTemplates).map(([name, template]) => summarizeTemplate(name, template)),
    criticalSopTemplates: Object.entries(raw.criticalSopTemplates).map(([name, template]) => summarizeTemplate(name, template))
  };
  output.totals = {
    deviceTemplates: output.checklistTemplates.length,
    deviceQuestions: output.checklistTemplates.reduce((sum, template) => sum + template.count, 0),
    systemTemplates: output.systemChecklistTemplates.length,
    systemQuestions: output.systemChecklistTemplates.reduce((sum, template) => sum + template.count, 0),
    criticalTemplates: output.criticalSopTemplates.length,
    criticalSteps: output.criticalSopTemplates.reduce((sum, template) => sum + template.count, 0)
  };
  writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
  await browser.close();
  process.stdout.write(`${JSON.stringify(output.totals)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
