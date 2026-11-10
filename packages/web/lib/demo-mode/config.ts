export const DEMO_LIFETIME_ROW_LIMIT = 50;

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1";
}
