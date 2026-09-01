import { checkServerRate, consumeServerCredits, getOrCreateRow } from './_saasLedger.js';

const DEFAULT_HOST = 'https://ark.ap-southeast.bytepluses.com/api/v3';
const DEFAULT_VIDEO_MODEL = 'seedance-1-0-pro-250528';
const VIDEO_CREDIT_COST = 2;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function hostBase(endpointUrl) {
  return String(endpointUrl || DEFAULT_HOST).replace(/\/$/, '');
}

function pickVideoUrl(data) {
  return (
    data?.content?.video_url ||
    data?.video_url ||
    data?.output?.video_url ||
    data?.data?.content?.video_url ||
    data?.data?.[0]?.url ||
    ''
  );
}

function pickTaskId(data) {
  return data?.id || data?.task_id || data?.data?.id || data?.data?.task_id || '';
}

function parseQuery(req) {
  if (req.query && (req.query.taskId || req.query.action)) return req.query;
  try {
    return Object.fromEntries(new URL(req.url || '', 'http://localhost').searchParams);
  } catch {
    return {};
  }
}

async function resolveCreateAuth(reqBody, res) {
  const { apiKey: clientKey, managed, email } = reqBody || {};
  let apiKey = String(clientKey || '').trim();
  const isManaged = managed === true || managed === 'true';
  let remainingCredits;

  if (isManaged) {
    const user = String(email || '').trim().toLowerCase();
    if (!user) {
      res.status(400).json({ success: false, error: 'Account email required for managed generate.' });
      return null;
    }
    const { row } = getOrCreateRow(user);
    if (row.status === 'DISABLED' || row.status === 'REVOKED') {
      res.status(403).json({ success: false, error: 'License revoked.' });
      return null;
    }
    const rate = checkServerRate(user, row.plan);
    if (!rate.ok) {
      res.status(429).json({ success: false, error: `Rate limit ${rate.max}/min. Wait ${rate.waitSec}s.` });
      return null;
    }
    const used = consumeServerCredits(user, VIDEO_CREDIT_COST);
    if (!used.ok) {
      res.status(402).json({ success: false, error: used.error || 'No managed credits' });
      return null;
    }
    remainingCredits = used.credits;
    apiKey = String(process.env.SPS_BYTEPLUS_API_KEY || process.env.BYTEPLUS_API_KEY || '').trim();
    if (!apiKey) {
      res.status(503).json({
        success: false,
        error: 'Studio BytePlus key is not configured (SPS_BYTEPLUS_API_KEY). Use BYOK until then.',
      });
      return null;
    }
  } else if (!apiKey) {
    res.status(400).json({
      success: false,
      error: 'BytePlus API key is required. Add it in Settings → API keys (BYOK).',
    });
    return null;
  }

  return { apiKey, isManaged, remainingCredits };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const query = parseQuery(req);
    const action = String((req.body && req.body.action) || query.action || '').toLowerCase();
    const taskIdIn = String((req.body && req.body.taskId) || query.taskId || '').trim();
    const wantsStatus = req.method === 'GET' || action === 'status' || (taskIdIn && action !== 'create');

    if (wantsStatus) {
      if (!taskIdIn) {
        return res.status(400).json({ success: false, error: 'taskId required.' });
      }
      const key = String(
        (req.body && req.body.apiKey) ||
          process.env.SPS_BYTEPLUS_API_KEY ||
          process.env.BYTEPLUS_API_KEY ||
          ''
      ).trim();
      if (!key) {
        return res.status(400).json({ success: false, error: 'API key required to poll.' });
      }
      const endpointUrl = (req.body && req.body.endpointUrl) || query.endpointUrl;
      const url = `${hostBase(endpointUrl)}/contents/generations/tasks/${encodeURIComponent(taskIdIn)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: data.error?.message || data.message || `Poll failed (${response.status})`,
        });
      }
      const status = String(data.status || data.data?.status || '').toLowerCase();
      const videoUrl = pickVideoUrl(data);
      return res.status(200).json({
        success: true,
        taskId: taskIdIn,
        status: status || 'unknown',
        url: videoUrl || undefined,
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const auth = await resolveCreateAuth(req.body, res);
    if (!auth) return;

    const { prompt, firstFrameUrl, duration = 5, ratio = '16:9', modelId, endpointUrl } = req.body || {};
    const text = String(prompt || '').trim();
    if (!text) {
      return res.status(400).json({ success: false, error: 'Prompt required.' });
    }

    const model = String(modelId || '').trim() || DEFAULT_VIDEO_MODEL;
    const sec = Math.min(12, Math.max(4, Number(duration) || 5));
    const content = [{ type: 'text', text: text.slice(0, 2500) }];
    const frame = String(firstFrameUrl || '').trim();
    if (frame.startsWith('http')) {
      content.push({
        type: 'image_url',
        image_url: { url: frame },
        role: 'first_frame',
      });
    }

    const response = await fetch(`${hostBase(endpointUrl)}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        content,
        duration: sec,
        ratio: String(ratio || '16:9'),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || data.message || JSON.stringify(data).slice(0, 400),
      });
    }

    const taskId = pickTaskId(data);
    if (!taskId) {
      return res.status(502).json({ success: false, error: 'BytePlus did not return a task id.' });
    }

    return res.status(200).json({
      success: true,
      taskId,
      status: data.status || 'queued',
      managed: auth.isManaged,
      credits: auth.remainingCredits,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
