# Top 10 Problems

1. **Production security boundary is absent.** Demo authentication, plain HTTP and unauthenticated APIs/assets make direct internet or real customer-data deployment unsafe.
2. **Production offline flow is incomplete.** IndexedDB/queue behavior is proven only in an isolated POC; no durable general queue or background evidence upload is active.
3. **Critical system pages are too tall.** Pump reaches 8.6k-10.8k px and Fire Alarm/Gas exceed 5k px across measured phone/tablet views.
4. **Whole-schedule administration writes remain risky.** Per-item records are revisioned, but stale schedule snapshots can still overwrite schedule metadata.
5. **Evidence durability is not production-grade.** Local files and metadata work, but object storage, backup, partial upload and retention are unresolved.
6. **Tablet landscape mimic overflows.** Current measured width is 1,195-1,218 px in a 1,024 px viewport.
7. **Drawing position retention lacks physical proof.** Floor/zoom/pan/selected area after Save and process restart are not verified on Android.
8. **Site technical/master data needs SME confirmation.** Parent/supply relationships and SOP versions cannot be inferred from device names/counts.
9. **Report workflow lacks real-volume field validation.** Structured snapshots are strong, but pagination, long text, missing images and customer layout need realistic tests.
10. **Current local server is a single operational point.** Atomic writes help corruption safety, but availability, backups, TLS and recovery require production infrastructure.

P0 open: **0 verified**. This does not mean no P0 exists; security and data-loss paths remain P1 until tested in the intended deployment boundary.
