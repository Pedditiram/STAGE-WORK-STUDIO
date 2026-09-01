import React, { useState } from 'react';
import {
  X, Keyboard, Sparkles, BookOpen, ExternalLink, Trophy, PlayCircle, Globe, Newspaper
} from 'lucide-react';
import {
  MOD,
  WRITER_HOTKEY_GROUPS,
  WRITER_COMPARISON,
  WRITER_HIGHLIGHTS,
  WRITER_RESOURCES,
  WRITER_QUICK_START
} from '../utils/writerHotkeys';
import { WRITER_VIEW_MODES, WRITER_VIEW_INTIMIDATION } from '../utils/writerViews';
import CinematicReferencesPanel from './CinematicReferencesPanel';

function Cell({ value }) {
  if (value === true) return <span className="text-emerald-400 font-black">✓</span>;
  if (value === false) return <span className="text-zinc-600">—</span>;
  if (value === 'partial' || value === 'limited' || value === 'add-on') {
    return <span className="text-amber-300 text-[10px] font-bold">{String(value)}</span>;
  }
  return <span className="text-cyan-300 text-[10px] font-bold">{String(value)}</span>;
}

/**
 * Writer Console Help — shortcuts, guide, competitive compare, craft digest.
 */
export default function WriterHelpModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('shortcuts'); // shortcuts | guide | compare | resources

  if (!isOpen) return null;

  const tabs = [
    { id: 'shortcuts', label: 'Hotkeys', icon: Keyboard },
    { id: 'guide', label: 'Guide', icon: BookOpen },
    { id: 'compare', label: 'Why SPS', icon: Trophy },
    { id: 'resources', label: 'Digest', icon: Newspaper }
  ];

  return (
    <div className="sps-overlay" style={{ zIndex: 85 }}>
      <div className="sps-shell sps-atelier-room sps-guide-blue">
        <div className="sps-modal-head">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--sps-gold)' }} />
              Writer Help & App Guide
            </h2>
            <p>
              Industry muscle memory · studio-exclusive power · craft digest
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sps-icon-btn"
            aria-label="Close help"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-[var(--sps-border)] shrink-0 overflow-x-auto bg-[var(--sps-bg)] px-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`sps-btn text-[11px] m-1.5 shrink-0 ${tab === t.id ? 'sps-btn-primary' : ''}`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sps-atelier-pane">
          {tab === 'shortcuts' && (
            <>
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                Hotkeys follow <strong className="text-zinc-200">Final Draft</strong> and{' '}
                <strong className="text-zinc-200">WriterDuet</strong> element shortcuts ({MOD}+1–7), plus SPS studio keys.
                Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 text-[10px]">{MOD} + /</kbd> anytime to reopen this panel.
              </p>
              {WRITER_HOTKEY_GROUPS.map((g) => (
                <div key={g.id} className="rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="px-3 py-2 bg-zinc-900 text-[10px] font-black uppercase tracking-wide text-zinc-400">
                    {g.title}
                  </div>
                  <table className="w-full text-[12px]">
                    <tbody>
                      {g.items.map((row) => (
                        <tr key={row.keys + row.action} className="border-t border-zinc-800/80">
                          <td className="px-3 py-2 w-[38%] font-mono text-[11px] text-cyan-300 whitespace-nowrap align-top">
                            {row.keys}
                          </td>
                          <td className="px-3 py-2 text-zinc-200 align-top">{row.action}</td>
                          <td className="px-3 py-2 text-[10px] text-zinc-500 align-top hidden sm:table-cell">
                            {row.industry}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}

          {tab === 'guide' && (
            <>
              <div className="rounded-xl border border-sky-700/40 bg-sky-950/20 p-4 space-y-2">
                <h3 className="text-xs font-black uppercase text-sky-300">Is Studio intimidating?</h3>
                <p className="text-[12px] text-zinc-300 leading-relaxed">{WRITER_VIEW_INTIMIDATION.verdict}</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-400">
                  {WRITER_VIEW_INTIMIDATION.why.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <p className="text-[12px] text-amber-200/90 leading-relaxed pt-1">{WRITER_VIEW_INTIMIDATION.remedy}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <div className="px-3 py-2 bg-zinc-900 text-[10px] font-black uppercase tracking-wide text-zinc-400">
                  View modes (start here → grow into Studio)
                </div>
                <div className="divide-y divide-zinc-800">
                  {WRITER_VIEW_MODES.map((m) => (
                    <div key={m.id} className="px-3 py-2.5 flex gap-3 items-start">
                      <span className="shrink-0 text-[11px] font-black text-amber-300 w-14">{m.short}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-zinc-500">{m.industry}</p>
                        <p className="text-[12px] text-zinc-300 leading-relaxed">{m.blurb}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 space-y-2">
                <h3 className="text-xs font-black uppercase text-amber-300">Quick start</h3>
                <ol className="list-decimal list-inside space-y-1.5 text-[12px] text-zinc-300 leading-relaxed">
                  {WRITER_QUICK_START.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {WRITER_HIGHLIGHTS.map((h) => (
                  <div key={h.title} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5">
                    <h4 className="text-[12px] font-black text-cyan-300 mb-1">{h.title}</h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{h.body}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-zinc-800 p-3.5 text-[11px] text-zinc-400 leading-relaxed">
                <strong className="text-zinc-200">Color legend (Studio):</strong> Amber = Scene · Fuchsia = Shot/Cam · Teal = Timing ·
                Cyan = Character · Green = Dialogue · Light = Action · Yellow = Note. Toggle with{' '}
                <span className="text-cyan-300 font-mono">{MOD}+Shift+K</span>.
              </div>
            </>
          )}

          {tab === 'compare' && (
            <>
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                Stage Work Studio Writer Console — AI Cinema Production OS — keeps Final Draft / WriterDuet formatting habits — then adds
                production Intel, Matrix sync, scene-locked co-write, and revision compare that those tools don’t ship
                as one system.
              </p>
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-[11px] min-w-[640px]">
                  <thead>
                    <tr className="bg-zinc-900 text-[10px] uppercase tracking-wide text-zinc-500">
                      <th className="text-left px-3 py-2 font-black">Capability</th>
                      <th className="px-2 py-2 font-black">FD</th>
                      <th className="px-2 py-2 font-black">WriterDuet</th>
                      <th className="px-2 py-2 font-black">Fade In</th>
                      <th className="px-2 py-2 font-black">Highland</th>
                      <th className="px-2 py-2 font-black text-amber-300">SPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WRITER_COMPARISON.map((row) => (
                      <tr key={row.feature} className="border-t border-zinc-800">
                        <td className="px-3 py-2 text-zinc-200 text-left">{row.feature}</td>
                        <td className="px-2 py-2 text-center"><Cell value={row.fd} /></td>
                        <td className="px-2 py-2 text-center"><Cell value={row.wd} /></td>
                        <td className="px-2 py-2 text-center"><Cell value={row.fade} /></td>
                        <td className="px-2 py-2 text-center"><Cell value={row.highland} /></td>
                        <td className="px-2 py-2 text-center bg-amber-950/20"><Cell value={row.sps} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-3.5 text-[12px] text-emerald-100/90 leading-relaxed">
                <strong className="text-emerald-300">The SPS edge:</strong> writers don’t leave the studio to “hand off”
                to production. Continuity Intel, Archive milestones, co-write locks, and Matrix sync live in the same
                console — so the page you write is the page that gets shot-crafted.
              </div>
            </>
          )}

          {tab === 'resources' && (
            <>
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                A short craft digest — websites, blogs, YouTube, plus movie / director / DoP / art / screenplay
                anchors so you can steer LLM intelligence with concrete taste.
              </p>

              <CinematicReferencesPanel
                sectionId="writer"
                genreKey={
                  (typeof window !== 'undefined' && localStorage.getItem('sps_preset_profile')) ||
                  'mythological'
                }
                projectTitle={
                  (typeof window !== 'undefined' && localStorage.getItem('sps_current_project_title')) ||
                  ''
                }
              />

              <ResourceBlock
                icon={Globe}
                title="Websites"
                items={WRITER_RESOURCES.websites}
              />
              <ResourceBlock
                icon={Newspaper}
                title="Blogs & essays"
                items={WRITER_RESOURCES.blogs}
              />
              <ResourceBlock
                icon={PlayCircle}
                title="YouTube channels"
                items={WRITER_RESOURCES.youtube}
              />
            </>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-zinc-800 text-[10px] text-zinc-500 flex flex-wrap justify-between gap-2 shrink-0">
          <span>Tip: keep {MOD}+1–7 in muscle memory — same as Final Draft & WriterDuet.</span>
          <button type="button" onClick={onClose} className="text-amber-300 font-bold cursor-pointer hover:text-amber-200">
            Close · Esc
          </button>
        </div>
      </div>
    </div>
  );
}

function ResourceBlock({ icon: Icon, title, items }) {
  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <div className="px-3 py-2 bg-zinc-900 text-[10px] font-black uppercase tracking-wide text-zinc-400 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </div>
      <ul className="divide-y divide-zinc-800/80">
        {items.map((item) => (
          <li key={item.url} className="px-3 py-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-bold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
              >
                {item.name}
                <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
              </a>
              <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{item.blurb}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
