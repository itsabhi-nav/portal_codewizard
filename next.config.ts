import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(__dirname),
  // pdfkit ships AFM font data files that must be read from node_modules at
  // runtime. Keep it (and its dependency tree) out of the webpack bundle.
  serverExternalPackages: ["pdfkit", "fontkit"],
  experimental: {
    // Keep server actions / route handlers robust
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    // pdfkit references optional dynamic requires
    config.externals = config.externals || [];
    return config;
  },
};

export default nextConfig;
