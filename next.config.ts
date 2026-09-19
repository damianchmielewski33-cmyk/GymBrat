import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(projectRoot),
  turbopack: {},

  compress: true,
  poweredByHeader: false,

  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      /** Domyślnie blokuje „hotlinking” zasobów między originami. */
      { key: "Cross-Origin-Resource-Policy", value: "same-site" },
      /** Utrudnia wstrzykiwanie polityk w starych pluginach/Flash. */
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    ];

    /**
     * CSP (Report-Only): start od zbierania raportów, bez blokowania.
     * Po zebraniu danych można przełączyć na `Content-Security-Policy` (enforce).
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

    const cspReportOnly = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      // Next/Tailwind często wymagają inline styles; na start zbieramy raporty.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://image.pollinations.ai",
      "font-src 'self' data:",
      "connect-src 'self'",
      `report-to ${reportGroup}`,
    ].join("; ");

    const prodOnly = isProd
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=15552000; includeSubDomains",
          },
          { key: "Report-To", value: reportTo },
          { key: "Reporting-Endpoints", value: `${reportGroup}="${cspReportEndpointPath}"` },
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
        ]
      : [];
    return [
      {
        source: "/:path*",
        headers: [...base, ...prodOnly],
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
};

export default nextConfig;
