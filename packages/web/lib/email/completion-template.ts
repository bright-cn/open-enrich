interface CompletionEmailData {
  totalRows: number;
  successCount: number;
  errorCount: number;
  totalCost: number;
  duration: string;
}

export function buildCompletionEmail(data: CompletionEmailData): { subject: string; html: string } {
  const successRate = data.totalRows > 0
    ? Math.round((data.successCount / data.totalRows) * 100)
    : 0;

  const costFormatted = data.totalCost < 0.01
    ? `$${data.totalCost.toFixed(4)}`
    : `$${data.totalCost.toFixed(2)}`;

  const subject = `Your enrichment is complete — ${data.successCount}/${data.totalRows} rows enriched`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1628;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background-color:#0b1022;border:1px solid rgba(165,180,220,0.08);border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid rgba(165,180,220,0.06);">
              <span style="font-size:20px;font-weight:700;color:#f0f2f8;letter-spacing:-0.02em;">Open</span>
              <span style="font-size:20px;font-weight:700;color:#4B8BFF;background:linear-gradient(90deg,#4B8BFF,#22D3EE);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Enrich</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 20px;font-size:16px;color:#f0f2f8;font-weight:600;">
                Your enrichment is complete
              </p>

              <!-- Stats grid -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td width="50%" style="padding:12px 16px;background:rgba(52,211,153,0.06);border-radius:8px 0 0 8px;border:1px solid rgba(52,211,153,0.1);border-right:none;">
                    <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(240,242,248,0.4);">Rows enriched</p>
                    <p style="margin:0;font-size:20px;font-weight:700;color:#34D399;font-variant-numeric:tabular-nums;">${data.successCount}/${data.totalRows}</p>
                  </td>
                  <td width="50%" style="padding:12px 16px;background:rgba(75,139,255,0.06);border-radius:0 8px 8px 0;border:1px solid rgba(75,139,255,0.1);border-left:none;">
                    <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(240,242,248,0.4);">Success rate</p>
                    <p style="margin:0;font-size:20px;font-weight:700;color:#4B8BFF;font-variant-numeric:tabular-nums;">${successRate}%</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="33%" style="padding:12px 16px;background:rgba(11,16,34,0.5);border-radius:8px 0 0 8px;border:1px solid rgba(165,180,220,0.06);border-right:none;">
                    <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(240,242,248,0.4);">Errors</p>
                    <p style="margin:0;font-size:16px;font-weight:600;color:${data.errorCount > 0 ? '#F87171' : '#34D399'};font-variant-numeric:tabular-nums;">${data.errorCount}</p>
                  </td>
                  <td width="33%" style="padding:12px 16px;background:rgba(11,16,34,0.5);border:1px solid rgba(165,180,220,0.06);border-left:none;border-right:none;">
                    <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(240,242,248,0.4);">Cost</p>
                    <p style="margin:0;font-size:16px;font-weight:600;color:#34D399;font-variant-numeric:tabular-nums;">${costFormatted}</p>
                  </td>
                  <td width="33%" style="padding:12px 16px;background:rgba(11,16,34,0.5);border-radius:0 8px 8px 0;border:1px solid rgba(165,180,220,0.06);border-left:none;">
                    <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(240,242,248,0.4);">Duration</p>
                    <p style="margin:0;font-size:16px;font-weight:600;color:#f0f2f8;font-variant-numeric:tabular-nums;">${data.duration}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:rgba(240,242,248,0.4);line-height:1.5;">
                Head back to Open Enrich to download your results.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid rgba(165,180,220,0.06);">
              <p style="margin:0;font-size:11px;color:rgba(240,242,248,0.25);">
                Sent by Open Enrich — open-source AI lead enrichment
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return { subject, html };
}
