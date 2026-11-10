import { config as dotenvConfig } from "dotenv";
import type { Credentials } from "@brightdata/enrich-core";
import { readStoredCredentials, CONFIG_PATH } from "./config-store";

export interface ResolvedCredentials {
  credentials: Credentials;
  sources: Record<keyof Credentials, "env" | "dotenv" | "config" | "missing">;
}

const ENV_KEYS: Record<keyof Credentials, string> = {
  brightDataApiKey: "BRIGHT_DATA_API_KEY",
  brightDataSerpZone: "BRIGHT_DATA_SERP_ZONE",
  brightDataUnlockerZone: "BRIGHT_DATA_UNLOCKER_ZONE",
  openRouterApiKey: "OPENROUTER_API_KEY",
};

export async function resolveCredentials(): Promise<ResolvedCredentials> {
  const before = { ...process.env };
  dotenvConfig();  // loads .env from cwd; does not overwrite existing env

  const stored = await readStoredCredentials();
  const credentials: Credentials = {
    brightDataApiKey: "",
    brightDataSerpZone: "",
    brightDataUnlockerZone: "",
    openRouterApiKey: "",
  };
  const sources = {} as Record<keyof Credentials, "env" | "dotenv" | "config" | "missing">;

  for (const key of Object.keys(ENV_KEYS) as (keyof Credentials)[]) {
    const envName = ENV_KEYS[key];
    if (before[envName]) {
      credentials[key] = before[envName]!;
      sources[key] = "env";
    } else if (process.env[envName]) {
      credentials[key] = process.env[envName]!;
      sources[key] = "dotenv";
    } else if (stored[key]) {
      credentials[key] = stored[key]!;
      sources[key] = "config";
    } else {
      sources[key] = "missing";
    }
  }

  return { credentials, sources };
}

export function formatMissingCredentialsError(resolved: ResolvedCredentials): string {
  const lines: string[] = ["Error: missing credentials."];
  for (const key of Object.keys(ENV_KEYS) as (keyof Credentials)[]) {
    const envName = ENV_KEYS[key];
    const source = resolved.sources[key];
    const mark = source === "missing" ? "✗" : "✓";
    const detail = source === "missing"
      ? `not set in env, .env, or ${CONFIG_PATH}`
      : `(from ${source})`;
    lines.push(`  ${mark} ${envName.padEnd(28)} ${detail}`);
  }
  lines.push("");
  lines.push("Run `enrich login` to set them interactively, or set them in your environment.");
  return lines.join("\n");
}

export function hasAllCredentials(resolved: ResolvedCredentials): boolean {
  return Object.values(resolved.sources).every((s) => s !== "missing");
}
