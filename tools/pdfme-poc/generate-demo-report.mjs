import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generate } from "@pdfme/generator";
import { BLANK_A4_PDF } from "@pdfme/common";

const output = join(process.cwd(), "output", "pdf", "pdfme-poc");
mkdirSync(output, { recursive: true });

const template = {
  basePdf: BLANK_A4_PDF,
  schemas: [[
    { name: "header", type: "text", position: { x: 18, y: 16 }, width: 170, height: 9, fontSize: 18, fontColor: "#991b1b" },
    { name: "client", type: "text", position: { x: 18, y: 32 }, width: 170, height: 7, fontSize: 12 },
    { name: "job", type: "text", position: { x: 18, y: 43 }, width: 170, height: 6, fontSize: 10 },
    { name: "summary", type: "text", position: { x: 18, y: 58 }, width: 170, height: 40, fontSize: 10, lineHeight: 1.5 },
    { name: "approval", type: "text", position: { x: 18, y: 120 }, width: 170, height: 8, fontSize: 10 }
  ]]
};
const pdf = await generate({
  template,
  inputs: [{
    header: "Realmart Fire Inspection - DEMO ONLY",
    client: "Demo Client / Demo Site",
    job: "Job: POC-REPORT-001 | Technician: Demo Technician | Admin: Pending",
    summary: "PASS: 12\nFAULT: 1\nEvidence: 2 references\n\nThis isolated pdfme proof demonstrates text layout only. It does not read or replace the RMT production report generator.",
    approval: "Administrative approval: NOT FOR PRODUCTION USE"
  }]
});
const path = join(output, "rmt-pdfme-demo-report.pdf");
writeFileSync(path, pdf);
console.log(JSON.stringify({ ok: true, path, bytes: pdf.length }, null, 2));
