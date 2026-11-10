import { createInterface } from "readline";
import pc from "picocolors";
import type { Credentials } from "@brightdata/enrich-core";
import { readStoredCredentials, writeStoredCredentials, CONFIG_PATH } from "../auth/config-store";
import { validateBrightData, validateOpenRouter } from "../auth/validate";

function prompt(question: string, opts?: { hidden?: boolean; defaultValue?: string }): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    if (opts?.hidden) {
      // Hide input by toggling stdout writes
      const origWrite = (process.stdout as any)._write;
      (process.stdout as any)._write = function (chunk: any, encoding: any, cb: any) {
        if (typeof chunk === "string" && !chunk.includes(question)) {
          origWrite.call(this, "*", encoding, cb);
        } else {
          origWrite.call(this, chunk, encoding, cb);
        }
      };
      rl.question(question, (answer) => {
        (process.stdout as any)._write = origWrite;
        process.stdout.write("\n");
        rl.close();
        resolve(answer.trim() || opts.defaultValue || "");
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim() || opts?.defaultValue || "");
      });
    }
  });
}

function mask(s: string): string {
  if (!s) return "";
  if (s.length <= 8) return "*".repeat(s.length);
  return s.slice(0, 4) + "•".repeat(Math.min(8, s.length - 8)) + s.slice(-4);
}

export async function runLogin(): Promise<void> {
  console.log(`\nThis will store your credentials at\n  ${CONFIG_PATH} (mode 0600 on POSIX).\n`);

  const existing = await readStoredCredentials();

  const fields: Array<{ key: keyof Credentials; label: string; envName: string; hidden: boolean }> = [
    { key: "brightDataApiKey", label: "Bright Data API key", envName: "BRIGHT_DATA_API_KEY", hidden: true },
    { key: "brightDataSerpZone", label: "Bright Data SERP zone", envName: "BRIGHT_DATA_SERP_ZONE", hidden: false },
    { key: "brightDataUnlockerZone", label: "Bright Data Web Unlocker zone", envName: "BRIGHT_DATA_UNLOCKER_ZONE", hidden: false },
    { key: "openRouterApiKey", label: "OpenRouter API key", envName: "OPENROUTER_API_KEY", hidden: true },
  ];

  const collected: Partial<Credentials> = { ...existing };

  for (const f of fields) {
    if (process.env[f.envName]) {
      console.log(pc.dim(`${f.label} (set via $${f.envName} — skipping)`));
      continue;
    }
    const current = existing[f.key];
    const displayDefault = current ? ` [${mask(current)}]` : "";
    const answer = await prompt(`${f.label}${displayDefault}: `, { hidden: f.hidden, defaultValue: current });
    if (answer) collected[f.key] = answer;
  }

  if (!collected.brightDataApiKey || !collected.brightDataSerpZone || !collected.brightDataUnlockerZone || !collected.openRouterApiKey) {
    console.error(pc.red("\nMissing required credentials. Aborting."));
    process.exit(1);
  }

  console.log("\nValidating credentials...");
  const bdResult = await validateBrightData(collected as Credentials);
  console.log(`  ${bdResult.ok ? pc.green("✓") : pc.red("✗")} ${bdResult.message}`);
  const orResult = await validateOpenRouter(collected as Credentials);
  console.log(`  ${orResult.ok ? pc.green("✓") : pc.red("✗")} ${orResult.message}`);

  if (!bdResult.ok || !orResult.ok) {
    console.error(pc.red("\nValidation failed. Credentials not saved."));
    process.exit(1);
  }

  await writeStoredCredentials(collected as Credentials);
  console.log(pc.green("\n✓ Credentials saved."));
}
