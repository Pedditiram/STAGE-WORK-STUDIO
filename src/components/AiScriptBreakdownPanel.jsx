import React, { useEffect, useRef, useState } from 'react';
import {
  Wand2, Upload, AlertTriangle, Loader2, Sparkles, Square
} from 'lucide-react';
import {
  parseRawScriptToShots, extractTextFromPDF,
  synthesizeFullAppElementsFromScript, getLastParseMeta,
  PdfExtractError, isPdfBinaryGarbage, looksLikeUsableScriptText,
  PDF_EXTRACT_MESSAGES, isParseAbortError
} from '../services/aiScriptParser';
import { detectScriptGenre, SEEDANCE_SLOTS } from '../constants/seedancePresets';
import { writeOpenScreenplayText, importScreenplayFile } from '../utils/screenplayInterop';
import { assertProjectWriteGate } from '../utils/productionLifecycle';
import ActiveProjectConfirmModal from './ActiveProjectConfirmModal';
import StoryPackageReview from './StoryPackageReview';
import {
  assertStoryPackageApplyAllowed,
  buildStoryPackage,
  getApplyPayloadFromStoryPackage,
  readActiveStoryPackage,
  readStoryPackageForTitle,
  saveStoryPackage
} from '../utils/storyPackage';

const CRAFT_COUNT = SEEDANCE_SLOTS.length;

const SAMPLE_SCRIPTS = [
  {
    title: "Kara-Dhushan War (28 Shots)",
    script: `PART ONE: Action Script - Kara-Dhushan War: Lord Rama vs. Demon Legion of Janasthana
ACT I: The Dark Horizon — Demon Legion Arrives

S01-A Aerial · EWS Slow push-in
Vast Dandaka forest canopy, still and grey. Horizon blackens — fourteen thousand silhouettes crest the ridge. Sky dims to ash, sunlight throttled.

S01-B Low-Angle · WS Crane rise
Kara — obsidian chariot, tusked stallions. Dhushan flanking, serpent armour. War drums pulse green-black light through smoke. Ground shudders.

S01-C MCU Intercut Quick cuts x3
Demon eyes — glowing venom-green. Spears raised. Snarling mouths. Cut rapidly: armour, claws, skull banners flapping in unnatural wind.

S01-D OTS Back · WS Static hold
Over Rama's back — alone at forest's edge in saffron dhoti, divine blue skin. The demon tide approaches. He nocks an arrow — utterly still.`
  },
  {
    title: "Cyberpunk Music Video Climax",
    script: `EXT. NEO-TOKYO CONCERT STAGE - NIGHT

Heavy rain falls through cyan and magenta neon light beams.
ARIA (20s, neon blue hair, metallic jacket) grips the microphone stand with both hands.

ARIA
(singing with intense vocal passion)
"The grid is failing... we turn up the amps tonight!"

Camera pushes in with a slow dolly zoom. In the background, LEO (lead guitarist) leans back-to-back with Aria, striking a fierce guitar solo pose. Steam rises from stage floor vents as the backing crowd cheers in unison.`
  }
];

/**
 * Shared AI Script Breakdown — mirrored in Project Console and Writer.
 */
export default function AiScriptBreakdownPanel({
  projectTitle = '',
  shots = [],
  onApplyShots,
  setShots,
  setPresetProfile,
  onApplied,
  onBack,
  showBack = false,
  eventSource = 'breakdown',
  initialScriptText = '',
  className = ''
}) {
  const scriptFileInputRef = useRef(null);
  const parseInFlightRef = useRef(false);
  const parseAbortRef = useRef(null);

  const [rawScriptText, setRawScriptText] = useState(() => String(initialScriptText || '').trim() || '');
  const [parsedPreview, setParsedPreview] = useState([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [parseProgress, setParseProgress] = useState(0);
  const [parseProgressLive, setParseProgressLive] = useState(false);
  const [parseStatusBanner, setParseStatusBanner] = useState('');
  const [pdfFailure, setPdfFailure] = useState(null);
  const [applyGateOpen, setApplyGateOpen] = useState(false);
  const [lastFullElements, setLastFullElements] = useState(null);
  const [storyPackage, setStoryPackage] = useState(() => {
    try {
      return readStoryPackageForTitle(projectTitle) || readActiveStoryPackage() || null;
    } catch {
      return null;
    }
  });

  const hasUsableScriptText = Boolean(String(rawScriptText || '').trim());
  const canRunParse = hasUsableScriptText && !isLoadingFile;

  useEffect(() => {
    const existing =
      readStoryPackageForTitle(projectTitle) ||
      (readActiveStoryPackage()?.projectTitle === projectTitle ? readActiveStoryPackage() : null);
    if (existing) setStoryPackage(existing);
  }, [projectTitle]);

  useEffect(() => {
    if (!initialScriptText) return;
    const next = String(initialScriptText || '');
    if (next.trim() && !String(rawScriptText || '').trim()) {
      setRawScriptText(next);
    }
  }, [initialScriptText]);

  useEffect(() => {
    let timer;
    if (isLoadingFile) {
      if (parseProgressLive) return undefined;
      setParseProgress(10);
      timer = setInterval(() => {
        setParseProgress((prev) => {
          if (prev >= 92) return 92;
          const step = Math.floor(Math.random() * 12) + 6;
          return Math.min(prev + step, 92);
        });
      }, 140);
    } else {
      setParseProgress((prev) => (prev > 0 && prev < 100 ? 0 : prev));
    }
    return () => clearInterval(timer);
  }, [isLoadingFile, parseProgressLive]);

  const finishParseProgress = (opts = {}) => {
    const { success = true } = opts;
    if (!success) {
      setParseProgress(0);
      return;
    }
    setParseProgress(100);
    setTimeout(() => setParseProgress(0), 700);
  };

  const beginParseAbort = () => {
    try {
      parseAbortRef.current?.abort();
    } catch {
      /* ignore */
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    parseAbortRef.current = controller;
    return controller?.signal;
  };

  const handleStopParse = () => {
    if (!parseInFlightRef.current && !isLoadingFile) return;
    try {
      parseAbortRef.current?.abort();
    } catch {
      /* ignore */
    }
    setParseStatusBanner('⏹ Parse stopped — project left unchanged.');
    setParseProgressLive(false);
  };

  useEffect(() => () => {
    try {
      parseAbortRef.current?.abort();
    } catch {
      /* ignore */
    }
  }, []);

  const alertLeavingProjectUnchanged = (message) => {
    const msg = String(message || '').trim();
    if (/Existing project was left unchanged\.?/i.test(msg)) {
      alert(msg);
      return;
    }
    alert(`${msg}\n\nExisting project was left unchanged.`);
  };

  const resetScriptFileInput = () => {
    if (scriptFileInputRef.current) {
      scriptFileInputRef.current.value = '';
    }
  };

  const formatPdfFailureBanner = (code, message) => {
    const label = code || 'extract failed';
    return `⚠️ PDF: ${label} — ${message || PDF_EXTRACT_MESSAGES.PARSE_FAILED}`;
  };

  const commitStoryPackageFromParse = (parsedShots, sourceText, meta, fullElements = null) => {
    const built = buildStoryPackage({
      projectTitle,
      shots: parsedShots,
      fullElements: fullElements || { shots: parsedShots },
      parseMeta: meta,
      sourceText,
      previous: readStoryPackageForTitle(projectTitle)
    });
    let saved = built;
    try {
      saved = saveStoryPackage(built) || built;
    } catch (pkgErr) {
      console.warn('Story package save skipped:', pkgErr);
    }
    setStoryPackage(saved);
    return saved;
  };

  // 3. AI SCRIPT PARSING HANDLERS
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (parseInFlightRef.current || isLoadingFile) {
      resetScriptFileInput();
      return;
    }

    parseInFlightRef.current = true;
    setIsLoadingFile(true);
    setPdfFailure(null);
    setParseStatusBanner('');
    setUploadedFileName(file.name);
    let parseSucceeded = false;
    const signal = beginParseAbort();

    try {
      let extractedText = '';
      const imported = await importScreenplayFile(file, { extractPdf: extractTextFromPDF });
      extractedText = imported?.text || '';
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

      if (!extractedText || !String(extractedText).trim()) {
        setUploadedFileName('');
        setPdfFailure({
          code: isPdf ? 'EMPTY' : 'EMPTY_FILE',
          message: isPdf ? PDF_EXTRACT_MESSAGES.EMPTY : 'Could not extract text from that file. Existing project was left unchanged.',
          fileName: file.name
        });
        setParseStatusBanner(
          isPdf
            ? formatPdfFailureBanner('EMPTY', PDF_EXTRACT_MESSAGES.EMPTY)
            : '⚠️ No text in file — paste screenplay text or try a sample script. Existing project unchanged.'
        );
        alertLeavingProjectUnchanged(
          isPdf ? PDF_EXTRACT_MESSAGES.EMPTY : 'Could not extract text from that file. Existing project was left unchanged.'
        );
        return;
      }

      if (isPdf && (isPdfBinaryGarbage(extractedText) || !looksLikeUsableScriptText(extractedText))) {
        setUploadedFileName('');
        setPdfFailure({
          code: 'PDF_GARBAGE',
          message: PDF_EXTRACT_MESSAGES.PDF_GARBAGE,
          fileName: file.name
        });
        setParseStatusBanner(formatPdfFailureBanner('PDF_GARBAGE', PDF_EXTRACT_MESSAGES.PDF_GARBAGE));
        alertLeavingProjectUnchanged(PDF_EXTRACT_MESSAGES.PDF_GARBAGE);
        return;
      }

      setRawScriptText(extractedText);
      setPdfFailure(null);
      if (typeof window !== 'undefined') {
        writeOpenScreenplayText(extractedText, { silent: true });
        try {
          window.dispatchEvent(new CustomEvent('sps_screenplay_updated', { detail: { source: eventSource } }));
        } catch (e) {}
      }
      const parsedShots = await parseRawScriptToShots(extractedText, {
        signal,
        onProgress: ({ percent, message }) => {
          if (signal?.aborted) return;
          setParseProgressLive(true);
          if (typeof percent === 'number') setParseProgress(Math.max(4, Math.min(96, percent)));
          if (message) setParseStatusBanner(message);
        }
      });
      if (signal?.aborted) throw Object.assign(new Error('Parse stopped by user.'), { name: 'AbortError', code: 'PARSE_ABORTED' });
      const meta = getLastParseMeta();
      if (!parsedShots.length) {
        alertLeavingProjectUnchanged(meta?.warning || 'Parse produced no shots. Existing project was left unchanged.');
        setParseStatusBanner(meta?.warning || '⚠️ Parse produced no shots. Existing project unchanged.');
        return;
      }
      setParsedPreview(parsedShots);
      setIsGenerated(true);
      commitStoryPackageFromParse(parsedShots, extractedText, meta);
      if (meta?.warning) {
        console.info('[AI Breakdown]', meta.warning);
      }
      if (meta?.source === 'feature_expand') {
        setParseStatusBanner(`✓ Expanded ${meta.shotCount || parsedShots.length} shots · ${meta.sequenceCount || ''} sequences · ${meta.runtimeMinutes || ''} min feature`);
      } else if (meta?.source === 'built_in' || meta?.source === 'built_in_expand') {
        setParseStatusBanner(`✓ Parsed ${meta.shotCount || parsedShots.length} shots (Built-In cinema engine)`);
      } else {
        setParseStatusBanner(
          meta?.error === 'MISSING_API_KEY' || meta?.usedFallback
            ? (meta.warning || 'Offline heuristic parse used.')
            : (meta?.shotCount ? `✓ Parsed ${meta.shotCount} shots (${CRAFT_COUNT} crafts)` : '')
        );
      }

      // AUTO-SYNTHESIZE ALL APP ELEMENTS (preview only — do NOT overwrite library shots until Apply)
      let fullElements = null;
      try {
        fullElements = await synthesizeFullAppElementsFromScript(extractedText, file.name || projectTitle || '', parsedShots, { signal });
        setLastFullElements(fullElements);
        commitStoryPackageFromParse(parsedShots, extractedText, meta, fullElements);
        // Cast/World stay in preview (lastFullElements) until Apply — do not overwrite active film vaults here
      } catch (synthErr) {
        if (isParseAbortError(synthErr)) {
          setParseStatusBanner((prev) =>
            String(prev || '').includes('Story Package')
              ? prev
              : `✓ Story Package ready (${parsedShots.length} shots) — review then Apply`
          );
          return;
        }
        console.warn('Post-parse synthesis skipped:', synthErr);
        setLastFullElements({ shots: parsedShots });
      }

      setParseStatusBanner((prev) =>
        String(prev || '').startsWith('✓')
          ? `${prev} · Story Package ready for review`
          : `✓ Story Package ready (${parsedShots.length} shots) — review then Apply`
      );

      const detected = fullElements?.detectedGenre || detectScriptGenre(file.name || projectTitle || '', parsedShots, extractedText);
      if (detected) {
        if (typeof setPresetProfile === 'function') setPresetProfile(detected);
        try {
          localStorage.setItem('sps_preset_profile', detected);
          localStorage.setItem('sps_active_genre', detected);
        } catch {
          /* quota */
        }
      }
      parseSucceeded = true;
      // Genre/vision preview only — shots applied via Apply button to avoid wiping project mid-preview
    } catch (err) {
      if (isParseAbortError(err)) {
        setParseStatusBanner('⏹ Parse stopped — project left unchanged.');
        return;
      }
      const isPdfErr = err instanceof PdfExtractError || err?.name === 'PdfExtractError';
      const code = err?.code || (isPdfErr ? 'PARSE_FAILED' : 'PARSE_ERROR');
      const message = err?.message || PDF_EXTRACT_MESSAGES.PARSE_FAILED;
      // Do not wipe existing paste text / preview / project shots on failure
      setUploadedFileName('');
      if (isPdfErr) {
        setPdfFailure({ code, message, fileName: file.name });
        setParseStatusBanner(formatPdfFailureBanner(code, message));
      } else {
        setPdfFailure(null);
        setParseStatusBanner(`⚠️ ${message}`);
      }
      alertLeavingProjectUnchanged(message);
    } finally {
      parseInFlightRef.current = false;
      setIsLoadingFile(false);
      setParseProgressLive(false);
      finishParseProgress({ success: parseSucceeded });
      resetScriptFileInput();
    }
  };

  const handleParseScript = async () => {
    if (parseInFlightRef.current || isLoadingFile) return;
    if (!rawScriptText.trim()) {
      alert('Paste screenplay text, upload a text-based PDF/TXT, or pick a sample script before parsing.');
      setParseStatusBanner('⚠️ Parse disabled — no usable screenplay text yet.');
      return;
    }
    const parseGate = assertProjectWriteGate(projectTitle, { auditLabel: `${eventSource}_parse` });
    if (!parseGate.ok) {
      alert(parseGate.message);
      setParseStatusBanner(`⚠️ ${parseGate.message}`);
      return;
    }
    parseInFlightRef.current = true;
    setIsLoadingFile(true);
    setParseProgressLive(true);
    setPdfFailure(null);
    let parseSucceeded = false;
    const signal = beginParseAbort();
    try {
      if (typeof window !== 'undefined') {
        try {
          writeOpenScreenplayText(rawScriptText, { silent: true });
          window.dispatchEvent(new CustomEvent('sps_screenplay_updated', { detail: { source: `${eventSource}_parse` } }));
        } catch {
          /* SoT write must not abort breakdown */
        }
      }
      const parsedShots = await parseRawScriptToShots(rawScriptText, {
        signal,
        onProgress: ({ percent, message }) => {
          if (signal?.aborted) return;
          if (typeof percent === 'number') setParseProgress(Math.max(4, Math.min(96, percent)));
          if (message) setParseStatusBanner(message);
        }
      });
      if (signal?.aborted) throw Object.assign(new Error('Parse stopped by user.'), { name: 'AbortError', code: 'PARSE_ABORTED' });
      const meta = getLastParseMeta();
      if (!parsedShots.length) {
        alertLeavingProjectUnchanged(meta?.warning || 'Parse produced no shots. Existing project was left unchanged.');
        setParseStatusBanner(meta?.warning || '⚠️ Parse produced no shots. Existing project unchanged.');
        return;
      }
      setParsedPreview(parsedShots);
      setIsGenerated(true);
      commitStoryPackageFromParse(parsedShots, rawScriptText, meta);
      if (meta?.warning) {
        console.info('[AI Breakdown]', meta.warning);
      }
      if (meta?.source === 'feature_expand') {
        setParseStatusBanner(`✓ Expanded ${meta.shotCount || parsedShots.length} shots · ${meta.sequenceCount || ''} sequences · ${meta.runtimeMinutes || ''} min feature`);
      } else if (meta?.source === 'built_in' || meta?.source === 'built_in_expand') {
        setParseStatusBanner(`✓ Parsed ${meta.shotCount || parsedShots.length} shots (Built-In cinema engine)`);
      } else if (meta?.error === 'MISSING_API_KEY') {
        setParseStatusBanner(meta.warning);
      } else {
        setParseStatusBanner(
          meta?.usedFallback
            ? meta.warning
            : (meta?.shotCount ? `✓ Parsed ${meta.shotCount} shots (${CRAFT_COUNT} crafts)` : '')
        );
      }

      let fullElements = null;
      try {
        fullElements = await synthesizeFullAppElementsFromScript(rawScriptText, projectTitle || '', parsedShots, { signal });
        setLastFullElements(fullElements);
        commitStoryPackageFromParse(parsedShots, rawScriptText, meta, fullElements);
        // Cast/World stay in preview until Apply — do not overwrite active film vaults here
      } catch (synthErr) {
        if (isParseAbortError(synthErr)) {
          setParseStatusBanner((prev) =>
            String(prev || '').includes('Story Package')
              ? prev
              : `✓ Story Package ready (${parsedShots.length} shots) — review then Apply`
          );
          return;
        }
        console.warn('Post-parse synthesis skipped:', synthErr);
        setLastFullElements({ shots: parsedShots });
      }

      setParseStatusBanner((prev) =>
        String(prev || '').startsWith('✓')
          ? `${prev} · Story Package ready for review`
          : `✓ Story Package ready (${parsedShots.length} shots) — review then Apply`
      );

      const detected = fullElements?.detectedGenre || detectScriptGenre(projectTitle || '', parsedShots, rawScriptText);
      if (detected) {
        if (typeof setPresetProfile === 'function') setPresetProfile(detected);
        try {
          localStorage.setItem('sps_preset_profile', detected);
          localStorage.setItem('sps_active_genre', detected);
        } catch {
          /* quota */
        }
      }
      parseSucceeded = true;
      // Do not write shots into project library until user clicks Apply
    } catch (err) {
      if (isParseAbortError(err)) {
        setParseStatusBanner('⏹ Parse stopped — project left unchanged.');
        return;
      }
      alertLeavingProjectUnchanged(`Failed to parse script: ${err?.message || err}`);
      setParseStatusBanner(`⚠️ Parse failed: ${err?.message || err}`);
    } finally {
      parseInFlightRef.current = false;
      setIsLoadingFile(false);
      setParseProgressLive(false);
      finishParseProgress({ success: parseSucceeded });
    }
  };

  const handleApplyAIShotsToCurrent = () => {
    const payload = getApplyPayloadFromStoryPackage(storyPackage);
    const hasShots = (payload?.shots?.length || parsedPreview.length) > 0;
    if (!hasShots) return;
    const gate = assertStoryPackageApplyAllowed({
      activeTitle: projectTitle,
      pkg: storyPackage,
      intendedTitle: storyPackage?.projectTitle || projectTitle,
      existingShotCount: Array.isArray(shots) ? shots.length : 0,
      auditLabel: `${eventSource}_apply_open`
    });
    if (!gate.ok) {
      alert(gate.message);
      setParseStatusBanner(`⚠️ ${gate.message}`);
      return;
    }
    setApplyGateOpen(true);
  };

  const confirmApplyAIShotsToCurrent = () => {
    setApplyGateOpen(false);
    const gate = assertStoryPackageApplyAllowed({
      activeTitle: projectTitle,
      pkg: storyPackage,
      intendedTitle: storyPackage?.projectTitle || projectTitle,
      existingShotCount: Array.isArray(shots) ? shots.length : 0,
      auditLabel: `${eventSource}_apply_confirm`
    });
    if (!gate.ok) {
      alert(gate.message);
      setParseStatusBanner(`⚠️ ${gate.message}`);
      return;
    }
    const payload = getApplyPayloadFromStoryPackage(storyPackage);
    const shotsToApply = payload?.shots?.length ? payload.shots : parsedPreview;
    const elementsToApply = payload?.fullElements || lastFullElements;
    if (typeof onApplyShots === 'function') {
      onApplyShots(shotsToApply, projectTitle, {
        ...(elementsToApply || {}),
        markStoryPackage: true,
        learnFromParse: true
      });
      setParseStatusBanner(
        `✓ ${shotsToApply.length} shots queued — approve in Production → LLM command review`
      );
    } else if (setShots) {
      setShots(shotsToApply);
    }
    onApplied?.();
  };

  const handleStoryPackageLogline = (logline) => {
    if (!storyPackage) return;
    const next = saveStoryPackage({ ...storyPackage, logline });
    setStoryPackage(next);
  };



  return (
    <div className={`min-h-0 flex flex-col ${className || ''}`.trim()}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 font-mono">
              {/* LEFT PANE: Script Input & Controls */}
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between space-y-3 shadow-sm">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2.5">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[color:var(--sps-text)] flex items-center gap-1.5">
                        <Wand2 className="w-4 h-4 text-amber-600" />
                        AI Screenplay Breakdown & Cinema Parser
                      </h4>
                      <p className="text-[10px] text-[color:var(--sps-muted)] font-semibold mt-0.5 truncate">
                        Target: {projectTitle || 'Active project'}
                      </p>
                    </div>
                    <label className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-md transition-all ${
                      isLoadingFile
                        ? 'bg-zinc-700 text-white cursor-not-allowed opacity-90 pointer-events-none'
                        : 'bg-cyan-700 hover:bg-cyan-600 text-white cursor-pointer'
                    }`}>
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isLoadingFile ? 'Reading…' : 'Upload File'}</span>
                      <input
                        ref={scriptFileInputRef}
                        type="file"
                        accept=".pdf,.txt,.fountain,.fdx"
                        onChange={handleFileUpload}
                        disabled={isLoadingFile}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Sample Scripts Selector */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[11px] text-[color:var(--sps-muted)] font-bold shrink-0">Sample Scripts:</span>
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                      {SAMPLE_SCRIPTS.map((sample, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setRawScriptText(sample.script);
                            setPdfFailure(null);
                            setParseStatusBanner('');
                            setUploadedFileName('');
                          }}
                          disabled={isLoadingFile}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-cyan-600 dark:text-cyan-300 text-[11px] font-bold shrink-0 hover:border-cyan-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          📄 {sample.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {pdfFailure && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-[11px] text-amber-950 dark:text-amber-100">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-1 min-w-0">
                          <p className="font-black">
                            PDF extract failed{pdfFailure.code ? `: ${pdfFailure.code}` : ''}
                            {pdfFailure.fileName ? ` (${pdfFailure.fileName})` : ''}
                          </p>
                          <p className="leading-relaxed opacity-90">{pdfFailure.message}</p>
                          <ul className="list-disc pl-4 space-y-0.5 text-amber-900/90 dark:text-amber-100/90">
                            <li>Use a <strong>text-based PDF</strong> or <strong>.TXT</strong> export (not a scan).</li>
                            <li>Or <strong>paste</strong> screenplay text into the box below.</li>
                            <li>Or load a <strong>Sample Script</strong> above to verify the parser.</li>
                            <li>Scanned PDFs need <strong>external OCR</strong> first — not built into SPS.</li>
                          </ul>
                          <p className="font-semibold text-amber-800 dark:text-amber-200">
                            Parse stays disabled until usable script text is present. Existing project shots were not changed.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="text-[11px] text-[color:var(--sps-text)] font-bold block">Paste screenplay or feature brief:</label>
                      {uploadedFileName ? (
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono truncate max-w-[50%]" title={uploadedFileName}>
                          📎 {uploadedFileName}
                        </span>
                      ) : null}
                    </div>
                    <textarea
                      rows={8}
                      value={rawScriptText}
                      onChange={(e) => {
                        setRawScriptText(e.target.value);
                        if (e.target.value.trim()) setPdfFailure(null);
                      }}
                      disabled={isLoadingFile}
                      placeholder="Paste a finished screenplay, OR a two-line brief (e.g. 3 hour movie, birth to death of Mahaveer Karna). Briefs expand into a full feature breakdown."
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-cyan-500 leading-relaxed min-h-[160px] max-h-[260px] resize-y shadow-inner font-mono font-medium disabled:opacity-60"
                    />
                    {!hasUsableScriptText && !pdfFailure ? (
                      <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-1">
                        No script text yet — paste, upload TXT/text-PDF, or pick a sample. Parse stays off until then.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-[color:var(--sps-muted)]">
                      Engine: <strong className="text-cyan-800 dark:text-cyan-400 font-bold">AI Cinema Production OS ({CRAFT_COUNT} Crafts)</strong>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isLoadingFile ? (
                        <button
                          type="button"
                          onClick={handleStopParse}
                          title="Stop parsing — leave project unchanged"
                          aria-label="Stop parsing"
                          className="px-3 py-2 rounded-xl font-black text-xs border border-rose-400/60 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          Stop
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleParseScript}
                        disabled={!canRunParse}
                        title={
                          isLoadingFile
                            ? 'Parse in progress…'
                            : (!hasUsableScriptText
                              ? 'Paste or upload usable screenplay text first'
                              : `Parse into ${CRAFT_COUNT}-craft shots`)
                        }
                        className={`px-4 py-2 rounded-xl font-black text-xs shadow-md flex items-center gap-1.5 transition-all ${
                          canRunParse
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-zinc-950 cursor-pointer'
                            : 'bg-slate-300 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 cursor-not-allowed opacity-70 grayscale'
                        }`}
                      >
                        {isLoadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 fill-current" />}
                        <span>{isLoadingFile ? `Parsing (${parseProgress}%)...` : `⚡ Parse ${CRAFT_COUNT} Crafts Shots`}</span>
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Thin Progress Bar Animation with Percentages */}
                  {(isLoadingFile || parseProgress > 0) && (
                    <div className="w-full space-y-1 pt-1 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs font-mono text-cyan-800 dark:text-cyan-400 font-bold gap-2">
                        <span className="flex items-center gap-1 min-w-0 truncate">
                          <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />
                          <span className="truncate">{isLoadingFile ? `Analyzing ${CRAFT_COUNT} Crafts…` : 'Finishing…'}</span>
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className="bg-cyan-500/10 text-cyan-500 px-2 py-0.5 rounded text-xs font-mono font-black">{parseProgress}%</span>
                          {isLoadingFile ? (
                            <button
                              type="button"
                              onClick={handleStopParse}
                              className="text-[10px] font-black uppercase tracking-wide text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                            >
                              Stop
                            </button>
                          ) : null}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden relative shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 via-amber-400 to-emerald-400 transition-all duration-200 ease-out rounded-full relative"
                          style={{ width: `${parseProgress}%` }}
                        >
                          <div className="absolute inset-0 bg-white/40 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  )}
                  {parseStatusBanner && !isLoadingFile ? (
                    <p className={`text-[10.5px] font-mono leading-relaxed pt-1 ${String(parseStatusBanner).startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {parseStatusBanner}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-2 pt-1">
                    {showBack ? (
                      <button
                        type="button"
                        onClick={onBack}
                        className="text-[11px] font-bold text-[color:var(--sps-muted)] hover:text-cyan-800 dark:text-zinc-400 dark:hover:text-cyan-300 cursor-pointer"
                      >
                        ← Back
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* RIGHT PANE: Durable Story Package review before Apply */}
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 flex flex-col min-h-0 h-full overflow-hidden shadow-sm">
                {(storyPackage?.proposedShots?.length || parsedPreview.length) ? (
                  <StoryPackageReview
                    package={
                      storyPackage?.proposedShots?.length
                        ? storyPackage
                        : {
                            projectTitle,
                            status: 'ready',
                            proposedShots: parsedPreview,
                            shotCount: parsedPreview.length,
                            sequences: [],
                            scenes: []
                          }
                    }
                    activeTitle={projectTitle}
                    intendedTitle={storyPackage?.projectTitle || projectTitle}
                    existingShotCount={Array.isArray(shots) ? shots.length : 0}
                    shots={shots}
                    onApply={handleApplyAIShotsToCurrent}
                    onLoglineChange={handleStoryPackageLogline}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 space-y-3 flex-1 my-auto">
                    <div className="p-3 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">
                      <Wand2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                      <h5 className="text-xs font-bold text-[color:var(--sps-text)]">Story Package review</h5>
                      <p className="text-xs text-[color:var(--sps-muted)] leading-normal">
                        Paste screenplay text on the left, upload a <strong>text-based</strong> PDF/TXT, or select a sample script, then click <strong>⚡ Parse {CRAFT_COUNT} Crafts Shots</strong>. A durable Story Package appears here for review before Matrix Apply.
                      </p>
                      {pdfFailure ? (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold pt-2">
                          Last upload failed ({pdfFailure.code || 'PDF'}). Recover with paste / TXT / sample — then Parse enables.
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
      <ActiveProjectConfirmModal
        isOpen={applyGateOpen}
        activeTitle={projectTitle}
        intendedTitle={storyPackage?.projectTitle || projectTitle}
        existingCount={Array.isArray(shots) ? shots.length : 0}
        incomingCount={
          getApplyPayloadFromStoryPackage(storyPackage)?.shots?.length ||
          parsedPreview.length
        }
        actionLabel="Apply Story Package to the Matrix for this film"
        onCancel={() => setApplyGateOpen(false)}
        onConfirm={confirmApplyAIShotsToCurrent}
      />
    </div>
  );
}
