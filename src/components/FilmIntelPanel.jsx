import React, { useEffect, useMemo, useState } from 'react';
import {
  Radar,
  Activity,
  Layers,
  AlertTriangle,
  Gauge,
  Users,
  MapPin,
  Clapperboard,
  RefreshCw,
  Search,
  Sparkles,
  Lightbulb,
  Shirt,
  Package,
  Download,
  Printer,
  Star
} from 'lucide-react';
import { intensityColor } from '../utils/screenplayIntelligence';
import { buildFilmIntel, formatPresenceDuration, searchFilmIntel } from '../utils/filmIntelEngine';
import { adviseFilmIntelWithLlm } from '../utils/filmIntelAdvise';
import { filmIntelToMarkdown, filmIntelToPrintHtml } from '../utils/filmIntelExport';
import { readOpenScreenplayText } from '../utils/screenplayInterop';
import { getActiveCharacterProfiles, getActiveWorldAssets } from '../utils/projectBibleVault';
import { exportDownloadText } from '../utils/exportGate';
import { appendCreativeAudit } from '../utils/creativeAuditLog';
import { proposeContinuityDriftFixes, applyContinuityDriftFixes } from '../utils/continuitySupervisor';
import FilmIntelProgressTab from './FilmIntelProgressTab';
import { lifecycleSummary } from '../utils/productionLifecycle';

/**
 * Film Intel desk — search, quality, suggestions, Writer analysis, Matrix presence.
 */
export default function FilmIntelPanel({
  projectTitle = '',
  shots = [],
  onOpenWriter,
  onJumpToShot,
  onRefresh,
  onUpdateShot,
  onHealBibleSoT,
  compact = false
}) {
  const [deskTab, setDeskTab] = useState('overview');
  const [subTab, setSubTab] = useState('radar');
  const [entityType, setEntityType] = useState('film');
  const [entityKey, setEntityKey] = useState('');
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);
  const [llmBusy, setLlmBusy] = useState(false);
  const [llmSummary, setLlmSummary] = useState('');
  const [llmSuggestions, setLlmSuggestions] = useState([]);
  const [llmError, setLlmError] = useState('');

  useEffect(() => {
    const onScript = () => setTick((n) => n + 1);
    window.addEventListener('sps_screenplay_updated', onScript);
    return () => window.removeEventListener('sps_screenplay_updated', onScript);
  }, []);

  const intel = useMemo(() => {
    const scriptText = readOpenScreenplayText(projectTitle);
    return buildFilmIntel({
      projectTitle,
      shots,
      characters: getActiveCharacterProfiles(),
      worldAssets: getActiveWorldAssets(),
      scriptText,
      entityFilter:
        entityType === 'film'
          ? null
          : { type: entityType, key: entityKey }
    });
  }, [projectTitle, shots, entityType, entityKey, tick]);

  const search = useMemo(() => searchFilmIntel(intel, query), [intel, query]);
  const filmElements = useMemo(() => {
    const index = Array.isArray(intel?.searchIndex) ? intel.searchIndex : [];
    const order = ['shot', 'character', 'world', 'costume', 'prop', 'mark', 'beat', 'flag', 'quality', 'suggestion'];
    const groups = new Map();
    order.forEach((k) => groups.set(k, []));
    index.forEach((row) => {
      const kind = String(row?.kind || 'other');
      if (!groups.has(kind)) groups.set(kind, []);
      groups.get(kind).push(row);
    });
    return order
      .filter((k) => (groups.get(k) || []).length > 0)
      .map((k) => ({ kind: k, items: groups.get(k) }));
  }, [intel]);
  const screenplay = intel.screenplay || {};
  const realScenes = (screenplay.scenes || []).filter((s) => !/^ACT\s+/i.test(s.title));
  const realBeats = (screenplay.beats || []).filter((b) => !/^ACT\s+/i.test(b.title));
  const allSuggestions = useMemo(
    () => [...llmSuggestions, ...(intel.suggestions || [])],
    [llmSuggestions, intel.suggestions]
  );

  const openWriterAt = (offset) => {
    if (typeof offset !== 'number') {
      onOpenWriter?.();
      return;
    }
    onOpenWriter?.({ offset });
  };

  const jumpShot = (index) => {
    if (typeof index !== 'number') return;
    onJumpToShot?.(index);
  };

  const runHit = (hit) => {
    if (!hit) return;
    if (hit.kind === 'character' && hit.entityKey) {
      setEntityType('character');
      setEntityKey(hit.entityKey);
      setDeskTab('overview');
      return;
    }
    if (hit.kind === 'world' && hit.entityKey) {
      setEntityType('world');
      setEntityKey(hit.entityKey);
      setDeskTab('overview');
      return;
    }
    if (hit.kind === 'costume' && hit.entityKey) {
      setEntityType('costume');
      setEntityKey(hit.entityKey);
      setDeskTab('overview');
      return;
    }
    if (hit.kind === 'prop' && hit.entityKey) {
      setEntityType('prop');
      setEntityKey(hit.entityKey);
      setDeskTab('overview');
      return;
    }
    if (typeof hit.offset === 'number') {
      openWriterAt(hit.offset);
      return;
    }
    if (typeof hit.shotIndex === 'number') {
      jumpShot(hit.shotIndex);
      return;
    }
    if (hit.kind === 'quality' || hit.kind === 'suggestion') {
      setDeskTab(hit.kind === 'suggestion' ? 'suggest' : 'quality');
    }
  };

  const runSuggestion = (s) => {
    const t = s?.target || {};
    if (t.type === 'writer' || typeof t.offset === 'number') {
      openWriterAt(t.offset);
      return;
    }
    if (t.type === 'shot' && typeof t.shotIndex === 'number') {
      jumpShot(t.shotIndex);
      return;
    }
    if (t.type === 'character' && t.key) {
      setEntityType('character');
      setEntityKey(t.key);
      setDeskTab('overview');
      return;
    }
    if (t.type === 'costume' && t.key) {
      setEntityType('costume');
      setEntityKey(t.key);
      setDeskTab('overview');
      return;
    }
    if (t.type === 'prop' && t.key) {
      setEntityType('prop');
      setEntityKey(t.key);
      setDeskTab('overview');
      return;
    }
    if (t.type === 'llm') {
      handleAskLlm();
      return;
    }
    setDeskTab('quality');
  };

  const handleAskLlm = async () => {
    setLlmBusy(true);
    setLlmError('');
    try {
      const res = await adviseFilmIntelWithLlm(intel);
      if (!res.ok) {
        setLlmError(res.message || 'Advise failed');
        return;
      }
      setLlmSummary(res.summary || '');
      setLlmSuggestions(res.suggestions || []);
      setDeskTab('suggest');
      appendCreativeAudit({
        projectTitle,
        category: 'film_intel',
        action: 'llm_advise',
        targetType: 'film',
        targetId: projectTitle || 'film',
        targetLabel: 'Film Intel Advise',
        note: `score ${intel.filmHealth?.score ?? 0} · ${(res.suggestions || []).length} suggestions`
      });
    } finally {
      setLlmBusy(false);
    }
  };

  const handleRate = () => {
    const score = intel.filmHealth?.score ?? 0;
    const grade = intel.filmHealth?.grade || 'Draft';
    appendCreativeAudit({
      projectTitle,
      category: 'film_intel',
      action: 'rate',
      targetType: 'film',
      targetId: projectTitle || 'film',
      targetLabel: `Film Health ${score}`,
      note: `Rated ${score} · ${grade} · craft ${intel.quality?.craftFill?.pct ?? 0}% · ${intel.stats?.blockMarks || 0} blocks`
    });
    try {
      window.dispatchEvent(
        new CustomEvent('sps_toast', {
          detail: { message: `Film Intel rated ${score} · ${grade} (saved to audit)` }
        })
      );
    } catch {
      /* ignore */
    }
  };

  const handleExportMd = () => {
    const slug = String(projectTitle || 'film')
      .replace(/[^\w\-]+/g, '_')
      .slice(0, 40);
    const live = (Array.isArray(shots) ? shots : []).filter((s) => !s?.isArchived && !s?.isMuted);
    exportDownloadText(
      `${slug}_film_intel.md`,
      filmIntelToMarkdown({ ...intel, progressLife: lifecycleSummary(live) }),
      {
        projectTitle,
        auditLabel: 'film_intel_md',
        auditFormat: 'md',
        mime: 'text/markdown;charset=utf-8',
        shots,
        note: `Film Intel ${intel.filmHealth?.score ?? 0}`
      }
    );
  };

  const handleExportPrint = () => {
    const w = window.open('', '_blank');
    if (!w) {
      window.alert('Allow popups to print Film Intel PDF.');
      return;
    }
    w.document.write(filmIntelToPrintHtml(intel));
    w.document.close();
    appendCreativeAudit({
      projectTitle,
      category: 'film_intel',
      action: 'export_print',
      targetType: 'film',
      targetId: projectTitle || 'film',
      targetLabel: 'Film Intel print',
      note: `score ${intel.filmHealth?.score ?? 0}`
    });
  };

  const handleApplyContinuity = () => {
    const { proposals } = proposeContinuityDriftFixes(projectTitle, shots);
    if (!proposals?.length) {
      window.alert('No continuity drift patches to apply.');
      return;
    }
    if (
      !window.confirm(
        `Apply ${proposals.length} continuity patch${proposals.length === 1 ? '' : 'es'} from Film Intel?`
      )
    ) {
      return;
    }
    const result = applyContinuityDriftFixes(projectTitle, shots, {
      updateShot: (index, shot) => onUpdateShot?.(index, shot)
    });
    setTick((n) => n + 1);
    onRefresh?.();
    window.alert(result.message || (result.applied ? 'Applied.' : 'Nothing applied.'));
  };

  const deskTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'progress', label: 'Progress' },
    { id: 'ready', label: 'Ready' },
    { id: 'search', label: 'Search' },
    { id: 'quality', label: 'Quality' },
    { id: 'suggest', label: `Suggest (${allSuggestions.length})` },
    { id: 'writer', label: 'Writer' }
  ];

  const reelSeverityColor = (sev) => {
    if (sev === 'block') return 'var(--sps-danger)';
    if (sev === 'warn') return 'var(--sps-gold)';
    if (sev === 'note' || sev === 'info') return 'color-mix(in srgb, var(--sps-gold) 45%, var(--sps-border))';
    return 'var(--sps-success)';
  };

  const pickFilmElement = (id) => {
    if (!id) return;
    const hit = (intel?.searchIndex || []).find((row) => row.id === id);
    if (!hit) return;
    setQuery(hit.title || '');
    setDeskTab('search');
    runHit(hit);
  };

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <div className="flex flex-wrap items-center gap-1.5">
        <h3
          className={`font-semibold m-0 flex items-center gap-1 shrink-0 ${compact ? 'text-[12px]' : 'text-[13px]'}`}
          style={{ fontFamily: 'var(--sps-font-display)' }}
        >
          <Radar className="w-3.5 h-3.5 text-[var(--sps-gold)] shrink-0" />
          Film Intel
          <span className="text-[9px] font-normal text-[var(--sps-muted)] truncate max-w-[9rem]">
            · {projectTitle || 'Untitled'}
          </span>
        </h3>

        <div className="relative flex-1 min-w-[9rem] max-w-[14rem] mx-auto">
          <Search className="w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 text-[var(--sps-muted)] pointer-events-none" />
          <select
            className="w-full appearance-none pl-6 pr-5 py-1 text-[10px] rounded-[5px] border border-[var(--sps-border)] bg-[var(--sps-bg)] outline-none focus:border-[var(--sps-gold)] cursor-pointer"
            defaultValue=""
            aria-label="Jump to film element"
            title="Shots, cast, world, marks, beats…"
            onChange={(e) => {
              const id = e.target.value;
              e.target.value = '';
              pickFilmElement(id);
            }}
          >
            <option value="">Film elements…</option>
            {filmElements.map((g) => (
              <optgroup key={g.kind} label={`${g.kind} (${g.items.length})`}>
                {g.items.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title}
                    {row.subtitle ? ` — ${String(row.subtitle).slice(0, 42)}` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="sps-tabs sps-tabs-compact flex flex-wrap shrink-0" role="tablist" aria-label="Film Intel desks">
          {deskTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={deskTab === t.id}
              onClick={() => setDeskTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 flex-wrap justify-end ml-auto">
          <button
            type="button"
            className="sps-btn sps-btn-compact text-[10px] flex items-center gap-1"
            title="Save Film Health rating to creative audit"
            onClick={handleRate}
          >
            <Star className="w-3 h-3" />
            Rate
          </button>
          <button
            type="button"
            className="sps-btn sps-btn-compact text-[10px] flex items-center gap-1"
            title="Export Film Intel markdown"
            onClick={handleExportMd}
          >
            <Download className="w-3 h-3" />
            MD
          </button>
          <button
            type="button"
            className="sps-btn sps-btn-compact text-[10px] flex items-center gap-1"
            title="Print Film Intel (Save as PDF)"
            onClick={handleExportPrint}
          >
            <Printer className="w-3 h-3" />
            Print
          </button>
          <button
            type="button"
            className="sps-btn sps-btn-primary sps-btn-compact text-[10px] flex items-center gap-1"
            disabled={llmBusy}
            title="LLM Advise — suggestions only, never silent rewrite"
            onClick={handleAskLlm}
          >
            <Sparkles className="w-3 h-3" />
            {llmBusy ? 'Advising…' : 'Ask LLM'}
          </button>
          <button
            type="button"
            className="sps-icon-btn"
            title="Refresh Film Intel"
            onClick={() => {
              setTick((n) => n + 1);
              onRefresh?.();
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        <div className="rounded-[5px] border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] px-1.5 py-0.5 min-w-0">
          <p className="text-[8px] uppercase tracking-wide text-[var(--sps-muted)] m-0 truncate">Health</p>
          <p className="text-[12px] font-bold m-0 text-[var(--sps-gold)] leading-tight truncate">
            {intel.filmHealth?.score ?? 0}
            <span className="text-[8px] font-semibold text-[var(--sps-muted)] ml-0.5">
              {intel.filmHealth?.grade || 'Draft'}
            </span>
          </p>
        </div>
        <div className="rounded-[5px] border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] px-1.5 py-0.5 min-w-0">
          <p className="text-[8px] uppercase tracking-wide text-[var(--sps-muted)] m-0 truncate">Craft</p>
          <p className="text-[12px] font-bold m-0 leading-tight truncate">
            {intel.quality?.craftFill?.pct ?? 0}%
            <span className="text-[8px] font-normal text-[var(--sps-muted)] ml-0.5">
              {(intel.quality?.craftFill?.weakShots || []).length} weak
            </span>
          </p>
        </div>
        <div className="rounded-[5px] border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] px-1.5 py-0.5 min-w-0">
          <p className="text-[8px] uppercase tracking-wide text-[var(--sps-muted)] m-0 truncate">Marks</p>
          <p className="text-[12px] font-bold m-0 leading-tight truncate">
            <span className="text-[var(--sps-danger)]">{intel.stats?.blockMarks || 0}</span>
            <span className="text-[8px] text-[var(--sps-muted)]">b</span>
            {' '}
            <span className="text-[#dc2626]">{intel.stats?.warnMarks || 0}</span>
            <span className="text-[8px] text-[var(--sps-muted)]">w</span>
          </p>
        </div>
        <div className="rounded-[5px] border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] px-1.5 py-0.5 min-w-0">
          <p className="text-[8px] uppercase tracking-wide text-[var(--sps-muted)] m-0 truncate">Gates</p>
          <p className="text-[10px] font-bold m-0 leading-tight truncate">
            <span className={intel.readiness?.lock?.ready ? 'text-[#16a34a]' : 'text-[#dc2626]'}>
              L{intel.readiness?.lock?.ready ? '✓' : '✗'}
            </span>
            {' '}
            <span className={intel.readiness?.generate?.ready ? 'text-[#16a34a]' : 'text-[#dc2626]'}>
              G{intel.readiness?.generate?.ready ? '✓' : '✗'}
            </span>
            {' '}
            <span className={intel.readiness?.shoot?.ready ? 'text-[#16a34a]' : 'text-[#6b7280]'}>
              S{intel.readiness?.shoot?.ready ? '✓' : '·'}
            </span>
          </p>
        </div>
      </div>

      {deskTab === 'progress' && (
        <FilmIntelProgressTab
          shots={shots}
          intel={intel}
          onJumpToShot={jumpShot}
        />
      )}

      {deskTab === 'ready' && (
        <section className="space-y-2">
          <h4 className="text-[10px] uppercase tracking-wide text-[var(--sps-muted)] m-0 flex items-center gap-1">
            <Gauge className="w-3 h-3" />
            Before lock · generate · shoot
          </h4>
          <p className="text-[10px] text-[var(--sps-muted)] m-0 leading-snug">
            Clarity gate — clear blockers before spending money, time, or AI credits. Advise only; never silent rewrite.
          </p>
          {[
            { key: 'lock', title: 'Ready to lock', hint: 'Structure + continuity before locking shots' },
            { key: 'generate', title: 'Ready to generate', hint: 'Safe to spend AI still / video credits' },
            { key: 'shoot', title: 'Ready to shoot / spend', hint: 'Pre-production confidence checklist' }
          ].map((gate) => {
            const g = intel.readiness?.[gate.key] || { ready: false, items: [] };
            return (
              <div
                key={gate.key}
                className={`rounded-[6px] border px-2.5 py-2 space-y-1.5 ${
                  g.ready
                    ? 'border-[var(--sps-success)]/40'
                    : 'border-[var(--sps-danger)]/35'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-bold m-0">
                    {g.ready ? '✓' : '✗'} {gate.title}
                  </p>
                  <span className="text-[9px] text-[var(--sps-muted)]">
                    {(g.blockers || []).length} block · {(g.warnings || []).length} warn
                  </span>
                </div>
                <p className="text-[9px] text-[var(--sps-muted)] m-0">{gate.hint}</p>
                <div className="space-y-0.5">
                  {(g.items || []).map((it) => (
                    <p
                      key={it.id}
                      className={`text-[10px] m-0 ${it.ok ? 'text-[var(--sps-success)]' : it.severity === 'block' ? 'text-[var(--sps-danger)]' : 'text-[var(--sps-gold)]'}`}
                    >
                      {it.ok ? '✓' : '○'} {it.label}
                      {it.detail && !it.ok ? (
                        <span className="text-[var(--sps-muted)]"> — {it.detail}</span>
                      ) : null}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {deskTab === 'search' && (
        <section className="space-y-1.5">
          <h4 className="text-[10px] uppercase tracking-wide text-[var(--sps-muted)] m-0 flex items-center gap-1">
            <Search className="w-3 h-3" />
            Results · {search.total}
            {query ? ` · “${query.trim()}”` : ' · pick from Film elements ↑'}
          </h4>
          <div className="space-y-0.5 max-h-[min(28rem,55vh)] overflow-y-auto pr-0.5">
            {(search.hits || []).length === 0 && (
              <p className="text-[11px] text-[var(--sps-muted)]">
                No elements yet. Open Writer / Matrix so Film Intel can index shots, cast, world, and marks.
              </p>
            )}
            {(search.hits || []).map((hit) => (
              <button
                key={hit.id}
                type="button"
                onClick={() => runHit(hit)}
                className="w-full text-left rounded-[5px] border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] px-2 py-1 hover:border-[var(--sps-gold)]/50 cursor-pointer"
              >
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[9px] font-bold uppercase text-[var(--sps-gold)] shrink-0">{hit.kind}</span>
                  <p className="text-[11px] font-semibold m-0 truncate flex-1">{hit.title}</p>
                  {hit.severity ? (
                    <span className="text-[9px] text-[var(--sps-muted)] shrink-0">{hit.severity}</span>
                  ) : null}
                </div>
                {hit.subtitle ? (
                  <p className="text-[10px] text-[var(--sps-muted)] m-0 truncate pl-[3.25rem]">{hit.subtitle}</p>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      )}

      {deskTab === 'quality' && (
        <section className="space-y-3">
          <h4 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] m-0 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5" />
            Quality analysis · {intel.quality?.grade || 'Draft'} · {intel.quality?.score ?? 0}
          </h4>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="sps-btn text-[10px]" onClick={handleApplyContinuity}>
              Apply continuity patches
            </button>
            {typeof onHealBibleSoT === 'function' && intel.stats?.bibleDrift ? (
              <button type="button" className="sps-btn text-[10px]" onClick={() => onHealBibleSoT()}>
                Heal bible SoT
              </button>
            ) : null}
            <button type="button" className="sps-btn text-[10px]" onClick={handleExportMd}>
              Export MD report
            </button>
          </div>
          {intel.quality?.bibleSoT?.drift ? (
            <div className="rounded-[6px] border border-[var(--sps-gold)]/40 px-2.5 py-2 text-[10px]">
              Bible SoT drift · {(intel.quality.bibleSoT.preview || []).join(' · ') || `${intel.quality.bibleSoT.issueCount} issues`}
            </div>
          ) : null}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {(intel.quality?.dimensions || []).map((d) => (
              <div key={d.id} className="rounded-[6px] border border-[var(--sps-border)] px-2 py-1.5 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--sps-muted)]">{d.label}</span>
                  <span className="font-bold">{d.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--sps-bg)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--sps-gold)]"
                    style={{ width: `${Math.min(100, Math.max(0, d.value))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-[8px] border border-[var(--sps-border)] p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase text-[var(--sps-muted)] m-0">Quality issues</p>
            {(intel.quality?.issues || []).length === 0 && (
              <p className="text-[11px] text-[var(--sps-success)] m-0">No structural quality issues flagged.</p>
            )}
            {(intel.quality?.issues || []).map((q) => (
              <div
                key={q.id}
                className={`rounded-[6px] border px-2.5 py-2 ${
                  q.severity === 'block'
                    ? 'border-[var(--sps-danger)]/40'
                    : q.severity === 'warn'
                      ? 'border-[var(--sps-gold)]/40'
                      : 'border-[var(--sps-border)]'
                }`}
              >
                <p className="text-[11px] font-bold m-0">
                  {q.title}
                  <span className="font-normal text-[var(--sps-muted)]"> · {q.severity}</span>
                </p>
                <p className="text-[10px] text-[var(--sps-muted)] m-0 mt-0.5">{q.detail}</p>
              </div>
            ))}
          </div>
          {(intel.quality?.craftFill?.weakShots || []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase text-[var(--sps-muted)] m-0">Weak craft shots</p>
              {(intel.quality.craftFill.weakShots || []).map((w) => (
                <button
                  key={w.shotId}
                  type="button"
                  className="w-full text-left sps-btn text-[11px] justify-between"
                  onClick={() => jumpShot(w.index)}
                >
                  <span>{w.shotId}</span>
                  <span className="text-[var(--sps-muted)]">{w.fillPct}% filled</span>
                </button>
              ))}
            </div>
          )}
          <div className="rounded-[8px] border border-[var(--sps-border)] p-3 space-y-1">
            <p className="text-[10px] font-bold uppercase text-[var(--sps-muted)] m-0">Writer readiness checklist</p>
            {(intel.quality?.checklist || []).map((f) => (
              <p
                key={f.label}
                className={`text-[10px] m-0 ${f.ok ? 'text-[var(--sps-success)]' : 'text-[var(--sps-muted)]'}`}
              >
                {f.ok ? '✓' : '○'} {f.label}
              </p>
            ))}
          </div>
        </section>
      )}

      {deskTab === 'suggest' && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] m-0 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              Suggestions · click to jump
            </h4>
            <button
              type="button"
              className="sps-btn text-[10px]"
              disabled={llmBusy}
              onClick={handleAskLlm}
            >
              {llmBusy ? 'Advising…' : 'Refresh LLM Advise'}
            </button>
          </div>
          {llmError ? (
            <p className="text-[11px] text-[var(--sps-danger)] m-0">{llmError}</p>
          ) : null}
          {llmSummary ? (
            <div className="rounded-[8px] border border-[var(--sps-gold)]/40 bg-[var(--sps-bg-elevated)] px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-[var(--sps-gold)] m-0">LLM summary</p>
              <p className="text-[11px] m-0 mt-1 leading-snug">{llmSummary}</p>
              <p className="text-[9px] text-[var(--sps-muted)] m-0 mt-1">Advise only — never auto-applies to Matrix or Writer.</p>
            </div>
          ) : null}
          <div className="space-y-1.5 max-h-[28rem] overflow-y-auto pr-1">
            {allSuggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => runSuggestion(s)}
                className={`w-full text-left rounded-[6px] border px-2.5 py-2 cursor-pointer ${
                  s.severity === 'block'
                    ? 'border-[var(--sps-danger)]/40'
                    : s.severity === 'warn'
                      ? 'border-[var(--sps-gold)]/40'
                      : 'border-[var(--sps-border)] bg-[var(--sps-bg-elevated)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold">
                    #{s.priority} · {s.title}
                  </span>
                  <span className="text-[9px] text-[var(--sps-muted)] shrink-0">
                    {s.source} · {s.actionLabel}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--sps-muted)] m-0 mt-0.5 leading-snug">{s.detail}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {deskTab === 'overview' && (
        <>
          {(intel.filmHealth?.dimensions || []).length > 0 && (
            <div className="rounded-[8px] border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--sps-muted)] m-0 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" />
                Dimensions
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {intel.filmHealth.dimensions.map((d) => (
                  <div key={d.id} className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[var(--sps-muted)]">{d.label}</span>
                      <span className="font-bold">{d.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--sps-bg)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--sps-gold)]"
                        style={{ width: `${Math.min(100, Math.max(0, d.value))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)]">Lens</label>
            <select
              className="sps-btn text-[11px] py-1"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setEntityKey('');
              }}
              title="Film Intel entity lens"
            >
              <option value="film">Whole film</option>
              <option value="character">Character</option>
              <option value="world">World / location</option>
              <option value="costume">Costume / look</option>
              <option value="prop">Prop</option>
              <option value="lighting">Lighting</option>
            </select>
            {entityType === 'character' && (
              <select
                className="sps-btn text-[11px] py-1 min-w-[10rem]"
                value={entityKey}
                onChange={(e) => setEntityKey(e.target.value)}
              >
                <option value="">Select character…</option>
                {(intel.characters || []).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name} · {formatPresenceDuration(c.sec)}
                  </option>
                ))}
              </select>
            )}
            {entityType === 'world' && (
              <select
                className="sps-btn text-[11px] py-1 min-w-[10rem]"
                value={entityKey}
                onChange={(e) => setEntityKey(e.target.value)}
              >
                <option value="">Select world…</option>
                {(intel.worlds || []).map((w) => (
                  <option key={w.key} value={w.key}>
                    {w.name} · {formatPresenceDuration(w.sec)}
                  </option>
                ))}
              </select>
            )}
            {entityType === 'costume' && (
              <select
                className="sps-btn text-[11px] py-1 min-w-[10rem]"
                value={entityKey}
                onChange={(e) => setEntityKey(e.target.value)}
              >
                <option value="">Select costume…</option>
                {(intel.costumes || []).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name.slice(0, 48)} · {c.shotCount} shots
                  </option>
                ))}
              </select>
            )}
            {entityType === 'prop' && (
              <select
                className="sps-btn text-[11px] py-1 min-w-[10rem]"
                value={entityKey}
                onChange={(e) => setEntityKey(e.target.value)}
              >
                <option value="">Select prop…</option>
                {(intel.props || []).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name.slice(0, 48)} · {p.shotCount} shots
                  </option>
                ))}
              </select>
            )}
          </div>

          {(intel.reelMap || []).length > 0 && (
            <section className="space-y-2">
              <h4 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] m-0 flex items-center gap-1.5">
                <Clapperboard className="w-3.5 h-3.5" />
                Reel map · click shot to jump
              </h4>
              <div className="flex items-end gap-0.5 h-16 overflow-x-auto pb-1">
                {(intel.reelMap || []).map((r) => (
                  <button
                    key={`${r.index}-${r.shotId}`}
                    type="button"
                    title={`${r.shotId} · ${r.severity} · ${r.markCount} marks · ${r.sec}s`}
                    onClick={() => jumpShot(r.index)}
                    className="shrink-0 w-2.5 min-w-[10px] rounded-t cursor-pointer border-0 p-0"
                    style={{
                      height: `${Math.max(18, Math.min(100, 18 + r.sec * 2))}%`,
                      background: reelSeverityColor(r.severity)
                    }}
                  />
                ))}
              </div>
              <p className="text-[9px] text-[var(--sps-muted)] m-0">
                Green ok · gold warn · red block · {(intel.reelMap || []).length} shots
              </p>
            </section>
          )}

          {intel.focus && (
            <div className="rounded-[8px] border border-[var(--sps-gold)]/40 bg-[var(--sps-bg-elevated)] px-3 py-2">
              <p className="text-[11px] font-semibold m-0">
                {intel.focus.name}
                <span className="text-[var(--sps-muted)] font-normal">
                  {' '}
                  · {formatPresenceDuration(intel.focus.sec)} on screen · {intel.focus.shotCount} shots ·{' '}
                  {intel.focus.sharePct || 0}% of reel
                </span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="space-y-2">
              <h4 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] m-0 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Character screen time
              </h4>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(intel.characters || []).length === 0 && (
                  <p className="text-[11px] text-[var(--sps-muted)]">No cast matched on Matrix shots yet.</p>
                )}
                {(intel.characters || []).slice(0, 16).map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="w-full text-left rounded-[6px] border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] px-2.5 py-1.5 hover:border-[var(--sps-gold)]/50 cursor-pointer"
                    onClick={() => {
                      setEntityType('character');
                      setEntityKey(c.key);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-bold truncate">{c.name}</span>
                      <span className="text-[10px] text-[var(--sps-gold)] shrink-0">
                        {formatPresenceDuration(c.sec)} · {c.sharePct || 0}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--sps-bg)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--sps-gold)]"
                        style={{ width: `${Math.min(100, Math.max(4, c.sharePct || 0))}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] m-0 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                World / location presence
              </h4>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(intel.worlds || []).length === 0 && (
                  <p className="text-[11px] text-[var(--sps-muted)]">No world plates matched yet.</p>
                )}
                {(intel.worlds || []).slice(0, 12).map((w) => (
                  <button
                    key={w.key}
                    type="button"
                    className="w-full text-left rounded-[6px] border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] px-2.5 py-1.5 hover:border-[var(--sps-gold)]/50 cursor-pointer"
                    onClick={() => {
                      setEntityType('world');
                      setEntityKey(w.key);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold truncate">{w.name}</span>
                      <span className="text-[10px] text-[var(--sps-muted)] shrink-0">
                        {formatPresenceDuration(w.sec)} · {w.shotCount} shots
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="space-y-2">
              <h4 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] m-0 flex items-center gap-1.5">
                <Shirt className="w-3.5 h-3.5" />
                Costume / look versions
              </h4>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {(intel.costumes || []).length === 0 && (
                  <p className="text-[11px] text-[var(--sps-muted)]">No costume states from continuity yet.</p>
                )}
                {(intel.costumes || []).slice(0, 12).map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="w-full text-left rounded-[6px] border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] px-2.5 py-1.5 cursor-pointer"
                    onClick={() => {
                      setEntityType('costume');
                      setEntityKey(c.key);
                    }}
                  >
                    <p className="text-[11px] font-bold m-0 truncate">{c.name}</p>
                    <p className="text-[9px] text-[var(--sps-muted)] m-0">
                      {c.shotCount} shots · {(c.characters || []).slice(0, 3).join(', ') || '—'}
                    </p>
                  </button>
                ))}
              </div>
            </section>
            <section className="space-y-2">
              <h4 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] m-0 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                Props
              </h4>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {(intel.props || []).length === 0 && (
                  <p className="text-[11px] text-[var(--sps-muted)]">No props tracked from continuity yet.</p>
                )}
                {(intel.props || []).slice(0, 12).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className="w-full text-left rounded-[6px] border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] px-2.5 py-1.5 cursor-pointer"
                    onClick={() => {
                      setEntityType('prop');
                      setEntityKey(p.key);
                    }}
                  >
                    <p className="text-[11px] font-bold m-0 truncate">{p.name}</p>
                    <p className="text-[9px] text-[var(--sps-muted)] m-0">
                      {p.shotCount} shots · {(p.characters || []).slice(0, 3).join(', ') || '—'}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className="space-y-2">
            <h4 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] m-0 flex items-center gap-1.5">
              <Clapperboard className="w-3.5 h-3.5" />
              Marks · click to jump
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {(intel.marks || []).length === 0 && (
                <p className="text-[11px] text-[var(--sps-success)]">Clean — no marks for this lens.</p>
              )}
              {(intel.marks || []).slice(0, 40).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`w-full text-left rounded-[6px] border px-2.5 py-2 cursor-pointer ${
                    m.severity === 'block'
                      ? 'border-[var(--sps-danger)]/40'
                      : m.severity === 'warn'
                        ? 'border-[var(--sps-gold)]/40'
                        : 'border-[var(--sps-border)] bg-[var(--sps-bg-elevated)]'
                  }`}
                  onClick={() => {
                    if (m.source === 'writer' && typeof m.offset === 'number') openWriterAt(m.offset);
                    else if (typeof m.shotIndex === 'number') jumpShot(m.shotIndex);
                  }}
                >
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 opacity-70" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold m-0">
                        {m.shotId || 'Writer'} · {m.severity}
                      </p>
                      <p className="text-[10px] m-0 mt-0.5 leading-snug">{m.message}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="sps-btn text-[10px]" onClick={() => setDeskTab('suggest')}>
              Open suggestions ({allSuggestions.length})
            </button>
            <button type="button" className="sps-btn text-[10px]" onClick={() => setDeskTab('quality')}>
              Open quality report
            </button>
          </div>
        </>
      )}

      {deskTab === 'writer' && (
        <div className="rounded-[8px] border border-[var(--sps-border)] overflow-hidden bg-[var(--sps-bg-elevated)]">
          <div className="px-3 py-2 border-b border-[var(--sps-border)] flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5">
              <Radar className="w-3.5 h-3.5 text-[var(--sps-gold)]" />
              Writer analysis
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--sps-border)]">
              {screenplay.readiness?.score ?? 0} · {screenplay.readiness?.grade || 'Draft'}
            </span>
          </div>
          <div className="flex border-b border-[var(--sps-border)]">
            {[
              { id: 'radar', label: 'Radar', icon: Radar },
              { id: 'pacing', label: 'Pace', icon: Activity },
              { id: 'beats', label: 'Beats', icon: Layers },
              { id: 'flags', label: 'Flags', icon: AlertTriangle }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`flex-1 py-1.5 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                  subTab === t.id
                    ? 'text-[var(--sps-gold)] border-b-2 border-[var(--sps-gold)]'
                    : 'text-[var(--sps-muted)] hover:text-[var(--sps-text)]'
                }`}
              >
                <t.icon className="w-3 h-3" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-3 space-y-3 max-h-[28rem] overflow-y-auto">
            {subTab === 'radar' && (
              <>
                <div className="rounded-[8px] border border-[var(--sps-border)] p-2.5">
                  <p className="text-[10px] font-bold uppercase text-[var(--sps-muted)] mb-2">Cinema DNA</p>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div className="rounded-[6px] border border-[var(--sps-border)] px-2 py-1.5">
                      INT <span className="font-bold">{screenplay.cinemaDNA?.intPct ?? 0}%</span>
                    </div>
                    <div className="rounded-[6px] border border-[var(--sps-border)] px-2 py-1.5">
                      EXT <span className="font-bold">{screenplay.cinemaDNA?.extPct ?? 0}%</span>
                    </div>
                    <div className="rounded-[6px] border border-[var(--sps-border)] px-2 py-1.5">
                      Day <span className="font-bold">{screenplay.cinemaDNA?.dayPct ?? 0}%</span>
                    </div>
                    <div className="rounded-[6px] border border-[var(--sps-border)] px-2 py-1.5">
                      Night <span className="font-bold">{screenplay.cinemaDNA?.nightPct ?? 0}%</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {(screenplay.characters || []).slice(0, 12).map((c) => (
                    <div key={c.name} className="rounded-[6px] border border-[var(--sps-border)] px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-bold truncate">{c.name}</span>
                        <span className="text-[10px] text-[var(--sps-gold)]">{c.sharePct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--sps-bg)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--sps-gold)]"
                          style={{ width: `${Math.min(100, Math.max(4, c.sharePct))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {subTab === 'pacing' && (
              <div>
                <div className="flex items-end gap-1 h-28 px-1">
                  {realScenes.map((s) => (
                    <button
                      key={`heat-${s.index}`}
                      type="button"
                      onClick={() => openWriterAt(s.offset)}
                      className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1 cursor-pointer"
                      title={`${s.title} · ${s.intensity}`}
                    >
                      <div
                        className="w-full rounded-t-md"
                        style={{
                          height: `${Math.max(8, s.intensity)}%`,
                          background: intensityColor(s.intensity)
                        }}
                      />
                      <span className="text-[8px] text-[var(--sps-muted)]">{s.index + 1}</span>
                    </button>
                  ))}
                </div>
                <ul className="mt-3 space-y-1.5 list-none p-0 m-0">
                  {realScenes.map((s) => (
                    <button
                      key={`pace-row-${s.index}`}
                      type="button"
                      onClick={() => openWriterAt(s.offset)}
                      className="w-full text-left rounded-[6px] border border-[var(--sps-border)] px-2 py-1.5 cursor-pointer"
                    >
                      <span className="text-[10px] font-bold truncate block">{s.title}</span>
                      <span className="text-[9px] text-[var(--sps-muted)]">
                        {s.emotion} · {s.dialogueRatio}% dialogue
                      </span>
                    </button>
                  ))}
                </ul>
              </div>
            )}

            {subTab === 'beats' && (
              <div className="space-y-2">
                {realBeats.map((b, i) => (
                  <button
                    key={`beat-${i}-${b.offset}`}
                    type="button"
                    onClick={() => openWriterAt(b.offset)}
                    className="w-full text-left rounded-[8px] border border-[var(--sps-border)] p-2.5 cursor-pointer"
                  >
                    <span
                      className="text-[9px] font-bold uppercase"
                      style={{ color: intensityColor(b.intensity) }}
                    >
                      {b.emotion}
                    </span>
                    <p className="text-[11px] font-bold m-0 mt-1">{b.summary}</p>
                  </button>
                ))}
              </div>
            )}

            {subTab === 'flags' && (
              <div className="space-y-2">
                {(screenplay.flags || []).length === 0 && (
                  <p className="text-[11px] text-[var(--sps-success)]">Clean — no writer flags.</p>
                )}
                {(screenplay.flags || []).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => typeof f.offset === 'number' && openWriterAt(f.offset)}
                    className="w-full text-left rounded-[6px] border border-[var(--sps-border)] px-2.5 py-2 cursor-pointer"
                  >
                    <span className="text-[10px] leading-snug">{f.message}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
