import type { MetadataRoute } from "next";

/**
 * Web app manifest, served at /manifest.webmanifest (Next adds the <link rel="manifest"> itself).
 * It makes PerDiem installable as a desktop app: Chrome / Edge on Windows and macOS (install button
 * or the address-bar install icon) and Safari 17+ on macOS (File > Add to Dock…). See
 * components/perdiem/install-app.tsx.
 *
 * Static on purpose: no data, no request-time API, so the route is prerendered and cached. The file
 * and the icons are excluded from the Basic-auth proxy (proxy.ts matcher): browsers fetch the
 * manifest without credentials, and a 401 here would make the site not installable.
 * Colours: background_color = light --background, theme_color = --cobalt (app/globals.css).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PerDiem",
    short_name: "PerDiem",
    description:
      "Delegated spend, kept inside the line: a policy layer that stops any agent payment outside the traveler's per-diem mandate and keeps receipts an auditor can verify.",
    start_url: "/traveler",
    scope: "/",
    display: "standalone",
    background_color: "#F1F3F5",
    theme_color: "#214FDB",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
