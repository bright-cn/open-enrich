/** Max rows processed in parallel. */
export const CONCURRENT_ROWS = 30;

/** Per-agent timeout (ms). */
export const AGENT_TIMEOUT_MS = 60_000;

/** Personal email domains to skip during enrichment. */
export const SKIP_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "gmx.net",
  "fastmail.com",
  "tutanota.com",
  "hey.com",
  "pm.me",
]);

/**
 * Check if an email should be skipped (personal domain or .edu).
 */
export function shouldSkipEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return true;
  if (SKIP_DOMAINS.has(domain)) return true;
  if (domain.endsWith(".edu") || domain.endsWith(".ac.uk")) return true;
  return false;
}

/**
 * Get a human-readable reason for skipping.
 */
export function getSkipReason(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return "Invalid email";
  if (SKIP_DOMAINS.has(domain)) return `Personal email domain (${domain})`;
  if (domain.endsWith(".edu")) return "Educational institution";
  if (domain.endsWith(".ac.uk")) return "UK academic institution";
  return "Unknown";
}
