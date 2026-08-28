# Import / Export Templates

These CSV files can be opened in Excel. Save back as CSV before importing into the prototype.

## Files

- `fire-inspection-import-export-templates.xlsx`
  - Recommended file to open in Excel.
  - Contains three sheets: First-Time Setup, Maintenance Results, and Quotation Follow-Up.

- `first-time-site-setup-template.csv`
  - Use during the first site survey.
  - Captures client, site, floor, device tag, device type, location, brand/model, serial/barcode, expiry, and remarks.
  - This is the file to import into the new First-Time Site Setup panel.

- `maintenance-results-export-template.csv`
  - Shows the structure for exported inspection results.
  - Includes photo filename references, timestamp, GPS, remarks, and corrective action.

- `quotation-follow-up-template.csv`
  - Converts failed items and missing-device requests into quotation follow-up rows.
  - Useful later when we build the quotation module.

## Suggested Workflow

1. Use `first-time-site-setup-template.csv` when onboarding a new customer.
2. Import the completed CSV into the prototype First-Time Site Setup panel.
3. Confirm device tags and mimic positions during admin review.
4. Use maintenance result exports to generate reports and quotation follow-up.
