import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig = (phase: string): NextConfig => {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    reactStrictMode: true,
    outputFileTracingRoot: __dirname,
    distDir: isDevServer ? ".next-dev" : ".next"
  };
};

export default nextConfig;
