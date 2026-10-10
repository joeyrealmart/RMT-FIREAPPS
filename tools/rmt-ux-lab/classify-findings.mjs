import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const observationsPath = path.join(root, "outputs", "rmt-ux-lab", "ux-observations.json");
const outputPath = path.join(root, "outputs", "rmt-ux-lab", "local-ollama-classification.json");
const modulePath = "C:/Users/Joey/Documents/Codex/2026-07-09/RMT-FIREAPPS-ruflo/.ruflo-npm-cache/_npx/6cae46e04c06d98a/node_modules/@claude-flow/cli/dist/src/mcp-tools/agent-execute-core.js";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;
process.env.RUFLO_PROVIDER = "ollama";
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";

const observations = JSON.parse(readFileSync(observationsPath, "utf8"));
const measured = observations.findings.map(({ severity, category, title, evidence, journey }) => ({
  severity,
  category,
  title,
  journey,
  evidence: String(evidence || "").slice(0, 500)
}));
const prompt = `You are the bounded RMT UX findings reviewer. Classify only the deterministic observations below. Do not invent issues, technical fire procedures, business rules, or fixes. For each observation, return: confirmed severity, whether it is a genuine product UX issue or a test-only concern, concise reason, and recommended routing (LOCAL_POLISH, PHYSICAL_REVIEW, or CODEX_HEAVY_QUEUE). Return strict JSON with keys summary and findings.\n\n${JSON.stringify(measured, null, 2)}`;

const { callAnthropicMessages } = await import(pathToFileURL(modulePath).href);
const startedAt = Date.now();
const result = await callAnthropicMessages({
  provider: "ollama",
  model: "qwen2.5:1.5b-instruct",
  systemPrompt: "Classify supplied RMT UX observations only. Never add observations.",
  prompt,
  maxTokens: 700,
  temperature: 0,
  timeoutMs: 300000
});

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
  error: result.error || ""
};
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
if (!result.success) {
  console.error(result.error || "Local Ollama classification failed");
  process.exit(1);
}
console.log(JSON.stringify({ provider: payload.provider, model: payload.resolvedModel, durationMs: payload.durationMs, usage: payload.usage }, null, 2));
