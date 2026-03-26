import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: false
  },
  serverExternalPackages: ["unzipper", "pg", "pg-native"]
};

export default nextConfig;
