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

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
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
  const fromBody = String(body?.origin || '').replace(/\/$/, '');
  if (fromBody.startsWith('http')) return fromBody;
  const proto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  if (host) return `${proto}://${host}`;
  return 'https://www.stageworkstudio.com';
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
  cors(res);
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
      if (!isSaasAdmin(body.actor)) {
        return res.status(403).json({ success: false, error: 'Only the studio admin can list trial requests.' });
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
      if (!isSaasAdmin(body.actor)) {
        return res.status(403).json({ success: false, error: 'Only the studio admin can set the desktop release URL.' });
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
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'A valid email is required.' });
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
      message: 'This email already has a pending desktop trial request. The owner will follow up at the same address.',
    });
  }
  if (existing && existing.status === 'approved') {
    return res.status(200).json({
      success: true,
      queued: true,
      duplicate: true,
      alreadyApproved: true,
      configured: mailConfigured(),
      message: 'This email already has an approved desktop trial. Check that inbox, or ask the owner to resend the download from Settings → SaaS.',
    });
  }

  const record = {
    id: `dtr_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`,
    name,
    email,
    org,
    why: why || 'I would like a desktop trial of Stage Work Studio.',
    status: 'pending',
    createdAt: new Date().toISOString(),
    adminEmailed: false,
    requesterEmailed: false,
    downloadCount: 0,
  };
  state.requests = [record, ...(state.requests || []).filter((r) => normalizeEmail(r.email) !== email)];
  const wrote = await writeTrialState(state);

  const ownerTo = adminInbox();
  const origin = publicOrigin(req, body);
  const subject = 'Stage Work Studio — desktop trial request';
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0b0a09;color:#f4ecde;border:1px solid #3f3a34;border-radius:12px;">
      <p style="margin:0 0 8px;color:#c9a36a;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">Stage Work Studio</p>
      <h1 style="margin:0 0 16px;font-size:18px;">Desktop trial request</h1>
      <p style="margin:0 0 8px;font-size:14px;"><strong>Name:</strong> ${escapeHtml(record.name)}</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong>Email:</strong> ${escapeHtml(record.email)}</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong>Org:</strong> ${escapeHtml(record.org || '—')}</p>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.55;color:#d6cfc4;white-space:pre-wrap;">${escapeHtml(record.why)}</p>
      <p style="margin:20px 0 0;font-size:13px;">Approve in the web app: Settings → SaaS → Desktop trial. Then a download mail goes to ${escapeHtml(record.email)}.</p>
      <p style="margin:8px 0 0;font-size:12px;color:#8a8378;">${escapeHtml(origin)}</p>
    </div>
  `;
  const text = `Stage Work Studio desktop trial request\n\nName: ${record.name}\nEmail: ${record.email}\nOrg: ${record.org || '—'}\n\n${record.why}\n\nApprove in Settings → SaaS → Desktop trial.`;

  let ownerSend = await sendResend({
    to: ownerTo,
    subject,
    html,
    text,
    replyTo: email,
  });

  // If Resend is in sandbox testing mode (onboarding@resend.dev) and restricts to registered email,
  // deliver fallback to pedditiram@gmail.com so notification is never lost, while clearly marked for admin@stageworkstudio.com.
  if (!ownerSend.emailed && ownerSend.error && ownerSend.error.includes('pedditiram@gmail.com')) {
    const fallback = await sendResend({
      to: 'pedditiram@gmail.com',
      subject: `[For admin@stageworkstudio.com] ${subject}`,
      html: `<div style="background:#1e1b18;padding:12px;border-left:4px solid #c9a36a;margin-bottom:14px;font-family:sans-serif;font-size:12px;color:#f4ecde;">` +
            `<strong>Desktop Trial Request for admin@stageworkstudio.com</strong><br>` +
            `Delivered to primary admin inbox. To receive directly at <code>admin@stageworkstudio.com</code>, configure Titan SMTP (<code>SPS_SMTP_PASS</code>) or verify <strong>stageworkstudio.com</strong> at <a href="https://resend.com/domains" style="color:#38bdf8;">resend.com/domains</a>.` +
            `</div>` + html,
      text: `[Desktop Trial Request for admin@stageworkstudio.com]\n\n` + text,
      replyTo: email,
    });
    if (fallback.emailed) {
      ownerSend = fallback;
    }
  }

  if (ownerSend.emailed) {
    record.adminEmailed = true;
    await writeTrialState(state);
  }

  // Auto-reply confirmation to the applicant
  const applicantSubject = 'Stage Work Studio — desktop trial request received';
  const applicantText = `Hi${name ? ` ${name}` : ''},\n\nThank you for requesting a desktop trial of Stage Work Studio (SWS).\n\nYour application has been received by studio administration (admin@stageworkstudio.com) and is currently under review. Once approved, your personalized, secure download link will arrive at ${email}.\n\nFor any questions or immediate production inquiries, reach out to studio administration at admin@stageworkstudio.com.\n\n— Stage Work Studio\nAI Cinema Production OS\nwww.stageworkstudio.com`;
  const applicantHtml = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0b0a09;color:#f4ecde;border:1px solid #3f3a34;border-radius:12px;">
      <p style="margin:0 0 8px;color:#c9a36a;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">Stage Work Studio · AI Cinema Production OS</p>
      <h1 style="margin:0 0 16px;font-size:18px;">Desktop Trial Request Received</h1>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Thank you for requesting a desktop trial of Stage Work Studio.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#d6cfc4;">Your application has been received by studio administration (<code>admin@stageworkstudio.com</code>) and is currently under review. Once approved, your personalized, secure download link will arrive at <strong>${escapeHtml(email)}</strong>.</p>
      <p style="margin:20px 0 0;font-size:12px;color:#8a8378;">For questions, contact <a href="mailto:admin@stageworkstudio.com" style="color:#c9a36a;text-decoration:none;">admin@stageworkstudio.com</a></p>
    </div>
  `;

  let applicantSend = await sendResend({
    to: email,
    subject: applicantSubject,
    text: applicantText,
    html: applicantHtml,
    replyTo: 'admin@stageworkstudio.com',
  });

  if (applicantSend.emailed) {
    record.requesterEmailed = true;
    await writeTrialState(state);
  } else if (applicantSend.error && applicantSend.error.includes('pedditiram@gmail.com')) {
    // Sandbox preview copy to admin
    await sendResend({
      to: 'pedditiram@gmail.com',
      subject: `[Applicant Auto-Reply Preview: ${email}] ${applicantSubject}`,
      text: `[Auto-Reply preview for ${email}]\n\n` + applicantText,
      html: `<div style="background:#1e1b18;padding:12px;border-left:4px solid #c9a36a;margin-bottom:14px;font-family:sans-serif;font-size:12px;color:#f4ecde;">` +
            `<strong>Auto-Reply Preview for ${escapeHtml(email)}</strong><br>` +
            `Configure Titan SMTP (<code>SPS_SMTP_PASS</code>) or verify <strong>stageworkstudio.com</strong> at <a href="https://resend.com/domains" style="color:#38bdf8;">resend.com/domains</a> to deliver directly to applicant's inbox.` +
            `</div>` + applicantHtml,
      replyTo: 'admin@stageworkstudio.com',
    });
  }

  return res.status(200).json({
    success: true,
    queued: true,
    emailed: Boolean(ownerSend.emailed),
    configured: Boolean(ownerSend.configured),
    durable: wrote.durable,
    backend: wrote.backend || backend,
    message: 'Your desktop trial request has been received. Our studio administration (admin@stageworkstudio.com) will review your application and issue your personal download link.',
  });
}

async function decide(req, res, body, status) {
  if (!isSaasAdmin(body.actor)) {
    return res.status(403).json({ success: false, error: 'Only the studio admin can approve or deny trial requests.' });
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
      subject: 'Stage Work Studio — desktop trial not approved',
      text: `Hi${row.name ? ` ${row.name}` : ''},\n\nThe studio admin did not approve a desktop trial for ${row.email} at this time. You can request again later or write ${adminInbox()}.\n\n— Stage Work Studio`,
      html: `<p>Hi${row.name ? ` ${escapeHtml(row.name)}` : ''},</p><p>The studio admin did not approve a desktop trial for ${escapeHtml(row.email)} at this time.</p><p>— Stage Work Studio</p>`,
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
  if (!isSaasAdmin(body.actor)) {
    return res.status(403).json({ success: false, error: 'Only the studio admin can resend download mail.' });
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
  const gatekeeper =
    'macOS may warn because the build is unsigned until a Developer ID cert is used. Right-click the app → Open, or run: xattr -cr "/Applications/Stage Work Studio.app"';
  const missing = releaseReady
    ? ''
    : '\n\nThe owner has not set SPS_DESKTOP_RELEASE_URL yet. The tokenized link will work after they paste a GitHub Release (or other HTTPS) URL in Settings → SaaS.';
  return sendResend({
    to: row.email,
    subject: 'Stage Work Studio — your desktop trial is approved',
    text: `Hi${row.name ? ` ${row.name}` : ''},\n\nYour desktop trial was approved. Sign in with this same email (${row.email}) after install. Cloud is the license authority — the app does not control your computer or delete your files.\n\nDownload (this link is personal; do not share):\n${downloadUrl}\n\n${gatekeeper}${missing}\n\n— Stage Work Studio`,
    html: `<p>Hi${row.name ? ` ${escapeHtml(row.name)}` : ''},</p>
      <p>Your desktop trial was approved. Sign in with <strong>${escapeHtml(row.email)}</strong> after install. Cloud is the license authority; the app never controls your computer or deletes your files.</p>
      <p><a href="${escapeHtml(downloadUrl)}">Download Stage Work Studio (desktop trial)</a></p>
      <p style="font-size:13px;color:#555;">macOS may warn on an unsigned build. Right-click → Open, or <code>xattr -cr</code> the app.</p>
      ${releaseReady ? '' : '<p>The owner still needs to set the GitHub Release URL; the tokenized link activates after that.</p>'}
      <p>— Stage Work Studio</p>`,
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
