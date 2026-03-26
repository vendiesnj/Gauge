import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: false
  },
  serverExternalPackages: ["unzipper"]
};

export default nextConfig;
