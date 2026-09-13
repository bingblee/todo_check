import type { NextConfig } from "next";

function normalizeBasePath(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

const basePath = normalizeBasePath(process.env.APP_BASE_PATH);

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: basePath || undefined,
  serverExternalPackages: ["better-sqlite3"],
  turbopack: { root: process.cwd() },
};

export default nextConfig;
