import { readFile, writeFile, mkdir, chmod, unlink } from "fs/promises";
import { join, dirname } from "path";
import envPaths from "env-paths";
import type { Credentials } from "@brightdata/enrich-core";

const paths = envPaths("brightdata-enrich", { suffix: "" });
export const CONFIG_PATH = join(paths.config, "config.json");

interface StoredConfig {
  version: 1;
  credentials: Partial<Credentials>;
}

export async function readStoredCredentials(): Promise<Partial<Credentials>> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as StoredConfig;
    return parsed.credentials ?? {};
  } catch {
    return {};
  }
}

export async function writeStoredCredentials(credentials: Credentials): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  const data: StoredConfig = { version: 1, credentials };
  await writeFile(CONFIG_PATH, JSON.stringify(data, null, 2), "utf-8");
  if (process.platform !== "win32") {
    await chmod(CONFIG_PATH, 0o600);
  }
}

export async function deleteStoredCredentials(): Promise<boolean> {
  try {
    await unlink(CONFIG_PATH);
    return true;
  } catch {
    return false;
  }
}
