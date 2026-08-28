# Maintenance Module V1 Brief

## 1. Company Info

- Company name: Realmart Sdn Bhd
- Logo: To be uploaded
- Address: No 1, Jalan Jasa Mereka 8, Taman Datuk Tamby Chik Karim, 75350 Batu Berendam, Melaka, Malaysia
- Phone: +60 18-760 2499
- Email: TBA
- Report footer wording: TBA

## 2. User Roles

- Admin: Yes
- Supervisor: Yes
- Technician: Yes
- Viewer / client: No
- First-stage user count: TBA

## 3. First Test Site

- Client name: MTB Reality Sdn Bhd
- Site name: MTB Reality Sdn Bhd
- Site address: Bandar Hilir
- Contact person: Mr Young, Chief Engineer
- Floors / areas: 26
- Mimic / floor plan: Received `MIMIC MTB REALITY (RAMADA).pdf` with 13 scanned mimic pages. Received usable `MIMIC-R1 2000.dxf`; rendered CAD preview successfully for app map preparation.

## 4. Device List

Device list available: Yes

Expected format:

```text
Device tag | Device type | Floor/Area | Location
LV1-HR-1 | Hose Reel | LV1 | Beside staircase
LV1-EL-1 | Emergency Light | LV1 | Main corridor
```

## 5. Checklist Questions

- Use suggested checklist first: Yes
- User may provide own checklist later: Yes

Device types required:

- Hose Reel
- Extinguisher
- Break Glass / Call Point
- Exit Sign
- Emergency Light
- Fire Pump
- Fire Alarm Panel
- Gas Release System

Checklist templates started:

- Fire alarm control panel: `outputs/checklist-templates/fire-alarm-control-panel-checklist.md`
- Hose reel system: `outputs/checklist-templates/hose-reel-system-checklist.md`
- Sprinkler system: `outputs/checklist-templates/sprinkler-system-checklist.md`
- Normal hydrant: `outputs/checklist-templates/normal-hydrant-checklist.md`
- Pressurized hydrant system: `outputs/checklist-templates/pressurized-hydrant-system-checklist.md`
- Portable fire extinguisher: `outputs/checklist-templates/portable-fire-extinguisher-checklist.md`
- Fireman intercom system: `outputs/checklist-templates/fireman-intercom-system-checklist.md`
- Dry riser system: `outputs/checklist-templates/dry-riser-system-checklist.md`
- Tripping system: `outputs/checklist-templates/tripping-system-checklist.md`
- Gas release system: `outputs/checklist-templates/gas-release-system-checklist.md`

Structured app-ready data:

- Checklist JSON: `outputs/app-data/checklist-templates.json`
- Checklist question CSV: `outputs/app-data/checklist-questions.csv`
- Setup field CSV: `outputs/app-data/checklist-setup-fields.csv`
- Device master schema: `outputs/app-data/device-master-schema.md`
- Device import template: `outputs/app-data/device-master-import-template.csv`

## 5A. First-Time Site Setup Module

Before normal servicing starts, the app should support a one-time setup/survey mode for new customers.

Purpose:

- Capture as much asset data as possible from sites that do not have proper softcopy drawings.
- Photograph fabricated mimic panels and redraw them later.
- Build the permanent asset register for future maintenance.
- Reduce future technician typing and missed devices.

Data to capture:

- Mimic panel photos, floor/area names, device symbols, and zone references.
- Pump nameplate details: brand, model, serial number, rating, controller details, pressure settings.
- CO2 system: protected area, number of cylinders/units, cylinder serial numbers, panel/release locations.
- Wet chemical system: cylinder size, serial number, number of nozzles, hood name, hood size, nozzle layout.
- Extinguishers: scan Bomba QR/barcode, serial number, expiry date, type, capacity, location.
- Keluar/exit signs: brand, type, location, condition.
- Emergency lights: brand, type, location, condition.
- Unknown or missing devices should be tagged as `UNKNOWN` and reviewed later.

Output after first-time setup:

- Site asset register.
- Device list CSV.
- Mimic/floor review drawing.
- Missing information list.
- Photo reference set.
- Ready-to-use maintenance checklist for future service.

Detailed checklist: `outputs/first-time-site-data-capture-checklist.md`

Level 1 abbreviation mapping confirmed:

- `L1.WCC.1`: Wet Chemical
- `L1.EL.1`: Emergency Light
- `L1.S.1`: Smoke Detector
- `L1.H.1`: Hose Reel
- `L1.WR.1`: Wet Riser
- `L1.PA`: Fireman Intercom

## 6. Report Format

- Existing report sample: Yes
- Format: PDF
- Company letterhead required: Yes

## 7. Photo Rules

- Before photo required: TBC
- After photo required: TBC
- Failed item must have photo: Yes
- Timestamp on all photos: Yes
- GPS on photo: Yes

## 8. Service Contract Rules

- Monthly: 10% passive devices + 100% active systems
- Bi-monthly: 20% passive devices + 100% active systems
- Tri-monthly: 30% passive devices + 100% active systems
- Yearly: 100% full inspection
- Admin manually add devices into scope: No

## Open Items

1. Confirm first-stage user count.
2. Confirm before photo rule.
3. Confirm after photo rule.
4. Upload company logo.
5. Upload existing PDF report sample.
6. Review generated MTB floor review images and mark device corrections floor by floor.
7. Provide device list for MTB Reality Sdn Bhd.

## Generated Floor Review Package

Created floor-by-floor CAD review images under `outputs/mtb-floor-review/` from `MIMIC-R1 2000.dxf`.

Included:

- Level 1
- Level 2
- Level 3
- Typical Level 4 & Level 5
- Level 6
- Level 7
- Level 8
- Level 9
- Typical Level 10 through Typical Level 23
- Level 24

Review workflow:

1. Open one floor image.
2. Mark missing or wrong device points using the agreed color code.
3. Send the edited image back.
4. Update CAD/DXF, PNG preview, and CSV device list for that floor.

## Uploaded Floor-By-Floor PDFs

Received and rendered cleaner floor-by-floor PDF drawings under `outputs/mtb-uploaded-floor-pdfs/`.

Included:

- Basement
- L1
- L2
- L3
- L4-5
- L6
- L7
- L8
- L9
- L10-23
- L24
- Roof
- Elevation

These uploaded PDFs should be used as the main review/app background set because they are cleaner and already include fire symbols.

## Colour-Coded First-Pass Device Review

Generated automatic colour-coded review images under `outputs/mtb-all-floor-colour-coded/`.

Included review PNGs and CSVs for:

- Basement
- Level 1
- Level 2
- Level 3
- Level 4-5 Typical
- Level 6
- Level 7
- Level 8
- Level 9
- Level 10-23 Typical
- Level 24
- Roof

Generated `all-floors-device-first-pass.csv` with 311 first-pass markers.

Important: this is an automatic review layer. The next step is for Joey to check each floor for:

1. Wrong device type.
2. Missing device.
3. Extra device.
4. Location not precise.
5. CO2 or panel symbols that need manual correction.

Note: this earlier pack was based on automatic detection from clean floor PDF symbols. It should not be treated as the master device list.

## Mimic-List-Based Landscape Review Pack

Created corrected review drawings under `outputs/mtb-mimic-list-plotted-landscape/`.

This pack uses coloured points extracted from the scanned mimic-list pages, then plots those points onto the cleaner floor-plan PDF backgrounds. Pages are rotated to landscape for easier viewing.

Included:

- Landscape PNG per floor.
- CSV per floor.
- Combined CSV: `all-floors-mimic-list-points.csv`.
- Combined review PDF: `MTB-mimic-list-plotted-landscape-review.pdf`.

This is now the preferred review pack because it is based on the mimic list supplied by Joey, not guessed from the clean PDF symbols. Device type/tag still needs human review because the scanned mimic list contains handwritten notes that cannot be reliably extracted as text.

## Editable Draw.io Review Files

Created editable draw.io files under `outputs/mtb-drawio-editable/`.

Created sharper HD editable draw.io files under `outputs/mtb-drawio-editable-hd/` after the first draw.io set looked blurry in editing.

Included:

- One combined multi-page file: `MTB-all-floors-editable.drawio`.
- One individual draw.io file per floor.
- Rotated landscape background PNGs under `outputs/mtb-drawio-editable/backgrounds/`.
- Summary CSV: `drawio-file-summary.csv`.

Preferred edit set: use `outputs/mtb-drawio-editable-hd/` for clearer floor-plan viewing.

If the HD PNG-background files still look blurry in draw.io, use the vector set under `outputs/mtb-drawio-editable-vector/`.

Vector set notes:

- Floor plans are rebuilt from PDF vector lines/text.
- They should stay sharp when zooming.
- File sizes are larger.
- The floor linework/text is locked; device markers remain editable.

## Blank Outline Draw.io Files

Created blank outline draw.io files under `outputs/mtb-drawio-blank-outline/`.

Purpose:

- Remove existing device markers.
- Remove coloured symbols.
- Remove text labels.
- Keep only black floor/building linework.
- Joey can manually input all device details from scratch.

Main file: `MTB-all-floors-blank-outline.drawio`.

## Basement Edited Draw.io Extraction

Received edited file: `outputs/mtb-drawio-blank-outline/basement-blank-outline-EDIT.drawio`.

Extracted outputs:

- Raw object extraction: `outputs/mtb-drawio-blank-outline/extracted/basement-blank-outline-EDIT-devices.csv`
- Clean grouped device list: `outputs/mtb-drawio-blank-outline/extracted/basement-device-master-from-edit.csv`
- Review note: `outputs/mtb-drawio-blank-outline/extracted/basement-extraction-review.md`

Result:

- 41 grouped basement devices extracted.
- Draw.io grouping workflow is usable for app device-location data.
- Needs review for duplicate tags and `B.FI` device type confirmation.

## Assisted Floor Creation From Mimic List

Created assisted draw.io files under `outputs/mtb-assisted-from-mimic/`.

Purpose:

- Avoid fully manual floor-by-floor input.
- Use Basement grouping/style as the device-marker template.
- Place first-pass movable markers using scanned mimic-list extracted points.
- Joey reviews, renames, deletes, moves, and confirms device types.

Created:

- One assisted draw.io per floor from Level 1 through Roof.
- Combined file: `MTB-assisted-all-floors-from-mimic.drawio`.
- Marker count summary: `assisted-marker-summary.csv`.
- Point CSV per floor.

Each floor includes:

- First-pass markers from the scanned mimic list.
- Basement-style grouped marker + label.
- Copy/paste device palette.
- Instruction note.

These files are review starting points, not final app data yet.

Draw.io editing workflow:

1. Open the combined file or a single-floor `.drawio` file in diagrams.net / draw.io.
2. Keep the floor plan background locked.
3. Move, rename, delete, or add device markers.
4. Save the edited `.drawio` file.
5. Use the edited draw.io file as the corrected device-location source for app data.
