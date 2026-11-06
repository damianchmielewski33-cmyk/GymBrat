import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// SITE: docelowa domena landingu (ustaw PUBLIC_SITE_URL przy buildzie; do czasu zakupu domeny: placeholder).
const site = process.env.PUBLIC_SITE_URL || "https://example.com";

export default defineConfig({
  site,
  integrations: [sitemap()],
  build: { inlineStylesheets: "auto" },
});
