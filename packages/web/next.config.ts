import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  basePath,
  transpilePackages: ["@brightdata/enrich-core"],
  serverExternalPackages: [
    "@langchain/core",
    "@langchain/langgraph",
    "@langchain/openai",
    "deepagents",
    "langchain",
    "micromatch",
  ],
};

export default nextConfig;
