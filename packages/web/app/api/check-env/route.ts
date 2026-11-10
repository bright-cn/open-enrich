import { isDemoMode } from "@/lib/demo-mode/config";

export async function GET() {
  return Response.json({
    BRIGHT_DATA_API_KEY: !!process.env.BRIGHT_DATA_API_KEY,
    BRIGHT_DATA_SERP_ZONE: !!process.env.BRIGHT_DATA_SERP_ZONE,
    BRIGHT_DATA_UNLOCKER_ZONE: !!process.env.BRIGHT_DATA_UNLOCKER_ZONE,
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
    demoMode: isDemoMode(),
  });
}
