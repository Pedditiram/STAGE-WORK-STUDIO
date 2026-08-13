import React, { useMemo, useState } from 'react';
import { X, Columns2, Filter, ExternalLink, RotateCcw } from 'lucide-react';
import {
  diffScreenplayLines,
  summarizeDiff,
  filterChangedOnly,
  buildDiffPopoutHtml,
  openDiffPopout
} from '../utils/screenplayDiff';

/**
 * In-app version/archive compare + pop-out window.
 */
export default function ScreenplayDiffModal({
  isOpen,
  onClose,
  leftText = '',
  rightText = '',
  leftLabel = 'Version',
  rightLabel = 'Current Editor',
  title = 'Script Compare',
  onRestoreLeft
}) {
  const [changedOnly, setChangedOnly] = useState(true);
  const [sideBySide, setSideBySide] = useState(true);

  const rows = useMemo(
    () => diffScreenplayLines(leftText, rightText),
    [leftText, rightText]
  );
  const stats = useMemo(() => summarizeDiff(rows), [rows]);
  const viewRows = useMemo(
    () => (changedOnly ? filterChangedOnly(rows, { context: 1 }) : rows),
    [rows, changedOnly]
  );

  if (!isOpen) return null;

  const handlePopout = () => {
    const html = buildDiffPopoutHtml({
      title,
      leftLabel,
      rightLabel,
      rows,
      changedOnly
    });
    const ok = openDiffPopout(html);
    if (!ok) {
      alert('Pop-up blocked. Allow pop-ups for this site, or use this compare panel.');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
      <div className="force-dark w-full max-w-6xl h-[90vh] max-h-[920px] rounded-2xl border border-zinc-700 bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-zinc-900/90">
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase tracking-wide text-amber-300 truncate">{title}</h3>
            <p className="text-[11px] text-zinc-500 truncate">
              {leftLabel} → {rightLabel}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-zinc-400 px-2">
              <span className="text-emerald-400">+{stats.add}</span>
              {' · '}
              <span className="text-rose-400">−{stats.del}</span>
              {' · '}
              <span className="text-amber-300">~{stats.change}</span>
            </span>
            <button
              type="button"
              onClick={() => setChangedOnly((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border flex items-center gap-1 cursor-pointer ${
                changedOnly
                  ? 'bg-amber-500 text-zinc-950 border-amber-400'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}
              title="Show only changed parts"
            >
              <Filter className="w-3 h-3" />
              {changedOnly ? 'Changed only' : 'Full script'}
            </button>
            <button
              type="button"
              onClick={() => setSideBySide((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-black border bg-zinc-800 text-zinc-300 border-zinc-700 flex items-center gap-1 cursor-pointer"
            >
              <Columns2 className="w-3 h-3" />
              {sideBySide ? 'Side-by-side' : 'Unified'}
            </button>
            <button
              type="button"
              onClick={handlePopout}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-black border bg-cyan-800 hover:bg-cyan-700 text-white border-cyan-600 flex items-center gap-1 cursor-pointer"
              title="Open in separate browser window"
            >
              <ExternalLink className="w-3 h-3" />
              Separate window
            </button>
            {typeof onRestoreLeft === 'function' && (
              <button
                type="button"
                onClick={onRestoreLeft}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-black border bg-emerald-800 hover:bg-emerald-700 text-white border-emerald-600 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Restore left
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              aria-label="Close compare"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto font-mono text-[12px] leading-relaxed">
          {viewRows.length === 0 && (
            <p className="p-8 text-center text-zinc-500 text-sm">
              {changedOnly ? 'No differences — scripts match.' : 'Nothing to compare.'}
            </p>
          )}

          {sideBySide ? (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-left px-2 py-2 bg-rose-950 text-rose-200 text-[10px] font-black w-[50%]">
                    {leftLabel}
                  </th>
                  <th className="text-left px-2 py-2 bg-emerald-950 text-emerald-200 text-[10px] font-black w-[50%]">
                    {rightLabel}
                  </th>
                </tr>
              </thead>
              <tbody>
                {viewRows.map((r, idx) => {
                  if (r.type === 'gap') {
                    return (
                      <tr key={`g-${idx}`}>
                        <td colSpan={2} className="px-3 py-2 text-center text-[10px] text-zinc-600 bg-zinc-900/50">
                          ··· unchanged lines omitted ···
                        </td>
                      </tr>
                    );
                  }
                  const leftBg =
                    r.type === 'del' || r.type === 'change'
                      ? 'bg-rose-950/50 text-rose-100'
                      : r.type === 'equal'
                        ? 'text-zinc-600'
                        : 'text-zinc-700';
                  const rightBg =
                    r.type === 'add' || r.type === 'change'
                      ? 'bg-emerald-950/40 text-emerald-100'
                      : r.type === 'equal'
                        ? 'text-zinc-600'
                        : 'text-zinc-700';
                  return (
                    <tr key={`r-${idx}`} className="align-top border-b border-zinc-900">
                      <td className={`px-2 py-0.5 whitespace-pre-wrap ${leftBg}`}>
                        <span className="inline-block w-8 text-zinc-600 text-right mr-2 select-none text-[10px]">
                          {r.oldIdx || ''}
                        </span>
                        {r.oldLine || (r.type === 'add' ? '' : ' ')}
                      </td>
                      <td className={`px-2 py-0.5 whitespace-pre-wrap ${rightBg}`}>
                        <span className="inline-block w-8 text-zinc-600 text-right mr-2 select-none text-[10px]">
                          {r.newIdx || ''}
                        </span>
                        {r.newLine || (r.type === 'del' ? '' : ' ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-2 space-y-0.5">
              {viewRows.map((r, idx) => {
                if (r.type === 'gap') {
                  return (
                    <div key={`ug-${idx}`} className="text-center text-[10px] text-zinc-600 py-2">
                      ··· unchanged lines omitted ···
                    </div>
                  );
                }
                if (r.type === 'equal') {
                  return (
                    <div key={`ue-${idx}`} className="px-2 text-zinc-600 whitespace-pre-wrap">
                      <span className="text-zinc-700 mr-2"> </span>
                      {r.newLine}
                    </div>
                  );
                }
                if (r.type === 'del') {
                  return (
                    <div key={`ud-${idx}`} className="px-2 bg-rose-950/50 text-rose-200 whitespace-pre-wrap">
                      <span className="text-rose-400 mr-2">−</span>
                      {r.oldLine}
                    </div>
                  );
                }
                if (r.type === 'add') {
                  return (
                    <div key={`ua-${idx}`} className="px-2 bg-emerald-950/40 text-emerald-200 whitespace-pre-wrap">
                      <span className="text-emerald-400 mr-2">+</span>
                      {r.newLine}
                    </div>
                  );
                }
                return (
                  <div key={`uc-${idx}`} className="space-y-0.5">
                    <div className="px-2 bg-rose-950/40 text-rose-200 whitespace-pre-wrap">
                      <span className="text-rose-400 mr-2">−</span>
                      {r.oldLine}
                    </div>
                    <div className="px-2 bg-amber-950/40 text-amber-100 whitespace-pre-wrap">
                      <span className="text-amber-400 mr-2">~</span>
                      {r.newLine}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
