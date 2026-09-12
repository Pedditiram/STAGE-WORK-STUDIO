/**
 * Shared outbound mail service (OTP, access requests, desktop trial).
 * Official Studio Service & Communication: admin@stageworkstudio.com
 *
 * Supported Providers:
 * 1. Direct SMTP via Titan Email / GoDaddy (Recommended for admin@stageworkstudio.com)
 *    Env: SPS_SMTP_PASS or TITAN_EMAIL_PASS (and optional SPS_SMTP_HOST, SPS_SMTP_USER, SPS_SMTP_PORT)
 * 2. Resend API
 *    Env: SPS_RESEND_API_KEY or RESEND_API_KEY
 *    Optional: SPS_OTP_FROM_EMAIL (default: admin@stageworkstudio.com)
 */

import nodemailer from 'nodemailer';

export const OFFICIAL_STUDIO_EMAIL = 'admin@stageworkstudio.com';
export const OFFICIAL_STUDIO_NAME = 'Stage Work Studio — Cinema Production OS';

export function resendApiKey() {
  return process.env.SPS_RESEND_API_KEY || process.env.RESEND_API_KEY || '';
}

export function getSmtpConfig() {
  const pass = process.env.SPS_SMTP_PASS || process.env.SMTP_PASS || process.env.TITAN_EMAIL_PASS || '';
  if (!pass) return null;
  const host = process.env.SPS_SMTP_HOST || process.env.SMTP_HOST || 'smtp.titan.email';
  const user = process.env.SPS_SMTP_USER || process.env.SMTP_USER || OFFICIAL_STUDIO_EMAIL;
  const port = parseInt(process.env.SPS_SMTP_PORT || process.env.SMTP_PORT || '465', 10);
  const secure = port === 465;
  return { host, port, secure, user, pass };
}

export function fromAddress() {
  const email = process.env.SPS_OTP_FROM_EMAIL || OFFICIAL_STUDIO_EMAIL;
  const name = process.env.SPS_OTP_FROM_NAME || OFFICIAL_STUDIO_NAME;
  return `${name} <${email}>`;
}

export function mailConfigured() {
  return Boolean(getSmtpConfig() || resendApiKey());
}

/**
 * Send email via Titan SMTP or Resend API.
 */
export async function sendResend({ to, subject, html, text, replyTo }) {
  const recipientList = Array.isArray(to) ? to : [to];
  const effectiveReplyTo = replyTo || OFFICIAL_STUDIO_EMAIL;

  // 1. Direct Titan Email SMTP (High priority — sends directly from admin@stageworkstudio.com)
  const smtp = getSmtpConfig();
  if (smtp) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });
      const info = await transporter.sendMail({
        from: `${OFFICIAL_STUDIO_NAME} <${smtp.user}>`,
        to: recipientList.join(', '),
        subject,
        html,
        text,
        replyTo: effectiveReplyTo,
      });
      return { emailed: true, configured: true, id: info.messageId, provider: 'titan-smtp' };
    } catch (smtpErr) {
      console.error('[Mail] Titan SMTP failed, checking fallback:', smtpErr?.message || smtpErr);
      // Fall through to Resend if configured
    }
  }

  // 2. Resend API
  const key = resendApiKey();
  if (!key) return { emailed: false, configured: false };

  const preferredFrom = fromAddress();
  const payload = {
    from: preferredFrom,
    to: recipientList,
    subject,
    html,
    text,
    reply_to: effectiveReplyTo,
  };

  try {
    let sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // If Resend fails because stageworkstudio.com is not yet verified in Resend,
    // automatically retry with onboarding@resend.dev (Resend sandbox address)
    if (!sendRes.ok && preferredFrom.includes(OFFICIAL_STUDIO_EMAIL)) {
      const errText = await sendRes.text().catch(() => '');
      if (errText.includes('domain') || errText.includes('not verified') || errText.includes('validation_error')) {
        const retryPayload = {
          ...payload,
          from: `Stage Work Studio <onboarding@resend.dev>`,
          reply_to: OFFICIAL_STUDIO_EMAIL,
        };
        const retryRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(retryPayload),
        });
        if (retryRes.ok) {
          const data = await retryRes.json().catch(() => ({}));
          return { emailed: true, configured: true, id: data.id || null, provider: 'resend-sandbox' };
        }
      }
      return { emailed: false, configured: true, error: errText.slice(0, 180), provider: 'resend' };
    }

    if (!sendRes.ok) {
      const errText = await sendRes.text().catch(() => '');
      return { emailed: false, configured: true, error: errText.slice(0, 180), provider: 'resend' };
    }

    const data = await sendRes.json().catch(() => ({}));
    return { emailed: true, configured: true, id: data.id || null, provider: 'resend' };
  } catch (netErr) {
    return { emailed: false, configured: true, error: netErr?.message || 'Network error during mail delivery', provider: 'resend' };
  }
}
