import type { Credentials } from "@brightdata/enrich-core";

export async function validateBrightData(creds: Pick<Credentials, "brightDataApiKey">): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("https://api.brightdata.com/zone/get_active_zones", {
      headers: { Authorization: `Bearer ${creds.brightDataApiKey}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "Bright Data: invalid API key" };
    }
    if (!res.ok) {
      return { ok: false, message: `Bright Data: HTTP ${res.status}` };
    }
    const zones = await res.json();
    return { ok: true, message: `Bright Data: ${Array.isArray(zones) ? zones.length : 0} zones found` };
  } catch (err) {
    return { ok: false, message: `Bright Data: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function validateOpenRouter(creds: Pick<Credentials, "openRouterApiKey">): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.openRouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: "ok" }],
        max_tokens: 1,
      }),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "OpenRouter: invalid API key" };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: `OpenRouter: HTTP ${res.status} ${text.slice(0, 80)}` };
    }
    return { ok: true, message: "OpenRouter: authenticated" };
  } catch (err) {
    return { ok: false, message: `OpenRouter: ${err instanceof Error ? err.message : String(err)}` };
  }
}
