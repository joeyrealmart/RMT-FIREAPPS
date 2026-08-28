import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs/app-data/import-export-templates";
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();

const sheets = [
  {
    name: "First-Time Setup",
    headers: [
      "client_name",
      "site_name",
      "site_address",
      "floor_area",
      "device_tag",
      "device_type",
      "location",
      "brand_model",
      "serial_barcode",
      "expiry_date",
      "status",
      "remarks",
      "captured_by",
      "captured_at"
    ],
    rows: [
      ["MTB Reality Sdn Bhd", "MTB Reality Sdn Bhd", "Bandar Hilir", "Level 1", "L1.MCP.1", "Manual Call Point", "Lift lobby", "", "", "", "Pending Review", "Confirm exact mimic position", "Demo Inspector", "2026-07-14"],
      ["MTB Reality Sdn Bhd", "MTB Reality Sdn Bhd", "Bandar Hilir", "Level 1", "L1.SD.1", "Smoke Detector", "Main corridor", "", "", "", "Pending Review", "From first-time survey", "Demo Inspector", "2026-07-14"],
      ["MTB Reality Sdn Bhd", "MTB Reality Sdn Bhd", "Bandar Hilir", "Basement", "UNKNOWN-001", "Fire Extinguisher", "Smoking area", "", "UF032026Y967551", "2027-07-08", "Pending Review", "Bomba barcode captured from photo", "Demo Inspector", "2026-07-14"]
    ]
  },
  {
    name: "Maintenance Results",
    headers: [
      "report_no",
      "client_name",
      "site_name",
      "service_date",
      "inspected_by",
      "device_tag",
      "device_type",
      "floor_area",
      "location",
      "result",
      "remarks",
      "corrective_action",
      "before_photo",
      "after_photo",
      "timestamp",
      "gps"
    ],
    rows: [
      ["RPT-2026-0001", "MTB Reality Sdn Bhd", "MTB Reality Sdn Bhd", "2026-07-14", "Demo Inspector", "L1.HR.1", "Hose Reel", "Level 1", "Beside staircase", "Pass", "Cabinet accessible and hose condition acceptable", "No action required", "before-L1-HR-1.jpg", "after-L1-HR-1.jpg", "2026-07-14 10:30", "2.1944,102.2491"],
      ["RPT-2026-0001", "MTB Reality Sdn Bhd", "MTB Reality Sdn Bhd", "2026-07-14", "Demo Inspector", "L1.EL.1", "Emergency Light", "Level 1", "Main corridor", "Fail", "Lamp weak during test", "Prepare quotation for battery/replacement", "before-L1-EL-1.jpg", "after-L1-EL-1.jpg", "2026-07-14 10:42", "2.1944,102.2491"]
    ]
  },
  {
    name: "Quotation Follow-Up",
    headers: [
      "quotation_ref",
      "report_no",
      "client_name",
      "site_name",
      "device_tag",
      "device_type",
      "floor_area",
      "location",
      "defect_summary",
      "recommended_work",
      "priority",
      "status",
      "created_date"
    ],
    rows: [
      ["QT-DRAFT-001", "RPT-2026-0001", "MTB Reality Sdn Bhd", "MTB Reality Sdn Bhd", "L1.EL.1", "Emergency Light", "Level 1", "Main corridor", "Emergency light weak during test", "Replace battery or fitting after supervisor confirmation", "Medium", "Draft", "2026-07-14"],
      ["QT-DRAFT-002", "RPT-2026-0001", "MTB Reality Sdn Bhd", "MTB Reality Sdn Bhd", "UNKNOWN-001", "Fire Extinguisher", "Basement", "Smoking area", "Device not in mimic drawing", "Admin to add device to master and next maintenance scope", "Low", "Need Review", "2026-07-14"]
    ]
  }
];

function colName(index) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function rangeAddress(rowCount, colCount) {
  return `A1:${colName(colCount - 1)}${rowCount}`;
}

for (const spec of sheets) {
  const sheet = workbook.worksheets.add(spec.name);
  sheet.showGridLines = false;
  const data = [spec.headers, ...spec.rows];
  const used = sheet.getRangeByIndexes(0, 0, data.length, spec.headers.length);
  used.values = data;

  const header = sheet.getRangeByIndexes(0, 0, 1, spec.headers.length);
  header.format = {
    fill: "#06245A",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true
  };

  used.format.borders = { preset: "inside", style: "thin", color: "#D9E2EF" };
  used.format.autofitColumns();
  used.format.autofitRows();
  sheet.freezePanes.freezeRows(1);
  sheet.tables.add(rangeAddress(data.length, spec.headers.length), true, `${spec.name.replace(/[^A-Za-z0-9]/g, "")}Table`);

  if (spec.headers.includes("status")) {
    const statusCol = spec.headers.indexOf("status");
    sheet.getRangeByIndexes(1, statusCol, 200, 1).dataValidation = {
      rule: { type: "list", values: ["Pending Review", "Confirmed", "Need Admin Check", "Draft", "Need Review"] }
    };
  }
  if (spec.headers.includes("result")) {
    const resultCol = spec.headers.indexOf("result");
    sheet.getRangeByIndexes(1, resultCol, 200, 1).dataValidation = {
      rule: { type: "list", values: ["Pass", "Fail", "N/A", "Pending"] }
    };
  }
  if (spec.headers.includes("priority")) {
    const priorityCol = spec.headers.indexOf("priority");
    sheet.getRangeByIndexes(1, priorityCol, 200, 1).dataValidation = {
      rule: { type: "list", values: ["Low", "Medium", "High", "Urgent"] }
    };
  }
}

const overview = await workbook.inspect({
  kind: "sheet,table",
  maxChars: 4000,
  tableMaxRows: 4,
  tableMaxCols: 8
});
console.log(overview.ndjson);

const preview = await workbook.render({
  sheetName: "First-Time Setup",
  autoCrop: "all",
  scale: 1,
  format: "png"
});
await fs.writeFile(`${outputDir}/fire-inspection-import-export-templates-preview.png`, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/fire-inspection-import-export-templates.xlsx`);
