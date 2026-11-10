/**
 * Format a timestamp as relative time.
 * "just now" (<60s), "2m ago" (<60m), "1h ago" (<24h), "3d ago" (<7d), or formatted date.
 */
export function formatRelativeTime(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 0) return "just now";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
