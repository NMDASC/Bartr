import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Monorepo root, so packages/contracts can be imported from apps/web.
  turbopack: { root: path.join(__dirname, "..") },
};

export default nextConfig;
