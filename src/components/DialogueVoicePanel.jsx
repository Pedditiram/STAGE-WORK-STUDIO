import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import {
  enforceTeluguOnly,
  hasTeluguScript,
  teluguFromSpeechResult
} from '../utils/teluguVoiceText';

const DEFAULT_VOICE = {
  rate: 1,
  pitch: 1,
  volume: 1,
  warmth: 0.45,
  breath: 0.25,
  clarity: 0.7,
  energy: 0.55
};

const SLIDERS = [
  { key: 'rate', label: 'Speed', min: 0.5, max: 1.8, step: 0.05 },
  { key: 'pitch', label: 'Pitch', min: 0.5, max: 1.8, step: 0.05 },
  { key: 'volume', label: 'Volume', min: 0.2, max: 1, step: 0.05 },
  { key: 'warmth', label: 'Warmth', min: 0, max: 1, step: 0.05 },
  { key: 'breath', label: 'Breath', min: 0, max: 1, step: 0.05 },
  { key: 'clarity', label: 'Clarity', min: 0, max: 1, step: 0.05 },
  { key: 'energy', label: 'Energy', min: 0, max: 1, step: 0.05 }
];

function normalizeVoice(raw) {
  const base = { ...DEFAULT_VOICE, ...(raw && typeof raw === 'object' ? raw : {}) };
  for (const s of SLIDERS) {
    const n = Number(base[s.key]);
    base[s.key] = Number.isFinite(n) ? Math.min(s.max, Math.max(s.min, n)) : DEFAULT_VOICE[s.key];
  }
  return base;
}

function VoiceGraph({ voice }) {
  const bars = SLIDERS.map((s) => {
    const v = Number(voice[s.key] ?? DEFAULT_VOICE[s.key]);
    const t = (v - s.min) / (s.max - s.min);
    return { key: s.key, label: s.label, t: Math.min(1, Math.max(0, t)) };
  });
  return (
    <div
      className="flex items-end gap-1.5 h-14 px-2 py-1 rounded-lg border border-[var(--sps-border)] bg-[var(--sps-bg)]"
      aria-hidden
    >
      {bars.map((b) => (
        <div key={b.key} className="flex-1 flex flex-col items-center gap-0.5 min-w-0 h-full justify-end">
          <div
            className="w-full max-w-[14px] rounded-t-sm"
            style={{
              height: `${Math.max(8, b.t * 100)}%`,
              background: 'linear-gradient(180deg, var(--sps-gold), color-mix(in srgb, var(--sps-gold) 35%, var(--sps-text)))'
            }}
            title={`${b.label}`}
          />
          <span className="text-[7px] uppercase tracking-wider truncate w-full text-center" style={{ color: 'var(--sps-muted)' }}>
            {b.label.slice(0, 3)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Dialogue craft: Telugu / English voice → text, plus human-voice character graph.
 */
export default function DialogueVoicePanel({
  value = '',
  onChange,
  voiceProfile = null,
  onVoiceProfileChange,
  readOnly = false
}) {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem('sps_dialogue_voice_lang');
      if (saved === 'te-IN' || saved === 'en-IN') return saved;
    } catch {
      /* ignore */
    }
    return hasTeluguScript(value) ? 'te-IN' : 'en-IN';
  });
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const voice = normalizeVoice(voiceProfile);
  const recognitionRef = useRef(null);
  const baseRef = useRef({ text: String(value || ''), caret: String(value || '').length });
  const interimRef = useRef('');
  const langRef = useRef(lang);
  const valueRef = useRef(value);
  valueRef.current = value;
  langRef.current = lang;

  const patchVoice = useCallback(
    (key, raw) => {
      if (readOnly || typeof onVoiceProfileChange !== 'function') return;
      const next = normalizeVoice({ ...voice, [key]: Number(raw) });
      onVoiceProfileChange(next);
    },
    [onVoiceProfileChange, readOnly, voice]
  );

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    try {
      rec?.stop?.();
      rec?.abort?.();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const insertSpoken = useCallback(
    (spoken) => {
      const text = String(spoken || '').trim();
      if (!text) return;
      const base = baseRef.current;
      const before = base.text.slice(0, base.caret);
      const after = base.text.slice(base.caret);
      const needsSpace =
        before && !/\s$/.test(before) && !/[\u0C00-\u0C7F]$/.test(before);
      const next = `${before}${needsSpace ? ' ' : ''}${text}${after}`;
      const caret = before.length + (needsSpace ? 1 : 0) + text.length;
      baseRef.current = { text: next, caret };
      interimRef.current = '';
      onChange?.(next);
    },
    [onChange]
  );

  const start = useCallback(() => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setStatus('Voice needs Chrome, Edge, or Safari with speech support');
      return;
    }
    if (readOnly) return;
    stop();
    const current = String(valueRef.current || '');
    baseRef.current = { text: current, caret: current.length };
    interimRef.current = '';
    const rec = new SR();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = langRef.current;
    rec.maxAlternatives = langRef.current === 'te-IN' ? 5 : 1;

    rec.onstart = () => {
      setListening(true);
      setStatus(langRef.current === 'te-IN' ? 'తెలుగు వినడం…' : 'Listening (English)…');
    };
    rec.onerror = (ev) => {
      const code = ev?.error || 'error';
      if (code === 'not-allowed') setStatus('Microphone blocked — allow mic access');
      else if (code === 'no-speech') setStatus('No speech heard — try again');
      else setStatus(`Voice: ${code}`);
      setListening(false);
    };
    rec.onend = () => {
      if (recognitionRef.current === rec) {
        try {
          rec.lang = langRef.current;
          rec.start();
        } catch {
          setListening(false);
          recognitionRef.current = null;
        }
      }
    };
    rec.onresult = (event) => {
      const teMode = langRef.current === 'te-IN';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const r = event.results[i];
        if (!r.isFinal) continue;
        finalChunk += teMode ? teluguFromSpeechResult(r) : String(r?.[0]?.transcript || '');
      }
      if (!finalChunk) return;
      const spoken = teMode ? enforceTeluguOnly(finalChunk) : finalChunk.trim();
      if (spoken) {
        insertSpoken(spoken);
        setStatus(teMode ? 'తెలుగు typed · keep speaking' : 'Captured · keep speaking');
      } else if (teMode) {
        setStatus('తెలుగులో మాట్లాడండి — English skipped');
      }
    };

    try {
      rec.start();
    } catch (err) {
      setStatus(err?.message || 'Could not start microphone');
      setListening(false);
    }
  }, [insertSpoken, readOnly, stop]);

  useEffect(() => () => stop(), [stop]);

  const persistLang = (next) => {
    setLang(next);
    langRef.current = next;
    try {
      localStorage.setItem('sps_dialogue_voice_lang', next);
    } catch {
      /* ignore */
    }
    if (listening) {
      stop();
      window.setTimeout(() => start(), 80);
    }
  };

  const previewSpeech = () => {
    const text = String(value || '').trim();
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
      setStatus('Nothing to preview');
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = voice.rate;
      u.pitch = voice.pitch;
      u.volume = voice.volume;
      window.speechSynthesis.speak(u);
      setStatus('Preview playing…');
    } catch {
      setStatus('Preview unavailable');
    }
  };

  return (
    <div className="space-y-2 p-3 rounded-[10px] border border-[var(--sps-border)] bg-[var(--sps-bg)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sps-muted)' }}>
          Dialogue voice
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`sps-btn sps-btn-compact ${lang === 'en-IN' ? 'sps-btn-primary' : ''}`}
            disabled={readOnly}
            onClick={() => persistLang('en-IN')}
          >
            EN
          </button>
          <button
            type="button"
            className={`sps-btn sps-btn-compact ${lang === 'te-IN' ? 'sps-btn-primary' : ''}`}
            disabled={readOnly}
            onClick={() => persistLang('te-IN')}
          >
            TE
          </button>
          <button
            type="button"
            className={`sps-btn sps-btn-compact ${listening ? 'sps-btn-primary' : ''}`}
            disabled={readOnly}
            onClick={() => (listening ? stop() : start())}
            title={listening ? 'Stop voice' : 'Voice to text'}
          >
            {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {listening ? 'Stop' : 'Voice'}
          </button>
          <button type="button" className="sps-btn sps-btn-compact" onClick={previewSpeech} title="Preview voice character">
            <Volume2 className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>
      </div>
      {status ? (
        <p className="text-[10px] m-0 font-mono" style={{ color: 'var(--sps-muted)' }}>
          {status}
        </p>
      ) : null}

      <VoiceGraph voice={voice} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SLIDERS.map((s) => (
          <label key={s.key} className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[9px] uppercase tracking-wider flex justify-between gap-2" style={{ color: 'var(--sps-muted)' }}>
              <span>{s.label}</span>
              <span className="tabular-nums">{Number(voice[s.key]).toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={voice[s.key]}
              disabled={readOnly}
              onChange={(e) => patchVoice(s.key, e.target.value)}
              className="w-full accent-[var(--sps-gold)]"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
