import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(root, "docs", "RMT_WETEX_RETEST_PACK.md");
const modulePath = "C:/Users/Joey/Documents/Codex/2026-07-09/RMT-FIREAPPS-ruflo/.ruflo-npm-cache/_npx/6cae46e04c06d98a/node_modules/@claude-flow/cli/dist/src/mcp-tools/agent-execute-core.js";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;
process.env.RUFLO_PROVIDER = "ollama";
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";

const prompt = `Create concise Markdown physical test instructions for RMT FIREAPPS. Use only the facts below. Do not invent passwords, technical fire procedures, discharge steps, bypass steps, test readings, departments, or reporting destinations. Keep it under 90 lines. Output plain Markdown without a code fence.

Verified facts:
- Test job: DEMO-WETEX-RETEST-20260924
- LAN URL is verified separately at test time; tell the user to use the reported http://<PC-IP>:8026/ URL.
- Login A: tech@rmtfire.local, Demo Technician, 33 assigned items, MFAP GRD.MFAP.1.
- Login B: tech2@rmtfire.local, Tech 2, 32 assigned items, Pump Room LG.SPP.1.
- Frozen scope: 65 IDs = 56 normal + 9 critical.
- Both phones must open the same job.
- Pump Step 3 uses feet and calculates Imperial gallons with L x W x H x 6.25.
- Pump Step 5 accepts 376-440 V inclusive. Missing or outside range requires acknowledgement/remark, blocks completion, and creates a same-job alert.
- Pump Steps 15-18 allow normal PASS/confirm without remarks; FAIL/N/A require remarks where configured.
- Pump Room manual test saves one linked side. MFAP phone should receive a live prompt without reload, then record its own side.
- Matching sides => VERIFIED. Different sides => MISMATCH_REVIEW_REQUIRED.
- Wrong technician ownership must be rejected.
- Test one phone offline: save its own work, confirm local pending state, reconnect, retry once, verify no duplicate and no overwrite.
- Capture PASS, FAULT, photo timestamp evidence, Save & Next, remaining scope, report submission, and Admin review.
- Do not alter the protected older job DEMO-WETEX-MULTITECH-SYNC-202609.

Required headings, each exactly once: Setup, Phone A, Phone B, Pump/FAP Linked Test, Offline/Reconnect, Completion/Admin Review, Pass Criteria, Stop Conditions.
- Under Phone A say to login with tech@rmtfire.local, select the exact retest job, confirm 33 assigned items, and work the MFAP side.
- Under Phone B say to login with tech2@rmtfire.local, select the same exact retest job, confirm 32 assigned items, and work the Pump Room side.
- Under Pump/FAP Linked Test explicitly state matching sides => VERIFIED and different sides => MISMATCH_REVIEW_REQUIRED.
- Under Offline/Reconnect test one phone at a time and preserve the other phone online.
- Under Pass Criteria list exact observable outcomes: 65 frozen items unchanged; 33/32 ownership; live prompt without reload; shared voltage alert; verified match; visible mismatch; offline pending then one sync; no duplicate; no overwrite.
- Under Stop Conditions state that any physical failure is authoritative and do not continue if scope, ownership, evidence, or an existing protected job changes.`;

const { callAnthropicMessages } = await import(pathToFileURL(modulePath).href);
const startedAt = Date.now();
const result = await callAnthropicMessages({
  provider: "ollama",
  model: "qwen2.5:1.5b-instruct",
  systemPrompt: "Write only the requested concise RMT physical test Markdown. Preserve supplied identifiers and rules exactly.",
  prompt,
  maxTokens: 1200,
  temperature: 0,
  timeoutMs: 300000
});

if (!result.success) throw new Error(result.error || "Local Ollama documentation task failed.");
const localDraft = String(result.output || "").trim();
const requiredDraftTerms = ["## Phone A", "## Phone B", "376", "440", "VERIFIED", "MISMATCH_REVIEW_REQUIRED"];
const draftUsable = !localDraft.startsWith("```") && requiredDraftTerms.every((term) => localDraft.includes(term));
const deterministicPack = `# RMT FIREAPPS Wetex Retest Pack

Physical Android validation is authoritative. Stop and report any difference from the expected behavior below.

## Setup

1. Open the verified LAN URL \`http://<PC-IP>:8026/\` on two Android phones using the same Wi-Fi.
2. On both phones select \`DEMO-WETEX-RETEST-20260924\`.
3. Confirm the frozen job remains 65 items: 56 normal and 9 critical.
4. Do not open or modify protected job \`DEMO-WETEX-MULTITECH-SYNC-202609\`.

## Phone A

- Login: \`tech@rmtfire.local\` (Demo Technician).
- Confirm 33 assigned items.
- Confirm \`GRD.MFAP.1\` is assigned to Phone A.
- Record only the MFAP side of linked Pump/FAP tests.

## Phone B

- Login: \`tech2@rmtfire.local\` (Tech 2).
- Confirm 32 assigned items.
- Confirm \`LG.SPP.1\` is assigned to Phone B.
- Record only the Pump Room side of linked Pump/FAP tests.

## Pump/FAP Linked Test

1. On Phone B, confirm Pump Step 3 records tank dimensions in feet and calculates \`L x W x H x 6.25\` Imperial gallons.
2. Confirm Pump Step 5 accepts 376-440 V inclusive. A missing or out-of-range reading must require acknowledgement/remarks, block completion, and create a same-job alert.
3. Confirm normal PASS/confirm on Pump Steps 15-18 does not require remarks. Use FAIL or N/A only where applicable and confirm configured remarks appear.
4. Save one Pump Room manual-test side on Phone B.
5. Without refreshing Phone A, confirm the live linked prompt and any same-job voltage alert appear in the MFAP workflow.
6. Save a matching MFAP result on Phone A. Expected final status: \`VERIFIED\`.
7. Repeat one linked event with different Pump/MFAP results. Expected final status: \`MISMATCH_REVIEW_REQUIRED\`.
8. Attempt one wrong-owner save. It must be rejected.

## Offline/Reconnect

1. Keep one phone online and disable connectivity on the other phone.
2. Save that technician's own assigned work and photo/evidence. Confirm a local pending/unsynced state is visible.
3. Refresh or reopen and confirm the local work remains.
4. Restore connectivity and retry once.
5. Confirm the record syncs once, with no duplicate, silent overwrite, or ownership change.

## Completion/Admin Review

1. Validate PASS, FAULT, photo timestamp evidence, Save & Next, and remaining-work counts on assigned devices.
2. Complete required prerequisite, field scope, completion/restoration, and acknowledgement steps without bypassing gates.
3. Submit the completed job for Admin review.
4. Confirm the technician view becomes read-only while awaiting review and Admin can inspect shared records from both technicians.

## Pass Criteria

- Frozen scope remains 65 items and exact planned IDs do not regenerate.
- Assignment remains Phone A 33 / Phone B 32.
- Live MFAP prompt appears without reload after the Pump Room save.
- Same-job voltage alert appears on the MFAP phone.
- Matching sides become \`VERIFIED\`; differing sides become \`MISMATCH_REVIEW_REQUIRED\`.
- Offline work remains visible, syncs once after reconnect, and creates no duplicate or overwrite.
- Photo timestamp evidence, technician identity, ownership, and revisions remain intact.

## Stop Conditions

Stop immediately if the physical app changes scope, ownership, evidence, the protected old job, or silently overwrites/conflicts. A physical failure overrides automated QA and must be reported before further development.
`;
writeFileSync(outputPath, `${draftUsable ? localDraft : deterministicPack.trim()}\n`, "utf8");
console.log(JSON.stringify({
  outputPath,
  provider: "ollama",
  model: result.model || "qwen2.5:1.5b-instruct",
  endpoint: process.env.OLLAMA_BASE_URL,
  durationMs: Date.now() - startedAt,
  usage: result.usage || null,
  localDraftUsable: draftUsable,
  cloudFallbackAllowed: false
}, null, 2));
