import { checkServerRate, consumeServerCredits, getOrCreateRow } from './_saasLedger.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      apiKey: clientKey,
      endpointUrl,
      modelId,
      prompt,
      width = 1280,
      height = 720,
      managed,
      email,
    } = req.body || {};

    let apiKey = String(clientKey || '').trim();
    const isManaged = managed === true || managed === 'true';
    let remainingCredits;

    if (isManaged) {
      const user = String(email || '').trim().toLowerCase();
      if (!user) {
        return res.status(400).json({ success: false, error: 'Account email required for managed generate.' });
      }
      const { row } = getOrCreateRow(user);
      if (row.status === 'DISABLED' || row.status === 'REVOKED') {
        return res.status(403).json({ success: false, error: 'License revoked.' });
      }
      const rate = checkServerRate(user, row.plan);
      if (!rate.ok) {
        return res.status(429).json({ success: false, error: `Rate limit ${rate.max}/min. Wait ${rate.waitSec}s.` });
      }
      const used = consumeServerCredits(user, 1);
      if (!used.ok) {
        return res.status(402).json({ success: false, error: used.error || 'No managed credits' });
      }
      remainingCredits = used.credits;
      apiKey = String(process.env.SPS_BYTEPLUS_API_KEY || process.env.BYTEPLUS_API_KEY || '').trim();
      if (!apiKey) {
        return res.status(503).json({
          success: false,
          error: 'Studio BytePlus key is not configured (SPS_BYTEPLUS_API_KEY). Use BYOK until then.',
        });
      }
    } else if (!apiKey) {
      return res.status(400).json({ error: 'BytePlus API key is required. Add it in Settings → API keys (BYOK).' });
    }

    const hostBase = (endpointUrl || 'https://ark.ap-southeast.bytepluses.com/api/v3').replace(/\/$/, '');
    const model = modelId || 'seed-2-0-pro-260328';

    const endpointsToTry = [
      `${hostBase}/images/generations`,
      `https://ark.cn-beijing.volces.com/api/v3/images/generations`,
      `https://ark.ap-southeast.bytepluses.com/api/v3/images/generations`,
      `${hostBase}/responses`,
    ];

    let lastError = null;

    for (const url of endpointsToTry) {
      try {
        const isResponses = url.endsWith('/responses');
        const headers = {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'ark-beta-mcp': 'true',
        };

        const body = isResponses
          ? {
              model,
              input: [{
                role: 'user',
                content: [{ type: 'input_text', text: `Generate 8k cinematic film still: ${prompt}` }],
              }],
            }
          : {
              model,
              prompt,
              size: `${width}x${height}`,
              width,
              height,
              response_format: 'url',
            };

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const data = await response.json();
          let imageUrl = data?.data?.[0]?.url || data?.url || data?.image_url || data?.output?.[0]?.content?.[0]?.text || '';

          if (imageUrl && !imageUrl.startsWith('http')) {
            const match = imageUrl.match(/https?:\/\/[^\s"']+/);
            if (match) imageUrl = match[0];
          }

          if (imageUrl && imageUrl.startsWith('http')) {
            return res.status(200).json({
              success: true,
              url: imageUrl,
              endpointUsed: url,
              managed: isManaged,
              credits: remainingCredits,
            });
          }
        } else {
          lastError = await response.text();
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    return res.status(400).json({
      success: false,
      error: `BytePlus API call failed across endpoints. Last error: ${lastError || 'Invalid response'}`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
