import { loadEmailSettings, saveEmailSettings } from "@/lib/email/settings";

export async function GET() {
  const settings = await loadEmailSettings();
  const masked = settings.apiKey
    ? settings.apiKey.slice(0, 6) + "..." + settings.apiKey.slice(-3)
    : "";
  return Response.json({ apiKey: masked, email: settings.email, configured: !!settings.apiKey });
}

export async function POST(request: Request) {
  let body: { apiKey?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.apiKey || !body.email) {
    return Response.json({ error: "apiKey and email are required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  await saveEmailSettings({ apiKey: body.apiKey, email: body.email });
  return Response.json({ success: true }, { status: 200 });
}
