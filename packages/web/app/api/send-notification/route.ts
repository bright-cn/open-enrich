import { Resend } from "resend";
import { loadEmailSettings } from "@/lib/email/settings";
import { buildCompletionEmail } from "@/lib/email/completion-template";

interface NotificationBody {
  email: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  totalCost: number;
  duration: string;
}

export async function POST(request: Request) {
  let body: NotificationBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.email || !body.totalRows) {
    return Response.json({ error: "email and totalRows are required" }, { status: 400 });
  }

  const settings = await loadEmailSettings();
  if (!settings.apiKey) {
    return Response.json({ error: "Resend API key not configured" }, { status: 400 });
  }

  const { subject, html } = buildCompletionEmail({
    totalRows: body.totalRows,
    successCount: body.successCount,
    errorCount: body.errorCount,
    totalCost: body.totalCost,
    duration: body.duration,
  });

  try {
    const resend = new Resend(settings.apiKey);
    await resend.emails.send({
      from: "Open Enrich <onboarding@resend.dev>",
      to: body.email,
      subject,
      html,
    });
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return Response.json({ error: message }, { status: 500 });
  }
}
