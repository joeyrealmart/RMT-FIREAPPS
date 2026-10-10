import { generateSW } from "workbox-build";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const output = resolve(root, "outputs", "fire-inspection-mvp");
const result = await generateSW({
  globDirectory: output,
  globPatterns: [
    "index.html",
    "app.js",
    "styles.css",
    "vendor/dexie.min.js",
    "offline/rmt-offline-store.js",
    "offline/rmt-offline-adapter-test.html",
    "assets/qa-workbox-cached-mimic.svg"
  ],
  swDest: resolve(output, "sw-rmt-offline-prototype.js"),
  globIgnores: ["reports/**", "local-data/**", "mobile-qa/**", "performance-qa/**"],
  cleanupOutdatedCaches: true,
  navigateFallback: "/index.html",
  clientsClaim: false,
  skipWaiting: false,
  runtimeCaching: [{
    urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/assets/mimics/"),
    handler: "CacheFirst",
    options: {
      cacheName: "rmt-approved-mimic-backgrounds-v1",
      expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
      cacheableResponse: { statuses: [0, 200] }
    }
  }]
});
console.log(JSON.stringify({ ok: true, ...result, swDest: resolve(output, "sw-rmt-offline-prototype.js") }, null, 2));
