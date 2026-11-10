import { bdclient } from "@brightdata/sdk";
import type { Credentials } from "../credentials";

export function createBrightDataClient(
  creds: Pick<Credentials, "brightDataApiKey" | "brightDataSerpZone" | "brightDataUnlockerZone">
): bdclient {
  if (!creds.brightDataApiKey) {
    throw new Error("brightDataApiKey is required");
  }
  return new bdclient({
    apiKey: creds.brightDataApiKey,
    serpZone: creds.brightDataSerpZone || undefined,
    webUnlockerZone: creds.brightDataUnlockerZone || undefined,
  });
}
