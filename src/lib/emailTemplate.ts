// Shared branded HTML shell for transactional emails (uptime alerts, task
// assignments, ...). Inline styles only, for email-client compatibility.
// Emails are opened on the recipient's machine, so localhost URLs (dev/test
// sends) would break the logo image and links — fall back to the public site.
export function publicUrl(baseUrl: string) {
  return /localhost|127\.0\.0\.1/.test(baseUrl) ? "https://shopifyaudit.com" : baseUrl;
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function emailShell(
  rawBaseUrl: string,
  accent: string,
  title: string,
  bodyHtml: string,
  projectUrl: string,
  ctaLabel = "Ver monitoreo →",
  footerNote = "Recibes esto porque activaste el monitoreo de disponibilidad de este proyecto en Shopify Audit."
) {
  const baseUrl = publicUrl(rawBaseUrl);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:#14171C;padding:14px 24px;">
          <a href="${baseUrl}" style="text-decoration:none;">
            <img src="${baseUrl}/logo.png" width="28" height="28" alt="" style="vertical-align:middle;border-radius:6px;" />
            <span style="color:#ffffff;font-size:15px;font-weight:600;vertical-align:middle;margin-left:8px;">Shopify Audit</span>
          </a>
        </td></tr>
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:${accent};">${title}</h1>
          ${bodyHtml}
          <a href="${projectUrl}" style="display:inline-block;margin-top:8px;background:#228449;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:6px;">${ctaLabel}</a>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#9ca3af;margin-top:16px;">${footerNote}</p>
    </td></tr>
  </table>
</body></html>`;
}

