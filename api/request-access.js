/**
 * In-app access / signup request. Emails the studio owner via Resend.
 *
 * Env: SPS_RESEND_API_KEY or RESEND_API_KEY
 *      SPS_OTP_FROM_EMAIL, SPS_OTP_FROM_NAME (same as send-otp)
 *      SPS_ACCESS_TO_EMAIL (default pedditiram@gmail.com)
 */

import fs from 'fs';
import path from 'path';

const ADMIN_EMAIL = 'admin@stageworkstudio.com';

function resendApiKey() {
  return process.env.SPS_RESEND_API_KEY || process.env.RESEND_API_KEY || '';
}

function fromAddress() {
  const email = process.env.SPS_OTP_FROM_EMAIL || 'onboarding@resend.dev';
  const name = process.env.SPS_OTP_FROM_NAME || 'Stage Work Studio — AI Cinema Production OS';
  return `${name} <${email}>`;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function persistRequest(record) {
  try {
    const dir = path.join(process.cwd(), 'storage', 'cloud');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'access-requests.json');
    let list = [];
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(raw)) list = raw;
    }
    list.unshift(record);
    fs.writeFileSync(file, JSON.stringify(list.slice(0, 200), null, 2));
    return true;
  } catch {
    return false;
  }
}

async function sendResend({ to, subject, html, text, replyTo }) {
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const name = String(body.name || '').trim().slice(0, 120);
    const email = normalizeEmail(body.email);
    const role = String(body.role || '').trim().slice(0, 80);
    const message = String(body.message || '').trim().slice(0, 2000);

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid email is required.' });
    }

    const adminTo = normalizeEmail(process.env.SPS_ACCESS_TO_EMAIL) || ADMIN_EMAIL;
    const record = {
      id: `req_${Date.now()}`,
      name: name || '—',
      email,
      role: role || '—',
      message: message || 'I would like to request access / sign up for Stage Work Studio.',
      createdAt: new Date().toISOString(),
    };
    persistRequest(record);

    const subject = 'Stage Work Studio — Request access';
    const html = `
      <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0b0a09;color:#f4ecde;border:1px solid #3f3a34;border-radius:12px;">
        <p style="margin:0 0 8px;color:#c9a36a;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">Stage Work Studio</p>
        <h1 style="margin:0 0 16px;font-size:18px;">Access request</h1>
        <p style="margin:0 0 8px;font-size:14px;"><strong>Name:</strong> ${escapeHtml(record.name)}</p>
        <p style="margin:0 0 8px;font-size:14px;"><strong>Email:</strong> ${escapeHtml(record.email)}</p>
        <p style="margin:0 0 8px;font-size:14px;"><strong>Role / studio:</strong> ${escapeHtml(record.role)}</p>
        <p style="margin:16px 0 0;font-size:14px;line-height:1.55;color:#d6cfc4;white-space:pre-wrap;">${escapeHtml(record.message)}</p>
      </div>
    `;
    const text = `Stage Work Studio access request\n\nName: ${record.name}\nEmail: ${record.email}\nRole: ${record.role}\n\n${record.message}`;

    const adminSend = await sendResend({
      to: adminTo,
      subject,
      html,
      text,
      replyTo: email,
    });

    if (adminSend.emailed) {
      await sendResend({
        to: email,
        subject: 'Stage Work Studio — we received your access request',
        text: `Hi${name ? ` ${name}` : ''},\n\nYour request to join Stage Work Studio was sent to the studio admin. They will follow up at ${email}.\n\n— Stage Work Studio`,
        html: `<p>Hi${name ? ` ${escapeHtml(name)}` : ''},</p><p>Your request to join Stage Work Studio was sent to the studio admin. They will follow up at ${escapeHtml(email)}.</p><p>— Stage Work Studio</p>`,
      });
    }

    return res.status(200).json({
      success: true,
      emailed: Boolean(ownerSend.emailed),
      queued: true,
      configured: Boolean(ownerSend.configured),
      message: ownerSend.emailed
        ? 'Request sent. Check your inbox for a confirmation.'
        : ownerSend.configured
          ? `Request saved in the studio vault. Email delivery failed: ${ownerSend.error || 'unknown'}`
          : 'Request saved in the studio vault. Set SPS_RESEND_API_KEY on the server to email the owner automatically.',
    });
  } catch (e) {
    return res.status(200).json({
      success: true,
      emailed: false,
      queued: false,
      error: e.message || 'Send failed',
      message: 'Could not send from the app. Try again in a moment.',
    });
  }
}
