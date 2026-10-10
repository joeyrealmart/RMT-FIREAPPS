# RMT Workbox Evaluation

## Decision: prototype completed, not active in the live application

Workbox is suitable for a later static-shell offline layer. A pinned local build proof now generates an unregistered service worker, but RMT has no production service-worker registration. Activating it in the physical-test app now would risk stale shell behaviour and cached sensitive client data.

## Approved future cache boundary

- Precache: `index.html`, CSS, JS, icons and versioned approved mimic backgrounds.
- Runtime cache: only explicitly public/static mimic assets, using versioned cache names and bounded expiry.
- Never cache: authentication/session responses, POST/PUT/PATCH/DELETE responses, server mutation APIs, private evidence, inspection records, mutable schedule APIs or generated reports.

## Required first integration

1. Dexie adapter must be proven on physical Android.
2. Review the existing build/generation script for a versioned service worker before enabling registration.
3. Test online shell load, offline reload, cached mimic opening, offline draft persistence and one reconnect sync.
4. Provide an in-app cache version/clear mechanism for Admin diagnostics only.

The current local server is unchanged.
