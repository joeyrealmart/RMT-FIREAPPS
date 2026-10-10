import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = "C:/Users/Joey/Documents/Codex/2026-07-09/RMT-FIREAPPS-ruflo/.ruflo-npm-cache/_npx/6cae46e04c06d98a/node_modules/@claude-flow/cli/dist/src/mcp-tools/agent-execute-core.js";
const outputPath = new URL("../docs/reviews/physical-correction/test-output/mfap-live-indications-local-review.json", import.meta.url);

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;
process.env.RUFLO_PROVIDER = "ollama";
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";

const facts = {
  objective: "Add CHECKLIST and LIVE INDICATIONS tabs inside the existing MFAP SOP workspace.",
  existingComponents: [
    "renderCriticalSop builds the MFAP checklist in #criticalSopForm",
    "renderCriticalSopLiveLinkedPrompt renders initiated Pump and CO2/Gas MFAP confirmations",
    "renderTechnicianLinkedVerificationCards owns the working response cards and buttons",
    "renderActiveCriticalSopLinkedPrompt refreshes cards after shared-state changes",
    "refreshActiveTechnicianSharedState polls authoritative shared state every five seconds"
  ],
  constraints: [
    "UI only; no API, schema, ownership, revision, reconciliation, or sync changes",
    "One Live Indications tab for all current and future linked systems",
    "Badge derived from existing linked state",
    "Do not force navigation away from a checklist in progress",
    "Mobile tabs must not create horizontal scrolling"
  ],
  requiredQa: [
    "Pump request appears while Tech 1 remains scrolled inside Checklist",
    "Badge and sticky alert update without manual refresh",
    "VIEW opens Live Indications and focuses the new card",
    "Pump confirmation reconciles",
    "CO2 Step 12 repeats the same flow",
    "Gas Release and Wet Chemical are reported as configured or not configured"
  ]
};

const { callAnthropicMessages } = await import(pathToFileURL(modulePath).href);
const startedAt = Date.now();
const result = await callAnthropicMessages({
  provider: "ollama",
  model: "qwen2.5:1.5b-instruct",
  systemPrompt: "You are a bounded RMT UI reviewer. Use only supplied facts. Do not invent fire procedures, APIs, data models, or product scope.",
  prompt: `Return compact JSON with keys smallestChange, reusableComponents, risks, qaMatrix. Keep every recommendation UI-only. Facts:\n${JSON.stringify(facts, null, 2)}`,
  maxTokens: 900,
  temperature: 0,
  timeoutMs: 300000
});

if (!result.success) throw new Error(result.error || "Local Ollama MFAP review failed.");
const payload = {
  provider: "ollama",
  model: result.model,
  endpoint: process.env.OLLAMA_BASE_URL,
  durationMs: Date.now() - startedAt,
  usage: result.usage,
  output: result.output
};
await mkdir(new URL("../docs/reviews/physical-correction/test-output/", import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify(payload, null, 2));
