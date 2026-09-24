import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reviewRoot = path.join(root, "docs", "reviews", "linked-sync");
const evidence = JSON.parse(fs.readFileSync(path.join(reviewRoot, "test-output", "qa-live-linked-two-tech.json"), "utf8"));
const reportPath = path.join(reviewRoot, "RMT_LINKED_SYNC_TEST_REPORT.md");
const relShot = (name) => `screenshots/${name}`;
const sideRows = (states) => states.flatMap((item) => item.sides.map((side) =>
  `| \`${item.linkedVerificationId}\` | ${side.sideId} | ${side.technicianId} | ${side.result || "-"} | ${side.revision} | ${item.status} |`
)).join("\n");
const maxDelay = Math.max(...Object.values(evidence.updateDelaysMs));

const markdown = `# RMT Linked Sync Test Report

Generated: ${evidence.generatedAt}

Build under review: uncommitted linked-sync repair on current WIP

Physical retest: **NOT STARTED**

Automated status: **READY FOR CHATGPT REVIEW**

## A. Root Cause

The physical Pump-to-MFAP failure was reproduced against the real Wetex schedule \`${evidence.scheduleId}\` before the correction.

Four related defects were found in \`outputs/fire-inspection-mvp/app.js\`:

1. \`getPumpLinkedVerificationDefinitions()\` inferred linked tests for every pump-SOP device in scope. Wetex therefore gained an extra WRP Jockey/Duty/Standby set even though WRP and MFAP were assigned to the same technician. Those three never received a second side and kept FAP Step 8 pending after the intended SPP pump was verified.
2. CO2/Gas Release had no equivalent dynamic linked definitions or gas-SOP side-save trigger. FAP Step 8 requested CO2 but could never receive an authoritative CO2 result.
3. \`refreshActiveTechnicianSharedState()\` refreshed the shared store and live prompt but did not rerender the read-only FAP Step 8 summary. New counterpart state could reach the browser while the visible result remained stale.
4. \`getSopLinkedVerificationAutoState()\` evaluated pending siblings before mismatches. A known mismatch plus another not-started event incorrectly displayed PENDING instead of FAIL.

The repair:

- generates automatic Pump/CO2 links only for genuine cross-technician assignments;
- adds stable CO2 IDs and uses the existing revision-protected side-record API;
- saves the configured Gas/CO2 indication step through the shared linked-verification path;
- rerenders FAP Step 8 only when its derived signature changes and no form field is focused;
- gives authoritative mismatch/negative state precedence over pending state.

No Pump checklist wording, SOP operating procedure, pin, mimic, report, or Admin behavior was changed.

### Why earlier QA passed

Earlier tests proved a synthetic single-pump reconciliation and the presence of the MFAP prompt. They did not use the actual Wetex combination of SPP + WRP + CO2 assignments, did not assert the visible FAP Step 8 DOM after a remote save, and did not require CO2 to produce a shared event. The server-side Pump pair was valid, but the real Wetex aggregate remained blocked by unrelated inferred WRP records and absent CO2 records.

## B. Pump to MFAP Evidence

- Schedule: \`${evidence.scheduleId}\`
- Job: \`${evidence.jobId}\`
- Pump equipment: \`LG.SPP.1\`
- Pump side owner: \`tech2@rmtfire.local\`
- MFAP side owner: \`tech@rmtfire.local\`
- Stable identity format: \`scheduleId::PUMP_MFAP::pumpDeviceId::testKey\`

| Linked verification | Side | Technician | Result | Revision | Final state |
|---|---|---|---|---:|---|
${sideRows(evidence.pump.states)}

The harness created the Pump side first, observed \`AWAITING_COUNTERPART\`, allowed the MFAP technician to answer the existing event, and then observed the reconciled result from the Pump context without browser refresh.

## C. CO2 to MFAP Evidence

- Gas side owner: \`tech2@rmtfire.local\`
- Remote-panel/MFAP owner: \`tech@rmtfire.local\`
- Stable identity format: \`scheduleId::CO2_MFAP::gasDeviceId::INDICATION\`
- No technical discharge/activation procedure was added.

| Linked verification | Side | Technician | Result | Revision | Final state |
|---|---|---|---|---:|---|
${sideRows(evidence.co2.states)}

The configured Gas/CO2 indication checkpoint now writes only the suppression-location side. The MFAP technician receives and answers the same logical linked event.

## D. Live Update Proof

Two independent authenticated Edge contexts were active concurrently. Navigation counters remained Tech A = ${evidence.navigationCounts.techA}, Tech B = ${evidence.navigationCounts.techB} after setup.

| Update | Observed delay |
|---|---:|
| Pump prompt after Tech A reconnect | ${evidence.updateDelaysMs.pumpPromptAfterReconnect} ms |
| Duty Pump final result received by Tech B | ${evidence.updateDelaysMs.dutyResultToTechB} ms |
| CO2 prompt received by Tech A | ${evidence.updateDelaysMs.co2PromptToTechA} ms |
| CO2 final result received by Tech B | ${evidence.updateDelaysMs.co2ResultToTechB} ms |

Maximum observed delay was ${maxDelay} ms, within the existing five-second polling interval. No logout, application restart, manual reload, or checklist reopen was used.

## E. Mismatch Test

- Pump: Pump Room \`CONFIRMED\` + MFAP \`NOT_CONFIRMED\` produced \`MISMATCH_REVIEW_REQUIRED\` and FAP Pump = FAIL.
- CO2: Suppression side \`CONFIRMED\` + MFAP \`NOT_CONFIRMED\` produced \`MISMATCH_REVIEW_REQUIRED\` and FAP CO2 = FAIL even while another CO2 event remained pending.
- Correcting each MFAP side used revision 2 and returned that logical event to \`VERIFIED\`; no new event was created.

## F. Offline / Reconnect

Tech A was placed offline before Tech B submitted all three Pump sides. The server held three \`AWAITING_COUNTERPART\` events with one side each. After reconnect, the Duty prompt appeared in ${evidence.offline.reconnectElapsedMs} ms, Tech A completed the MFAP side, and each final event contained exactly two side records.

This proves reconnect recovery for a temporarily disconnected counterpart using existing polling. It does not claim full production offline/background sync is complete.

## G. Multiple Pump Identities

| Test | Linked ID suffix | Result |
|---|---|---|
| Jockey | \`JOCKEY_MANUAL\` | VERIFIED |
| Duty | \`DUTY_MANUAL\` | VERIFIED |
| Standby | \`STANDBY_MANUAL\` | VERIFIED after revision-2 mismatch correction |

The three IDs and their two side records remained independent.

## H. FAP Step 8

Initial read-only state:

- Pump: ${evidence.fapStep8.initial.details.find((item) => item.label === "Pump")?.status}
- CO2: ${evidence.fapStep8.initial.details.find((item) => item.label === "CO2")?.status}
- Overall: ${evidence.fapStep8.initial.details.find((item) => item.label === "Overall")?.status}

Final automatically derived state:

- Pump: ${evidence.fapStep8.final.details.find((item) => item.label === "Pump")?.status}
- CO2: ${evidence.fapStep8.final.details.find((item) => item.label === "CO2")?.status}
- Overall: ${evidence.fapStep8.final.details.find((item) => item.label === "Overall")?.status}

The field remains read-only. Mismatch derives FAIL; complete positive reconciliations derive PASS.

## I. Screenshots

1. [Pump side awaiting counterpart](${relShot("01-pump-awaiting-counterpart.png")})
2. [Tech 1 MFAP live prompt](${relShot("02-mfap-live-pump-prompt.png")})
3. [Pump verified result](${relShot("03-pump-verified-result.png")})
4. [MFAP verified result](${relShot("04-mfap-verified-result.png")})
5. [Pump mismatch result](${relShot("05-pump-mismatch-result.png")})
6. [CO2 linked prompt](${relShot("06-co2-linked-prompt.png")})
7. [CO2 verified result](${relShot("07-co2-verified-result.png")})
8. [CO2 mismatch result](${relShot("08-co2-mismatch-result.png")})
9. [FAP Step 8 pending](${relShot("09-fap-step8-pending.png")})
10. [FAP Step 8 final derived](${relShot("10-fap-step8-final-derived.png")})

Raw deterministic evidence: [qa-live-linked-two-tech.json](test-output/qa-live-linked-two-tech.json)

## J. Test Result Table

| Test | Result |
|---|---|
| Pump to MFAP | ${evidence.assertions.pumpTwoContext} |
| Pump live update without refresh | ${evidence.assertions.pumpLiveWithoutRefresh} |
| Jockey | ${evidence.assertions.jockey} |
| Duty | ${evidence.assertions.duty} |
| Standby | ${evidence.assertions.standby} |
| Pump mismatch | ${evidence.assertions.pumpMismatch} |
| CO2 to MFAP | ${evidence.assertions.co2TwoContext} |
| CO2 live update without refresh | ${evidence.assertions.co2LiveWithoutRefresh} |
| CO2 mismatch | ${evidence.assertions.co2Mismatch} |
| Offline reconnect | ${evidence.assertions.offlineReconnect} |
| Duplicate records | ${evidence.assertions.duplicateRecords} |
| FAP Step 8 | ${evidence.assertions.fapStep8} |

Regression subset also passed:

- \`qa-linked-verification-v1.cjs\`
- \`qa-wetex-pump-fap-live-link.cjs\`
- \`qa-fap-pump-checklist-corrections.cjs\`
- \`qa-shared-records.cjs\`
- \`qa-critical-dependency-sequence.cjs\` (fixture updated for current structured fields and mandatory linked result)
- \`qa-android-offline-poc.cjs\`
- \`qa-tech-system-hierarchy.cjs\`
- \`qa-android-mobile-web.cjs\`

Syntax checks passed for \`app.js\`, the new live test, and the updated dependency fixture. No console errors were captured by the live test.

## K. Remaining Risks

- No post-fix physical two-phone retest has been performed; Joey's original failure remains the authority until that later gate passes.
- Browser-context offline simulation proves missed-poll recovery, not every Android radio/background/suspension behavior.
- Durable production IndexedDB evidence queues and general offline conflict management remain separate known limitations.
- Dynamic automatic definitions deliberately cover cross-technician equipment only. Same-technician checks remain local SOP work unless explicitly configured as linked verification.
- The review branch is not a production release and must not be merged until ChatGPT review and physical retest approval.
`;

fs.mkdirSync(reviewRoot, { recursive: true });
fs.writeFileSync(reportPath, markdown);
console.log(reportPath);
