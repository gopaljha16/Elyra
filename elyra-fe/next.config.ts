import path from "node:path";
import type { NextConfig } from "next";

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  if (!process.env[key]?.trim()) throw new Error(`Missing required environment variable: ${key}`);
}

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(process.cwd(), "..") },
};

export default nextConfig;
