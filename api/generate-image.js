export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { apiKey, endpointUrl, modelId, prompt, width = 1280, height = 720 } = req.body || {};

    if (!apiKey) {
      return res.status(400).json({ error: 'BytePlus API key is required. Please add it in Admin Settings.' });
    }

    const hostBase = (endpointUrl || 'https://ark.ap-southeast.bytepluses.com/api/v3').replace(/\/$/, '');
    const model = modelId || 'seed-2-0-pro-260328';

    const endpointsToTry = [
      `${hostBase}/images/generations`,
      `https://ark.cn-beijing.volces.com/api/v3/images/generations`,
      `https://ark.ap-southeast.bytepluses.com/api/v3/images/generations`,
      `${hostBase}/responses`
    ];

    let lastError = null;

    for (const url of endpointsToTry) {
      try {
        const isResponses = url.endsWith('/responses');
        const headers = {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'ark-beta-mcp': 'true'
        };

        const body = isResponses ? {
          model: model,
          input: [{
            role: 'user',
            content: [{ type: 'input_text', text: `Generate 8k cinematic film still: ${prompt}` }]
          }]
        } : {
          model: model,
          prompt: prompt,
          size: `${width}x${height}`,
          width: width,
          height: height,
          response_format: 'url'
        };

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        if (response.ok) {
          const data = await response.json();
          let imageUrl = data?.data?.[0]?.url || data?.url || data?.image_url || data?.output?.[0]?.content?.[0]?.text || '';
          
          if (imageUrl && !imageUrl.startsWith('http')) {
            const match = imageUrl.match(/https?:\/\/[^\s"']+/);
            if (match) imageUrl = match[0];
          }

          if (imageUrl && imageUrl.startsWith('http')) {
            return res.status(200).json({ success: true, url: imageUrl, endpointUsed: url });
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
      error: `BytePlus API call failed across endpoints. Last error: ${lastError || 'Invalid response'}`
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
