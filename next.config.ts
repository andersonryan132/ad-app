import type { NextConfig } from "next";

const serverUrl = (process.env.NEXT_PUBLIC_API_SERVER || process.env.API_SERVER || "").replace(/\/$/, "");

if (!serverUrl) {
  throw new Error("NEXT_PUBLIC_API_SERVER não foi definido na etapa de build do Next.js.");
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/login",
        destination: `${serverUrl}/login`,
      },
    ];
  },
};

export default nextConfig;
