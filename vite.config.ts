// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

const staticSpa = process.env["RENDER"] === "true" || process.env["STATIC_SPA"] === "1";

export default defineConfig({
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        manifest: false,
        filename: "sw.js",
        devOptions: { enabled: false },
        workbox: {
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/~oauth/],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "gridguard-pages", networkTimeoutSeconds: 4 },
            },
            {
              urlPattern: ({ url }) => url.origin === self.location.origin && /\.[a-f0-9]{8,}\.(js|css)$/.test(url.pathname),
              handler: "CacheFirst",
              options: { cacheName: "gridguard-assets" },
            },
          ],
        },
      }),
    ],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Static hosting (Render Static Site, Netlify, S3...). The build then writes a plain index.html next
    // to the JS and CSS in .output/public and the browser renders every page. Render sets RENDER=true
    // during its builds; set STATIC_SPA=1 to get the same output locally. Without either, the app builds
    // for a server (Cloudflare by default), exactly as before.
    ...(staticSpa ? { spa: { enabled: true, prerender: { enabled: true, outputPath: "/index.html", crawlLinks: false, retryCount: 0 } } } : {}),
  },
});
