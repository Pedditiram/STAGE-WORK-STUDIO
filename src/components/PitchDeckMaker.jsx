import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft, ChevronRight, RefreshCw, ClipboardCheck,
  Pencil, Wand2, Presentation, Plus, Trash2, Maximize2, Minimize2, Download, X, Users
} from 'lucide-react';
import HoverPinBar from './HoverPinBar';
import { buildPitchDocx, buildPitchPptx, downloadBinary, pitchDeckToPrintHtml } from '../utils/pitchDeckExport';
import { assertExportAllowed, logExportSuccess, resolveCollabRoomId, exportDownloadText } from '../utils/exportGate';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import {
  PITCH_AUDIENCES,
  PITCH_FONTS,
  PITCH_FORMATS,
  PITCH_LAYOUTS,
  PITCH_PALETTES,
  PITCH_SIZES,
  PITCH_TEMPLATES,
  DEFAULT_PITCH_FORMAT,
  blankPitchSlide,
  buildInvestorPitchDeck,
  buildPitchDeckZipFiles,
  characterSheetSlide,
  clonePitchSlides,
  collectPitchFacts,
  generateLoglineOptions,
  normalizeFundSplit,
  pitchDeckToCsv,
  pitchDeckToMarkdown,
  pitchFormatDimension,
  pitchStageBox,
  qualityChecklist,
  resolvePitchFormat,
  resolvePitchStyle,
  savePitchDeckLocal,
  scorePitchDeck,
  logPitchBeatExclusions,
  collectPitchBeatExclusions
} from '../utils/pitchDeckMaker';
import { openMatrixLifecycleFilter } from '../utils/productionLifecycle';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';
import { persistPitchStill, readLocalImageFile, pitchStillSrc } from '../utils/localPitchMedia';
import { generateGeminiPitchStill, geminiImageAspect } from '../services/geminiImageClient';
import { polishPitchSlideWithGemini } from '../utils/pitchSlideLlm';

const fieldClass =
  'rounded-[var(--sps-radius-sm)] border border-[var(--sps-border)] bg-[var(--sps-surface)] text-[11px] text-[var(--sps-text)] px-2 py-1 focus:outline-none focus:border-[var(--sps-gold)]';
const formFieldClass = `w-full ${fieldClass} py-1.5`;

function pitchCssVars(style = {}) {
  return {
    '--pitch-paper': style.paper || '#1c1914',
    '--pitch-ink': style.ink || '#f4ede3',
    '--pitch-muted': style.muted || '#9a8b7a',
    '--pitch-gold': style.gold || '#c4a574',
    '--pitch-display': style.display || 'var(--sps-font-display)',
    '--pitch-body': style.body || 'var(--sps-font)'
  };
}

function SlideFrames({
  slide,
  placements,
  lookOnly,
  placeImage,
  compact,
  fill = false,
  onGenerate,
  generatingKey = ''
}) {
  const frames = slide.frames || [];
  if (!frames.length) return null;
  const cols =
    frames.length === 1 ? 'grid-cols-1' : frames.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';
  return (
    <div
      className={`${fill ? 'absolute inset-0 grid' : `grid gap-2 ${compact ? 'mt-3' : 'mt-4'}`} ${cols}`}
      style={fill ? { gap: 0 } : undefined}
    >
      {frames.map((fr, fi) => {
        const key = `${slide.id}:${fi}`;
        const src = pitchStillSrc(placements[key] || slide.images?.[fi] || '');
        const busy = generatingKey === key;
        return (
          <label
            key={key}
            className={`relative block overflow-hidden ${fill ? 'min-h-0 h-full' : compact ? 'min-h-[7rem]' : 'min-h-[11rem]'} ${
              lookOnly || !placeImage ? '' : 'cursor-pointer'
            }`}
            style={{
              border: fill ? 'none' : '1px dashed color-mix(in srgb, var(--pitch-gold) 50%, transparent)',
              background: 'color-mix(in srgb, var(--pitch-ink) 6%, var(--pitch-paper))'
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              placeImage?.(key, e.dataTransfer.files?.[0]);
            }}
          >
            {src ? (
              <img src={src} alt={fr.label} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                <span className="text-[11px] font-semibold" style={{ color: 'var(--pitch-gold)' }}>{fr.label}</span>
                <span className="text-[10px] mt-1" style={{ color: 'var(--pitch-muted)' }}>
                  {fr.hint || 'Drop still · Generate · ≥ 1 MB on this disk'}
                </span>
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={lookOnly || !placeImage}
              onChange={(e) => {
                placeImage?.(key, e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {!lookOnly && onGenerate ? (
              <button
                type="button"
                className="absolute bottom-1.5 right-1.5 sps-quiet-link"
                style={{ background: 'color-mix(in srgb, var(--pitch-paper) 82%, transparent)' }}
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onGenerate(key, fi);
                }}
              >
                {busy ? 'Generating' : 'Generate'}
              </button>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

function PointList({ slide, isManual, lookOnly, fieldClass, patchPoint, present }) {
  const points = slide.points || [];
  if (!points.length && !isManual) return null;
  return (
    <ul className={`${present ? 'space-y-3 mt-0' : 'mt-5 space-y-2.5'} flex-1 m-0 p-0 list-none`}>
      {points.map((pt, pi) => (
        <li
          key={pi}
          className={`leading-relaxed flex gap-2 whitespace-pre-wrap ${present ? 'text-lg md:text-xl' : 'text-[13px]'}`}
          style={{ color: 'var(--pitch-ink)' }}
        >
          <span className="shrink-0" style={{ color: 'var(--pitch-gold)' }}>—</span>
          {isManual && !present ? (
            <textarea
              className={`${fieldClass} min-h-[2.5rem] resize-y flex-1`}
              value={pt}
              disabled={lookOnly}
              onChange={(e) => patchPoint(pi, e.target.value)}
              rows={2}
            />
          ) : (
            <span>{pt}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function PitchSlideCard({
  slide,
  style,
  placements,
  lookOnly,
  isManual,
  present,
  formFieldClass,
  fieldClass,
  patchSlide,
  patchPoint,
  addPoint,
  removeSlide,
  canRemove,
  placeImage,
  fundSplitUi,
  frameStyle,
  onGenerate,
  generatingKey = ''
}) {
  const layout = slide.layout || slide.kind || 'page';
  const isCover = layout === 'cover';
  const isHero = layout === 'hero';
  const isQuote = layout === 'quote';
  const isSheet = layout === 'sheet';
  const isSplit = layout === 'split';
  const isGrid = layout === 'grid';
  const isCrew = layout === 'crew';
  const titleSize = present
    ? isCover || isQuote || isHero
      ? 'text-5xl md:text-6xl'
      : 'text-4xl md:text-5xl'
    : isCover || isQuote || isHero
      ? 'text-[clamp(1.6rem,4.2cqw,2.6rem)]'
      : 'text-[clamp(1.35rem,3.4cqw,2rem)]';
  const frameProps = {
    slide,
    placements,
    lookOnly: lookOnly || present,
    placeImage: present ? undefined : placeImage,
    onGenerate: present ? undefined : onGenerate,
    generatingKey
  };
  const people = slide.fields?.people || [];
  const crew = slide.fields?.crew || [];

  return (
    <article
      className={`sps-pitch-slide w-full h-full flex flex-col overflow-hidden shrink-0 ${
        present ? 'min-h-0' : 'rounded-[4px] border'
      } ${isHero || isCover ? 'relative' : ''} ${present ? '' : 'px-[6%] py-[7%]'}`}
      style={{
        ...pitchCssVars(style),
        ...(present ? {} : frameStyle || {}),
        background: present ? 'transparent' : 'var(--pitch-paper)',
        color: 'var(--pitch-ink)',
        fontFamily: 'var(--pitch-body)',
        borderColor: present ? 'transparent' : 'color-mix(in srgb, var(--pitch-gold) 28%, transparent)',
        boxShadow: present ? 'none' : 'var(--sps-shadow-lift)'
      }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.18em] m-0"
        style={{ color: 'var(--pitch-gold)' }}
      >
        {isManual && !present ? (
          <input
            className={`${formFieldClass} font-bold uppercase tracking-[0.18em]`}
            value={slide.kicker || ''}
            onChange={(e) => patchSlide({ kicker: e.target.value })}
          />
        ) : (
          slide.kicker
        )}
      </p>

      {isHero ? (
        <div className="flex-1 min-h-0 grid grid-rows-[1fr_auto] gap-3 mt-3">
          <div className="relative min-h-0">
            <SlideFrames {...frameProps} fill />
          </div>
          <div>
            {isManual && !present ? (
              <input
                className={`${formFieldClass} ${titleSize} font-semibold`}
                style={{ fontFamily: 'var(--pitch-display)', color: 'var(--pitch-ink)' }}
                value={slide.title || ''}
                onChange={(e) => patchSlide({ title: e.target.value })}
              />
            ) : (
              <h3 className={`${titleSize} leading-tight font-semibold m-0`} style={{ fontFamily: 'var(--pitch-display)' }}>
                {slide.title}
              </h3>
            )}
            {slide.subtitle ? (
              <p className={`${present ? 'text-xl' : 'text-[14px]'} leading-relaxed m-0 mt-2 opacity-90 whitespace-pre-wrap`}>
                {slide.subtitle}
              </p>
            ) : null}
          </div>
        </div>
      ) : isCover ? (
        <div className="flex-1 min-h-0 grid md:grid-cols-[1.05fr_0.95fr] gap-6 mt-4">
          <div className="flex flex-col min-h-0">
            {isManual && !present ? (
              <input
                className={`${formFieldClass} ${titleSize} font-semibold mb-3`}
                style={{ fontFamily: 'var(--pitch-display)', color: 'var(--pitch-ink)' }}
                value={slide.title || ''}
                onChange={(e) => patchSlide({ title: e.target.value })}
              />
            ) : (
              <h3 className={`${titleSize} leading-[1.05] font-semibold m-0 mb-4`} style={{ fontFamily: 'var(--pitch-display)' }}>
                {slide.title}
              </h3>
            )}
            {isManual && !present ? (
              <textarea
                className={`${formFieldClass} min-h-[4.5rem] resize-y flex-1`}
                value={slide.subtitle || ''}
                placeholder="Logline"
                onChange={(e) => patchSlide({ subtitle: e.target.value })}
                rows={4}
              />
            ) : slide.subtitle ? (
              <p className={`${present ? 'text-2xl md:text-3xl' : 'text-[clamp(1rem,2.2cqw,1.25rem)]'} leading-relaxed m-0 opacity-90 whitespace-pre-wrap`}>
                {slide.subtitle}
              </p>
            ) : null}
            <PointList slide={slide} isManual={isManual} lookOnly={lookOnly} fieldClass={fieldClass} patchPoint={patchPoint} present={present} />
          </div>
          <div className="relative min-h-[12rem]">
            <SlideFrames {...frameProps} fill />
          </div>
        </div>
      ) : isGrid ? (
        <div className="flex-1 min-h-0 flex flex-col mt-3">
          {isManual && !present ? (
            <input
              className={`${formFieldClass} ${titleSize} font-semibold mb-2`}
              style={{ fontFamily: 'var(--pitch-display)', color: 'var(--pitch-ink)' }}
              value={slide.title || ''}
              onChange={(e) => patchSlide({ title: e.target.value })}
            />
          ) : (
            <h3 className={`${titleSize} leading-tight font-semibold m-0 mb-1`} style={{ fontFamily: 'var(--pitch-display)' }}>
              {slide.title}
            </h3>
          )}
          {slide.subtitle ? (
            <p className={`${present ? 'text-lg' : 'text-[13px]'} m-0 mb-3 opacity-90`}>{slide.subtitle}</p>
          ) : null}
          <div className="flex-1 min-h-0 relative">
            <SlideFrames {...frameProps} fill />
          </div>
          {people.length ? (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 m-0 p-0 list-none">
              {people.slice(0, 8).map((p, i) => (
                <li key={`${p.id || p.name || 'cast'}-${i}`} className="text-[11px] leading-snug" style={{ color: 'var(--pitch-ink)' }}>
                  <span className="font-semibold">{p.name}</span>
                  <span style={{ color: 'var(--pitch-muted)' }}> · {p.role || 'Principal'} [{p.status || 'PROPOSED'}]</span>
                </li>
              ))}
            </ul>
          ) : (
            <PointList slide={slide} isManual={isManual} lookOnly={lookOnly} fieldClass={fieldClass} patchPoint={patchPoint} present={present} />
          )}
        </div>
      ) : isCrew ? (
        <div className="flex-1 min-h-0 flex flex-col mt-3">
          {isManual && !present ? (
            <input
              className={`${formFieldClass} ${titleSize} font-semibold mb-2`}
              style={{ fontFamily: 'var(--pitch-display)', color: 'var(--pitch-ink)' }}
              value={slide.title || ''}
              onChange={(e) => patchSlide({ title: e.target.value })}
            />
          ) : (
            <h3 className={`${titleSize} leading-tight font-semibold m-0 mb-1`} style={{ fontFamily: 'var(--pitch-display)' }}>
              {slide.title}
            </h3>
          )}
          {slide.subtitle ? (
            <p className={`${present ? 'text-lg' : 'text-[13px]'} m-0 mb-3 opacity-90`}>{slide.subtitle}</p>
          ) : null}
          {crew.length ? (
            <table className="w-full border-collapse text-left flex-1">
              <tbody>
                {crew.map((row) => (
                  <tr key={row.dept || row.name} className="border-t" style={{ borderColor: 'color-mix(in srgb, var(--pitch-gold) 22%, transparent)' }}>
                    <th className="py-2 pr-3 font-semibold w-[38%]" style={{ color: 'var(--pitch-gold)', fontFamily: 'var(--pitch-display)' }}>
                      {row.dept}
                    </th>
                    <td className="py-2">{row.name || 'DATA REQUIRED'}</td>
                    <td className="py-2 text-right text-[10px] uppercase tracking-wide" style={{ color: 'var(--pitch-muted)' }}>
                      {row.status || 'DATA REQUIRED'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <PointList slide={slide} isManual={isManual} lookOnly={lookOnly} fieldClass={fieldClass} patchPoint={patchPoint} present={present} />
          )}
        </div>
      ) : isSheet ? (
        <div className={`grid gap-6 flex-1 min-h-0 ${present ? 'mt-8 md:grid-cols-[16rem_1fr]' : 'mt-5 md:grid-cols-[minmax(10rem,14rem)_1fr]'}`}>
          <div className="relative min-h-[10rem]">
            <SlideFrames {...frameProps} fill compact />
            {slide.fields?.status ? (
              <p className="text-[10px] uppercase tracking-wide mt-2 m-0" style={{ color: 'var(--pitch-muted)' }}>
                {slide.fields.status}
              </p>
            ) : null}
          </div>
          <div className="min-h-0 overflow-hidden">
            {isManual && !present ? (
              <input
                className={`${formFieldClass} ${titleSize} font-semibold mb-2`}
                style={{ fontFamily: 'var(--pitch-display)', color: 'var(--pitch-ink)' }}
                value={slide.title || ''}
                onChange={(e) => patchSlide({ title: e.target.value })}
              />
            ) : (
              <h3 className={`${titleSize} leading-tight mb-2 font-semibold m-0`} style={{ fontFamily: 'var(--pitch-display)' }}>
                {slide.title}
              </h3>
            )}
            {isManual && !present ? (
              <input
                className={`${formFieldClass} mb-4`}
                value={slide.subtitle || ''}
                placeholder="Role · age"
                onChange={(e) => patchSlide({ subtitle: e.target.value })}
              />
            ) : slide.subtitle ? (
              <p className={`${present ? 'text-xl' : 'text-[14px]'} leading-relaxed m-0 mb-4 opacity-90`}>
                {slide.subtitle}
              </p>
            ) : null}
            <PointList slide={slide} isManual={isManual} lookOnly={lookOnly} fieldClass={fieldClass} patchPoint={patchPoint} present={present} />
          </div>
        </div>
      ) : (
        <>
          {isManual && !present ? (
            <input
              className={`${formFieldClass} ${titleSize} font-semibold mt-4 mb-3`}
              style={{ fontFamily: 'var(--pitch-display)', color: 'var(--pitch-ink)' }}
              value={slide.title || ''}
              onChange={(e) => patchSlide({ title: e.target.value })}
            />
          ) : (
            <h3
              className={`${titleSize} leading-tight ${isQuote ? 'mt-8 mb-6' : 'mt-4 mb-3'} font-semibold`}
              style={{ fontFamily: 'var(--pitch-display)', color: 'var(--pitch-ink)' }}
            >
              {slide.title}
            </h3>
          )}
          {isManual && !present ? (
            <textarea
              className={`${formFieldClass} min-h-[3rem] resize-y ${isQuote ? 'text-[1.05rem]' : ''}`}
              value={slide.subtitle || ''}
              placeholder="Subtitle / logline"
              onChange={(e) => patchSlide({ subtitle: e.target.value })}
              rows={isQuote ? 3 : 2}
            />
          ) : slide.subtitle ? (
            <p
              className={`${isQuote ? (present ? 'text-2xl md:text-3xl' : 'text-[1.15rem]') : present ? 'text-xl' : 'text-[14px]'} leading-relaxed m-0 opacity-90 whitespace-pre-wrap`}
              style={{ fontFamily: isQuote ? 'var(--pitch-display)' : 'var(--pitch-body)' }}
            >
              {slide.subtitle}
            </p>
          ) : null}
          {isSplit ? (
            <div className="grid md:grid-cols-2 gap-6 mt-2 flex-1 min-h-0">
              <div className="relative min-h-[10rem]">
                <SlideFrames {...frameProps} fill />
              </div>
              <PointList slide={slide} isManual={isManual} lookOnly={lookOnly} fieldClass={fieldClass} patchPoint={patchPoint} present={present} />
            </div>
          ) : (
            <>
              <div className="relative flex-1 min-h-[10rem] mt-3">
                <SlideFrames {...frameProps} fill={Boolean((slide.frames || []).length)} />
              </div>
              {!isQuote || (isManual && !present) ? (
                <PointList slide={slide} isManual={isManual} lookOnly={lookOnly} fieldClass={fieldClass} patchPoint={patchPoint} present={present} />
              ) : null}
            </>
          )}
        </>
      )}

      {fundSplitUi}
      {isManual && !present && !lookOnly ? (
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" className="sps-btn" onClick={addPoint}>
            <Plus className="w-3.5 h-3.5" />
            Add line
          </button>
          <button type="button" className="sps-btn" disabled={!canRemove} onClick={removeSlide}>
            <Trash2 className="w-3.5 h-3.5" />
            Delete slide
          </button>
        </div>
      ) : null}
      {slide.disclaimer ? (
        <p className="text-[11px] italic mt-4 m-0" style={{ color: 'var(--pitch-muted)' }}>{slide.disclaimer}</p>
      ) : null}
      {slide.footer && !present ? (
        <p
          className="text-[10px] uppercase tracking-wide mt-6 pt-4 m-0"
          style={{ color: 'var(--pitch-muted)', borderTop: '1px solid color-mix(in srgb, var(--pitch-gold) 22%, transparent)' }}
        >
          {slide.footer}
        </p>
      ) : null}
    </article>
  );
}

export default function PitchDeckMaker({
  shots = [],
  projectTitle = 'Untitled Feature',
  aspectRatio = '2.39:1',
  genreKey = '',
  onDirty,
  lookOnly = false,
  onToggleFullscreen,
  fullscreen = false
}) {
  const [audienceId, setAudienceId] = useState('investor');
  const [sizeId, setSizeId] = useState('standard');
  const [formatId, setFormatId] = useState(() => {
    try {
      return localStorage.getItem('sps_pitch_slide_format') || DEFAULT_PITCH_FORMAT;
    } catch {
      return DEFAULT_PITCH_FORMAT;
    }
  });
  const [templateId, setTemplateId] = useState('classic');
  const [paletteId, setPaletteId] = useState('studio');
  const [fontId, setFontId] = useState('studio');
  const [loglineId, setLoglineId] = useState('a');
  const [slideIndex, setSlideIndex] = useState(0);
  const [showCheck, setShowCheck] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [fundSplit, setFundSplit] = useState(null);
  const [budgetAsk, setBudgetAsk] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [rebuild, setRebuild] = useState(0);
  const [placements, setPlacements] = useState({});
  const [deckMode, setDeckMode] = useState('project');
  const [manualSlides, setManualSlides] = useState([]);
  const [presenting, setPresenting] = useState(false);
  const [stillBusy, setStillBusy] = useState('');
  const [copyBusy, setCopyBusy] = useState(false);
  const [pitchNote, setPitchNote] = useState('');

  const facts = useMemo(() => {
    void rebuild;
    const base = collectPitchFacts({ shots, projectTitle, aspectRatio, genreKey });
    if (budgetAsk.trim()) {
      base.investmentAsk = { value: budgetAsk.trim(), status: 'ASSUMPTION' };
      base.budgetTotal = { value: budgetAsk.trim(), status: 'ASSUMPTION' };
    }
    return base;
  }, [shots, projectTitle, aspectRatio, genreKey, rebuild, budgetAsk]);

  const excludedBeatCount = useMemo(() => collectPitchBeatExclusions(shots).length, [shots]);

  const loglines = useMemo(() => generateLoglineOptions(facts), [facts]);
  const loglineText = (loglines.find((l) => l.id === loglineId) || loglines[0])?.text || '';

  const deck = useMemo(
    () =>
      buildInvestorPitchDeck({
        facts,
        audienceId,
        sizeId,
        loglineText,
        fundSplit: fundSplit || facts.fundSplit,
        templateId,
        paletteId,
        fontId,
        formatId
      }),
    [facts, audienceId, sizeId, loglineText, fundSplit, templateId, paletteId, fontId, formatId]
  );

  const autoSlides = deck.slides || [];
  const slides = deckMode === 'manual' && manualSlides.length ? manualSlides : autoSlides;
  const current = slides[slideIndex] || slides[0];
  const style = deck.style || resolvePitchStyle(paletteId, fontId, deck.theme);
  const scores = useMemo(() => scorePitchDeck({ ...deck, slides }), [deck, slides]);
  const checks = useMemo(() => qualityChecklist({ ...deck, slides }), [deck, slides]);
  const splitNorm = normalizeFundSplit(fundSplit || facts.fundSplit);
  const exportDeck = { ...deck, slides };
  const isManual = deckMode === 'manual';
  const pitchFrame = resolvePitchFormat(formatId);
  const presentBox = pitchStageBox(pitchFrame, true);
  const exportLife = useMemo(() => lifecycleExportReadiness(shots, projectTitle), [shots, projectTitle]);
  const {
    strict: pitchLifecycleStrict,
    mode: pitchLifecycleMode
  } = useExportLifecyclePref('pitch');
  const exportBlocked = pitchLifecycleStrict && !exportLife.exportReady;

  useEffect(() => {
    setSlideIndex(0);
  }, [audienceId, sizeId, templateId]);

  const mark = () => onDirty?.();

  const updatePct = (id, pct) => {
    if (lookOnly) return;
    mark();
    setFundSplit((prev) => {
      const base = (prev || facts.fundSplit).map((r) =>
        r.id === id ? { ...r, pct: Math.max(0, Math.min(100, Number(pct) || 0)) } : r
      );
      return base;
    });
  };

  const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
  const roomId = resolveCollabRoomId();
  const lifeNote = `${slides.length} slides · ${audienceId}/${templateId}/${sizeId}/${formatId} · ${isManual ? 'manual' : 'auto'}${roomId ? ` · room:${roomId}` : ''}`;

  useEffect(() => {
    try {
      localStorage.setItem('sps_pitch_slide_format', formatId);
    } catch {
      /* ignore */
    }
  }, [formatId]);

  useEffect(() => {
    if (lookOnly) return undefined;
    const t = window.setTimeout(() => {
      savePitchDeckLocal({ ...deck, slides }, projectTitle);
    }, 500);
    return () => window.clearTimeout(t);
  }, [lookOnly, projectTitle, deck, slides]);

  const placeImage = async (key, file) => {
    if (lookOnly || !file || !file.type.startsWith('image/')) return;
    mark();
    const src = await readLocalImageFile(file);
    const frameIndex = Number(String(key).split(':').pop() || 0);
    const saved = await persistPitchStill({
      projectTitle,
      slideId: current?.id || 'slide',
      index: frameIndex,
      dataUrl: src
    });
    setPlacements((prev) => ({ ...prev, [key]: saved.dataUrl }));
    setPitchNote('Still on this disk · ≥ 1 MB · synced to collaborators’ local stores');
  };

  const generateStill = async (key, frameIndex = 0) => {
    if (lookOnly || !current) return;
    setStillBusy(key);
    setPitchNote('');
    try {
      const prompt = [
        'Cinematic film pitch still. No title text, no logos, no watermarks, no lettering.',
        `Project: ${projectTitle}.`,
        current.title ? `Subject: ${current.title}.` : '',
        current.subtitle || '',
        (current.points || []).slice(0, 2).join(' '),
        facts.genreLabel ? `Genre: ${facts.genreLabel}.` : ''
      ].filter(Boolean).join(' ');
      const { dataUrl, modelId } = await generateGeminiPitchStill({
        prompt,
        aspectRatio: geminiImageAspect(pitchFrame)
      });
      const saved = await persistPitchStill({
        projectTitle,
        slideId: current.id,
        index: frameIndex,
        dataUrl
      });
      mark();
      setPlacements((prev) => ({ ...prev, [key]: saved.dataUrl }));
      setPitchNote(`Still on this disk · ≥ 1 MB · ${modelId}`);
    } catch (err) {
      setPitchNote(err?.message || 'Still failed');
    } finally {
      setStillBusy('');
    }
  };

  const polishCurrent = async () => {
    if (lookOnly || !current) return;
    setCopyBusy(true);
    setPitchNote('');
    try {
      const polished = await polishPitchSlideWithGemini({ slide: current, facts, logline: loglineText });
      mark();
      setDeckMode('manual');
      setManualSlides((prev) => {
        const base = prev.length ? prev : clonePitchSlides(autoSlides);
        return base.map((s, i) => (i === slideIndex ? { ...s, ...polished } : s));
      });
      setPitchNote('Copy polished on this machine · Gemini 3.6 · no invented numbers');
    } catch (err) {
      setPitchNote(err?.message || 'Polish failed');
    } finally {
      setCopyBusy(false);
    }
  };

  const exportKeynote = () => {
    const filename = `${slug}_pitch.keynote.pptx`;
    const gate = assertExportAllowed({
      projectTitle,
      label: 'pitch_deck_keynote',
      format: 'pptx',
      lifecycleMode: pitchLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    const bytes = buildPitchPptx(exportDeck, placements);
    downloadBinary(filename, bytes, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    logExportSuccess({
      projectTitle,
      label: 'pitch_deck_keynote',
      format: 'pptx',
      filename,
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${pitchLifecycleMode}+ok` : pitchLifecycleMode
    });
    setSaveMsg('Exported for Keynote (.pptx)');
    setTimeout(() => setSaveMsg(''), 2200);
  };

  const exportPages = () => {
    const filename = `${slug}_pitch.pages.docx`;
    const gate = assertExportAllowed({
      projectTitle,
      label: 'pitch_deck_pages',
      format: 'docx',
      lifecycleMode: pitchLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    const bytes = buildPitchDocx(exportDeck, placements);
    downloadBinary(filename, bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    logExportSuccess({
      projectTitle,
      label: 'pitch_deck_pages',
      format: 'docx',
      filename,
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${pitchLifecycleMode}+ok` : pitchLifecycleMode
    });
    setSaveMsg('Exported for Pages (.docx)');
    setTimeout(() => setSaveMsg(''), 2200);
  };

  const exportPrintPdf = () => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'pitch_deck_pdf',
        format: 'pdf',
        lifecycleMode: pitchLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'pitch_deck_pdf',
      format: 'pdf',
      lifecycleMode: pitchLifecycleMode,
      shots,
      roomId,
      showAlert: true
    });
    if (!gate.ok) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    const audience = PITCH_AUDIENCES.find((a) => a.id === audienceId);
    const size = PITCH_SIZES.find((s) => s.id === sizeId);
    printWindow.document.write(
      pitchDeckToPrintHtml(
        {
          ...exportDeck,
          audienceId,
          audienceLabel: audience?.label || audienceId,
          sizeId,
          sizeLabel: size?.label || sizeId
        },
        { projectTitle, roomId }
      )
    );
    printWindow.document.close();
    logExportSuccess({
      projectTitle,
      label: 'pitch_deck_pdf',
      format: 'pdf',
      filename: `${slug}_pitch.pdf`,
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${pitchLifecycleMode}+ok` : pitchLifecycleMode
    });
    setSaveMsg('Print deck opened — save as PDF');
    setTimeout(() => setSaveMsg(''), 2200);
  };

  const exportMarkdown = () => {
    logPitchBeatExclusions(shots, { projectTitle });
    exportDownloadText(`${slug}_pitch.md`, pitchDeckToMarkdown(exportDeck), {
      projectTitle,
      auditLabel: 'pitch_deck_md',
      auditFormat: 'md',
      mime: 'text/markdown;charset=utf-8',
      lifecycleMode: pitchLifecycleMode,
      shots,
      roomId,
      note: lifeNote
    });
    setSaveMsg('Markdown outline exported');
    setTimeout(() => setSaveMsg(''), 2200);
  };

  const exportCsv = () => {
    logPitchBeatExclusions(shots, { projectTitle });
    exportDownloadText(`${slug}_pitch.csv`, pitchDeckToCsv(exportDeck), {
      projectTitle,
      auditLabel: 'pitch_deck_csv',
      auditFormat: 'csv',
      mime: 'text/csv;charset=utf-8',
      lifecycleMode: pitchLifecycleMode,
      shots,
      roomId,
      note: lifeNote
    });
    setSaveMsg('Slide CSV exported');
    setTimeout(() => setSaveMsg(''), 2200);
  };

  const exportZip = async () => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'pitch_deck_zip',
        format: 'zip',
        lifecycleMode: pitchLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'pitch_deck_zip',
      format: 'zip',
      lifecycleMode: pitchLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    logPitchBeatExclusions(shots, { projectTitle });
    const files = buildPitchDeckZipFiles(exportDeck, { roomId });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, `${slug}_pitch.zip`, {
      projectTitle,
      shots,
      lifecycleMode: pitchLifecycleMode,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      auditLabel: 'pitch_deck_zip',
      auditFormat: 'zip',
      roomId,
      note: lifeNote,
      showAlert: false
    });
    setSaveMsg('Pitch ZIP exported');
    setTimeout(() => setSaveMsg(''), 2200);
  };

  const enterManual = () => {
    mark();
    setManualSlides(clonePitchSlides(autoSlides.length ? autoSlides : [blankPitchSlide(1)]));
    setDeckMode('manual');
  };

  const patchSlide = (index, patch) => {
    if (lookOnly) return;
    mark();
    setManualSlides((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const patchPoint = (index, pointI, value) => {
    if (lookOnly) return;
    mark();
    setManualSlides((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const points = [...(s.points || [])];
        points[pointI] = value;
        return { ...s, points };
      })
    );
  };

  const addPoint = (index) => {
    if (lookOnly) return;
    mark();
    setManualSlides((prev) =>
      prev.map((s, i) => (i === index ? { ...s, points: [...(s.points || []), ''] } : s))
    );
  };

  const addSlide = (layout = 'page') => {
    if (lookOnly) return;
    mark();
    setManualSlides((prev) => {
      const slide = blankPitchSlide(prev.length + 1, layout === 'back' ? 'cover' : layout);
      if (layout === 'cover') {
        slide.navTitle = 'Cover';
        slide.kicker = 'Cover';
        slide.title = facts.title || slide.title;
        slide.layout = 'cover';
        slide.kind = 'cover';
      }
      if (layout === 'back') {
        slide.id = `back_${prev.length + 1}`;
        slide.navTitle = 'Back';
        slide.kicker = 'Back';
        slide.title = 'Thank you';
        slide.subtitle = facts.title || '';
        slide.layout = 'cover';
        slide.kind = 'cover';
      }
      const next = [...prev, slide];
      setSlideIndex(next.length - 1);
      return next;
    });
  };

  const insertCharacterSheets = () => {
    if (lookOnly) return;
    mark();
    const sheets = (facts.characters || []).length
      ? facts.characters.map((c, i) => characterSheetSlide(c, i))
      : [characterSheetSlide({}, 0)];
    if (!isManual) {
      setManualSlides(clonePitchSlides([...(autoSlides.length ? autoSlides : []), ...sheets]));
      setDeckMode('manual');
      setSlideIndex((autoSlides.length || 0));
      return;
    }
    setManualSlides((prev) => {
      const next = [...prev, ...sheets];
      setSlideIndex(prev.length);
      return next;
    });
  };

  const removeSlide = (index) => {
    if (lookOnly || slides.length <= 1) return;
    mark();
    setManualSlides((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setSlideIndex((n) => Math.min(n, next.length - 1));
      return next;
    });
  };

  useEffect(() => {
    if (!presenting) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setPresenting(false);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        e.stopPropagation();
        setSlideIndex((n) => Math.max(0, n - 1));
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        setSlideIndex((n) => Math.min(slides.length - 1, n + 1));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [presenting, slides.length]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <HoverPinBar
        storageKey="sps_pin_pitch_tools_v2"
        defaultPinned={true}
        pinLabel="Pitch tools"
        ariaLabel="Show pitch tools"
        wrap={false}
        className="z-20 shrink-0"
        barClassName="px-1.5 py-0.5 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] gap-0.5"
      >
        <button
          type="button"
          className="sps-icon-btn shrink-0"
          disabled={slideIndex <= 0}
          onClick={() => setSlideIndex((n) => Math.max(0, n - 1))}
          title="Previous slide"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] tabular-nums text-[var(--sps-muted)] whitespace-nowrap shrink-0 w-10 text-center">
          {slides.length ? slideIndex + 1 : 0}/{slides.length}
        </span>
        <button
          type="button"
          className="sps-icon-btn shrink-0"
          disabled={slideIndex >= slides.length - 1}
          onClick={() => setSlideIndex((n) => Math.min(slides.length - 1, n + 1))}
          title="Next slide"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <select
          className={`${fieldClass} w-[8.5rem] shrink-0`}
          value={templateId}
          disabled={lookOnly}
          title="Deck template"
          onChange={(e) => {
            mark();
            setTemplateId(e.target.value);
          }}
        >
          {PITCH_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          className={`${fieldClass} w-[6.25rem] shrink-0`}
          value={audienceId}
          disabled={lookOnly}
          title="Who are you presenting to?"
          onChange={(e) => {
            mark();
            setAudienceId(e.target.value);
          }}
        >
          {PITCH_AUDIENCES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <select
          className={`${fieldClass} w-[6.5rem] shrink-0`}
          value={sizeId}
          disabled={lookOnly || templateId !== 'classic'}
          title={templateId === 'classic' ? 'Deck length' : 'Length follows the template'}
          onChange={(e) => {
            mark();
            setSizeId(e.target.value);
          }}
        >
          {PITCH_SIZES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className={`${fieldClass} w-[9.5rem] shrink-0`}
          value={formatId}
          disabled={lookOnly}
          title={`Slide frame · ${pitchFormatDimension(pitchFrame)}`}
          onChange={(e) => {
            mark();
            setFormatId(e.target.value);
          }}
        >
          {PITCH_FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`sps-icon-btn shrink-0 ${!isManual ? 'is-on' : ''}`}
          onClick={() => setDeckMode('project')}
          title="From project"
        >
          <Wand2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className={`sps-icon-btn shrink-0 ${isManual ? 'is-on' : ''}`}
          onClick={enterManual}
          disabled={lookOnly}
          title="Manual slides"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="sps-icon-btn shrink-0" onClick={() => setRebuild((n) => n + 1)} title="Rebuild from project">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="sps-icon-btn shrink-0"
          onClick={insertCharacterSheets}
          disabled={lookOnly}
          title="Insert character sheets from Character Bible"
        >
          <Users className="w-3.5 h-3.5" />
        </button>
        {excludedBeatCount > 0 ? (
          <button
            type="button"
            className="text-[9px] font-mono text-[var(--sps-gold)] whitespace-nowrap shrink-0 px-1.5 hover:underline"
            title="Open Matrix filtered to draft/review shots that need approve"
            onClick={() =>
              openMatrixLifecycleFilter({
                statuses: ['draft', 'review'],
                id: 'needs_approve',
                source: 'pitch_excluded'
              })
            }
          >
            {excludedBeatCount} beat{excludedBeatCount === 1 ? '' : 's'} excluded → Matrix
          </button>
        ) : (
          <span className="text-[9px] font-mono text-[var(--sps-muted)] whitespace-nowrap shrink-0 px-1.5">
            {facts.liveShotCount || 0} approved
          </span>
        )}
        <button
          type="button"
          className="sps-icon-btn is-on shrink-0"
          onClick={() => setPresenting(true)}
          title="Present — arrows, Esc exits"
        >
          <Presentation className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="sps-icon-btn shrink-0" onClick={() => setShowCheck((v) => !v)} title="Quality">
          <ClipboardCheck className="w-3.5 h-3.5" />
        </button>
        <div className="relative shrink-0">
          <button
            type="button"
            className={`sps-icon-btn ${showExport ? 'is-on' : ''}`}
            disabled={lookOnly || exportBlocked}
            title={exportBlocked ? exportLife.message : 'Export'}
            onClick={() => setShowExport((v) => !v)}
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {showExport ? (
            <div className="absolute right-0 top-full mt-1 z-30 min-w-[11rem] rounded-[var(--sps-radius-sm)] border border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] p-1.5 shadow-lg flex flex-col gap-0.5">
              <button type="button" className="sps-quiet-link text-left px-2 py-1" onClick={() => { setShowExport(false); exportKeynote(); }}>Keynote (.pptx)</button>
              <button type="button" className="sps-quiet-link text-left px-2 py-1" onClick={() => { setShowExport(false); exportPages(); }}>Pages (.docx)</button>
              <button type="button" className="sps-quiet-link text-left px-2 py-1" onClick={() => { setShowExport(false); exportPrintPdf(); }}>Print PDF</button>
              <button type="button" className="sps-quiet-link text-left px-2 py-1" onClick={() => { setShowExport(false); exportMarkdown(); }}>Markdown</button>
              <button type="button" className="sps-quiet-link text-left px-2 py-1" onClick={() => { setShowExport(false); exportCsv(); }}>CSV</button>
              <button type="button" className="sps-quiet-link text-left px-2 py-1" onClick={() => { setShowExport(false); exportZip(); }}>ZIP pack</button>
            </div>
          ) : null}
        </div>
        {exportBlocked ? (
          <span className="text-[10px] text-[var(--sps-gold)] max-w-[14rem] leading-snug shrink-0 hidden xl:inline">
            {exportLife.message}
          </span>
        ) : null}
        {typeof onToggleFullscreen === 'function' ? (
          <button type="button" className="sps-icon-btn shrink-0" onClick={onToggleFullscreen} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        ) : null}
        {saveMsg ? <span className="text-[10px] text-[var(--sps-gold)] whitespace-nowrap shrink-0">{saveMsg}</span> : null}
      </HoverPinBar>

      <div className="flex-1 min-h-0 grid lg:grid-cols-[12.5rem_1fr_15rem] overflow-hidden">
        <nav className="overflow-y-auto border-r border-[var(--sps-border)] p-2 sps-atelier-pane">
          {slides.map((slide, i) => (
            <button
              key={`${slide.id}-${i}`}
              type="button"
              onClick={() => setSlideIndex(i)}
              className={`w-full text-left rounded-[var(--sps-radius-sm)] px-2 py-2 mb-1 border ${
                i === slideIndex
                  ? 'border-[var(--sps-gold)] bg-[var(--sps-surface)]'
                  : 'border-transparent hover:bg-[var(--sps-surface)]'
              }`}
            >
              <span className="block text-[9px] uppercase tracking-wide text-[var(--sps-gold)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="block text-[12px] font-semibold text-[var(--sps-text)] leading-snug">{slide.navTitle || slide.title}</span>
            </button>
          ))}
          {isManual && !lookOnly ? (
            <>
              <button type="button" className="sps-btn w-full mt-1" onClick={() => addSlide('page')}>
                <Plus className="w-3.5 h-3.5" />
                Add slide
              </button>
              <button type="button" className="sps-btn w-full mt-1" onClick={() => addSlide('cover')}>
                Cover
              </button>
              <button type="button" className="sps-btn w-full mt-1" onClick={() => addSlide('back')}>
                Back
              </button>
              <button type="button" className="sps-btn w-full mt-1" onClick={insertCharacterSheets}>
                <Users className="w-3.5 h-3.5" />
                Character sheets
              </button>
            </>
          ) : null}
        </nav>

        <div className="min-h-0 overflow-hidden p-3 md:p-5 flex flex-col items-center gap-3 sps-atelier-pane">
          {current ? (
            <div
              className="sps-pitch-stage flex-1 min-h-0 w-full"
              style={{
                '--pitch-ar': `${pitchFrame.cx} / ${pitchFrame.cy}`,
                '--pitch-ar-num': pitchFrame.cx / pitchFrame.cy
              }}
            >
            <div className="sps-pitch-canvas">
            <PitchSlideCard
              slide={current}
              style={style}
              placements={placements}
              lookOnly={lookOnly}
              isManual={isManual}
              present={false}
              formFieldClass={formFieldClass}
              fieldClass={fieldClass}
              patchSlide={(patch) => patchSlide(slideIndex, patch)}
              patchPoint={(pi, value) => patchPoint(slideIndex, pi, value)}
              addPoint={() => addPoint(slideIndex)}
              removeSlide={() => removeSlide(slideIndex)}
              canRemove={slides.length > 1}
              placeImage={placeImage}
              onGenerate={generateStill}
              generatingKey={stillBusy}
              frameStyle={{ width: '100%', height: '100%', minHeight: 0 }}
              fundSplitUi={
                current.id === 'useOfFunds' ? (
                  <div className="mt-4 space-y-1.5">
                    {(splitNorm.list || []).map((row) => (
                      <div key={row.id} className="flex items-center gap-2 text-[11px]">
                        <span className="w-40 truncate" style={{ color: 'var(--pitch-muted)' }}>{row.label}</span>
                        <input
                          className={`${fieldClass} w-16`}
                          type="number"
                          min={0}
                          max={100}
                          disabled={lookOnly}
                          value={row.pct}
                          onChange={(e) => updatePct(row.id, e.target.value)}
                        />
                        <span style={{ color: 'var(--pitch-muted)' }}>% [{row.status}]</span>
                      </div>
                    ))}
                    <p className={`text-[11px] m-0 ${splitNorm.total === 100 ? '' : 'text-[var(--sps-warn)]'}`} style={splitNorm.total === 100 ? { color: 'var(--pitch-gold)' } : undefined}>
                      Total {splitNorm.total}% {splitNorm.total === 100 ? '' : '— must equal 100'}
                    </p>
                  </div>
                ) : null
              }
            />
            </div>
            </div>
          ) : null}
          <div className="flex items-center gap-3 pb-3">
            <button type="button" className="sps-btn" disabled={slideIndex <= 0} onClick={() => setSlideIndex((n) => Math.max(0, n - 1))}>
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <span className="text-[11px] font-mono text-[var(--sps-muted)]">
              {slides.length ? slideIndex + 1 : 0} / {slides.length}
            </span>
            <button
              type="button"
              className="sps-btn"
              disabled={slideIndex >= slides.length - 1}
              onClick={() => setSlideIndex((n) => Math.min(slides.length - 1, n + 1))}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <aside className="overflow-y-auto border-l border-[var(--sps-border)] p-3 sps-atelier-pane text-[11px]">
          <p className="text-[10px] font-bold uppercase text-[var(--sps-muted)] m-0 mb-2">Style</p>
          <p className="text-[10px] text-[var(--sps-muted)] leading-snug m-0 mb-2">
            {PITCH_TEMPLATES.find((t) => t.id === templateId)?.hint || 'Industry leave-behind'}
          </p>
          <label className="block text-[10px] uppercase tracking-wide text-[var(--sps-muted)] mb-1">Frame</label>
          <select
            className={`${formFieldClass} mb-1`}
            value={formatId}
            disabled={lookOnly}
            title="Ratio · size · dimension"
            onChange={(e) => {
              mark();
              setFormatId(e.target.value);
            }}
          >
            {PITCH_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} · {f.hint}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-[var(--sps-muted)] leading-snug m-0 mb-3">
            {pitchFormatDimension(pitchFrame)}
          </p>
          <button
            type="button"
            className="sps-btn w-full mb-1"
            disabled={lookOnly || !current || Boolean(stillBusy)}
            title="Gemini 3.6 still · saved on this disk · ≥ 1 MB"
            onClick={() => generateStill(`${current.id}:0`, 0)}
          >
            {stillBusy ? 'Generating still' : 'Generate still'}
          </button>
          <button
            type="button"
            className="sps-btn w-full mb-2"
            disabled={lookOnly || !current || copyBusy}
            title="Rewrite this slide from project facts. Never invents box office or deals."
            onClick={polishCurrent}
          >
            {copyBusy ? 'Polishing' : 'Polish copy'}
          </button>
          {pitchNote ? (
            <p className="text-[10px] text-[var(--sps-gold)] leading-snug m-0 mb-3">{pitchNote}</p>
          ) : (
            <p className="text-[10px] text-[var(--sps-muted)] leading-snug m-0 mb-3">
              Stills stay on this disk and copy to other users’ local stores. None under 1 MB.
            </p>
          )}
          <label className="block text-[10px] uppercase tracking-wide text-[var(--sps-muted)] mb-1">Palette</label>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {PITCH_PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={lookOnly}
                title={p.label}
                onClick={() => {
                  mark();
                  setPaletteId(p.id);
                }}
                className={`h-8 rounded-sm border ${paletteId === p.id ? 'border-[var(--sps-gold)]' : 'border-[var(--sps-border)]'}`}
                style={{ background: `linear-gradient(135deg, ${p.paper} 55%, ${p.gold} 55%)` }}
              >
                <span className="sr-only">{p.label}</span>
              </button>
            ))}
          </div>
          <select
            className={`${formFieldClass} mb-2`}
            value={fontId}
            disabled={lookOnly}
            title="Type pair"
            onChange={(e) => {
              mark();
              setFontId(e.target.value);
            }}
          >
            {PITCH_FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          {isManual ? (
            <select
              className={`${formFieldClass} mb-2`}
              value={current?.layout || current?.kind || 'page'}
              disabled={lookOnly || !current}
              title="Slide layout"
              onChange={(e) => patchSlide(slideIndex, { layout: e.target.value, kind: e.target.value })}
            >
              {PITCH_LAYOUTS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          ) : null}
          <select
            className={`${formFieldClass} mb-2`}
            value={loglineId}
            disabled={lookOnly}
            title="Approved logline"
            onChange={(e) => {
              mark();
              setLoglineId(e.target.value);
            }}
          >
            {loglines.map((opt) => (
              <option key={opt.id} value={opt.id}>
                Logline {opt.id.toUpperCase()}
              </option>
            ))}
          </select>
          <input
            className={`${formFieldClass} mb-3`}
            placeholder="Ask / ₹ (assumption)"
            title="Ask / budget"
            value={budgetAsk}
            disabled={lookOnly}
            onChange={(e) => {
              mark();
              setBudgetAsk(e.target.value);
            }}
          />
          <p className="text-[10px] font-bold uppercase text-[var(--sps-muted)] m-0 mb-2">Pitch score</p>
          <p className="text-[10px] text-[var(--sps-muted)] leading-snug m-0 mb-2">{scores.note}</p>
          {[
            ['Story', scores.story],
            ['Characters', scores.characters],
            ['Visual world', scores.visualWorld],
            ['Audience', scores.audience],
            ['Commercial', scores.commercial],
            ['Production', scores.production],
            ['Team', scores.team],
            ['Financial', scores.financial],
            ['Investment', scores.investment],
            ['Overall', scores.overall]
          ].map(([label, n]) => (
            <div key={label} className="flex justify-between gap-2 py-0.5 text-[var(--sps-text)]">
              <span>{label}</span>
              <span className="font-mono">{n}</span>
            </div>
          ))}
          {showCheck && (
            <div className="mt-3 space-y-2">
              {Object.entries(checks).map(([group, items]) => (
                <div key={group}>
                  <p className="text-[10px] font-bold uppercase text-[var(--sps-gold)] m-0 mb-1">{group}</p>
                  <ul className="m-0 pl-0 space-y-0.5">
                    {items.map((it) => (
                      <li key={it.id} className="text-[var(--sps-text)]">
                        {it.pass ? '✓' : '○'} {it.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
      {presenting && current && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="sps-pitch-present fixed inset-0 z-[120] flex flex-col"
              style={{
                ...pitchCssVars(style),
                background: style.present || style.paper,
                color: style.ink,
                fontFamily: style.body
              }}
              onClick={() => setSlideIndex((n) => Math.min(slides.length - 1, n + 1))}
            >
              <button
                type="button"
                className="absolute top-4 right-4 sps-icon-btn z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setPresenting(false);
                }}
                title="Exit presentation (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex-1 min-h-0 flex items-center justify-center px-6 md:px-16 py-10 pointer-events-none">
                <div className="overflow-hidden" style={presentBox}>
                  <PitchSlideCard
                    slide={current}
                    style={style}
                    placements={placements}
                    lookOnly
                    isManual={false}
                    present
                    formFieldClass={formFieldClass}
                    fieldClass={fieldClass}
                    frameStyle={presentBox}
                  />
                </div>
              </div>
              <div
                className="shrink-0 flex items-center justify-center gap-4 pb-6 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="sps-btn"
                  disabled={slideIndex <= 0}
                  onClick={() => setSlideIndex((n) => Math.max(0, n - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[12px] font-mono" style={{ color: style.muted }}>
                  {slideIndex + 1} / {slides.length}
                </span>
                <button
                  type="button"
                  className="sps-btn"
                  disabled={slideIndex >= slides.length - 1}
                  onClick={() => setSlideIndex((n) => Math.min(slides.length - 1, n + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
