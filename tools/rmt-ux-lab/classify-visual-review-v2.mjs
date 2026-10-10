import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const outputDir = path.join(root, "outputs", "rmt-ux-lab", "visual-review-v2");
const observations = JSON.parse(readFileSync(path.join(root, "outputs", "rmt-ux-lab", "ux-observations.json"), "utf8"));
const modulePath = "C:/Users/Joey/Documents/Codex/2026-07-09/RMT-FIREAPPS-ruflo/.ruflo-npm-cache/_npx/6cae46e04c06d98a/node_modules/@claude-flow/cli/dist/src/mcp-tools/agent-execute-core.js";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;
process.env.RUFLO_PROVIDER = "ollama";
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";

const facts = {
  journeys: observations.journeys.map(({ name, status, metrics }) => ({ name, status, metrics })),
  findings: observations.findings,
  currentScreens: {
    technicianDesktop: [
      "Persistent system sidebar is clear but dense.",
      "Five equal-priority actions appear before the current device: Back to Dashboard, Back to System List, View Mimic, View Faults, Complete Job.",
      "Device identity is prominent; photo evidence consumes a large panel; result/save actions are below it.",
      "Sync state is not visually dominant near the primary action."
    ],
    mobileHome: [
      "Content is constrained to a narrow central column with stacked summary cards.",
      "Assigned-system state is lower on the page and needs scrolling.",
      "Bottom navigation is persistent."
    ],
    mobileInspection: [
      "Five large navigation buttons precede the device card.",
      "Result buttons are visible only after scrolling into the device card.",
      "PASS & Save and Save & Next compete as separate primary actions."
    ],
    mobileMimic: [
      "Stage cards occupy the upper viewport while the floor image appears lower.",
      "Mimic uses full content width but not full viewport height.",
      "Selected pin is visible; device action is not presented as a compact bottom sheet."
    ],
    admin: [
      "Stable left workspace navigation and compact top identity bar.",
      "Six equal-weight summary cards lead with low-severity counts before exception priority.",
      "Quick actions occupy a full row; operational panels follow in a two-column grid."
    ]
  },
  constraints: [
    "Visual proposals only; no production implementation.",
    "Preserve current Technician/Admin architecture and business logic.",
    "Professional Realmart red/navy, large field actions, compact information, minimal typing.",
    "Challenge the reference direction; avoid excessive cards, empty space, charts and equal-priority buttons."
  ]
};

const prompt = `You are the bounded local UX critique worker for RMT FIREAPPS. Review only the supplied measured facts. Do not invent screens, business rules, fire procedures, or test results. Challenge the proposed direction where it remains busy or unclear. Return strict JSON with keys: summary, technicianDesktop, mobileHomeOptionA, mobileHomeOptionB, mobileInspection, mobileMimic, adminOptionA, adminOptionB. Each screen value must contain: hierarchy (array of up to 6 labels), whyBetter (exactly 3 short points), hideOrDefer (array), and risks (array). Prioritize five questions: where am I, what am I testing, what remains, what next, saved/synced state.\n\n${JSON.stringify(facts, null, 2)}`;

const { callAnthropicMessages } = await import(pathToFileURL(modulePath).href);
const startedAt = Date.now();
const result = await callAnthropicMessages({
  provider: "ollama",
  model: "qwen2.5:1.5b-instruct",
  systemPrompt: "Classify and recommend from supplied RMT UX evidence only. Output strict JSON and no markdown.",
  prompt,
  maxTokens: 1800,
  temperature: 0,
  timeoutMs: 300000,
});

mkdirSync(outputDir, { recursive: true });
const payload = {
  generatedAt: new Date().toISOString(),
  provider: "ollama",
  endpoint: process.env.OLLAMA_BASE_URL,
  requestedModel: "qwen2.5:1.5b-instruct",
  cloudFallbackAllowed: false,
  durationMs: Date.now() - startedAt,
  success: Boolean(result.success),
  resolvedModel: result.model || "",
  usage: result.usage || null,
  output: result.output || "",
  error: result.error || "",
};
writeFileSync(path.join(outputDir, "local-ollama-critique.json"), `${JSON.stringify(payload, null, 2)}\n`);
if (!result.success) {
  console.error(result.error || "Local Ollama visual critique failed");
  process.exit(1);
}
console.log(JSON.stringify({ provider: payload.provider, model: payload.resolvedModel, durationMs: payload.durationMs, usage: payload.usage }, null, 2));
