import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  {
    protocol: "https",
    hostname: "images.unsplash.com"
  }
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (supabaseUrl) {
  try {
    const { protocol, hostname, port } = new URL(supabaseUrl);
    remotePatterns.push({
      protocol: protocol.replace(":", "") as "http" | "https",
      hostname,
      port,
      pathname: "/storage/v1/object/public/**"
    });
  } catch {
    // Environment validation is handled by the Supabase client at runtime.
  }
}

const nextConfig = (phase: string): NextConfig => {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    reactStrictMode: true,
    outputFileTracingRoot: __dirname,
    // Keep development artifacts separate from production builds. Running
    // `next build` while `next dev` is active must not corrupt either cache.
    distDir: isDevServer ? ".next-dev" : ".next",
    async redirects() {
      return [
        { source: "/login", destination: "/auth", permanent: false },
        { source: "/connexion", destination: "/auth", permanent: false },
        { source: "/contracts", destination: "/contrats", permanent: false },
        { source: "/house/:id", destination: "/houses/:id", permanent: false },
        { source: "/admin", destination: "/dashboard", permanent: false },
        { source: "/admin/publications", destination: "/dashboard?section=publications", permanent: false },
        { source: "/admin/users", destination: "/dashboard?section=users", permanent: false },
        { source: "/admin/contracts", destination: "/dashboard?section=contracts", permanent: false }
      ];
    },
    images: {
      remotePatterns
    }
  };
};

export default nextConfig;
