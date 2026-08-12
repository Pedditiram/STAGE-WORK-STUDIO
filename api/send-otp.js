/**
 * Optional OTP email delivery via Resend.
 *
 * Env (any one key works):
 *   SPS_RESEND_API_KEY  or  RESEND_API_KEY
 * Optional:
 *   SPS_OTP_FROM_EMAIL  (default: onboarding@resend.dev — Resend sandbox)
 *   SPS_OTP_FROM_NAME   (default: Stage Production Studio)
 *
 * Without a Resend key the endpoint returns { emailed: false, fallback: true }
 * so the client can keep showing the OTP in-UI (Owner never locked out).
 */

const PRIMARY_ADMIN_EMAIL = 'pedditiram@gmail.com';

function resendApiKey() {
  return process.env.SPS_RESEND_API_KEY || process.env.RESEND_API_KEY || '';
}

function fromAddress() {
  const email = process.env.SPS_OTP_FROM_EMAIL || 'onboarding@resend.dev';
  const name = process.env.SPS_OTP_FROM_NAME || 'Stage Production Studio';
  return `${name} <${email}>`;
}

function emailConfigured() {
  return Boolean(resendApiKey());
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isAllowedRecipient(to) {
  const clean = normalizeEmail(to);
  if (!clean || !clean.includes('@')) return false;
  // Always allow Owner; collaborators are invited by Owner so any valid email is OK
  // for invite OTPs. Recovery OTPs should target the admin email — enforced client-side
  // and lightly here for purpose=recovery.
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const to = normalizeEmail(body.to || body.email);
    const otp = String(body.otp || body.code || '').trim();
    const purpose = String(body.purpose || 'invite').toLowerCase();
    const collaboratorName = String(body.name || '').trim();
    const roomId = String(body.roomId || '').trim();

    if (!to || !isAllowedRecipient(to)) {
      return res.status(400).json({ success: false, error: 'Valid recipient email required' });
    }
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, error: 'OTP must be a 6-digit code' });
    }

    if (purpose === 'recovery' && to !== PRIMARY_ADMIN_EMAIL && to !== normalizeEmail(body.authorizedEmail)) {
      // Soft guard — still allow Owner recovery path
      if (to !== PRIMARY_ADMIN_EMAIL) {
        return res.status(403).json({
          success: false,
          emailed: false,
          fallback: true,
          error: 'Recovery OTP can only be emailed to the authorized admin email'
        });
      }
    }

    if (!emailConfigured()) {
      return res.status(200).json({
        success: true,
        emailed: false,
        fallback: true,
        configured: false,
        message:
          'Email delivery not configured (set SPS_RESEND_API_KEY on Vercel). Use the in-UI OTP code.'
      });
    }

    const subject =
      purpose === 'recovery'
        ? 'Stage Production Studio — Admin password recovery OTP'
        : 'Stage Production Studio — Your collaboration OTP';

    const intro =
      purpose === 'recovery'
        ? 'Use this one-time code to reset your Admin password in Stage Production Studio.'
        : `You have been invited to collaborate${collaboratorName ? ` as ${collaboratorName}` : ''}${
            roomId ? ` on room ${roomId}` : ''
          }.`;

    const html = `
      <div style="font-family:ui-monospace,Menlo,Consolas,monospace;max-width:480px;margin:0 auto;padding:24px;background:#0a0a0a;color:#e4e4e7;border:1px solid #27272a;border-radius:12px;">
        <p style="margin:0 0 8px;color:#22d3ee;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Stage Production Studio</p>
        <h1 style="margin:0 0 16px;font-size:18px;color:#fafafa;">Security OTP</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#a1a1aa;">${intro}</p>
        <p style="margin:0 0 8px;font-size:12px;color:#71717a;">Your 6-digit code</p>
        <p style="margin:0 0 20px;font-size:28px;letter-spacing:0.35em;font-weight:700;color:#fbbf24;text-align:center;padding:12px;background:#18181b;border-radius:8px;">${otp}</p>
        <p style="margin:0;font-size:12px;color:#52525b;">This code expires after use. If you did not request it, ignore this email.</p>
      </div>
    `;

    const text = `Stage Production Studio\n\n${intro}\n\nOTP: ${otp}\n\nIf you did not request this, ignore this email.`;

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [to],
        subject,
        html,
        text
      })
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text().catch(() => '');
      return res.status(200).json({
        success: true,
        emailed: false,
        fallback: true,
        configured: true,
        error: `Resend failed (${sendRes.status}). Use the in-UI OTP. ${errText.slice(0, 180)}`
      });
    }

    const data = await sendRes.json().catch(() => ({}));
    return res.status(200).json({
      success: true,
      emailed: true,
      fallback: false,
      configured: true,
      id: data.id || null,
      message: `OTP emailed to ${to}`
    });
  } catch (e) {
    return res.status(200).json({
      success: true,
      emailed: false,
      fallback: true,
      error: e.message || 'Email send failed',
      message: 'Use the in-UI OTP code (email delivery unavailable).'
    });
  }
}
