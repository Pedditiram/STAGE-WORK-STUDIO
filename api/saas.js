/**
 * SaaS license heartbeat, credits, checkout.
 * Does not access the user's filesystem or machine — account/license only.
 */

import {
  CREDIT_PACKS,
  isOwner,
  getOrCreateRow,
  grantServerCredits,
  readLedger,
  rememberDevice,
  saveRow,
} from './_saasLedger.js';
import { sendResend, mailConfigured, OFFICIAL_STUDIO_EMAIL } from './_saasMail.js';
import { validateEmail } from './_emailValidator.js';
import { issueSignupOtp, verifySignupOtp } from './_signupOtp.js';
import {
  allowlistedCheckoutOrigin,
  applyCors,
  clientIp,
  rateLimit,
  requireStudioAdmin,
} from './_httpSecurity.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Owner alert for web Sign Up — never the Mac desktop-trial template. */
async function notifySignupAdmin({ name, email, stage }) {
  const label = stage === 'confirmed' ? 'Sign Up Confirmed' : 'New Sign Up';
  const subject = `[Stage Work Studio] ${label}: ${name} (${email})`;
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b0a09;color:#f4ecde;border:1px solid #3f3a34;border-radius:12px;">
      <p style="margin:0 0 6px;color:#c9a36a;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Stage Work Studio · Admin Alert</p>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#fff;">${escapeHtml(label)}</h1>
      <p style="margin:0 0 16px;font-size:13px;color:#a8a29a;">Web account (browser). This is not an app download request.</p>
      <div style="background:#171411;border:1px solid #2e2820;border-radius:8px;padding:16px;">
        <p style="margin:0 0 8px;font-size:14px;"><strong style="color:#c9a36a;">Name:</strong> ${escapeHtml(name || '—')}</p>
        <p style="margin:0 0 8px;font-size:14px;"><strong style="color:#c9a36a;">Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color:#38bdf8;">${escapeHtml(email)}</a></p>
        <p style="margin:0;font-size:14px;"><strong style="color:#c9a36a;">Status:</strong> ${stage === 'confirmed' ? 'Email verified — web workspace opened' : 'Sign-up code emailed — waiting for them to confirm'}</p>
      </div>
    </div>`;
  const text = `Stage Work Studio ${label}\n\nName: ${name}\nEmail: ${email}\n\nWeb account only — not an app download request.`;
  for (const recipient of ['admin@stageworkstudio.com', 'pedditiram@gmail.com']) {
    try {
      await sendResend({ to: recipient, subject, html, text, replyTo: email });
    } catch (err) {
      console.error(`[Signup] Admin notice to ${recipient} failed:`, err?.message || err);
    }
  }
}

export default async function handler(req, res) {
  applyCors(req, res, { methods: 'GET, POST, OPTIONS' });
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = req.body || {};
    const action = String(body.action || (req.method === 'GET' ? 'status' : 'heartbeat'));
    const email = String(body.email || '').trim().toLowerCase();
    const deviceId = String(body.deviceId || '').trim();

    if (action === 'status' || req.method === 'GET') {
      return res.status(200).json({
        success: true,
        licenses: readLedger().length,
        authority: 'saas',
        packs: CREDIT_PACKS,
        stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      });
    }

    if (!email) {
      return res.status(400).json({ success: false, error: 'email required' });
    }

    if (action === 'heartbeat' || action === 'register') {
      const { list, idx, row } = getOrCreateRow(email);
      row.lastConnection = new Date().toISOString();
      row.heartbeats = [...(row.heartbeats || []), { at: row.lastConnection, deviceId: deviceId || undefined }].slice(-40);
      rememberDevice(row, deviceId);
      saveRow(list, idx, row);
      return res.status(200).json({
        success: true,
        ok: row.status === 'ACTIVE',
        license: { email: row.email, plan: row.plan, status: row.status, credits: row.credits, apiMode: row.apiMode },
      });
    }

    if (action === 'consume') {
      return res.status(410).json({ success: false, error: 'Credits are consumed only during generate.' });
    }

    if (action === 'grant-credits') {
      const admin = requireStudioAdmin(req, { ...body, actor: body.actor });
      if (!admin.ok) return res.status(admin.status).json({ success: false, error: admin.error });
      const pack = CREDIT_PACKS.find((p) => p.id === body.packId);
      const amount = pack ? pack.credits : Number(body.credits) || 0;
      if (!amount) return res.status(400).json({ success: false, error: 'packId or credits required' });
      const row = grantServerCredits(email, amount);
      return res.status(200).json({ success: true, credits: row.credits, granted: amount });
    }

    if (action === 'set-api-mode') {
      const admin = requireStudioAdmin(req, { ...body, actor: body.actor });
      if (!admin.ok) return res.status(admin.status).json({ success: false, error: admin.error });
      const mode = String(body.apiMode || body.mode || '').toLowerCase() === 'managed' ? 'managed' : 'byok';
      const { list, idx, row } = getOrCreateRow(email);
      row.apiMode = mode;
      saveRow(list, idx, row);
      return res.status(200).json({
        success: true,
        license: { email: row.email, plan: row.plan, status: row.status, credits: row.credits, apiMode: row.apiMode },
      });
    }

    if (action === 'checkout') {
      const pack = CREDIT_PACKS.find((p) => p.id === body.packId) || CREDIT_PACKS[0];
      const secret = process.env.STRIPE_SECRET_KEY;
      if (!secret) {
        return res.status(200).json({
          success: true,
          mode: 'ledger',
          pack,
          message: 'Payment system is held. Owner can grant this pack in Settings → SaaS.',
        });
      }
      const origin = allowlistedCheckoutOrigin(body.origin);
      const params = new URLSearchParams({
        mode: 'payment',
        success_url: `${origin}/?credits=ok&pack=${pack.id}`,
        cancel_url: `${origin}/?credits=cancel`,
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(pack.usd * 100),
        'line_items[0][price_data][product_data][name]': `Stage Work Studio ${pack.label}`,
        'client_reference_id': email,
        'metadata[email]': email,
        'metadata[pack]': pack.id,
      });
      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
      const data = await stripeRes.json();
      if (!stripeRes.ok || !data.url) {
        return res.status(400).json({ success: false, error: data.error?.message || 'Stripe checkout failed' });
      }
      return res.status(200).json({ success: true, mode: 'stripe', url: data.url, pack });
    }

    if (action === 'signup') {
      const ipLimit = rateLimit(`signup:${clientIp(req)}`, 8, 60 * 60 * 1000);
      if (!ipLimit.ok) {
        return res.status(429).json({ success: false, error: `Too many sign-up attempts. Wait ${ipLimit.waitSec}s.` });
      }
      const emailLimit = rateLimit(`signup-mail:${email}`, 5, 60 * 60 * 1000);
      if (!emailLimit.ok) {
        return res.status(429).json({ success: false, error: `Too many codes for this address. Wait ${emailLimit.waitSec}s.` });
      }
      const emailCheck = await validateEmail(email);
      if (!emailCheck.valid) {
        return res.status(400).json({ success: false, error: 'invalid mail id' });
      }
      if (isOwner(email)) {
        return res.status(400).json({
          success: false,
          error: 'Owner signs in with the studio email — this form is for a new public account.'
        });
      }
      if (!mailConfigured()) {
        return res.status(503).json({
          success: false,
          emailed: false,
          error: 'Email delivery is required to create a public account. Try again later, or request a studio invite.'
        });
      }
      const name = String(body.name || '').trim().slice(0, 120);
      let otp;
      try {
        otp = await issueSignupOtp(email, { name });
      } catch (e) {
        if (e?.code === 'RATE') {
          return res.status(429).json({ success: false, error: e.message });
        }
        throw e;
      }
      const mailResult = await sendResend({
        to: email,
        subject: 'Stage Work Studio — your sign-up code',
        html: `<div style="font-family:ui-monospace,Menlo,Consolas,monospace;max-width:480px;margin:0 auto;padding:24px;background:#0a0a0a;color:#e4e4e7;">
          <p style="color:#c9a36a;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Stage Work Studio</p>
          <h1 style="font-size:18px;color:#fafafa;">Confirm your email</h1>
          <p style="font-size:14px;color:#a1a1aa;">Use this code to open your own trial film — it is not a studio invite.</p>
          <p style="font-size:28px;letter-spacing:0.35em;font-weight:700;color:#fbbf24;text-align:center;padding:12px;background:#18181b;">${otp}</p>
          <p style="font-size:12px;color:#52525b;">Expires in 15 minutes. We never show this code in the app.</p>
        </div>`,
        text: `Stage Work Studio sign-up code: ${otp}\nExpires in 15 minutes.`,
        replyTo: OFFICIAL_STUDIO_EMAIL
      });
      if (!mailResult.emailed) {
        return res.status(502).json({
          success: false,
          emailed: false,
          error: 'Could not email a code. Check the address and try again.'
        });
      }
      notifySignupAdmin({ name, email, stage: 'requested' }).catch(() => {});
      return res.status(200).json({
        success: true,
        emailed: true,
        message: `We sent a 6-digit code to ${email}. Check your inbox.`
      });
    }

    if (action === 'verify-signup') {
      const emailCheck = await validateEmail(email);
      if (!emailCheck.valid) {
        return res.status(400).json({ success: false, error: 'invalid mail id' });
      }
      const checked = await verifySignupOtp(email, body.otp);
      if (!checked.ok) {
        return res.status(400).json({ success: false, error: checked.error });
      }
      const { list, idx, row } = getOrCreateRow(email);
      if (!isOwner(email)) {
        row.plan = 'trial';
        row.credits = typeof row.credits === 'number' && row.credits > 0 ? row.credits : 50;
        row.status = 'ACTIVE';
        row.apiMode = row.apiMode || 'byok';
        row.packOrigin = 'self_serve';
      }
      rememberDevice(row, deviceId);
      saveRow(list, idx, row);
      notifySignupAdmin({
        name: checked.name || String(body.name || ''),
        email,
        stage: 'confirmed'
      }).catch(() => {});
      return res.status(200).json({
        success: true,
        license: { email: row.email, plan: row.plan, status: row.status, credits: row.credits },
        name: checked.name || String(body.name || '')
      });
    }

    return res.status(400).json({ success: false, error: 'unknown action' });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'saas failed' });
  }
}
