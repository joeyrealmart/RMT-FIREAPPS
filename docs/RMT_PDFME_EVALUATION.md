# RMT pdfme Evaluation

## Proof of concept

An isolated `@pdfme/common`, `@pdfme/generator` and `@pdfme/schemas` v6.1.12 proof generates `output/pdf/pdfme-poc/rmt-pdfme-demo-report.pdf`. It is not connected to RMT records or report routes.

## Capability fit

- Header/logo and client/job details: supported through templates.
- Service summary, PASS/FAULT counts and detailed pages: supported through multi-page schemas.
- Evidence, signatures and QR: supported through explicit schemas/plugins, subject to implementation and visual QA.
- Admin approval and report verification: can be represented as structured input fields.

## Recommendation

Keep the existing report generator as V1 production. Evaluate pdfme later with a versioned template and a single copied, non-sensitive report snapshot. Do not migrate until page layout, evidence placement, print output and approval/audit compatibility pass side-by-side review.
