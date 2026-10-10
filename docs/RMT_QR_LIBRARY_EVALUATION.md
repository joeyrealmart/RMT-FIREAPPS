# RMT QR Library Evaluation

## Candidate

`qrcode` (node-qrcode) v1.5.4 is the current recommended candidate: MIT licensed, actively maintained, browser-capable, and can generate SVG or PNG without a paid API. Its published browser bundle/module support fits a later static-app integration.

## Decision

Do not install or integrate it yet. The extinguisher workflow and master list remain unchanged.

## Future payload contract

Use a stable identifier such as `rmt://asset/<asset-id>`, while always displaying the human-readable serial/asset ID next to the code. QR is supplementary identification, not the only field identifier.

## Required future QA

- SVG and PNG output scan successfully on Android.
- Asset ID remains readable without scanning.
- A scanned payload is matched against authoritative master data and never changes it automatically.
- Invalid/unknown QR is presented as a review action, not silently added.
