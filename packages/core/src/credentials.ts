export interface Credentials {
  brightDataApiKey: string;
  brightDataSerpZone: string;
  brightDataUnlockerZone: string;
  openRouterApiKey: string;
}

export class MissingCredentialsError extends Error {
  constructor(public missing: (keyof Credentials)[]) {
    super(`Missing credentials: ${missing.join(", ")}`);
    this.name = "MissingCredentialsError";
  }
}

export function assertCredentials(c: Partial<Credentials>): asserts c is Credentials {
  const missing: (keyof Credentials)[] = [];
  if (!c.brightDataApiKey) missing.push("brightDataApiKey");
  if (!c.brightDataSerpZone) missing.push("brightDataSerpZone");
  if (!c.brightDataUnlockerZone) missing.push("brightDataUnlockerZone");
  if (!c.openRouterApiKey) missing.push("openRouterApiKey");
  if (missing.length > 0) throw new MissingCredentialsError(missing);
}
