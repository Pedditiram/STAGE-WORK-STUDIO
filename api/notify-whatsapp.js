/**
 * WhatsApp online alerts for Stage Work Studio collaborators (opt-in).
 *
 * Recipients are loaded from the cloud collaborator list — only users with
 * whatsappNotify=true and a phone number are messaged. The arriving user is skipped.
 *
 * Env (Meta Cloud API — preferred):
 *   SPS_WHATSAPP_TOKEN          Graph API access token
 *   SPS_WHATSAPP_PHONE_NUMBER_ID
 *   SPS_WHATSAPP_TEMPLATE       optional approved template name (default: none → session text)
 *   SPS_WHATSAPP_TEMPLATE_LANG  default en
 *
 * Env (Twilio WhatsApp — fallback):
 *   SPS_TWILIO_ACCOUNT_SID
 *   SPS_TWILIO_AUTH_TOKEN
 *   SPS_TWILIO_WHATSAPP_FROM    e.g. whatsapp:+14155238886
 */

const JSONBLOB_COLLABORATORS_URL = 'https://jsonblob.com/api/jsonBlob/019ff13d-79e0-75d9-9312-53b71c76be18';
const COOLDOWN_MS = 20 * 60 * 1000;
const lastSent = new Map(); // `${fromEmail}::${toPhone}` -> ts

function metaConfigured() {
  return Boolean(process.env.SPS_WHATSAPP_TOKEN && process.env.SPS_WHATSAPP_PHONE_NUMBER_ID);
}

function twilioConfigured() {
  return Boolean(
    process.env.SPS_TWILIO_ACCOUNT_SID &&
      process.env.SPS_TWILIO_AUTH_TOKEN &&
      process.env.SPS_TWILIO_WHATSAPP_FROM
  );
}

function smsFrom() {
  return String(process.env.SPS_TWILIO_SMS_FROM || process.env.SPS_TWILIO_FROM || '').trim();
}

function smsConfigured() {
  return Boolean(process.env.SPS_TWILIO_ACCOUNT_SID && process.env.SPS_TWILIO_AUTH_TOKEN && smsFrom());
}

function isConfigured() {
  return metaConfigured() || twilioConfigured() || smsConfigured();
}

function toE164(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const digits = s.replace(/[^\d+]/g, '');
  if (digits.startsWith('+') && digits.length >= 11) return digits;
  const only = digits.replace(/\D/g, '');
  if (only.length === 10) return `+91${only}`;
  if (only.length === 12 && only.startsWith('91')) return `+${only}`;
  if (only.length >= 11) return `+${only}`;
  return '';
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

async function loadCollaborators() {
  try {
    const res = await fetch(`${JSONBLOB_COLLABORATORS_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const users = data?.users || data?.data?.users || [];
    return Array.isArray(users) ? users : [];
  } catch (e) {
    return [];
  }
}

function buildBody({ userName, userEmail, projectTitle, roomId }) {
  const who = userName || userEmail || 'A collaborator';
  const room = roomId || 'studio';
  const project = projectTitle || 'Stage Work Studio';
  return `Stage Work Studio — ${who} is online now.\nProject: ${project}\nRoom: ${room}`;
}

async function sendMeta(toE164Num, text, templateParams) {
  const phoneId = process.env.SPS_WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.SPS_WHATSAPP_TOKEN;
  const template = String(process.env.SPS_WHATSAPP_TEMPLATE || '').trim();
  const lang = process.env.SPS_WHATSAPP_TEMPLATE_LANG || 'en';
  const to = toE164Num.replace(/^\+/, '');
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  if (template) {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: lang },
          components: [
            {
              type: 'body',
              parameters: templateParams.map((t) => ({ type: 'text', text: String(t).slice(0, 1024) }))
            }
          ]
        }
      })
    });
    return res.ok;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text.slice(0, 1024) }
    })
  });
  return res.ok;
}

async function sendSms(toE164Num, text) {
  const sid = process.env.SPS_TWILIO_ACCOUNT_SID;
  const token = process.env.SPS_TWILIO_AUTH_TOKEN;
  const from = smsFrom();
  const params = new URLSearchParams({
    From: from,
    To: toE164Num,
    Body: text.slice(0, 1600)
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  return res.ok;
}

async function sendTwilio(toE164Num, text) {
  const sid = process.env.SPS_TWILIO_ACCOUNT_SID;
  const token = process.env.SPS_TWILIO_AUTH_TOKEN;
  const from = process.env.SPS_TWILIO_WHATSAPP_FROM;
  const params = new URLSearchParams({
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    To: `whatsapp:${toE164Num}`,
    Body: text.slice(0, 1600)
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  return res.ok;
}

async function sendOne(toE164Num, text, templateParams) {
  if (smsConfigured()) {
    try {
      if (await sendSms(toE164Num, text)) return true;
    } catch (e) {}
  }
  if (metaConfigured()) {
    try {
      if (await sendMeta(toE164Num, text, templateParams)) return true;
    } catch (e) {}
  }
  if (twilioConfigured()) {
    try {
      return await sendTwilio(toE164Num, text);
    } catch (e) {}
  }
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      held: true,
      configured: false,
      sms: false,
      provider: 'held'
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  return res.status(200).json({
    success: true,
    sent: 0,
    held: true,
    configured: false,
    message: 'SMS / WhatsApp alerts are on hold'
  });

  if (!isConfigured()) {
    return res.status(200).json({
      success: true,
      sent: 0,
      configured: false,
      message: 'SMS / WhatsApp API not configured'
    });
  }

  const body = req.body || {};
  const userEmail = normalizeEmail(body.userEmail);
  const userName = String(body.userName || userEmail.split('@')[0] || 'Collaborator').trim();
  const projectTitle = String(body.projectTitle || 'Stage Work Studio').trim();
  const roomId = String(body.roomId || '').trim();

  const event = String(body.event || 'online').toLowerCase() === 'chat' ? 'chat' : 'online';
  const preview = String(body.preview || '').trim().slice(0, 120);

  if (!userEmail) {
    return res.status(400).json({ success: false, error: 'userEmail required' });
  }

  const users = await loadCollaborators();
  const text =
    event === 'chat'
      ? `Stage Work Studio — ${userName} sent a studio message${preview ? `: ${preview}` : '.'}\nProject: ${projectTitle}\nRoom: ${roomId || 'studio'}`
      : buildBody({ userName, userEmail, projectTitle, roomId });
  const templateParams = [userName, projectTitle, roomId || 'studio'];
  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const u of users) {
    if (!u) continue;
    const opted = event === 'chat' ? u.whatsappChatNotify === true : u.whatsappNotify === true;
    if (!opted) continue;
    const theirEmail = normalizeEmail(u.email);
    if (theirEmail && theirEmail === userEmail) continue;
    const phone = toE164(u.whatsappPhone || u.phone);
    if (!phone) continue;

    const key = `${event}::${userEmail}::${phone}`;
    if (now - (lastSent.get(key) || 0) < COOLDOWN_MS) {
      skipped += 1;
      continue;
    }

    const ok = await sendOne(phone, text, templateParams);
    if (ok) {
      lastSent.set(key, now);
      sent += 1;
    }
  }

  return res.status(200).json({ success: true, configured: true, sent, skipped });
}
