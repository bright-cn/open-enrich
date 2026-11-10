import { createClient, type Client } from "@libsql/client";

let cached: Client | null = null;
let schemaInitialized = false;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS demo_quota (
    ip TEXT PRIMARY KEY,
    rows_used INTEGER NOT NULL DEFAULT 0,
    first_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_used_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`;

/**
 * Returns the server-side libSQL/Turso client used by demo-mode quota
 * enforcement. Throws if TURSO_DATABASE_URL or TURSO_AUTH_TOKEN are missing.
 *
 * On first use, lazily creates the demo_quota table (IF NOT EXISTS).
 *
 * Server-only — never import from a client component.
 */
export async function getTursoClient(): Promise<Client> {
  if (cached && schemaInitialized) return cached;

  if (!cached) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error(
        "DEMO_MODE is enabled but TURSO_DATABASE_URL is not set. See README for setup."
      );
    }
    if (!authToken) {
      throw new Error(
        "DEMO_MODE is enabled but TURSO_AUTH_TOKEN is not set. See README for setup."
      );
    }

    cached = createClient({ url, authToken });
  }

  if (!schemaInitialized) {
    await cached.execute(CREATE_TABLE_SQL);
    schemaInitialized = true;
  }

  return cached;
}
