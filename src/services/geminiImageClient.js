/**
 * Gemini image generation for Pitch stills.
 * Default: Gemini 3.6 Flash Image. Result is returned as a data URL for local disk save.
 * BYOK Google key only — never posted to Stage Work Studio backends.
 */

import { resolveLlmApiKey } from '../utils/saasControl';
import { fetchWithTimeout } from './aiScriptParser';

export const GEMINI_PITCH_IMAGE_DEFAULT = 'gemini-3.6-flash-image';

export const GEMINI_PITCH_IMAGE_CHAIN = Object.freeze([
  'gemini-3.6-flash-image',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
  'gemini-3.1-flash-lite-image',
  'gemini-2.5-flash-image'
]);

function readPreferredImageModel() {
  if (typeof window === 'undefined') return GEMINI_PITCH_IMAGE_DEFAULT;
  try {
    const raw = String(localStorage.getItem('sps_google_image_model') || '').trim();
    if (raw === 'gemini-3.6-flash' || raw === 'gemini_36_flash' || raw === 'google_gemini_nano') {
      return GEMINI_PITCH_IMAGE_DEFAULT;
    }
    if (GEMINI_PITCH_IMAGE_CHAIN.includes(raw) || raw.startsWith('gemini-3.6')) {
      return raw.endsWith('-image') || raw.includes('imagen') ? raw : GEMINI_PITCH_IMAGE_DEFAULT;
    }
    if (raw.startsWith('imagen-') || raw.includes('flash-image') || raw.includes('pro-image')) return raw;
  } catch {
    /* ignore */
  }
  return GEMINI_PITCH_IMAGE_DEFAULT;
}

export function geminiPitchImageModel() {
  return readPreferredImageModel() || GEMINI_PITCH_IMAGE_DEFAULT;
}

export function geminiImageAspect(format) {
  const r = String(format?.ratio || format || '16:9');
  if (/9:16|9\/16/.test(r) || (format?.cy && format.cx && format.cy > format.cx)) return '9:16';
  if (/1:1/.test(r)) return '1:1';
  if (/4:3|4\/3/.test(r)) return '4:3';
  if (/3:4|3\/4/.test(r) || /210:297|8\.5:11/.test(r)) return '3:4';
  return '16:9';
}

function googleKey() {
  return (
    resolveLlmApiKey('google_gemini') ||
    (typeof window !== 'undefined' ? String(localStorage.getItem('sps_api_key') || '').trim() : '')
  );
}

function extractInlineImage(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  for (const part of parts) {
    const inline = part?.inlineData || part?.inline_data;
    const b64 = inline?.data;
    const mime = inline?.mimeType || inline?.mime_type || 'image/png';
    if (b64) return `data:${mime};base64,${b64}`;
  }
  return '';
}

export async function generateGeminiPitchStill({
  prompt = '',
  aspectRatio = '16:9',
  signal
} = {}) {
  const key = googleKey();
  if (!key) {
    throw new Error('Add a Google Gemini key in Settings → API keys (BYOK). Stills stay on this disk.');
  }
  const text = String(prompt || '').trim();
  if (!text) throw new Error('Still prompt is empty.');

  const preferred = geminiPitchImageModel();
  const chain = [preferred, ...GEMINI_PITCH_IMAGE_CHAIN.filter((m) => m !== preferred)];
  let lastError = '';

  for (const modelId of chain) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(key)}`;
    const body = {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: aspectRatio || '16:9' }
      }
    };
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
      }, 90000);
      if (res.status === 404) {
        lastError = `${modelId} unavailable`;
        continue;
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastError = errText.slice(0, 240) || `Gemini image ${res.status}`;
        if (res.status === 401 || res.status === 403 || res.status === 429) break;
        continue;
      }
      const data = await res.json();
      const dataUrl = extractInlineImage(data);
      if (dataUrl) return { dataUrl, modelId };
      lastError = 'Gemini returned no image bytes.';
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      lastError = err?.message || String(err);
    }
  }
  throw new Error(lastError || 'Gemini 3.6 image generation failed.');
}
