# App Data Files

These files convert the checklist planning documents into app-ready data.

## Checklist Data

- `checklist-templates.json`
  - Full structured checklist templates.
  - Keeps sections, setup fields, questions, notes, and repeatable tables.
  - Best file for the app to load.

- `checklist-questions.csv`
  - Flat list of every checklist question.
  - Useful for review, Excel checking, and database import.

- `checklist-setup-fields.csv`
  - Flat list of setup fields, such as brand, model, location, panel type, pump model, etc.
  - Useful for first-time site setup forms.

- `checklist-template-summary.csv`
  - Summary count by checklist template.

## Device Master Data

- `device-master-schema.md`
  - Human-readable explanation of the device master table.

- `device-master-schema.json`
  - App/database schema for the device master table.

- `device-master-import-template.csv`
  - Excel/CSV upload template for bulk device import.

## Import / Export Templates

- `import-export-templates/fire-inspection-import-export-templates.xlsx`
  - One Excel workbook with First-Time Setup, Maintenance Results, and Quotation Follow-Up sheets.

- `import-export-templates/first-time-site-setup-template.csv`
  - First-time customer survey import file for device tag, type, floor, location, serial/barcode, expiry, and remarks.

- `import-export-templates/maintenance-results-export-template.csv`
  - Export format for completed maintenance results, including photo reference, timestamp, and GPS.

- `import-export-templates/quotation-follow-up-template.csv`
  - Draft quotation follow-up format generated from failed items and missing-device requests.

## Current Checklist Templates Converted

- Dry Riser System
- Fire Alarm Control Panel
- Fireman Intercom System
- Gas Release System
- Hose Reel System
- Normal Hydrant
- Portable Fire Extinguisher
- Pressurized Hydrant System
- Sprinkler System
- Tripping System
