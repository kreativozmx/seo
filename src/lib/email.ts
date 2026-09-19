// Sends transactional email via Resend's REST API directly (no SDK
// dependency needed for a single POST request). Requires RESEND_API_KEY —
// get one free at https://resend.com. RESEND_FROM_EMAIL must be an address
// on a domain verified in Resend; until you verify a domain, Resend only
// lets you send from onboarding@resend.dev to your own account email, so
// that's the default here for zero-config testing.

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta configurar RESEND_API_KEY para poder enviar correos (consigue una gratis en https://resend.com)."
    );
  }
  const from = process.env.RESEND_FROM_EMAIL || "Shopify Audit <onboarding@resend.dev>";

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403 && text.includes("You can only send testing emails")) {
      throw new Error(
        "Tu cuenta de Resend aun no tiene un dominio verificado: solo puede enviar correos de prueba a tu propio correo de Resend. Verifica un dominio en resend.com/domains y configura RESEND_FROM_EMAIL con ese dominio para enviar a otros destinatarios."
      );
    }
    throw new Error(`Resend request failed (${res.status}): ${text}`);
  }
}
