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
import { issueSignupOtp, releaseSignupOtp, verifySignupOtp } from './_signupOtp.js';
import { generateSignupCodeEmail } from './_cinemaEmailTemplates.js';
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

/** Owner alert — same pattern as desktop trial: Gmail notice, Titan reply from admin@. */
async function notifySignupAdmin({ name, email, stage, otp = '' }) {
  const label = stage === 'confirmed' ? 'Sign Up Confirmed' : 'New Sign Up';
  const subject = `[Stage Work Studio] ${label}: ${name} (${email})`;
  const code = String(otp || '').trim();
  const titanReplyBody =
`Hi ${name || 'there'},

Thank you for creating a Stage Work Studio account.

Your sign-up code is: ${code || '——'}

Enter this 6-digit code on the Create account screen. It expires in 15 minutes.

Best regards,
Stage Work Studio Administration
admin@stageworkstudio.com
https://www.stageworkstudio.com`;
  const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Stage Work Studio — your sign-up code')}&body=${encodeURIComponent(titanReplyBody)}`;

  const html = stage === 'confirmed'
    ? `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:580px;margin:0 auto;padding:24px;background:#0b0a09;color:#f4ecde;border:1px solid #3f3a34;border-radius:12px;">
      <p style="margin:0 0 6px;color:#c9a36a;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Stage Work Studio · Admin Alert</p>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#fff;">Sign Up Confirmed</h1>
      <p style="margin:0 0 16px;font-size:13px;color:#a8a29a;">Web account (browser). This is not an app download request.</p>
      <div style="background:#171411;border:1px solid #2e2820;border-radius:8px;padding:16px;">
        <p style="margin:0 0 8px;font-size:14px;"><strong style="color:#c9a36a;">Name:</strong> ${escapeHtml(name || '—')}</p>
        <p style="margin:0;font-size:14px;"><strong style="color:#c9a36a;">Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color:#38bdf8;">${escapeHtml(email)}</a></p>
      </div>
    </div>`
    : `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:580px;margin:0 auto;padding:24px;background:#0b0a09;color:#f4ecde;border:1px solid #3f3a34;border-radius:12px;">
      <p style="margin:0 0 6px;color:#c9a36a;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Stage Work Studio · Admin Alert</p>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#fff;">New Sign Up</h1>
      <p style="margin:0 0 16px;font-size:13px;color:#a8a29a;">Web account (browser). This is not an app download request.</p>
      <div style="background:#171411;border:1px solid #2e2820;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 8px;font-size:14px;"><strong style="color:#c9a36a;">Name:</strong> ${escapeHtml(name || '—')}</p>
        <p style="margin:0;font-size:14px;"><strong style="color:#c9a36a;">Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color:#38bdf8;">${escapeHtml(email)}</a></p>
      </div>
      <div style="background:#1e1a14;border:1px solid #c9a36a;border-left:4px solid #c9a36a;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#c9a36a;text-transform:uppercase;letter-spacing:0.1em;">Pre-minted sign-up code (15 minutes)</p>
        <p style="margin:0 0 12px;font-size:22px;letter-spacing:0.28em;font-weight:700;color:#a3e635;font-family:monospace;">${escapeHtml(code || '——')}</p>
        <a href="${escapeHtml(mailtoUrl)}" style="display:inline-block;background:#c9a36a;color:#0b0a09;font-size:12px;font-weight:700;padding:8px 14px;border-radius:6px;text-decoration:none;">
          ✉️ 1-Click Reply from admin@stageworkstudio.com (Titan)
        </a>
      </div>
      <div style="background:#12100e;border:1px solid #29241e;border-radius:8px;padding:14px;margin-bottom:16px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;">Quick Copy Template (Titan Webmail):</p>
        <pre style="margin:0;font-size:12px;line-height:1.5;color:#d1d5db;white-space:pre-wrap;font-family:monospace;background:#080706;padding:10px;border-radius:4px;">${escapeHtml(titanReplyBody)}</pre>
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#8a8378;line-height:1.5;">
        • Notice delivered to <strong>pedditiram@gmail.com</strong>.<br>
        • Reply to the applicant via Titan Webmail from <code>admin@stageworkstudio.com</code>. The applicant never sees any other address.
      </p>
    </div>`;
  const text = stage === 'confirmed'
    ? `Stage Work Studio Sign Up Confirmed\n\nName: ${name}\nEmail: ${email}\n\nWeb account only — not an app download request.`
    : `Stage Work Studio sign-up\n\nName: ${name}\nEmail: ${email}\nCode: ${code}\n\nReply from admin@stageworkstudio.com using Titan Email.`;

  let anyNotified = false;
  // Gmail first — same working path as desktop-trial.
  for (const recipient of ['pedditiram@gmail.com', 'admin@stageworkstudio.com']) {
    try {
      const sRes = await sendResend({
        to: recipient,
        subject,
        html,
        text,
        replyTo: email,
      });
      if (sRes.emailed) anyNotified = true;
    } catch (err) {
      console.error(`[Signup] Admin notice to ${recipient} failed:`, err?.message || err);
    }
  }
  return { emailed: anyNotified };
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
      const letter = generateSignupCodeEmail({ name, email, otp });
      const adminNotice = await notifySignupAdmin({ name, email, stage: 'requested', otp });
      if (!adminNotice.emailed) {
        await releaseSignupOtp(email).catch(() => {});
        console.error('[Signup] owner notice failed');
        return res.status(502).json({
          success: false,
          emailed: false,
          error: 'Could not email a code just now. Try again in a moment.'
        });
      }
      // Same as desktop trial: applicant mail is best-effort from admin@. Never block the request.
      let applicantEmailed = false;
      try {
        const applicantSend = await sendResend({
          to: email,
          subject: letter.subject,
          html: letter.html,
          text: letter.text,
          replyTo: OFFICIAL_STUDIO_EMAIL,
        });
        applicantEmailed = Boolean(applicantSend.emailed);
      } catch (err) {
        console.error('[Signup] applicant mail skipped', err?.message || err);
      }
      return res.status(200).json({
        success: true,
        emailed: true,
        queued: true,
        applicantEmailed,
        message: applicantEmailed
          ? `We sent a 6-digit code to ${email} from admin@stageworkstudio.com.`
          : `Sign-up received. Watch ${email} for a note from admin@stageworkstudio.com.`
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
