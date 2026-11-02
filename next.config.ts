import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const APK_RESPONSE_HEADERS = [
  {
    key: "Content-Type",
    value: "application/vnd.android.package-archive",
  },
  // Bez Content-Disposition: attachment — Chrome Android często wisi na 100%.
  {
    key: "Cache-Control",
    value: "public, max-age=0, must-revalidate",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Obraz Docker (Faza 1 VPS): lekki runtime bez pełnego node_modules.
   * Render / lokalne `next start` nadal działają.
   */
  output: "standalone",
  /** Mniej śladu w Sources / Network — bez map źródeł w przeglądarce. */
  productionBrowserSourceMaps: false,
  outputFileTracingRoot: path.join(projectRoot),
  /**
   * instrumentation.ts woła Drizzle migrate — bez tego Vercel nie pakuje
   * `db/migrations/meta/_journal.json` i loguje „Can't find meta/_journal.json”.
   */
  outputFileTracingIncludes: {
    "/*": ["./db/migrations/**/*"],
  },
  turbopack: {},

  compress: true,
  poweredByHeader: false,

  compiler: {
    /** Usuwa console.* z bundla klienta na produkcji (mniej w DevTools). */
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error"] }
        : false,
  },

  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    /**
     * Content-Security-Policy (w tym `frame-ancestors`, Z56) ustawia `proxy.ts` per żądanie
     * (nonce) — logika w `lib/csp.ts`. Tu zostają statyczne nagłówki i cache /sw.js, /login.
     */

    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },
      { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
    ];

    /**
     * Endpoint raportów CSP (polityka: `lib/csp.ts`, tryb: env `CSP_MODE`).
     */
    const cspReportEndpointPath = "/api/security/csp-report";
    const reportGroup = "csp-endpoint";
    const reportTo = JSON.stringify([
      {
        group: reportGroup,
        max_age: 60 * 60 * 24 * 7,
        endpoints: [{ url: cspReportEndpointPath }],
      },
    ]);

    const prodOnly = isProd
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=15552000; includeSubDomains",
          },
          { key: "Report-To", value: reportTo },
          { key: "Reporting-Endpoints", value: `${reportGroup}="${cspReportEndpointPath}"` },
        ]
      : [];
    return [
      {
        source: "/:path*",
        headers: [...base, ...prodOnly],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/push-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/login",
        headers: [{ key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" }],
      },
      {
        source: "/register",
        headers: [{ key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" }],
      },
      {
        source: "/gymbrat.apk",
        headers: APK_RESPONSE_HEADERS,
      },
      {
        source: "/gymbrat-:version.apk",
        headers: APK_RESPONSE_HEADERS,
      },
    ];
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "framer-motion",
      "@base-ui/react",
    ],
  },

  async rewrites() {
    // /gymbrat-0.1.9.apk → ten sam plik, inny URL (Chrome nie wisi na starym downloadzie).
    return [{ source: "/gymbrat-:version.apk", destination: "/gymbrat.apk" }];
  },
};

export default nextConfig;
