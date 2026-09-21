// Runs after `vite build`.
//
// When the app is built as a static single-page app (RENDER=true or STATIC_SPA=1), the files to publish
// are in .output/public. vite-plugin-pwa runs against a different folder and finds nothing to cache, so
// this step writes the service worker (offline support) straight into the publish folder instead.
// For any other build (for example Cloudflare) this script does nothing.
import { existsSync } from "node:fs";
import { generateSW } from "workbox-build";

const publicDir = ".output/public";

if (!existsSync(`${publicDir}/index.html`)) {
  console.log("[postbuild] No static index.html found, so this is a server build. Skipping service worker.");
  process.exit(0);
}

const { count, size, warnings } = await generateSW({
  globDirectory: publicDir,
  globPatterns: ["index.html", "assets/**/*.{js,css}", "*.{png,jpg,svg,webmanifest}"],
  swDest: `${publicDir}/sw.js`,
  // Same behaviour as registerType: "autoUpdate" in vite.config.ts: a new version takes over right away.
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  // Every page is served by the single-page app, so an offline navigation falls back to the cached shell.
  navigateFallback: "/index.html",
  runtimeCaching: [
    // Map tiles: keep recently viewed ones so the map still draws in a signal dead spot.
    {
      urlPattern: ({ url }) => url.hostname.endsWith("tile.openstreetmap.org"),
      handler: "StaleWhileRevalidate",
      options: { cacheName: "lesedilink-map-tiles", expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }, cacheableResponse: { statuses: [0, 200] } },
    },
  ],
});

for (const warning of warnings) console.warn(`[postbuild] ${warning}`);
console.log(`[postbuild] Service worker written to ${publicDir}/sw.js, precaching ${count} files (${(size / 1024).toFixed(0)} KiB).`);
