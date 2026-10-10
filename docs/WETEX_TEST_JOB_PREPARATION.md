# WETEX Test Job Preparation

Status: preparation only. No schedule/job was created or activated by this audit.

Proposed job ID: `DEMO-WETEX-MULTITECH-SYNC-202609`

## Scope Boundary

This document inventories the existing `WETEX / WETEX` data and prepares a candidate monthly service scope for later physical testing. It does not assign a final mimic background, alter annual coverage, reserve devices, modify the device master, or create a schedule.

`WETEX PARADE / WETEX/CLASSIC` is a separate dataset and is explicitly excluded.

## Authoritative Data Located

| Purpose | Current source | Finding |
| --- | --- | --- |
| Schedule-ready client/site | `outputs/fire-inspection-mvp/app.js` | `WETEX / WETEX` is enabled with `scheduleReady: true`. There is no separate authoritative client/site database record yet. |
| Device master | `outputs/rmt-fire-local-data/device-master/wetex-wetex-device-master.json` | 569 tagged devices with normalized pin coordinates. |
| Mimic/floor metadata | `outputs/rmt-fire-local-data/mimic-library/mimic-library-app-data.json` | 11 Wetex floors, each referencing a legacy original and a current clean-layer image. |
| Current schedules | `outputs/rmt-fire-local-data/schedules/service-schedules.json` | Two QA extinguisher schedules only; no current `WETEX / WETEX` schedule. |
| Shared job snapshots | `outputs/rmt-fire-local-data/shared-records/jobs/*.json` | 180 old/QA Wetex snapshots; none are current schedule-list entries. They are not used as active annual reservations by the schedule loader. |
| Annual scope state | Browser `rmtScopeCycle` and `tmFireScopeHistory` localStorage | No authoritative shared/server annual-coverage record. Exact covered/reserved state must be revalidated in the Admin browser that will create the final job. |
| Runtime clean-mimic manifest | `outputs/fire-inspection-mvp/assets/mimics/index.json` | No Wetex production manifest is registered yet. Final clean backgrounds must be registered later, after review. |

## Client And Site

- Client/company: `WETEX`
- Site: `WETEX`
- Schedule-ready: yes
- Proposed service: Monthly maintenance, 10 percent
- Proposed annual cycle: `annual-2026` using the current year-based fallback
- Technician A: `tech@rmtfire.local` (`Demo Technician`)
- Technician B: `tech2@rmtfire.local` (`Tech 2`)

## Floors And Existing Mimic References

The device-master top-level `floors` array is empty. Floor identity currently comes from each device's `floor` value and the mimic-library records.

| Floor ID | Code | Display name | Existing clean reference | Devices |
| --- | --- | --- | --- | ---: |
| `lib-wetex-f01` | LG | WETEX-01 / LG | `wetex-floor-01-structure.png` | 54 |
| `lib-wetex-f02` | GRD | WETEX-02 / Ground | `wetex-floor-02-structure.png` | 60 |
| `lib-wetex-f03` | L1 | WETEX-03 / L1 | `wetex-floor-03-structure.png` | 53 |
| `lib-wetex-f04` | L2 | WETEX-04 / L2 | `wetex-floor-04-structure.png` | 54 |
| `lib-wetex-f05` | L3 | WETEX-05 / L3 | `wetex-floor-05-structure.png` | 51 |
| `lib-wetex-f06` | L5 | WETEX-06 / L5 | `wetex-floor-06-structure.png` | 59 |
| `lib-wetex-f07` | L6 | WETEX-07 / L6 | `wetex-floor-06-structure.png` | 59 |
| `lib-wetex-f08` | L7 | WETEX-08 / L7 | `wetex-floor-06-structure.png` | 59 |
| `lib-wetex-f09` | L8 | WETEX-09 / L8 | `wetex-floor-06-structure.png` | 59 |
| `lib-wetex-f10` | L9 | WETEX - L9 (Existing 08) | `wetex-floor-08-structure.png` | 55 |
| `lib-wetex-f11` | ROOF | WETEX - Rooftop (Existing 09) | `wetex-floor-09-structure.png` | 6 |

Important mimic gap: L6, L7, and L8 currently point to the same `wetex-floor-06` original and clean background. These mappings must be confirmed when the new Wetex mimics are ready. No background was changed in this task.

## Device Master Inventory

| Device type | Count | Current scope class |
| --- | ---: | --- |
| Emergency Light | 178 | Normal/passive |
| Exit Sign | 150 | Normal/passive |
| Smoke Detector | 88 | Normal/passive |
| Manual Call Point | 70 | Normal/passive |
| Heat Detector | 39 | Normal/passive |
| Hose Reel | 20 | Normal/passive |
| Flow Switch | 15 | Normal/passive, with configurable cross-system dependencies |
| CO2 System | 6 | Critical/system equipment |
| Main Fire Alarm Panel | 1 | Critical/system equipment |
| Sprinkler Panel | 1 | Critical/system equipment |
| Wet Riser Panel | 1 | Critical/system equipment |
| **Total** | **569** | **560 normal + 9 critical** |

Integrity findings:

- Missing device IDs/tags: 0
- Duplicate exact tags: 0
- Duplicate case-insensitive tags: 0
- Missing floor values: 0
- Missing normalized pin coordinates: 0
- Coordinates outside 0-100 percent: 0
- Records still marked `Pending Review`: 569
- Records without a useful text location: 562

The IDs are structurally unique, but the site master is not yet fully field-verified. Pin position can support navigation, while location text and device approval status remain material data-quality blockers.

## Existing Jobs And History

The current authoritative schedule list contains no `WETEX / WETEX` job, so there are no current Wetex schedule reservations in that file.

The shared-record folder contains 180 legacy/QA Wetex snapshots:

- 8 snapshots with 1 planned item
- 142 snapshots with 12 planned items
- 29 snapshots with 13 planned items
- 1 snapshot with 65 planned items
- 0 have normal inspection records
- 0 have sign-off records

These retained artifacts are not deleted and are not treated as current schedules. One historical 65-item snapshot (`SCH-20260820-122310-691`) contains the same clean-cycle selection reproduced below, but it predates the current annual-cycle key format and is used only as a read-only consistency reference.

No authoritative server-side Wetex `coveredIds`, `reservedIds`, or mandatory-recheck list was found. Those values currently live in browser localStorage, so the final scope cannot be called authoritative until the actual scheduling browser's current cycle is checked.

## Monthly 10 Percent Calculation

Current production calculation in `getMaintenanceScopeSelection()`:

```text
eligible normal devices = 560
frequency = 10 percent
raw target = 560 x 0.10 = 56
rounding = Math.ceil(raw target), with a minimum of 1
planned normal-device count = 56
critical equipment = 9 additional items at 100 percent
mandatory rechecks = additional, currently unknown until authoritative browser cycle is checked
clean-cycle total with no rechecks = 65
```

Critical devices are not counted inside the 56-device normal sample.

The current annual selection order prefers devices that are neither covered nor reserved, balances site-wide selection across floors, and freezes `plannedDeviceIds` only when the schedule is committed. This audit ran without `commitHistory`, so it created no reservation.

## Candidate Normal `plannedDeviceIds`

This candidate assumes a fresh `annual-2026` cycle with no covered IDs, no reservations, and no mandatory rechecks. It was reproduced from actual Wetex data with the current classification, `Math.ceil`, and floor-balanced rotation order. It must be recalculated/revalidated immediately before final job creation.

```text
L9.EL.21
R.SD.5
LG.FS.1
GRD.FS.3
L1.FS.3
L2.EL.22
L3.FS.3
L5.EL.17
L6.EL.17
L7.EL.17
L8.EL.17
L9.EL.20
R.SD.4
LG.MCP.6
GRD.FS.2
L1.FS.2
L2.EL.21
L3.FS.2
L5.EL.16
L6.EL.16
L7.EL.16
L8.EL.16
L9.EL.19
R.SD.3
LG.MCP.5
GRD.FS.1
L1.FS.1
L2.EL.20
L3.FS.1
L5.EL.15
L6.EL.15
L7.EL.15
L8.EL.15
L9.EL.18
R.SD.2
LG.MCP.4
GRD.EL.16
L1.EL.19
L2.EL.19
L3.EL.12
L5.EL.14
L6.EL.14
L7.EL.14
L8.EL.14
L9.EL.17
R.SD.1
LG.MCP.3
GRD.EL.15
L1.EL.18
L2.EL.18
L3.EL.11
L5.EL.13
L6.EL.13
L7.EL.13
L8.EL.13
L9.EL.16
```

### Candidate Normal Floor Distribution

| Floor | Normal sample |
| --- | ---: |
| WETEX - L9 (Existing 08) | 6 |
| WETEX - Rooftop (Existing 09) | 5 |
| WETEX-01 / LG | 5 |
| WETEX-02 / Ground | 5 |
| WETEX-03 / L1 | 5 |
| WETEX-04 / L2 | 5 |
| WETEX-05 / L3 | 5 |
| WETEX-06 / L5 | 5 |
| WETEX-07 / L6 | 5 |
| WETEX-08 / L7 | 5 |
| WETEX-09 / L8 | 5 |
| **Total** | **56** |

## Critical Items (Separate From 10 Percent)

```text
LG.CO2.3
LG.CO2.2
LG.CO2.1
LG.SPP.1
LG.WRP.1
GRD.MFAP.1
GRD.CO2.2
GRD.CO2.1
R.CO2.1
```

Critical floor distribution is LG 5, Ground 3, Rooftop 1. Their technical hierarchy and technician responsibility must come from approved Wetex/site configuration. No Hose Reel Pump or other missing parent is inferred. The Wetex Hose Reel parent/supply relationship remains unconfirmed.

## Proposed Two-Technician Split

The split below alternates the 56 normal sample in selection order, giving each technician 28 devices. It is preparation only.

### Technician A - `tech@rmtfire.local` (28 normal)

```text
L9.EL.21, LG.FS.1, L1.FS.3, L3.FS.3, L6.EL.17, L8.EL.17,
R.SD.4, GRD.FS.2, L2.EL.21, L5.EL.16, L7.EL.16, L9.EL.19,
LG.MCP.5, L1.FS.1, L3.FS.1, L6.EL.15, L8.EL.15, R.SD.2,
GRD.EL.16, L2.EL.19, L5.EL.14, L7.EL.14, L9.EL.17, LG.MCP.3,
L1.EL.18, L3.EL.11, L6.EL.13, L8.EL.13
```

### Technician B - `tech2@rmtfire.local` (28 normal)

```text
R.SD.5, GRD.FS.3, L2.EL.22, L5.EL.17, L7.EL.17, L9.EL.20,
LG.MCP.6, L1.FS.2, L3.FS.2, L6.EL.16, L8.EL.16, R.SD.3,
GRD.FS.1, L2.EL.20, L5.EL.15, L7.EL.15, L9.EL.18, LG.MCP.4,
L1.EL.19, L3.EL.12, L6.EL.14, L8.EL.14, R.SD.1, GRD.EL.15,
L2.EL.18, L5.EL.13, L7.EL.13, L9.EL.16
```

Suggested critical workload for planning only: A could take the five LG critical records; B could take the three Ground records plus the Rooftop record. Admin must confirm this against approved competencies and site workflow before activation.

Important enforcement gap: ordinary schedule records currently freeze a job-level technician name but do not contain a server-enforced per-device technician assignment map. The A/B split is therefore operational guidance, not an access-control boundary. Revision checks still protect each saved item.

## Proposed Fixture Specification (Not Activated)

```json
{
  "scheduleId": "DEMO-WETEX-MULTITECH-SYNC-202609",
  "companyName": "WETEX",
  "siteName": "WETEX",
  "serviceType": "Maintenance / Inspection",
  "contractFrequencyPercent": 10,
  "annualCycleId": "annual-2026",
  "scopeSelectionMode": "site-wide",
  "scopeFrozen": true,
  "technicians": [
    "tech@rmtfire.local",
    "tech2@rmtfire.local"
  ],
  "sampledNormalCount": 56,
  "criticalCount": 9,
  "mandatoryRecheckCount": "RECALCULATE_BEFORE_ACTIVATION",
  "plannedDeviceIds": "FREEZE_ONLY_AFTER_FINAL_RECALCULATION"
}
```

Do not copy the historical 65-item snapshot into the final fixture. The schedule creator must use the current browser's annual-cycle state, include any genuine mandatory rechecks as additional items, and freeze the resulting IDs exactly once.

## Timeline Readiness

| Required event | Current readiness | Notes |
| --- | --- | --- |
| Job created | Partial | Schedule has `createdAt`, but there is no unified append-only server job-event ledger. |
| Technician assigned | Partial | Job-level technician/team data exists; assignment changes are not a dedicated immutable event. |
| Inspection started | Partial | Active-job/start state exists, but normal checklist-session start is not a central authoritative event. |
| PASS saved | Ready online | Per-item shared record retains technician, timestamp, result, revision, and evidence references. |
| FAULT saved | Ready online | Same per-item shared record model; fault/evidence fields are retained. |
| Evidence added | Ready online/partial offline | Evidence metadata is in the inspection record. Photo Timestamp Evidence V1 was not touched by this audit. |
| Offline draft | Prototype only | Browser draft behavior exists; it is not a durable general offline queue. |
| Reconnect/sync | Partial | Revision-protected online writes exist. General background upload/retry and conflict resolution remain incomplete. |
| Technician scope completed | Gap | Job-level completion exists, but the proposed A/B device split is not authoritative, so per-tech completion cannot be proven from assignment data alone. |
| Job submitted | Ready online | Submission state records technician, timestamp, counts, revision, and review status. |
| Admin review/approval | Ready as state, partial as audit | Return/approve states exist; a unified immutable job timeline is still absent. |

`buildInspectionRunActivity()` and `buildJobActivityEvents()` derive display activity from records. They do not replace an append-only authoritative activity store.

## Multi-Technician Shared-Record Readiness

Online behavior is suitable for the proposed two-phone test with limitations:

- Each normal device inspection is an independent shared record keyed by schedule/job and device.
- Different-device saves do not replace the whole job.
- Every update carries an expected revision.
- A stale same-device save returns conflict instead of overwriting the newer record.
- Equivalent duplicate saves are idempotent.
- Shared progress aggregates per-item records.
- Technician identity and timestamps are retained per saved item.

Risks and limits:

- There is no server-enforced per-device ownership for the proposed A/B split.
- Item claims are advisory; both technicians can still open the same item.
- General offline drafts are browser-local and do not yet have durable IndexedDB/file evidence storage or a robust background sync queue.
- Annual covered/reserved state is browser-local, so two Admin browsers can disagree when preparing schedules.
- Browser localStorage must not be treated as the authoritative inspection result store.

## Blockers Before Final Job Creation

1. Register and review the new clean Wetex background for each floor; do not reuse another floor's image silently.
2. Correct or explicitly confirm the L6/L7/L8 background mappings.
3. Field-review device records currently marked `Pending Review`.
4. Add or verify useful text locations for the 562 records that currently lack them.
5. Confirm Wetex critical-system dependency configuration, including water-system parent/supply relationships. Do not infer a dedicated Hose Reel Pump.
6. Open the intended Admin scheduling browser and read its actual `annual-2026` `coveredIds`, `reservedIds`, and unresolved rechecks.
7. Confirm no future valid schedule already reserves any candidate healthy device.
8. Decide whether the A/B split is operational only or needs a later authoritative per-item assignment feature. Do not silently claim enforcement in V1.
9. Confirm the final job date, site access plan, and approved technician responsibility for critical equipment.

## Exact Steps After New Wetex Mimics Are Available

1. Add reviewed clean-background manifests for all intended Wetex floors without changing normalized pin records.
2. Verify each background geometry against the existing pin layer, especially L6, L7, and L8.
3. Load the Admin browser that will create the schedule and confirm it is connected to the shared server.
4. Inspect the active `annual-2026` coverage/reservations and unresolved fault/recheck state.
5. Generate one site-wide Monthly 10 percent scope using the existing production scheduler.
6. Confirm the normal target remains 56 and critical items remain separate; add genuine mandatory rechecks without reducing 56.
7. Compare generated IDs with this candidate and investigate every difference rather than forcing the candidate.
8. Freeze the final `plannedDeviceIds` under `DEMO-WETEX-MULTITECH-SYNC-202609` only after review.
9. Record the agreed Tech A/B allocation outside or inside the job according to the supported data model; do not claim per-device enforcement unless it is implemented.
10. Verify both technician logins see the same schedule and authoritative planned IDs through the LAN server.
11. Run a small two-phone online test on different devices, then same-device conflict, refresh/resume, evidence, submission, and Admin review.

## Read-Only Validation Performed

- Parsed the Wetex device master and mimic library without writing runtime data.
- Verified 569 unique IDs, 560 normal devices, and 9 critical devices.
- Verified the production monthly formula gives exactly 56 normal devices.
- Reproduced the current floor-balanced candidate and matched all 56 IDs against the retained production-generated 65-item snapshot's sampled IDs.
- Verified candidate IDs are unique and exclude all critical IDs.
- Verified the current schedule file contains no Wetex schedule.
- Inspected revision-protected server write paths for inspection, critical SOP, sign-off, and submission records.
- No schedule, reservation, annual coverage, inspection, or master-data file was changed.

