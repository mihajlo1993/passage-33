import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
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
  "locked-chest",
  "folded-paper",
  "pistol-gun",
  "secret-book",
  "soda-can",
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

/** Build-only extraction keeps the full icon collection out of the runtime. */
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

function printOnlyChunk(id: string): boolean {
  const normalized = id.replaceAll("\\", "/");
  if (
    normalized.includes("/node_modules/qrcode/")
    || normalized.includes("/node_modules/dijkstrajs/")
    || normalized.includes("/src/components/print/")
  ) {
    return true;
  }
  return [
    "/src/components/CodesScreen.tsx",
    "/src/components/GlyphsScreen.tsx",
    "/src/components/SheetsScreen.tsx",
    "/src/map/PrintableSurveyMap.tsx",
    "/src/styles/codes.css",
    "/src/styles/glyphs.css",
    "/src/styles/sheets.css",
  ].some((suffix) => normalized.endsWith(suffix));
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
    // PWA/service worker removed: stale caches repeatedly masked fixes.
  ],
  build: {
    target: "es2022",
    modulePreload: { polyfill: false },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return printOnlyChunk(id) ? "print-routes" : undefined;
        },
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
