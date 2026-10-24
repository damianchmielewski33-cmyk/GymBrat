import path from "node:path";
import { defineConfig } from "vitest/config";

// Konfiguracja tylko dla skryptow pomiarowych w docs/wydajnosc/skrypty (poza `npm test`).
const root = path.resolve(__dirname, "../../..");

export default defineConfig({
  root,
  test: {
    environment: "node",
    include: ["docs/wydajnosc/skrypty/**/*.bench.ts"],
    globals: false,
    reporters: ["verbose"],
  },
  resolve: {
    alias: {
      "@": root,
      "server-only": path.resolve(root, "node_modules/next/dist/compiled/server-only/empty.js"),
    },
  },
});
