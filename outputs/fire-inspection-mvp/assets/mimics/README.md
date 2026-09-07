# Clean Mimic Background Assets

This folder contains only approved, technician-friendly **background** assets.
The application continues to render device pins from its existing authoritative
device/master records. Do not include pins, device IDs, inspection status, or
interactive markup in a background image or its manifest.

## Runtime layout

```text
assets/mimics/
  <client-id>/
    <site-id>/
      <floor-id>/
        background-clean.png
        manifest.json
```

Use stable lowercase slugs for the three IDs, for example:

```text
assets/mimics/avillion/main-building/level-1/
```

Keep the cleaned background at the same aspect ratio and geometry as the
approved reference wherever practical. Existing normalized pin coordinates can
then remain unchanged. A geometry change requires a manual pin-alignment review;
never move pins automatically and never overwrite historical device records.

Copy `manifest.example.json` into each approved floor folder as `manifest.json`
and replace its placeholder values. The background filename may change only when
the matching manifest is updated.

Add each approved manifest's values to `index.json`. The app reads this small
catalog instead of crawling runtime directories, then resolves the clean
background from the matching client/site/floor folder. Keep the catalog empty
until a background has been physically approved for use.

Source PDFs, scans, working exports, and cleanup experiments do not belong in
this runtime bundle. Store them under `work/mimic-sources/` or another controlled
source archive instead.
