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
 *
 * Resend sandbox (onboarding@resend.dev) can only reach the Resend-account inbox.
 * Public recipients (signup, invites) never use sandbox — Titan SMTP or a verified domain only.
 */

import nodemailer from 'nodemailer';

export const OFFICIAL_STUDIO_EMAIL = 'admin@stageworkstudio.com';
export const OFFICIAL_STUDIO_NAME = 'Stage Work Studio — Cinema Production OS';

const STUDIO_INBOXES = new Set(['admin@stageworkstudio.com', 'pedditiram@gmail.com']);
const SMTP_TIMEOUT_MS = 4000;
const RESEND_SANDBOX_FROM = 'Stage Work Studio <onboarding@resend.dev>';

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

function normalizeAddr(value) {
  return String(value || '').trim().toLowerCase();
}

function isStudioInbox(email) {
  return STUDIO_INBOXES.has(normalizeAddr(email));
}

function sandboxAllowedFor(recipients, explicit) {
  if (explicit === false) return false;
  if (explicit === true) return true;
  return recipients.every(isStudioInbox);
}

function looksUnverifiedDomain(errText) {
  const t = String(errText || '').toLowerCase();
  return t.includes('domain') || t.includes('not verified') || t.includes('validation_error');
}

async function sendViaSmtp({ recipientList, subject, html, text, replyTo }) {
  const smtp = getSmtpConfig();
  if (!smtp) return null;
  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS * 2,
    });
    const info = await transporter.sendMail({
      from: `${OFFICIAL_STUDIO_NAME} <${smtp.user}>`,
      to: recipientList.join(', '),
      subject,
      html,
      text,
      replyTo,
    });
    return { emailed: true, configured: true, id: info.messageId, provider: 'titan-smtp' };
  } catch (smtpErr) {
    const error = String(smtpErr?.message || smtpErr).slice(0, 180);
    console.error('[Mail] Titan SMTP failed:', error);
    return { emailed: false, configured: true, error, provider: 'titan-smtp' };
  }
}

async function postResend(key, payload) {
  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const raw = await sendRes.text().catch(() => '');
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  return { ok: sendRes.ok, raw, data };
}

async function sendViaResend({ recipientList, subject, html, text, replyTo, allowSandbox }) {
  const key = resendApiKey();
  if (!key) return { emailed: false, configured: false, error: 'Resend key missing', provider: 'resend' };

  const preferredFrom = fromAddress();
  const payload = {
    from: preferredFrom,
    to: recipientList,
    subject,
    html,
    text,
    reply_to: replyTo,
  };

  try {
    const first = await postResend(key, payload);
    if (first.ok) {
      return { emailed: true, configured: true, id: first.data.id || null, provider: 'resend' };
    }

    const errText = String(first.raw || first.data?.message || 'Resend send failed').slice(0, 180);
    const canSandbox =
      allowSandbox &&
      preferredFrom.includes(OFFICIAL_STUDIO_EMAIL) &&
      looksUnverifiedDomain(errText);

    if (canSandbox) {
      const retry = await postResend(key, {
        ...payload,
        from: RESEND_SANDBOX_FROM,
        reply_to: OFFICIAL_STUDIO_EMAIL,
      });
      if (retry.ok) {
        return { emailed: true, configured: true, id: retry.data.id || null, provider: 'resend-sandbox' };
      }
      const retryErr = String(retry.raw || retry.data?.message || errText).slice(0, 180);
      console.error('[Mail] Resend sandbox failed:', retryErr);
      return { emailed: false, configured: true, error: retryErr, provider: 'resend-sandbox' };
    }

    console.error('[Mail] Resend failed:', errText);
    return { emailed: false, configured: true, error: errText, provider: 'resend' };
  } catch (netErr) {
    const error = netErr?.message || 'Network error during mail delivery';
    console.error('[Mail] Resend network error:', error);
    return { emailed: false, configured: true, error, provider: 'resend' };
  }
}

/**
 * Send email via Titan SMTP or Resend API.
 * @param {{ allowSandbox?: boolean }} [opts]
 */
export async function sendResend({ to, subject, html, text, replyTo, allowSandbox }) {
  const recipientList = (Array.isArray(to) ? to : [to]).map((addr) => String(addr || '').trim()).filter(Boolean);
  const effectiveReplyTo = replyTo || OFFICIAL_STUDIO_EMAIL;
  const sandboxOk = sandboxAllowedFor(recipientList, allowSandbox);
  const onVercel = Boolean(process.env.VERCEL);
  const hasResend = Boolean(resendApiKey());
  const packet = {
    recipientList,
    subject,
    html,
    text,
    replyTo: effectiveReplyTo,
  };

  // Vercel often blocks outbound SMTP; try Resend HTTPS first there.
  const resendFirst = onVercel && hasResend;
  let last = { emailed: false, configured: mailConfigured() };

  if (resendFirst) {
    last = await sendViaResend({ ...packet, allowSandbox: sandboxOk });
    if (last.emailed) return last;
  }

  const smtpResult = await sendViaSmtp(packet);
  if (smtpResult?.emailed) return smtpResult;
  if (smtpResult && !last.error) last = smtpResult;

  if (!resendFirst && hasResend) {
    last = await sendViaResend({ ...packet, allowSandbox: sandboxOk });
    if (last.emailed) return last;
  }

  if (!last.configured) last.configured = mailConfigured();
  return last;
}
