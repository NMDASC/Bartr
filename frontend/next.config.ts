import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Allows an isolated production verification without disturbing the shared dev server.
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  // Monorepo root, so packages/contracts can be imported from apps/web.
  turbopack: { root: path.join(__dirname, "..") },
};

export default nextConfig;
