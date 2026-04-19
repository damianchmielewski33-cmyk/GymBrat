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
