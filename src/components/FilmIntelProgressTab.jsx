import React, { useMemo } from 'react';
import { Activity, Lock, Users, Clapperboard, Gauge, Sun, BarChart3 } from 'lucide-react';
import { buildFilmProgressCharts } from '../utils/filmProgressCharts';
import { lifecycleColor } from '../utils/lifecycleColors';

function RingMeter({ pct = 0, label, sub, size = 72, tone = 'blue' }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, pct));
  const stroke =
    tone === 'ok' || tone === 'green'
      ? '#16a34a'
      : tone === 'red'
        ? '#dc2626'
        : tone === 'grey'
          ? '#6b7280'
          : '#2563eb';
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[4.5rem]">
      <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden>
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--sps-border)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p / 100)}
          transform="rotate(-90 36 36)"
        />
        <text
          x="36"
          y="40"
          textAnchor="middle"
          className="fill-[var(--sps-text)]"
          style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--sps-font-mono, monospace)' }}
        >
          {p}%
        </text>
      </svg>
      <p className="text-[9px] font-bold m-0 uppercase tracking-wide text-[var(--sps-muted)]">{label}</p>
      {sub ? <p className="text-[8px] m-0 text-[var(--sps-muted)]">{sub}</p> : null}
    </div>
  );
}

function StackBar({ parts = [], height = 10 }) {
  const total = parts.reduce((n, p) => n + (p.count || 0), 0);
  if (!total) {
    return (
      <div
        className="w-full rounded-full border border-[var(--sps-border)]"
        style={{ height, background: 'color-mix(in srgb, var(--sps-muted) 22%, transparent)' }}
      />
    );
  }
  return (
    <div className="flex w-full overflow-hidden rounded-full border border-[var(--sps-border)]" style={{ height }}>
      {parts.map((p) =>
        p.count > 0 ? (
          <span
            key={p.key}
            title={`${p.label}: ${p.count}`}
            style={{ flexGrow: p.count, background: p.color, minWidth: 2 }}
          />
        ) : null
      )}
    </div>
  );
}

function HBar({ label, value, max = 100, hint, color = '#2563eb', onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left space-y-0.5 ${onClick ? 'cursor-pointer hover:opacity-90' : ''}`}
    >
      <div className="flex justify-between gap-2 text-[10px]">
        <span className="truncate font-semibold">{label}</span>
        <span className="text-[var(--sps-muted)] shrink-0">{hint || `${value}%`}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--sps-bg)] border border-[var(--sps-border)] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%`, background: color }}
        />
      </div>
    </Tag>
  );
}

function lifeColor(status) {
  return lifecycleColor(status);
}

/**
 * Detailed Progress desk for Film Intel — multiple infographics.
 */
export default function FilmIntelProgressTab({
  shots = [],
  intel = {},
  onJumpToShot
}) {
  const charts = useMemo(() => buildFilmProgressCharts({ shots, intel }), [shots, intel]);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-1.5">
        <div>
          <h4 className="text-[10px] uppercase tracking-wide text-[var(--sps-muted)] m-0 flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-[#2563eb]" />
            Progress · collab lock board
          </h4>
          <p className="text-[9px] text-[var(--sps-muted)] m-0 mt-0.5">
            Grey draft · Red review · Green approved · Blue locked
          </p>
        </div>
        <p className="text-[9px] font-mono text-[var(--sps-muted)] m-0">
          {charts.total} live · {charts.runtimeMin}m est · {charts.blockMarks}b / {charts.warnMarks}w
        </p>
      </div>

      {/* Ring meters */}
      <div className="rounded-[6px] border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] px-2 py-2 flex flex-wrap justify-around gap-2">
        <RingMeter pct={charts.donePct} label="Approved+" sub={`${charts.life.approved + charts.life.locked}/${charts.total}`} tone="green" />
        <RingMeter pct={charts.lockedPct} label="Locked" sub={`${charts.life.locked} shots`} tone="blue" />
        <RingMeter pct={charts.craftPct} label="Craft fill" sub={charts.healthGrade} tone="grey" />
        <RingMeter pct={charts.healthScore} label="Film health" sub={`${charts.healthScore}`} tone="blue" />
      </div>

      {/* Lifecycle stack + legend */}
      <div className="rounded-[6px] border border-[var(--sps-border)] px-2.5 py-2 space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--sps-muted)] m-0 flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Shot lifecycle mix
        </p>
        <StackBar parts={charts.lifecycleParts} height={14} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {charts.lifecycleParts.map((p) => (
            <div key={p.key} className="rounded-[5px] border border-[var(--sps-border)] px-2 py-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color }} />
                <span className="text-[9px] uppercase text-[var(--sps-muted)]">{p.label}</span>
              </div>
              <p className="text-[13px] font-bold m-0 font-mono">
                {p.count}
                <span className="text-[9px] font-normal text-[var(--sps-muted)] ml-1">{p.pct}%</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Scene progress strips */}
      <div className="rounded-[6px] border border-[var(--sps-border)] px-2.5 py-2 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--sps-muted)] m-0 flex items-center gap-1">
          <Clapperboard className="w-3 h-3" />
          Scene lock progress
        </p>
        {charts.scenes.length === 0 ? (
          <p className="text-[11px] text-[var(--sps-muted)] m-0">No live scenes yet.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
            {charts.scenes.map((sc) => (
              <div key={sc.sceneId} className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="font-bold">{sc.sceneId}</span>
                  <span className="text-[var(--sps-muted)]">
                    {sc.lockedPct}% locked · {sc.donePct}% done · {sc.total} shots
                  </span>
                </div>
                <StackBar
                  parts={[
                    { key: 'draft', label: 'Draft', count: sc.draft, color: lifeColor('draft') },
                    { key: 'review', label: 'Review', count: sc.review, color: lifeColor('review') },
                    { key: 'approved', label: 'Approved', count: sc.approved, color: lifeColor('approved') },
                    { key: 'locked', label: 'Locked', count: sc.locked, color: lifeColor('locked') }
                  ]}
                  height={8}
                />
                <div className="flex flex-wrap gap-0.5">
                  {sc.cells.map((cell) => (
                    <button
                      key={`${sc.sceneId}-${cell.index}`}
                      type="button"
                      title={`${cell.shotId} · ${cell.status}${cell.by !== 'Unknown' ? ` · ${cell.by}` : ''}`}
                      onClick={() => onJumpToShot?.(cell.index)}
                      className="w-2.5 h-2.5 rounded-[2px] border border-[var(--sps-border)] cursor-pointer hover:scale-125 transition-transform"
                      style={{ background: lifeColor(cell.status) }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Collaborators */}
        <div className="rounded-[6px] border border-[var(--sps-border)] px-2.5 py-2 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--sps-muted)] m-0 flex items-center gap-1">
            <Users className="w-3 h-3" />
            Collaborator activity
          </p>
          {charts.collaborators.length === 0 ? (
            <p className="text-[11px] text-[var(--sps-muted)] m-0">
              No lifecycle stamps yet — advance/lock shots to show who moved them.
            </p>
          ) : (
            <div className="space-y-1.5">
              {charts.collaborators.map((c) => (
                <HBar
                  key={c.actor}
                  label={c.actor}
                  value={c.locks + c.advances}
                  max={Math.max(1, ...charts.collaborators.map((x) => x.locks + x.advances))}
                  hint={`${c.locks} locked · ${c.advances} mid`}
                  color="#2563eb"
                />
              ))}
            </div>
          )}
        </div>

        {/* Ready gates */}
        <div className="rounded-[6px] border border-[var(--sps-border)] px-2.5 py-2 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--sps-muted)] m-0 flex items-center gap-1">
            <Gauge className="w-3 h-3" />
            Ready gates
          </p>
          <div className="space-y-1.5">
            {charts.gates.map((g) => (
              <HBar
                key={g.key}
                label={`${g.ready ? '✓' : '○'} ${g.label}`}
                value={g.pct}
                hint={`${g.ok}/${g.total}`}
                color={g.ready ? '#16a34a' : '#dc2626'}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Cast screen time */}
        <div className="rounded-[6px] border border-[var(--sps-border)] px-2.5 py-2 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--sps-muted)] m-0 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Cast screen share
          </p>
          {charts.castBars.length === 0 ? (
            <p className="text-[11px] text-[var(--sps-muted)] m-0">Tag CharID / bible names on shots to score presence.</p>
          ) : (
            <div className="space-y-1.5">
              {charts.castBars.map((c) => (
                <HBar
                  key={c.key}
                  label={c.label}
                  value={c.value}
                  hint={`${c.value}% · ${c.shots}sh · ${c.sec}s`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Lighting + dimensions */}
        <div className="rounded-[6px] border border-[var(--sps-border)] px-2.5 py-2 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--sps-muted)] m-0 flex items-center gap-1">
            <Sun className="w-3 h-3" />
            Lighting · health dimensions
          </p>
          <StackBar parts={charts.lightingParts} height={10} />
          <div className="flex flex-wrap gap-2 text-[9px] text-[var(--sps-muted)]">
            {charts.lightingParts.map((p) => (
              <span key={p.key}>
                {p.label} {p.count}
              </span>
            ))}
          </div>
          <div className="space-y-1.5 pt-1">
            {(charts.dimensions || []).map((d) => (
              <HBar key={d.id} label={d.label} value={d.value} />
            ))}
          </div>
        </div>
      </div>

      {/* Reel lifecycle mosaic */}
      {(charts.reelCells || []).length > 0 && (
        <div className="rounded-[6px] border border-[var(--sps-border)] px-2.5 py-2 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--sps-muted)] m-0">
            Reel mosaic · click a cell to open Form
          </p>
          <div className="flex flex-wrap gap-1">
            {charts.reelCells.map((cell) => (
              <button
                key={cell.index}
                type="button"
                title={`${cell.shotId} · ${cell.status} · ${cell.severity}`}
                onClick={() => onJumpToShot?.(cell.index)}
                className="w-7 h-7 rounded-[4px] border border-[var(--sps-border)] text-[8px] font-mono font-bold cursor-pointer hover:border-[#2563eb]"
                style={{
                  background: lifeColor(cell.status),
                  color: cell.status === 'draft' ? 'var(--sps-text)' : 'var(--sps-on-gold, #1a140c)'
                }}
              >
                {cell.index + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent stamps */}
      {charts.recent.length > 0 && (
        <div className="rounded-[6px] border border-[var(--sps-border)] px-2.5 py-2 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--sps-muted)] m-0">
            Recent lifecycle stamps
          </p>
          <div className="space-y-0.5 max-h-36 overflow-y-auto">
            {charts.recent.map((r) => (
              <button
                key={`${r.shotId}-${r.at}`}
                type="button"
                onClick={() => onJumpToShot?.(r.index)}
                className="w-full text-left flex items-center gap-2 px-1.5 py-1 rounded-[4px] hover:bg-[var(--sps-bg-elevated)] cursor-pointer"
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ background: lifeColor(r.status) }}
                />
                <span className="text-[11px] font-bold truncate">{r.shotId}</span>
                <span className="text-[9px] text-[var(--sps-muted)] uppercase">{r.status}</span>
                <span className="text-[9px] text-[var(--sps-muted)] ml-auto truncate">{r.by}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
