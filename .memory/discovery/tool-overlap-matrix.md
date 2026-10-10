# Tool Overlap Matrix

| Capability | Current tool | Discovered tool | New addition | Overlap | Extra complexity | Recommendation |
| --- | --- | --- | --- | ---: | --- | --- |
| Browser/mobile-web QA | Playwright | Appium | Native/real-device automation | 55% | Medium/High | Review after pilot, not now |
| Offline records | Isolated Dexie POC | Dexie | None; same tool | 100% | Integration risk, not discovery | Continue current proof |
| Background retry/cache | Workbox build proof | Workbox | None; same tool | 100% | Service-worker lifecycle | Keep disabled until queue proof |
| PDF generation | Current HTML/report plus pdfme POC | pdfme | Template designer/generator | 60% | Medium | Real-report comparison first |
| PDF viewing | Browser/native reference | PDF.js | Consistent embedded viewer | 30% | Low/Medium | Optional Admin V1.1 |
| Dynamic checklist forms | Custom config renderer | JSON Forms/RJSF | Generic schema/UI renderers | 75% | High migration/framework cost | Skip V1 |
| Mimic zoom/pan | Current renderer | panzoom/svg-pan-zoom/Konva | Mature gesture engines | 80% | High regression risk | Keep current |
| DXF runtime | Clean exported backgrounds | Three-DXF viewers | Direct CAD rendering | 20% | High, mobile performance risk | Skip V1 |
| Visual review | Playwright + local HTML | Browser/device farms | Remote device matrix | 40% | Paid/operational | Physical local pilot first |
| Code/repo map | Graphify/rg | Generic code MCPs | Alternative graph/search | 85% | More tool maintenance | Keep Graphify |
| Local classification | Ollama | Remote agents | Better reasoning | 40% | Cost/privacy | Use Ollama only for bounded bulk work |
| Independent review | Qodo documented inactive | Qodo/cloud reviewers | Automated review gate | 30% | Login/cloud/paid | Remain inactive until approved |
| Error monitoring | Server logs/QA | Sentry | Production event aggregation | 10% | High self-hosted overhead | Decide with production backend |

## Conclusion

The audit found no missing library that justifies an immediate installation. The highest-value engineering is integration/hardening of existing proofs, not adding more tools.
