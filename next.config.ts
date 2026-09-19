import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** Origin Akademii — AWP osadza GymBrat w iframe na /gymbrat. */
const DEFAULT_AWP_ORIGIN = "https://akademia-wielkich-pilkarzy.vercel.app";

function awpFrameAncestor(): string {
  const raw = process.env.NEXT_PUBLIC_AWP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_AWP_ORIGIN;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(projectRoot),
  turbopack: {},

  compress: true,
  poweredByHeader: false,

  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const awpOrigin = awpFrameAncestor();
    /**
     * AWP otwiera GymBrat w iframe. X-Frame-Options: DENY blokowało ten embed.
     * Kontrola przez CSP frame-ancestors. Cache /sw.js i /login — bez starego PWA.
     */
    const frameAncestors = `'self' ${awpOrigin}`;

    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors}` },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },
      { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
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
      `frame-ancestors ${frameAncestors}`,
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
      {
        source: "/sw.js",
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
