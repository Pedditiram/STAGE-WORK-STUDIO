/**
 * Desktop trial download — request → admin notify → approve → tokenized download.
 *
 * The ~500MB Electron binary is NOT hosted on Vercel. Point SPS_DESKTOP_RELEASE_URL
 * (or Settings → SaaS release URL) at a GitHub Release asset or other HTTPS file.
 * Local `release/mac-arm64/` is for the owner's machine only.
 *
 * Env:
 *   SPS_RESEND_API_KEY / RESEND_API_KEY
 *   SPS_OTP_FROM_EMAIL, SPS_OTP_FROM_NAME
 *   SPS_ACCESS_TO_EMAIL (admin inbox, default pedditiram@gmail.com)
 *   SPS_SAAS_ADMIN_EMAILS (comma extras)
 *   SPS_DESKTOP_RELEASE_URL (GitHub Release / signed HTTPS)
 *   SPS_PUBLIC_ORIGIN (download links in mail)
 *   SPS_KV_REST_URL + SPS_KV_REST_TOKEN (durable queue on Vercel)
 */

import crypto from 'crypto';
import {
  OWNER_EMAIL,
  activateDesktopTrialLicense,
} from './_saasLedger.js';
import { mailConfigured, sendResend } from './_saasMail.js';
import { validateEmail } from './_emailValidator.js';
import {
  generateDesktopTrialApprovalEmail,
  generateDesktopTrialReceivedEmail,
} from './_cinemaEmailTemplates.js';
import {
  envReleaseUrl,
  hashToken,
  isHttpsUrl,
  kvConfigured,
  MAX_DOWNLOADS,
  mintDownloadToken,
  readTrialState,
  resolveReleaseUrl,
  writeTrialState,
} from './_desktopTrialStore.js';
import { allowlistedCheckoutOrigin, applyCors, requireStudioAdmin } from './_httpSecurity.js';

function cors(req, res) {
  applyCors(req, res, { methods: 'GET, POST, OPTIONS' });
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

function queryOf(req) {
  if (req.query && typeof req.query === 'object' && Object.keys(req.query).length) return req.query;
  try {
    const u = new URL(req.url || '', 'http://localhost');
    return Object.fromEntries(u.searchParams);
  } catch {
    return {};
  }
}

const ADMIN_EMAIL = 'admin@stageworkstudio.com';

function adminInbox() {
  return normalizeEmail(process.env.SPS_ACCESS_TO_EMAIL) || ADMIN_EMAIL;
}

function isSaasAdmin(email) {
  const clean = normalizeEmail(email);
  if (!clean) return false;
  if (clean === OWNER_EMAIL || clean === 'admin@stageworkstudio.com' || clean === 'pedditiram@gmail.com') return true;
  if (clean === adminInbox()) return true;
  const extra = String(process.env.SPS_SAAS_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => normalizeEmail(s))
    .filter(Boolean);
  return extra.includes(clean);
}

function publicOrigin(req, body) {
  const fromEnv = String(process.env.SPS_PUBLIC_ORIGIN || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return allowlistedCheckoutOrigin(body?.origin || '');
}

function publicize(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    org: row.org || '',
    why: row.why || '',
    status: row.status,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt || null,
    decidedBy: row.decidedBy || null,
    downloadCount: row.downloadCount || 0,
    hasDownloadToken: Boolean(row.tokenHash),
    tokenExp: row.tokenExp || null,
    adminEmailed: Boolean(row.adminEmailed),
    requesterEmailed: Boolean(row.requesterEmailed),
  };
}

function findByEmail(state, email) {
  const clean = normalizeEmail(email);
  return (state.requests || []).find((r) => normalizeEmail(r.email) === clean);
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const q = queryOf(req);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const action = String(body.action || q.action || (req.method === 'GET' ? 'public' : '')).toLowerCase();

    if (req.method === 'GET' && (action === 'download' || q.token)) {
      return serveDownload(req, res, q);
    }

    if (action === 'public' || (req.method === 'GET' && !action)) {
      const { state, backend } = await readTrialState();
      const release = resolveReleaseUrl(state);
      return res.status(200).json({
        success: true,
        mailConfigured: mailConfigured(),
        kvConfigured: kvConfigured(),
        hasRelease: Boolean(release),
        backend,
        hint: kvConfigured()
          ? 'Queue is durable on KV.'
          : 'On Vercel, set SPS_KV_REST_URL + SPS_KV_REST_TOKEN so trial requests survive deploys. Local Vite uses storage/cloud/desktop-trial.json.',
      });
    }

    if (action === 'request' && req.method === 'POST') {
      return createRequest(req, res, body);
    }

    if (action === 'list' && req.method === 'POST') {
      const admin = requireStudioAdmin(req, body);
      if (!admin.ok) {
        return res.status(admin.status).json({ success: false, error: admin.error });
      }
      const { state, backend } = await readTrialState();
      const release = resolveReleaseUrl(state);
      return res.status(200).json({
        success: true,
        requests: (state.requests || []).map(publicize),
        releaseUrl: release,
        releaseFromEnv: Boolean(envReleaseUrl()),
        mailConfigured: mailConfigured(),
        kvConfigured: kvConfigured(),
        backend,
        adminInbox: adminInbox(),
      });
    }

    if (action === 'set-release-url' && req.method === 'POST') {
      const admin = requireStudioAdmin(req, body);
      if (!admin.ok) {
        return res.status(admin.status).json({ success: false, error: admin.error });
      }
      const url = String(body.releaseUrl || '').trim();
      if (url && !isHttpsUrl(url)) {
        return res.status(400).json({ success: false, error: 'Release URL must be https (GitHub Release or signed object URL).' });
      }
      const { state } = await readTrialState();
      state.releaseUrl = url;
      const wrote = await writeTrialState(state);
      return res.status(200).json({
        success: true,
        releaseUrl: resolveReleaseUrl(state),
        durable: wrote.durable,
        backend: wrote.backend,
      });
    }

    if (action === 'approve' && req.method === 'POST') {
      return decide(req, res, body, 'approved');
    }
    if (action === 'deny' && req.method === 'POST') {
      return decide(req, res, body, 'denied');
    }
    if (action === 'resend' && req.method === 'POST') {
      return resendApproved(req, res, body);
    }

    return res.status(400).json({ success: false, error: 'unknown action' });
  } catch (e) {
    return res.status(200).json({ success: false, error: e.message || 'desktop trial failed' });
  }
}

async function createRequest(req, res, body) {
  const name = String(body.name || '').trim().slice(0, 120);
  const email = normalizeEmail(body.email);
  const org = String(body.org || body.role || '').trim().slice(0, 160);
  const why = String(body.why || body.message || '').trim().slice(0, 2000);

  if (!name) {
    return res.status(400).json({ success: false, error: 'Name is required.' });
  }
  const emailCheck = await validateEmail(email);
  if (!emailCheck.valid) {
    return res.status(400).json({ success: false, error: 'invalid mail id' });
  }

  const { state, backend } = await readTrialState();
  const existing = findByEmail(state, email);

  if (existing && existing.status === 'pending') {
    return res.status(200).json({
      success: true,
      queued: true,
      duplicate: true,
      emailed: Boolean(existing.adminEmailed),
      configured: mailConfigured(),
      message: 'This email already has a pending app download request. The owner will follow up at the same address.',
    });
  }
  if (existing && existing.status === 'approved') {
    return res.status(200).json({
      success: true,
      queued: true,
      duplicate: true,
      alreadyApproved: true,
      configured: mailConfigured(),
      message: 'This email already has an approved app download. Check that inbox, or ask the owner to resend the download from Settings → SaaS.',
    });
  }

  const minted = mintDownloadToken();
  const origin = publicOrigin(req, body);
  const directDownloadUrl = `${origin}/api/desktop-trial?action=download&token=${encodeURIComponent(minted.raw)}`;

  const record = {
    id: `dtr_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`,
    name,
    email,
    org,
    why: why || 'I would like to download the Stage Work Studio app.',
    status: 'approved', // Pre-approved so personal token is immediately valid for the applicant
    createdAt: new Date().toISOString(),
    decidedAt: new Date().toISOString(),
    decidedBy: 'auto-preapproved',
    tokenHash: minted.hash,
    tokenExp: minted.exp,
    adminEmailed: false,
    requesterEmailed: false,
    downloadCount: 0,
  };
  activateDesktopTrialLicense(record.email);

  state.requests = [record, ...(state.requests || []).filter((r) => normalizeEmail(r.email) !== email)];
  const wrote = await writeTrialState(state);

  const { subject: applicantSubject, html: applicantHtml, text: applicantText } = generateDesktopTrialReceivedEmail({
    name: record.name,
    email: record.email,
  });

  const titanReplyBody =
`Hi ${record.name || 'there'},

Thank you for requesting access to Stage Work Studio!

We have received your application to download the app.

Your access is currently being provisioned. If you have any specific requirements or questions regarding your production slate, please feel free to let us know.

Best regards,
Stage Work Studio Administration
admin@stageworkstudio.com
https://www.stageworkstudio.com`;

  const titanApprovalBody =
`Hi ${record.name || 'there'},

Thank you for your interest in Stage Work Studio!

Your app download has been approved. You can download the application using your personal, secure link below:
${directDownloadUrl}

(Note: This personal link is valid for 7 days and up to 5 downloads. Sign in with ${record.email} after launch.)

macOS Installation:
Right-click "Stage Work Studio.app" -> select Open, or run: xattr -cr "/Applications/Stage Work Studio.app"

If you have any questions or feedback, feel free to reply directly to this email.

Best regards,
Stage Work Studio Administration
admin@stageworkstudio.com
https://www.stageworkstudio.com`;

  const mailtoSubject = encodeURIComponent('Stage Work Studio — Download App Access');
  const mailtoUrl = `mailto:${encodeURIComponent(record.email)}?subject=${mailtoSubject}&body=${encodeURIComponent(titanReplyBody)}`;
  const mailtoApproveUrl = `mailto:${encodeURIComponent(record.email)}?subject=${encodeURIComponent('Your Stage Work Studio App Download')}&body=${encodeURIComponent(titanApprovalBody)}`;

  const subject = `[Stage Work Studio] App Download Request: ${record.name} (${record.email})`;
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:580px;margin:0 auto;padding:24px;background:#0b0a09;color:#f4ecde;border:1px solid #3f3a34;border-radius:12px;">
      <p style="margin:0 0 6px;color:#c9a36a;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Stage Work Studio · Admin Alert</p>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#fff;">New App Download Request</h1>

      <div style="background:#171411;border:1px solid #2e2820;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 8px;font-size:14px;"><strong style="color:#c9a36a;">Name:</strong> ${escapeHtml(record.name)}</p>
        <p style="margin:0 0 8px;font-size:14px;"><strong style="color:#c9a36a;">Email:</strong> <a href="mailto:${escapeHtml(record.email)}" style="color:#38bdf8;">${escapeHtml(record.email)}</a></p>
        <p style="margin:0 0 8px;font-size:14px;"><strong style="color:#c9a36a;">Organization:</strong> ${escapeHtml(record.org || 'Independent / Individual')}</p>
        <p style="margin:0;font-size:14px;"><strong style="color:#c9a36a;">Stated Reason:</strong><br><span style="color:#d6cfc4;white-space:pre-wrap;">${escapeHtml(record.why)}</span></p>
      </div>

      <div style="background:#1e1a14;border:1px solid #c9a36a;border-left:4px solid #c9a36a;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#c9a36a;text-transform:uppercase;letter-spacing:0.1em;">Pre-Minted Secure Download Link (Active 7 Days)</p>
        <p style="margin:0 0 12px;font-size:12px;word-break:break-all;font-family:monospace;background:#0d0c0b;padding:8px 10px;border-radius:4px;border:1px solid #332d26;color:#a3e635;">
          ${escapeHtml(directDownloadUrl)}
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
          <a href="${escapeHtml(mailtoUrl)}" style="display:inline-block;background:#c9a36a;color:#0b0a09;font-size:12px;font-weight:700;padding:8px 14px;border-radius:6px;text-decoration:none;">
            ✉️ 1-Click Provisioning Reply (Titan)
          </a>
          <a href="${escapeHtml(mailtoApproveUrl)}" style="display:inline-block;background:#24201b;border:1px solid #c9a36a;color:#c9a36a;font-size:12px;font-weight:700;padding:8px 14px;border-radius:6px;text-decoration:none;">
            🚀 1-Click Send Download Link
          </a>
        </div>
      </div>

      <div style="background:#12100e;border:1px solid #29241e;border-radius:8px;padding:14px;margin-bottom:16px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;">Quick Copy Template (Provisioning Response):</p>
        <pre style="margin:0;font-size:12px;line-height:1.5;color:#d1d5db;white-space:pre-wrap;font-family:monospace;background:#080706;padding:10px;border-radius:4px;">${escapeHtml(titanReplyBody)}</pre>
      </div>

      <p style="margin:16px 0 0;font-size:12px;color:#8a8378;line-height:1.5;">
        • Notice delivered to <strong>admin@stageworkstudio.com</strong> &amp; <strong>pedditiram@gmail.com</strong>.<br>
        • Reply to the applicant directly via Titan Webmail from <code>admin@stageworkstudio.com</code>. The applicant never sees any other address.
      </p>
    </div>
  `;
  const text = `Stage Work Studio app download request\n\nName: ${record.name}\nEmail: ${record.email}\nOrg: ${record.org || '—'}\n\n${record.why}\n\nPre-minted download URL:\n${directDownloadUrl}\n\nReply from admin@stageworkstudio.com using Titan Email.`;

  // Dual delivery to both official studio mailbox and owner account
  const notifyRecipients = ['admin@stageworkstudio.com', 'pedditiram@gmail.com'];
  let anyNotified = false;

  for (const recipient of notifyRecipients) {
    try {
      const sRes = await sendResend({
        to: recipient,
        subject,
        html,
        text,
        replyTo: record.email,
      });
      if (sRes.emailed) anyNotified = true;
    } catch (err) {
      console.error(`[DesktopTrial] Notice delivery to ${recipient} failed:`, err?.message || err);
    }
  }

  if (anyNotified) {
    record.adminEmailed = true;
    await writeTrialState(state);
  }

  // Attempt direct dispatch of the trial application received email to applicant
  try {
    const applicantSend = await sendResend({
      to: email,
      subject: applicantSubject,
      text: applicantText,
      html: applicantHtml,
      replyTo: 'admin@stageworkstudio.com',
    });
    if (applicantSend.emailed) {
      record.requesterEmailed = true;
      await writeTrialState(state);
    }
  } catch {
    // Non-fatal if sandbox restricts direct outbound to applicant
  }

  return res.status(200).json({
    success: true,
    queued: true,
    emailed: Boolean(anyNotified),
    configured: mailConfigured(),
    durable: wrote.durable,
    backend: wrote.backend || backend,
    message: 'Thank you for requesting access to Stage Work Studio! We have received your application to download the app. Your access is currently being provisioned.',
  });
}

async function decide(req, res, body, status) {
  const admin = requireStudioAdmin(req, body);
  if (!admin.ok) {
    return res.status(admin.status).json({ success: false, error: admin.error });
  }
  const id = String(body.requestId || body.id || '').trim();
  if (!id) return res.status(400).json({ success: false, error: 'requestId required' });

  const { state } = await readTrialState();
  const row = (state.requests || []).find((r) => r.id === id);
  if (!row) return res.status(404).json({ success: false, error: 'Request not found' });

  row.status = status;
  row.decidedAt = new Date().toISOString();
  row.decidedBy = normalizeEmail(body.actor);

  let requesterSend = { emailed: false, configured: mailConfigured() };

  if (status === 'approved') {
    activateDesktopTrialLicense(row.email);
    const minted = mintDownloadToken();
    row.tokenHash = minted.hash;
    row.tokenExp = minted.exp;
    row.downloadCount = 0;
    const origin = publicOrigin(req, body);
    const downloadUrl = `${origin}/api/desktop-trial?action=download&token=${encodeURIComponent(minted.raw)}`;
    const releaseReady = Boolean(resolveReleaseUrl(state));
    requesterSend = await sendRequesterApproved(row, downloadUrl, releaseReady);
    row.requesterEmailed = Boolean(requesterSend.emailed);
  } else {
    row.tokenHash = '';
    row.tokenExp = null;
    requesterSend = await sendResend({
      to: row.email,
      subject: 'Stage Work Studio — app download not approved',
      text: `Hi${row.name ? ` ${row.name}` : ''},\n\nThe studio admin did not approve an app download for ${row.email} at this time. You can request again later or write ${adminInbox()}.\n\n— Stage Work Studio`,
      html: `<p>Hi${row.name ? ` ${escapeHtml(row.name)}` : ''},</p><p>The studio admin did not approve an app download for ${escapeHtml(row.email)} at this time.</p><p>— Stage Work Studio</p>`,
    });
    row.requesterEmailed = Boolean(requesterSend.emailed);
  }

  const wrote = await writeTrialState(state);
  return res.status(200).json({
    success: true,
    request: publicize(row),
    downloadUrl: status === 'approved' ? downloadUrl : null,
    emailed: Boolean(requesterSend.emailed),
    configured: Boolean(requesterSend.configured),
    durable: wrote.durable,
    message:
      status === 'approved'
        ? requesterSend.emailed
          ? `Approved. Download mail sent to ${row.email}.`
          : `Approved and licensed as trial for ${row.email}.`
        : requesterSend.emailed
          ? `Denied. Notice sent to ${row.email}.`
          : 'Denied. Request stays in the queue.',
  });
}

async function resendApproved(req, res, body) {
  const admin = requireStudioAdmin(req, body);
  if (!admin.ok) {
    return res.status(admin.status).json({ success: false, error: admin.error });
  }
  const id = String(body.requestId || body.id || '').trim();
  const { state } = await readTrialState();
  const row = (state.requests || []).find((r) => r.id === id);
  if (!row) return res.status(404).json({ success: false, error: 'Request not found' });
  if (row.status !== 'approved') {
    return res.status(400).json({ success: false, error: 'Only approved requests can be resent.' });
  }
  activateDesktopTrialLicense(row.email);
  const minted = mintDownloadToken();
  row.tokenHash = minted.hash;
  row.tokenExp = minted.exp;
  row.downloadCount = 0;
  const origin = publicOrigin(req, body);
  const downloadUrl = `${origin}/api/desktop-trial?action=download&token=${encodeURIComponent(minted.raw)}`;
  const requesterSend = await sendRequesterApproved(row, downloadUrl, Boolean(resolveReleaseUrl(state)));
  row.requesterEmailed = Boolean(requesterSend.emailed);
  await writeTrialState(state);
  return res.status(200).json({
    success: true,
    emailed: Boolean(requesterSend.emailed),
    configured: Boolean(requesterSend.configured),
    downloadUrl,
    request: publicize(row),
    message: requesterSend.emailed
      ? `New download link emailed to ${row.email}.`
      : `Token rotated. Link ready for ${row.email}.`,
  });
}

async function sendRequesterApproved(row, downloadUrl, releaseReady) {
  const { subject, html, text } = generateDesktopTrialApprovalEmail({
    name: row.name,
    email: row.email,
    downloadUrl,
    expiryDays: 7,
    maxDownloads: MAX_DOWNLOADS,
  });
  return sendResend({
    to: row.email,
    subject,
    text,
    html,
    replyTo: 'admin@stageworkstudio.com',
  });
}

async function serveDownload(req, res, q) {
  const token = String(q.token || '').trim();
  if (!token || token.length < 16) {
    return res.status(404).json({ success: false, error: 'Invalid download token.' });
  }
  const { state } = await readTrialState();
  const digest = hashToken(token);
  const row = (state.requests || []).find((r) => r.tokenHash && r.tokenHash === digest);
  if (!row || row.status !== 'approved') {
    return res.status(404).json({ success: false, error: 'Unknown or expired download token.' });
  }
  if (row.tokenExp && Date.now() > Number(row.tokenExp)) {
    return res.status(410).json({ success: false, error: 'This download link expired. Ask the owner to resend from Settings → SaaS.' });
  }
  if ((row.downloadCount || 0) >= MAX_DOWNLOADS) {
    return res.status(429).json({ success: false, error: 'Download limit reached for this token. Ask the owner to resend.' });
  }
  const target = resolveReleaseUrl(state);
  if (!target || !isHttpsUrl(target)) {
    return res.status(503).json({
      success: false,
      error: 'Desktop binary is not hosted on this website (Vercel cannot serve the ~500MB .app). The owner must set SPS_DESKTOP_RELEASE_URL or paste a GitHub Release HTTPS URL in Settings → SaaS.',
    });
  }
  row.downloadCount = (row.downloadCount || 0) + 1;
  row.lastDownloadAt = new Date().toISOString();
  await writeTrialState(state);
  res.statusCode = 302;
  res.setHeader('Location', target);
  res.setHeader('Cache-Control', 'no-store');
  return res.end();
}
