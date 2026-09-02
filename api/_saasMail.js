/**
 * Shared Resend outbound mail (OTP, access, desktop trial).
 * Env: SPS_RESEND_API_KEY or RESEND_API_KEY
 *      SPS_OTP_FROM_EMAIL, SPS_OTP_FROM_NAME
 */

export function resendApiKey() {
  return process.env.SPS_RESEND_API_KEY || process.env.RESEND_API_KEY || '';
}

export function fromAddress() {
  const email = process.env.SPS_OTP_FROM_EMAIL || 'onboarding@resend.dev';
  const name = process.env.SPS_OTP_FROM_NAME || 'Stage Work Studio — AI Cinema Production OS';
  return `${name} <${email}>`;
}

export function mailConfigured() {
  return Boolean(resendApiKey());
}

export async function sendResend({ to, subject, html, text, replyTo }) {
  const key = resendApiKey();
  if (!key) return { emailed: false, configured: false };
  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!sendRes.ok) {
    const errText = await sendRes.text().catch(() => '');
    return { emailed: false, configured: true, error: errText.slice(0, 180) };
  }
  const data = await sendRes.json().catch(() => ({}));
  return { emailed: true, configured: true, id: data.id || null };
}
