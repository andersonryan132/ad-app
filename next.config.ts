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
      {
        source: "/auth/authorize-role",
        destination: `${serverUrl}/auth/authorize-role`,
      },
      {
        source: "/users",
        destination: `${serverUrl}/users`,
      },
      {
        source: "/inventory/categories",
        destination: `${serverUrl}/inventory/categories`,
      },
      {
        source: "/inventory/products",
        destination: `${serverUrl}/inventory/products`,
      },
      {
        source: "/inventory/transfer-requests",
        destination: `${serverUrl}/inventory/transfer-requests`,
      },
      {
        source: "/inventory/transfer-requests/:path*",
        destination: `${serverUrl}/inventory/transfer-requests/:path*`,
      },
      {
        source: "/vehicles",
        destination: `${serverUrl}/vehicles`,
      },
      {
        source: "/fuelings",
        destination: `${serverUrl}/fuelings`,
      },
    ];
  },
};

export default nextConfig;
