import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = "C:/Users/Joey/Documents/Codex/2026-07-09/RMT-FIREAPPS-ruflo/.ruflo-npm-cache/_npx/6cae46e04c06d98a/node_modules/@claude-flow/cli/dist/src/mcp-tools/agent-execute-core.js";
const measurementsPath = new URL("../docs/reviews/technician-nav/field-measurements.json", import.meta.url);
const outputPath = new URL("../docs/reviews/technician-nav/ollama-classification.json", import.meta.url);

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;
process.env.RUFLO_PROVIDER = "ollama";
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";

const measurements = JSON.parse(await readFile(measurementsPath, "utf8"));
const boundedFacts = {
  scheduleId: measurements.inventory.scheduleId,
  viewport: measurements.inventory.viewport,
  document: measurements.inventory.document,
  groups: measurements.inventory.groups,
  routes: measurements.routes.map((route) => ({
    id: route.id,
    label: route.label,
    screen: route.screen,
    scrollY: route.scrollY,
    mimicVisible: route.mimicVisible,
    markerCount: route.markerCount
  })),
  touchTargets: measurements.inventory.touchTargets,
  undersizedTouchTargets: measurements.inventory.undersizedTouchTargets,
  consoleErrors: measurements.consoleErrors,
  constraints: [
    "Review only; no production implementation.",
    "Do not invent systems absent from the frozen WETEX job.",
    "Preserve safety stages and linked-verification rules.",
    "Prioritize discoverability, few taps, and low scrolling."
  ]
};

const { callAnthropicMessages } = await import(pathToFileURL(modulePath).href);
const startedAt = Date.now();
const result = await callAnthropicMessages({
  provider: "ollama",
  model: "qwen2.5:1.5b-instruct",
  systemPrompt: "You are a bounded RMT technician-navigation reviewer. Use only supplied measurements. Do not invent fire procedures or production changes.",
  prompt: `Classify the measured navigation findings. Return compact JSON with keys topFindings, discoverability, tapFlow, scrollRisk, keep, proposedRailRules. Each finding must include CURRENT, PROBLEM, PROPOSED, WHY. Facts:\n${JSON.stringify(boundedFacts, null, 2)}`,
  maxTokens: 1500,
  temperature: 0,
  timeoutMs: 300000
});

if (!result.success) throw new Error(result.error || "Local Ollama navigation classification failed.");
const payload = {
  provider: "ollama",
  model: result.model,
  endpoint: process.env.OLLAMA_BASE_URL,
  durationMs: Date.now() - startedAt,
  usage: result.usage,
  output: result.output
};
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify(payload, null, 2));
