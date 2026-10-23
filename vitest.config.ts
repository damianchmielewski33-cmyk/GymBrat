import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `import "server-only"` rzuca poza RSC; w testach jednostkowych to pusty moduł.
      "server-only": path.resolve(
        __dirname,
        "node_modules/next/dist/compiled/server-only/empty.js",
      ),
    },
  },
});
