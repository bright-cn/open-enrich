import { DEMO_LIFETIME_ROW_LIMIT } from "./config";
import { getTursoClient } from "./turso";

export type QuotaResult =
  | { status: "ok"; granted: number }
  | { status: "partial"; granted: number; requested: number }
  | { status: "blocked" };

/**
 * Read client IP from a Web `Request`. Trusts `x-forwarded-for` (first hop)
 * then `x-real-ip`. If neither is present, returns the literal "unknown" so
 * all header-stripped requests share one bucket and cannot bypass the cap.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  return "unknown";
}

/**
 * Atomically reserve up to `requestedRows` rows for `ip` against the lifetime
 * cap. Uses a BEGIN IMMEDIATE libSQL transaction to serialize concurrent
 * reservations.
 *
 * Throws on libSQL/network failure — the caller (the API route) catches this
 * and converts it to a 503. We deliberately do NOT fail open: an unreachable
 * quota DB must not allow unlimited demo use.
 */
export async function checkAndReserveQuota(
  ip: string,
  requestedRows: number
): Promise<QuotaResult> {
  const client = await getTursoClient();
  const tx = await client.transaction("write");
  try {
    await tx.execute({
      sql: "INSERT INTO demo_quota (ip) VALUES (?) ON CONFLICT(ip) DO NOTHING",
      args: [ip],
    });

    const sel = await tx.execute({
      sql: "SELECT rows_used FROM demo_quota WHERE ip = ?",
      args: [ip],
    });

    const row = sel.rows[0];
    const rowsUsed = row ? Number(row.rows_used) : 0;
    const remaining = Math.max(DEMO_LIFETIME_ROW_LIMIT - rowsUsed, 0);
    const granted = Math.min(requestedRows, remaining);

    if (granted > 0) {
      await tx.execute({
        sql: "UPDATE demo_quota SET rows_used = rows_used + ?, last_used_at = unixepoch() WHERE ip = ?",
        args: [granted, ip],
      });
    }

    await tx.commit();

    if (granted === 0) return { status: "blocked" };
    if (granted < requestedRows) {
      return { status: "partial", granted, requested: requestedRows };
    }
    return { status: "ok", granted };
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}
