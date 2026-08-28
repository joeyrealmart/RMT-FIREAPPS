# RMT Fire Inspection App - Locked Workflow Decisions

This file records agreed product decisions so we do not re-discuss the same workflow.

## Main Goal

The app is for Realmart maintenance operations:
- make first-time customer setup easier,
- help technicians find device locations,
- make technicians follow SOP,
- track who did what and how long it took,
- generate client summary reports and backend audit reports,
- reduce paper and prepare for future project/document modules.

## Roles

Admin can:
- create and edit clients/sites/floors/mimic/device master,
- set maintenance contract percentage,
- schedule jobs on the work calendar,
- assign technician/team and time,
- review technician suggested missing pins,
- generate customer report and backend audit/staff tracking report.

Technician can:
- see only jobs assigned to them or technician pool,
- open assigned checklist items,
- use mimic/map to find the assigned device,
- suggest missing device pins without changing the master directly,
- complete extinguisher collection/return/loan form only when assigned or approved,
- save progress, use Save & Next, and complete final sign-off.

Technician must not see admin setup controls or general admin scope.

## Maintenance Scheduling Scope

The maintenance percentage is site-wide, not per floor.

Example:
- WETEX has many floors.
- 10% means 10% of all passive devices across the whole site.
- Active/critical systems are always 100% every visit.

Passive devices:
- smoke detector,
- heat detector,
- manual call point / break glass,
- emergency light,
- exit sign,
- hose reel,
- extinguisher where applicable,
- flow switch,
- fireman intercom.

Active / critical systems:
- main fire alarm panel,
- hose reel pump / panel,
- sprinkler pump / panel,
- wet riser pump / panel,
- pressurized hydrant pump / panel,
- CO2,
- FM200,
- gas release,
- wet chemical.

Rotation rule:
- do not repeat passive devices until the 100% passive cycle is completed,
- after 100% is completed, any extra overlap can prioritize failed / unable-to-check / earlier defect items,
- critical active systems repeat every visit.

## Technician Workflow

The technician workflow must be smooth for phone/tablet:
1. Tech logs in.
2. Tech sees assigned jobs only.
3. Tech opens assigned job.
4. Assigned item list appears first.
5. Mimic map is used to find the location, not as the only way to start work.
6. Tech opens item from list or pin.
7. Checklist or critical SOP opens immediately in the working area.
8. Tech fills only needed fields.
9. Save button must be at the end of the form.
10. Save & Next must move to next assigned item.
11. When all assigned items are done, final sign-off appears.
12. Sign-off needs technician name, supervisor/client witness, signature/thumbprint-style capture, final confirmation, and Complete Job.

Avoid annoying auto-scroll. Do not jump the user away from the current form while they are filling it.

## Mimic / Pin Behavior

Tech mimic should show only assigned pins for that scheduled scope:
- 10%, 20%, 30%, 50% passive selection,
- plus 100% active/critical systems.

Reason:
- phone/pad display is small,
- too many pins close together causes confusion,
- tech should focus only on assigned work.

Map and pin requirements:
- list follows assigned pins,
- Map button highlights the selected pin,
- pins must stay aligned during zoom,
- pins must be tappable on phone,
- floor/level selector must be close to the mimic/map, not far away.

Technician can add/suggest missing pins, but those remain pending until admin approves.

## Critical SOP

Critical SOP must be step-by-step and cannot be treated like normal simple checklist.

Critical examples:
- MFAP,
- gas release,
- CO2,
- FM200,
- wet chemical,
- hose reel pump,
- sprinkler pump,
- wet riser pump,
- pressurized hydrant pump.

For gas/CO2/FM200/wet chemical:
- most safety steps should be tick/select only for speed,
- before photo is required,
- after photo is required,
- final supervisor/witness name is required,
- filled-by technician must be recorded automatically,
- save time and duration must be recorded.

MFAP pre-check should appear before normal checklist work when MFAP is part of the assigned job.

## Tracking / Audit

Every checklist item should track:
- logged-in technician name,
- role,
- item opened time,
- saved time,
- duration,
- status,
- remarks/action,
- photo evidence where required.

Every job should track:
- check-in,
- progress saves,
- item opens/saves,
- critical SOP opens/saves,
- team members involved,
- completion/sign-off.

Multiple techs can work on the same client/building and different floors. Each tech needs their own account, and backend must show who filled which item.

## Reports

Customer report:
- front summary page for quick overview,
- defect / quotation follow-up summary,
- normal device details can be simpler,
- critical systems must include detailed readings and SOP results,
- include company letterhead/logo,
- include photo references.

Backend/admin report:
- focus on red flags,
- skipped / incomplete SOP,
- failed/malfunction items,
- missing photo/evidence,
- staff tracking,
- who filled each checklist,
- time/duration.

Admin report generation must be obvious from admin page.

## Extinguisher Collection / Return / Loan

This is separate from normal maintenance checklist.

Flow:
1. Admin creates form or technician requests form.
2. Tech goes to customer.
3. Tech records customer/place/address, including new non-existing clients.
4. Tech records collection time and quantity.
5. Tech takes photo proof of collected extinguishers.
6. Tech records loan unit quantity and photo proof.
7. Unit details can include brand, manufacture month/year, agent type, serial, pressure, powder/refill, hose, belt.
8. Office sends for Bomba inspection.
9. Tech returns units to customer and collects loan units back.
10. Return quantity and loan-return quantity must tally.
11. Missing units must be highlighted.
12. Cash received and receipt/payment reference can be recorded.

## Future Expansion

After maintenance is usable:
- project management,
- document control,
- daily report,
- LOA/shop drawing/MOS/HIRARC/document flow/catalogue submission/follow-up/Gantt/testing form/handover/checklist/EOT/FYI.

Do not mix these future modules into the maintenance workflow until maintenance is stable.
