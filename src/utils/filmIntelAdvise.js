/**
 * Film Intel LLM Advise — read-only suggestions from a compact snapshot.
 * Never mutates Matrix / Writer; user must Apply elsewhere explicitly.
 */

import { fetchGeminiContent } from '../services/aiScriptParser';
import { resolveLlmApiKey } from './saasControl';

function compactSnapshot(intel) {
  return {
    title: intel?.projectTitle || '',
    score: intel?.filmHealth?.score,
    grade: intel?.filmHealth?.grade,
    dimensions: intel?.filmHealth?.dimensions || [],
    runtimeMin: intel?.runtime?.minutes,
    liveShots: intel?.stats?.liveShots,
    topCharacters: (intel?.characters || []).slice(0, 8).map((c) => ({
      name: c.name,
      sec: c.sec,
      sharePct: c.sharePct,
      shots: c.shotCount
    })),
    qualityIssues: (intel?.quality?.issues || []).slice(0, 10),
    marks: (intel?.marks || []).slice(0, 12).map((m) => ({
      shotId: m.shotId,
      severity: m.severity,
      message: m.message
    })),
    craftFillPct: intel?.quality?.craftFill?.pct,
    writerGrade: intel?.screenplay?.readiness?.grade
  };
}

function parseAdviseJson(text) {
  const raw = String(text || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ ok: boolean, suggestions?: array, summary?: string, message?: string }>}
 */
export async function adviseFilmIntelWithLlm(intel, { signal } = {}) {
  const provider =
    (typeof window !== 'undefined' && localStorage.getItem('sps_llm_provider')) || 'google_gemini';
  const apiKey = resolveLlmApiKey(provider) || resolveLlmApiKey('google_gemini');
  if (!apiKey) {
    return {
      ok: false,
      message: 'Add a BYOK LLM key in Settings → API keys to use Film Intel Advise.'
    };
  }

  const snap = compactSnapshot(intel);
  const prompt = `You are Film Intel for Stage Work Studio (Cinema Production OS).
Advise on craft health — continuity, coverage, craft fill, balance — NOT artistic taste scores.
Return ONLY JSON:
{
  "summary": "2-3 sentence craft diagnosis",
  "suggestions": [
    {
      "title": "short fix title",
      "detail": "specific actionable note citing shot ids when possible",
      "severity": "block|warn|info",
      "actionLabel": "what director should do"
    }
  ]
}
Max 6 suggestions. Prefer concrete Matrix/Writer fixes. Do not invent shots not in the snapshot.

SNAPSHOT:
${JSON.stringify(snap)}`;

  try {
    const res = await fetchGeminiContent(
      apiKey,
      prompt,
      { temperature: 0.35, maxOutputTokens: 1200 },
      { context: 'Film Intel Advise', signal }
    );
    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';
    const parsed = parseAdviseJson(text);
    if (!parsed || !Array.isArray(parsed.suggestions)) {
      return { ok: false, message: 'LLM returned no parseable Film Intel suggestions.' };
    }
    const suggestions = parsed.suggestions.slice(0, 6).map((s, i) => ({
      id: `llm_${i}_${String(s.title || 'note')
        .slice(0, 24)
        .replace(/\W+/g, '_')}`,
      priority: 100 + i,
      severity: ['block', 'warn', 'info'].includes(s.severity) ? s.severity : 'info',
      title: String(s.title || 'LLM note').slice(0, 120),
      detail: String(s.detail || '').slice(0, 400),
      actionLabel: String(s.actionLabel || 'Review').slice(0, 40),
      target: { type: 'quality' },
      source: 'llm'
    }));
    return {
      ok: true,
      summary: String(parsed.summary || '').slice(0, 500),
      suggestions
    };
  } catch (err) {
    return {
      ok: false,
      message: err?.message || 'Film Intel Advise failed.'
    };
  }
}
