import { pathToFileURL } from "node:url";

const modulePath = "C:/Users/Joey/Documents/Codex/2026-07-09/RMT-FIREAPPS-ruflo/.ruflo-npm-cache/_npx/6cae46e04c06d98a/node_modules/@claude-flow/cli/dist/src/mcp-tools/agent-execute-core.js";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;
process.env.RUFLO_PROVIDER = "ollama";
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";

const facts = {
  physicalFailure: "Tech 2 completes Pump-side work; Tech 1 FAP Step 8 remains pending and blocks completion.",
  heartbeat: "Every 5 seconds requestSharedJobState applies shared records, loads linked index, renders stage panel, then calls renderActiveCriticalSopLinkedPrompt only.",
  fapStep8: "getSopLinkedVerificationAutoState derives Pump and CO2 status during renderCriticalSop/getSopStepRenderState.",
  currentHeartbeatGap: "Heartbeat does not rerender the FAP SOP step list after linked state changes.",
  pumpDefinitions: "Stable ID = scheduleId::PUMP_MFAP::pumpDeviceId::JOCKEY|DUTY|STANDBY_MANUAL.",
  pumpTrigger: "syncPumpManualLinkedVerifications runs after Pump critical SOP save.",
  co2Definitions: "Wetex schedule has no configured linkedVerifications and current app generates only Pump definitions dynamically.",
  co2Trigger: "No gas-discharge SOP linked-side sync helper exists.",
  fapAggregation: "Step 8 treats a verification type with no definitions as PENDING and waits for all definitions of both requested types.",
  protectedRules: "Reuse shared side records, stable IDs, revisions, ownership, idempotency and polling. Do not invent SOP content."
};

const { callAnthropicMessages } = await import(pathToFileURL(modulePath).href);
const startedAt = Date.now();
const result = await callAnthropicMessages({
  provider: "ollama",
  model: "qwen2.5:1.5b-instruct",
  systemPrompt: "Classify only supplied RMT linked-sync facts. Do not invent code or fire procedures.",
  prompt: `Compare Pump and CO2 flows. Return compact JSON with keys rootCauseCandidates, pumpGap, co2Gap, requiredTests, protectedComponents. Facts:\n${JSON.stringify(facts, null, 2)}`,
  maxTokens: 700,
  temperature: 0,
  timeoutMs: 300000
});
if (!result.success) throw new Error(result.error || "Local Ollama linked-sync classification failed.");
console.log(JSON.stringify({ provider: "ollama", model: result.model, durationMs: Date.now() - startedAt, usage: result.usage, output: result.output }, null, 2));
