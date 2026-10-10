import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..", "..");
const lab = path.join(root, "outputs", "rmt-mimic-lab", "LTK");
const modulePath = "C:/Users/Joey/Documents/Codex/2026-07-09/RMT-FIREAPPS-ruflo/.ruflo-npm-cache/_npx/6cae46e04c06d98a/node_modules/@claude-flow/cli/dist/src/mcp-tools/agent-execute-core.js";
const floors = ["main-panel", "feed-mill", "egg-production"];

for (const key of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY"]) {
  delete process.env[key];
}
process.env.OLLAMA_HOST = "http://127.0.0.1:11434";
process.env.RUFLO_PROVIDER = "ollama";
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";

const manifests = floors.map((floor) => ({
  floor,
  ...(() => {
    const manifest = JSON.parse(fs.readFileSync(path.join(lab, floor, "manifest.json"), "utf8"));
    const review = JSON.parse(fs.readFileSync(path.join(lab, floor, "review-status.json"), "utf8"));
    return {
      version: manifest.backgroundVersion,
      segmentCount: manifest.geometry.segmentCount,
      unsupportedStrokesRemoved: manifest.geometry.removedUnsupportedSegments,
      diagonalSegments: manifest.geometry.diagonalSegments,
      identityCoordinates: manifest.coordinateTransform.type === "IDENTITY",
      runtimePinsExcluded: manifest.containsRuntimePins === false,
      reviewStatus: review.status,
      humanReview: review.humanReview,
    };
  })(),
}));
const prompt = [
  "You are a bounded QA summarizer for RMT-MIMIC-LAB.",
  "Use only the supplied deterministic manifest and review data.",
  "Do not infer missing geometry, approve drawings, or suggest invented rooms/equipment.",
  "Every humanReview entry is an OPEN UNCONFIRMED check. Do not describe any of them as accurate, confirmed, passed, preserved, or represented.",
  "State that source comparison by Joey is required for doors, curves, diagonals, stairs, major sections, and possible annotation-line contamination.",
  "Return concise JSON with keys summary, perFloor, humanReviewRequired, productionIntegration.",
  "productionIntegration must be false and humanReviewRequired must be true.",
  JSON.stringify(manifests),
].join("\n");

const started = Date.now();
const { callAnthropicMessages } = await import(pathToFileURL(modulePath).href);
const result = await callAnthropicMessages({
  provider: "ollama",
  model: "qwen2.5:1.5b-instruct",
  systemPrompt: "Summarize supplied deterministic RMT Mimic Lab review data only. Never invent or approve geometry.",
  prompt,
  maxTokens: 450,
  temperature: 0,
  timeoutMs: 180000,
});
const durationMs = Date.now() - started;
const modelOutput = result.output || "";
const forbiddenClaims = [
  /all major building sections remain/i,
  /confirmed against the source/i,
  /genuine source geometry/i,
  /accurately (?:aligned|represented)/i,
  /no .*annotation-line contamination/i,
];
const unsupportedClaims = forbiddenClaims.filter((pattern) => pattern.test(modelOutput)).map((pattern) => pattern.source);
const output = {
  provider: "ollama",
  endpoint: "http://127.0.0.1:11434",
  requestedModel: "qwen2.5:1.5b-instruct",
  durationMs,
  cloudFallbackAllowed: false,
  success: Boolean(result.success),
  resolvedModel: result.model || "",
  usage: result.usage || null,
  output: modelOutput,
  error: result.error || "",
  reviewAccepted: Boolean(result.success) && unsupportedClaims.length === 0,
  validation: unsupportedClaims.length
    ? { status: "REJECTED_OVERCLAIM", unsupportedClaims }
    : { status: "ACCEPTED_BOUNDED_SUMMARY", unsupportedClaims: [] },
};
fs.writeFileSync(path.join(lab, "analysis", "local-ollama-review.json"), `${JSON.stringify(output, null, 2)}\n`);
if (!result.success) {
  console.error(result.error || "Local Ollama Mimic Lab review failed");
  process.exit(1);
}
console.log(JSON.stringify({ provider: output.provider, model: output.resolvedModel, durationMs, usage: output.usage }, null, 2));
