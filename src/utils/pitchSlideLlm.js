/**
 * Gemini 3.6 Flash (High) rewrites a pitch slide from project facts.
 * Advisor only: never invent box office, deals, budgets, or attached talent.
 */

import { fetchGeminiContent, extractGeminiResponseText, safeParseJsonObject } from '../services/aiScriptParser';
import { resolveLlmApiKey } from './saasControl';

function googleKey() {
  return (
    resolveLlmApiKey('google_gemini') ||
    (typeof window !== 'undefined' ? String(localStorage.getItem('sps_api_key') || '').trim() : '')
  );
}

export async function polishPitchSlideWithGemini({ slide, facts, logline = '' } = {}) {
  const key = googleKey();
  if (!key) {
    throw new Error('Add a Google Gemini key in Settings → API keys. Copy stays on this machine.');
  }
  const prompt = [
    'You are a film-pitch editor inside Stage Work Studio.',
    'Rewrite ONE Keynote-style slide from the JSON facts only.',
    'Rules:',
    '- Do not invent box office, budgets, attached talent, distributors, or dates.',
    '- Empty facts stay the exact label DATA REQUIRED (or UNKNOWN / TARGET / PROPOSED if already labeled).',
    '- Keep the same slide purpose. Tighten language. Film grammar, not startup-deck hype.',
    '- Return JSON only: { "kicker": "", "title": "", "subtitle": "", "points": [""] }',
    '',
    `Logline: ${logline || 'DATA REQUIRED'}`,
    `Slide: ${JSON.stringify({
      id: slide?.id,
      kicker: slide?.kicker,
      title: slide?.title,
      subtitle: slide?.subtitle,
      points: slide?.points || []
    })}`,
    `Facts: ${JSON.stringify({
      title: facts?.title,
      genre: facts?.genreLabel,
      language: facts?.language,
      format: facts?.format,
      synopsis: facts?.synopsis,
      characters: (facts?.characters || []).map((c) => ({
        name: c.name,
        role: c.role,
        status: c.status
      })),
      crew: facts?.crew || [],
      merch: facts?.merchandise || [],
      territories: facts?.territories || [],
      world: facts?.worldLines,
      liveShotCount: facts?.liveShotCount,
      budget: facts?.budgetTotal,
      ask: facts?.investmentAsk
    })}`
  ].join('\n');

  const res = await fetchGeminiContent(key, prompt, { maxOutputTokens: 2048 }, {
    provider: 'google_gemini_36_high',
    context: 'Pitch polish'
  });
  const data = await res.json();
  const parsed = safeParseJsonObject(extractGeminiResponseText(data));
  if (!parsed) throw new Error('Gemini did not return slide JSON.');
  return {
    kicker: String(parsed.kicker || slide.kicker || '').trim(),
    title: String(parsed.title || slide.title || '').trim(),
    subtitle: String(parsed.subtitle || '').trim(),
    points: Array.isArray(parsed.points) ? parsed.points.map((p) => String(p || '').trim()).filter(Boolean) : slide.points
  };
}
