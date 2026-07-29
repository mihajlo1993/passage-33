import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { colours } from "./src/tokens";
const GAME_ICON_MODULE = "virtual:game-icons";
const RESOLVED_GAME_ICON_MODULE = "\0virtual:game-icons";
const GAME_ICON_SOURCE = fileURLToPath(
  new URL(
    "./node_modules/@iconify-json/game-icons/icons.json",
    import.meta.url,
  ),
);
const INCLUDED_GAME_ICONS = [
  "abstract-001",
  "abstract-002",
  "abstract-003",
  "abstract-004",
  "abstract-005",
  "abstract-006",
  "abstract-007",
  "abstract-008",
  "abstract-009",
  "abstract-010",
  "abstract-011",
  "abstract-012",
  "abstract-013",
  "abstract-014",
  "abstract-015",
  "abstract-016",
  "bowie-knife",
  "brain",
  "candle-flame",
  "chemical-drop",
  "combination-lock",
  "hand",
  "health-potion",
  "herbs-bundle",
  "key-card",
  "pistol-gun",
  "secret-book",
  "star-altar",
  "treasure-map",
  "valve",
  "vhs",
  "wind-slap",
] as const;

interface BuildIconCollection {
  width?: number;
  height?: number;
  icons: Record<string, { body: string; width?: number; height?: number }>;
}

/** Build-only extraction keeps the 6 MB source collection out of the runtime. */
function bundledGameIconsPlugin(): Plugin {
  return {
    name: "bundled-game-icons",
    resolveId(id) {
      return id === GAME_ICON_MODULE ? RESOLVED_GAME_ICON_MODULE : null;
    },
    load(id) {
      if (id !== RESOLVED_GAME_ICON_MODULE) return null;

      const source = JSON.parse(
        readFileSync(GAME_ICON_SOURCE, "utf8"),
      ) as BuildIconCollection;
      const icons = Object.fromEntries(
        INCLUDED_GAME_ICONS.map((name) => {
          const icon = source.icons[name];
          if (!icon) throw new Error(`Missing bundled game icon: ${name}`);
          return [name, icon];
        }),
      );

      return "export default " + JSON.stringify({
        width: source.width ?? 512,
        height: source.height ?? 512,
        icons,
      }) + ";";
    },
  };
}

export default defineConfig({
  appType: "spa",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  plugins: [
    bundledGameIconsPlugin(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["og.png", "icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        id: "/",
        name: "Thirty-Three Candles",
        short_name: "BH Seven",
        description:
          "A private offline birthday survival-horror scavenger hunt.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: colours.void,
        theme_color: colours.void,
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        shortcuts: [
          { name: "Scan a mark", short_name: "Scan", url: "/scan" },
          { name: "Floorplan", short_name: "Map", url: "/map" },
        ],
      },
      workbox: {
        globPatterns: [
          "**/*.{js,css,html,png,webp,svg,webmanifest,woff,woff2}",
        ],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/codes\/print-only/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: "es2022",
    modulePreload: { polyfill: false },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
