# Mimic Source Archive

Keep original PDFs, scans, CAD exports, and working cleanup material outside the
runtime web bundle. Organize source material by stable client/site slug:

```text
work/mimic-sources/
  <client-id>/
    <site-id>/
      source-original.pdf
```

These source files are reference material for controlled background cleanup.
They do not change the production device master, existing pin coordinates, or
historical inspection data. Only an approved clean PNG plus a matching manifest
is copied to `outputs/fire-inspection-mvp/assets/mimics/`.
