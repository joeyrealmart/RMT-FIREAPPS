# RMT FIREAPPS Product Blueprint V1

This document is the architectural reference for RMT FIREAPPS prototype work.
Future changes should preserve this product direction unless the owner approves a new version.

## Product Purpose

RMT FIREAPPS is an internal Realmart fire-protection servicing and inspection application.
The goal is to reduce paper work, guide technicians through approved inspection sequences, make device locations easier to find, preserve audit evidence, and generate both customer-facing and internal review reports.

The application must support field use on Android phones and tablets, with a workflow that is simple enough for technicians to use on site without searching through admin screens.

## Core Technician Journey

The agreed technician flow is:

1. Login.
2. Open assigned job.
3. Choose configured fire system.
4. Complete system check when required.
5. Use building/floor mimic to locate field devices.
6. Tap actual device pin.
7. Record PASS or FAULT.
8. Attach required evidence for fault or critical items.
9. Save and return to mimic.
10. Complete system completion/restoration where configured.
11. Complete job and sign off.

The technician hierarchy is:

```text
Assigned Job
-> Fire System
-> System Check
-> Mimic / Field Devices
-> Completion
```

The UI wording may use:

```text
1. System Check
2. Field Devices
3. Completion
```

## Configuration-Driven Fire-System Tabs

Fire-system tabs must be driven by site/job configuration and assigned device data.
The app must not show every possible system at every site.

Examples of possible system tabs:

- Fire Alarm
- Hose Reel
- Sprinkler / Wet Riser / Hydrant
- Gas / Special Suppression
- Wet Chemical
- Portable Fire Extinguisher
- Emergency Light / Exit Sign
- Other Configured Systems

Only systems actually configured or assigned for the selected client/site/job should be visible to the technician.

## Critical SOP Rules

Critical SOP content must come from approved, versioned Realmart or site configuration.
The app may enforce sequence, locking, evidence requirements, and audit trail.
The app must not invent technical operating procedures.

When an inspection starts, the SOP version used should be preserved with the inspection record.
This protects the audit trail if an SOP template is updated later.

Critical systems should follow the same product hierarchy:

```text
System Check
-> Field Devices / Linked Checks
-> Completion / Restoration / Normal Status
```

Stage 2 must remain locked when a mandatory Stage 1 prerequisite is incomplete or unsafe.
Stage 3 must remain locked until configured completion requirements are satisfied.
No alternate navigation path should bypass a mandatory gate.

## Tap-First SOP UX

Technician entry should favor fast, low-typing controls:

- large PASS / FAULT buttons;
- preset choices for common readings where appropriate;
- required fields only when needed;
- fault details revealed only after FAULT is selected;
- required photo/evidence prompts when configured;
- supervisor/client names and sign-off where required.

Critical systems may have more steps, but the UX should still be tap-first and mobile friendly.

## User Accounts And Attribution

Each technician should have an individual account.
Every saved inspection item, critical SOP record, system check, photo/evidence reference, sign-off, and audit event should be tied to:

- user or technician ID;
- user display name;
- role;
- session/job ID;
- schedule ID;
- device or checklist item ID;
- timestamp;
- revision where shared records are used.

## Audit And Activity History

The system should preserve an append-only audit/activity history for important actions.

Examples:

- login/session restored;
- job opened or resumed;
- system selected;
- critical SOP opened;
- dependency blocked;
- device inspection opened;
- PASS/FAULT saved;
- evidence added;
- shared-record conflict;
- completion/sign-off attempted;
- job completed;
- supervisor review action.

Audit history should be used for review and improvement, not automatic blame.

## Staff Timing And Inactivity Monitoring

Admin/supervisor views should eventually show service timing and inactivity indicators such as:

- job start time;
- device open time;
- save time;
- duration per item;
- long inactive periods during an active job;
- repeated reopen/edit actions;
- missing evidence;
- unusually fast completion;
- shared-record conflicts.

These should be anomaly flags for review, not automatic accusations.
The system should help supervisors ask the right question instead of assuming staff wrongdoing.

## Location And Site-Presence Monitoring

Location/site-presence monitoring should apply only during active assigned jobs.
It should not become general staff tracking outside work.

Future location data should be minimal and purpose-limited:

- active job only;
- check-in/check-out or evidence location when configured;
- clear user awareness;
- no hidden background tracking for unrelated time.

## Malaysian Water-System Parent/Supply Relationships

Water-system arrangements must be configurable per site.
The app must support:

- dedicated pump/system parents;
- shared or parent supply systems;
- branch or PRV arrangements;
- no dedicated parent where the actual site design does not have one;
- unconfirmed parent/supply status until Realmart verifies the arrangement.

Examples:

```text
Wet Riser System -> Hose Reel branch / PRV arrangement -> Hose Reel devices
Dedicated Hose Reel Pump -> Hose Reel devices
Sprinkler Pump / Panel -> Flow Switch / Sprinkler checks
```

A missing Hose Reel Pump record must not automatically mean incomplete master data.
The parent/supply relationship must be a configuration decision.

Flow Switch is a configurable cross-system device.
One physical Flow Switch record may belong to a water-system functional check and also satisfy a Fire Alarm/MFAP indication verification dependency where site design requires it.
Do not duplicate the same physical Flow Switch unless the master data actually contains separate devices.

## Mimic Model

The mimic workflow should preserve:

- original source mimic or site photo;
- working/clean background used for field inspection;
- separate normalized pin layer;
- stable pin coordinates stored as percentages or another resolution-independent coordinate system;
- device tags and metadata separate from the background image;
- pin status from authoritative inspection records.

The app should never require repinning simply because the background image was cleaned or optimized.
If a background is replaced, there must be a review step to confirm pin alignment.

## Mimic Setup And Field Verification

First-time customer setup may require heavy data collection.
The workflow should support:

- upload existing mimic, PDF, CAD export, scan, or site photo;
- create clean working mimic background;
- pin devices;
- capture device tag, type, brand, model, serial, location, expiry, and remarks;
- technician suggestion for missing device;
- admin review before adding suggested devices to master data;
- field verification of uncertain locations or unknown device details.

Future AI import may suggest devices or text extraction, but it must not automatically become trusted master data.
Admin review is required before AI-suggested or technician-suggested records are promoted to the master list.

## Reports

Customer-facing reports and internal audit reports are separate products.

Customer report:

- company letterhead;
- customer-friendly summary page;
- system status overview;
- faults and recommendations;
- detailed inspection sections where useful;
- critical-system readings/results when configured;
- selected evidence photos;
- professional wording suitable for client sharing.

Internal audit report:

- technician attribution;
- device-by-device records;
- SOP sequence evidence;
- timestamps and durations;
- skipped/blocked items;
- missing evidence;
- conflicts or unsynced drafts;
- supervisor review notes;
- enough detail to prove the work process.

## Admin Control Desk

The Admin experience is a control desk, not one long scrolling page. Only one
workspace should be active at a time, with the current selection preserved when
Admin moves between workspaces or refreshes the browser.

Top-level Admin navigation:

- Home
- Clients
- Schedule
- Reports
- Defects
- Mimics
- Staff
- Settings

Home is a compact operational dashboard showing today's jobs, work in progress,
reports awaiting review, open defects, pending suggested pins, upcoming services,
and clear quick actions.

Each client/site workspace has its own tabs:

```text
Overview -> Schedule -> Systems -> Mimic -> Reports -> Defects -> History
```

Quotations will later be added as a client workspace when the quotation workflow
is ready. Legacy forms may be reused internally, but they must appear inside their
own workspace, drawer, or detail pane rather than as unrelated stacked panels.

## Report Review Workflow

The intended report workflow is:

```text
Technician completes inspection
-> client acknowledgement/signature where required
-> technician submits for review
-> Admin receives the submitted report
-> structured results are calculated from authoritative records
-> AI/Codex may prepare a Page-1 management-summary draft
-> Admin reviews and approves/returns it
-> client receives the summary front page plus full report
```

AI/Codex assistance may prepare wording and a summary draft from approved
structured results. It must not approve, send, or alter inspection evidence
without Admin review. Customer reports remain separate from the internal audit
report.

## Defect-To-Quotation Workflow

The future quotation flow begins only from approved report defects:

```text
Approved report defects
-> quotation-required items identified
-> Realmart rate library provides pricing
-> AI/Codex prepares wording and a draft
-> Admin reviews and approves
-> quotation sent
-> purchase order
-> rectification
-> recheck
-> close
```

The rate library and final pricing are controlled by Realmart. AI/Codex may assist
with a draft only; Admin must approve every quotation before it is issued.

## Infrastructure Direction

The intended deployment is staged and does not require a paid service for the
prototype:

- home is the initial primary server location;
- the RMT application/database server should sit near the Synology;
- Synology stores large files, evidence, and backups rather than browser
  localStorage;
- office users connect securely to the application server;
- technicians will later sync remotely, with robust offline support added as a
  separate phase;
- a secondary off-site backup is a later resilience requirement.

This direction keeps the existing online shared-record safety model while moving
large files and backups to appropriate storage. Production authentication,
database migration, remote access, and offline conflict sync require their own
approved design and rollout stages.

## Data Integrity Direction

The accepted Phase 1 shared-record model is:

```text
One scheduled job
-> many independent inspection-item records
-> many independent critical-SOP records
-> one job sign-off record
```

Shared per-item records are authoritative.
Browser localStorage is cache/draft only.
Legacy `schedule.jobProgress` is fallback/migration data only.
Online multi-technician saves use revision checks.
Stale same-item saves must return conflict instead of silently overwriting newer work.

Offline merge/conflict sync is not implemented in Phase 1.
If the server is unavailable, technicians may save local draft only and job completion must remain blocked until shared sync is restored.

## Change Control

Before any major architecture, database, workflow, or SOP-related change:

1. Identify what is currently wrong.
2. Propose the change.
3. Explain why it is needed.
4. Explain what could break.
5. State whether the prototype can continue without the change.

Do not remove existing business requirements merely to make development easier.
Do not change technical fire-protection SOP content without Realmart approval.
