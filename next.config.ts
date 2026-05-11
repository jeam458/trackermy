import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import path from "node:path";
import { buildProductionContentSecurityPolicy } from "./src/lib/buildContentSecurityPolicy";

const isCapacitorStatic = process.env.CAPACITOR_STATIC === "1";
const projectRoot = "/Users/work/Desktop/mi proy/trackermy";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

function securityHeaders():
  | { source: string; headers: { key: string; value: string }[] }[]
  | Promise<{ source: string; headers: { key: string; value: string }[] }[]> {
  if (process.env.NODE_ENV !== "production" || isCapacitorStatic) {
    return [];
  }
  return [
    {
      source: "/:path*",
      headers: [
        {
          key: "Content-Security-Policy",
          value: buildProductionContentSecurityPolicy(),
        },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    },
  ];
}

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
  headers: securityHeaders,
  webpack: (config) => {
    const modules = config.resolve?.modules ?? [];
    config.resolve = config.resolve ?? {};
    config.resolve.modules = [
      path.join(projectRoot, "node_modules"),
      ...modules,
    ];
    return config;
  },
  ...(isCapacitorStatic
    ? {
        output: "export" as const,
        images: { unoptimized: true },
      }
    : {}),
};

/** Build web estático para APK (sin servidor Next). Desarrollo web sigue usando Serwist. */
export default isCapacitorStatic ? nextConfig : withSerwist(nextConfig);
