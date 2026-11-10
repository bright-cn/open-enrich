import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface EmailSettings {
  apiKey: string;
  email: string;
}

const CONFIG_PATH = join(process.cwd(), "data", "email-settings.json");

export async function loadEmailSettings(): Promise<EmailSettings> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as EmailSettings;
  } catch {
    return { apiKey: "", email: "" };
  }
}

export async function saveEmailSettings(settings: EmailSettings): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(settings, null, 2), "utf-8");
}
