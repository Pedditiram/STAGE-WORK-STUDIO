import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy, Check, Download, RefreshCw, Megaphone, Search, MapPin, Calendar, Type,
  IndianRupee, Landmark, FlaskConical, Scale, Archive,
} from 'lucide-react';
import HoverPinBar from './HoverPinBar';
import { exportDownloadText, assertExportAllowed, logExportSuccess, resolveCollabRoomId } from '../utils/exportGate';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import {
  CAMPAIGN_CATEGORIES,
  CAMPAIGN_TONES,
  CAMPAIGN_LANGS,
  CAMPAIGN_DENSITIES,
  buildCampaignKit,
  campaignKitToCsv,
  campaignKitToMarkdown,
  campaignKitToPrintHtml,
  buildCampaignKitZipFiles,
  auditCampaignBeatExclusions
} from '../utils/campaignKit';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';
import { PRODUCT } from '../constants/brand';

const TABS = [
  { id: 'kit', label: 'Kit', Icon: Megaphone },
  { id: 'research', label: 'Research', Icon: Search },
  { id: 'markets', label: 'Markets', Icon: MapPin },
  { id: 'calendar', label: 'Calendar', Icon: Calendar },
  { id: 'spend', label: 'Spend', Icon: IndianRupee },
  { id: 'festival', label: 'Festival', Icon: Landmark },
  { id: 'tests', label: 'Tests', Icon: FlaskConical },
  { id: 'copy', label: 'Copy', Icon: Type },
  { id: 'legal', label: 'Legal', Icon: Scale },
];

export default function CampaignKitModal({
  isOpen,
  asRoom = false,
  shots = [],
  projectTitle = 'Project',
  genreKey = '',
  lookOnly = false,
}) {
  const [tab, setTab] = useState('kit');
  const [channel, setChannel] = useState('All');
  const [tone, setTone] = useState('prestige');
  const [lang, setLang] = useState('auto');
  const [density, setDensity] = useState('quiet');
  const [seed, setSeed] = useState(0);
  const [copied, setCopied] = useState('');
  const [unitId, setUnitId] = useState('');

  const kit = useMemo(() => {
    void seed;
    return buildCampaignKit({ shots, projectTitle, genreKey, category: channel, tone, lang, density });
  }, [shots, projectTitle, genreKey, channel, tone, lang, density, seed]);

  const exportLife = useMemo(() => lifecycleExportReadiness(shots, projectTitle), [shots, projectTitle]);
  const {
    strict: campaignLifecycleStrict,
    mode: campaignLifecycleMode
  } = useExportLifecyclePref('campaign');
  const exportBlocked = campaignLifecycleStrict && !exportLife.exportReady;

  const activeUnit = kit.units.find((u) => u.id === unitId) || kit.units[0];

  const copyText = useCallback(async (text, key) => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      /* ignore */
    }
  }, []);

  const slug = String(kit.projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
  const roomId = resolveCollabRoomId();
  const lifeNote = `${kit.units.length}u · ${kit.tone}/${kit.density}/${kit.lang} · ${kit.category}${roomId ? ` · room:${roomId}` : ''}`;

  const handleExportPdf = useCallback(() => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'campaign_kit_pdf',
        format: 'pdf',
        lifecycleMode: campaignLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'campaign_kit_pdf',
      format: 'pdf',
      lifecycleMode: campaignLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    auditCampaignBeatExclusions({ shots, projectTitle, category: channel });
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    printWindow.document.write(campaignKitToPrintHtml(kit, { roomId }));
    printWindow.document.close();
    logExportSuccess({
      projectTitle,
      label: 'campaign_kit_pdf',
      format: 'pdf',
      filename: `${slug}_campaign.pdf`,
      roomId,
      note: `${lifeNote}${roomId ? ` · room:${roomId}` : ''}`,
      lifecycleMode: gate.advisory ? `${campaignLifecycleMode}+ok` : campaignLifecycleMode
    });
  }, [projectTitle, campaignLifecycleMode, shots, kit, slug, exportBlocked, roomId, lifeNote, channel]);

  const handleExportZip = useCallback(async () => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'campaign_kit_zip',
        format: 'zip',
        lifecycleMode: campaignLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'campaign_kit_zip',
      format: 'zip',
      lifecycleMode: campaignLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    auditCampaignBeatExclusions({ shots, projectTitle, category: channel });
    const files = buildCampaignKitZipFiles(kit, { roomId });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, `${slug}_campaign.zip`, {
      projectTitle,
      shots,
      lifecycleMode: campaignLifecycleMode,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      auditLabel: 'campaign_kit_zip',
      auditFormat: 'zip',
      roomId,
      note: lifeNote,
      showAlert: false
    });
  }, [projectTitle, campaignLifecycleMode, shots, kit, slug, exportBlocked, roomId, lifeNote, channel]);

  if (!asRoom && !isOpen) return null;

  const field = 'w-full rounded-[var(--sps-radius-sm)] border border-[var(--sps-border)] bg-[var(--sps-bg)] text-[11px] px-2 py-1.5';

  const body = (
    <div className="flex flex-col h-full min-h-0 overflow-hidden sps-atelier-room">
      <HoverPinBar
        storageKey="sps_pin_campaign_bar"
        defaultPinned
        pinLabel="Campaign bar"
        ariaLabel="Show Campaign toolbar"
        className="shrink-0 z-20"
        barClassName="px-3 py-2 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex items-center justify-between gap-2"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold m-0 flex items-center gap-2" style={{ fontFamily: 'var(--sps-font-display)' }}>
            <Megaphone className="w-4 h-4" />
            Campaign Kit
          </h2>
          <p className="text-[11px] text-[var(--sps-muted)] truncate m-0">
            {kit.units.length} units · Print / Digital / Video · {kit.shotSourceCount} shots · {PRODUCT}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <button type="button" className="sps-btn text-[11px]" disabled={lookOnly} onClick={() => setSeed((n) => n + 1)}>
            <RefreshCw className="w-3.5 h-3.5" />
            Rebuild
          </button>
          <button
            type="button"
            className="sps-btn text-[11px] disabled:opacity-40"
            disabled={lookOnly || exportBlocked}
            title={exportBlocked ? exportLife.message : 'Export campaign CSV'}
            onClick={() => {
              auditCampaignBeatExclusions({ shots, projectTitle, category: channel });
              exportDownloadText(`${slug}_campaign.csv`, campaignKitToCsv(kit), {
                projectTitle,
                auditLabel: 'campaign_kit_csv',
                auditFormat: 'csv',
                mime: 'text/csv;charset=utf-8',
                lifecycleMode: campaignLifecycleMode,
                shots,
                roomId,
                note: lifeNote
              });
            }}
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            className="sps-btn text-[11px] disabled:opacity-40"
            disabled={lookOnly || exportBlocked}
            title={exportBlocked ? exportLife.message : 'Export full campaign kit'}
            onClick={() => {
              auditCampaignBeatExclusions({ shots, projectTitle, category: channel });
              exportDownloadText(`${slug}_campaign.md`, campaignKitToMarkdown(kit), {
                projectTitle,
                auditLabel: 'campaign_kit_md',
                auditFormat: 'md',
                mime: 'text/markdown;charset=utf-8',
                lifecycleMode: campaignLifecycleMode,
                shots,
                roomId,
                note: lifeNote
              });
            }}
          >
            <Download className="w-3.5 h-3.5" />
            Full kit
          </button>
          <button
            type="button"
            className="sps-btn text-[11px] disabled:opacity-40"
            disabled={lookOnly || exportBlocked}
            title={exportBlocked ? exportLife.message : 'Print campaign kit PDF'}
            onClick={handleExportPdf}
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            type="button"
            className="sps-btn text-[11px] disabled:opacity-40"
            disabled={lookOnly || exportBlocked}
            title={exportBlocked ? exportLife.message : 'Download campaign ZIP (MD + CSV)'}
            onClick={handleExportZip}
          >
            <Archive className="w-3.5 h-3.5" />
            ZIP
          </button>
          {exportBlocked ? (
            <span className="text-[10px] text-[var(--sps-gold)] max-w-[14rem] leading-snug">
              {exportLife.message}
            </span>
          ) : null}
        </div>
      </HoverPinBar>

      <div className="px-3 py-2 border-b border-[var(--sps-border)] flex flex-wrap gap-1.5 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`sps-btn text-[11px] ${tab === t.id ? 'sps-btn-primary' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <t.Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-3 py-2 border-b border-[var(--sps-border)] flex flex-wrap gap-3 shrink-0 items-center">
        <label className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] flex items-center gap-1.5">
          Tone
          <select className={field} style={{ width: 'auto' }} value={tone} disabled={lookOnly} onChange={(e) => setTone(e.target.value)}>
            {CAMPAIGN_TONES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] flex items-center gap-1.5">
          Language
          <select className={field} style={{ width: 'auto' }} value={lang} disabled={lookOnly} onChange={(e) => setLang(e.target.value)}>
            {CAMPAIGN_LANGS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] flex items-center gap-1.5">
          Density
          <select className={field} style={{ width: 'auto' }} value={density} disabled={lookOnly} onChange={(e) => setDensity(e.target.value)}>
            {CAMPAIGN_DENSITIES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <p className="text-[10px] text-[var(--sps-muted)] m-0 flex-1 min-w-[12rem]">
          {(CAMPAIGN_TONES.find((t) => t.id === tone) || {}).note}{' '}
          {(CAMPAIGN_DENSITIES.find((t) => t.id === density) || {}).note}
        </p>
      </div>

      {tab === 'kit' ? (
        <div className="px-3 py-2 border-b border-[var(--sps-border)] flex flex-wrap gap-1.5 shrink-0">
          <button
            type="button"
            className={`sps-btn text-[10px] ${channel === 'All' ? 'sps-btn-primary' : ''}`}
            onClick={() => {
              setChannel('All');
              setUnitId('');
            }}
          >
            All
          </button>
          {CAMPAIGN_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`sps-btn text-[10px] ${channel === c.id ? 'sps-btn-primary' : ''}`}
              title={c.note}
              onClick={() => {
                setChannel(c.id);
                setUnitId('');
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'kit' && (
          <div className="h-full grid lg:grid-cols-[minmax(16rem,0.95fr)_1.2fr] min-h-0">
            <div className="overflow-y-auto border-r border-[var(--sps-border)] p-3 space-y-2 sps-atelier-pane">
              {(kit.units || []).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setUnitId(u.id)}
                  className={`w-full text-left rounded-[var(--sps-radius)] border p-3 ${
                    activeUnit?.id === u.id ? 'border-[var(--sps-gold)]' : 'border-[var(--sps-border)]'
                  } bg-[var(--sps-surface)]`}
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase text-[var(--sps-gold)]">{u.category}</span>
                    <span className="text-[10px] font-mono text-[var(--sps-muted)]">{u.size}</span>
                  </div>
                  <p className="text-[12px] font-semibold m-0 mt-1">{u.label}</p>
                  <p className="text-[10px] m-0 mt-0.5 text-[var(--sps-muted)]">{u.channel} · {u.mediumLabel || 'Still'}</p>
                  <p className="text-[10px] m-0 mt-0.5 font-mono text-[var(--sps-muted)]">{u.sceneShotId || '—'}</p>
                </button>
              ))}
            </div>
            <div className="overflow-y-auto p-4 space-y-3 sps-atelier-pane">
              {activeUnit ? (
                <>
                  <p className="sps-pres-kicker text-[10px] uppercase tracking-[0.18em] m-0">{activeUnit.category} · {activeUnit.channel}</p>
                  <h3 className="text-xl m-0" style={{ fontFamily: 'var(--sps-font-display)' }}>{activeUnit.label}</h3>
                  <p className="text-[11px] text-[var(--sps-gold)] m-0">
                    {activeUnit.category === 'Video'
                      ? 'Video prompt — motion, duration, audio.'
                      : `${activeUnit.category} still — graphic design, not a clip.`}
                  </p>
                  <p className="text-[12px] text-[var(--sps-muted)] m-0">{activeUnit.layout}</p>
                  <p className="text-[13px] m-0"><strong>{activeUnit.headline}</strong></p>
                  <p className="text-[12px] italic m-0">{activeUnit.tagline}</p>
                  <p className="text-[11px] text-[var(--sps-muted)] m-0">{activeUnit.credit}</p>
                  <button
                    type="button"
                    className="sps-btn sps-btn-primary text-[11px]"
                    onClick={() => copyText(activeUnit.imagePrompt, activeUnit.id)}
                  >
                    {copied === activeUnit.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {activeUnit.category === 'Video' ? 'Copy video prompt' : 'Copy graphic prompt'}
                  </button>
                  <pre className={`${field} min-h-[12rem] whitespace-pre-wrap font-mono text-[10px] leading-snug overflow-y-auto max-h-[50vh]`}>
                    {activeUnit.imagePrompt}
                  </pre>
                </>
              ) : (
                <p className="text-[12px] text-[var(--sps-muted)]">Add Matrix shots to extract campaign art.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'research' && (
          <div className="h-full overflow-y-auto p-4 space-y-4 max-w-4xl sps-atelier-pane">
            <p className="text-[15px] leading-relaxed m-0">{kit.research.insight}</p>
            <p className="text-[13px] leading-relaxed m-0">{kit.research.positioning}</p>
            <p className="text-[12px] text-[var(--sps-muted)] m-0">{kit.research.question}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.entries(kit.research.messageHouse || {}).map(([k, v]) => (
                <div key={k} className="rounded-[var(--sps-radius)] border border-[var(--sps-border)] p-3 bg-[var(--sps-surface)]">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--sps-gold)] m-0">{k}</p>
                  <p className="text-[12px] m-0 mt-2 leading-relaxed">{v}</p>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ['Primary', kit.research.audience.primary],
                ['Secondary', kit.research.audience.secondary],
                ['Do not chase', kit.research.audience.anti],
                ['Occasion', kit.research.audience.occasion],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[var(--sps-radius)] border border-[var(--sps-border)] p-3 bg-[var(--sps-surface)]">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--sps-gold)] m-0">{k}</p>
                  <p className="text-[12px] m-0 mt-2 leading-relaxed">{v}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[10px] uppercase text-[var(--sps-muted)] m-0 mb-2">Campaign grammar (not clones)</p>
              <div className="flex flex-wrap gap-1.5">
                {(kit.research.comps || []).map((c) => (
                  <span key={c} className="sps-chip text-[11px]">{c}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[var(--sps-muted)] m-0 mb-2">Platforms</p>
              <ul className="space-y-2 m-0 p-0 list-none">
                {(kit.research.platforms || []).map((p) => (
                  <li key={p.id} className="text-[12px] leading-relaxed">
                    <strong>{p.name}.</strong> {p.use}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[var(--sps-muted)] m-0 mb-2">Type & lockup</p>
              <ul className="m-0 pl-4 text-[12px] space-y-1">
                {(kit.research.colorType || []).map((n) => <li key={n}>{n}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[var(--sps-muted)] m-0 mb-2">Look notes from the matrix</p>
              <ul className="m-0 pl-4 text-[12px] space-y-1">
                {(kit.research.lookNotes || []).map((n) => <li key={n}>{n}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[var(--sps-muted)] m-0 mb-2">Risks</p>
              <ul className="m-0 pl-4 text-[12px] space-y-1">
                {(kit.research.risks || []).map((n) => <li key={n}>{n}</li>)}
              </ul>
            </div>
          </div>
        )}

        {tab === 'markets' && (
          <div className="h-full overflow-y-auto p-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-3 sps-atelier-pane">
            {(kit.markets || []).map((m) => (
              <div key={m.id} className="rounded-[var(--sps-radius)] border border-[var(--sps-border)] p-4 bg-[var(--sps-surface)]">
                <p className="text-[10px] uppercase tracking-widest text-[var(--sps-gold)] m-0">{m.tier} · {m.spend}</p>
                <h3 className="text-lg m-0 mt-1" style={{ fontFamily: 'var(--sps-font-display)' }}>{m.city}</h3>
                <p className="text-[12px] leading-relaxed m-0 mt-2">{m.note}</p>
                <p className="text-[11px] text-[var(--sps-muted)] m-0 mt-2">{m.mix}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'calendar' && (
          <div className="h-full overflow-y-auto p-4 max-w-2xl space-y-2 sps-atelier-pane">
            {(kit.research.calendar || []).map((c) => (
              <div key={c.week} className="flex gap-4 border-b border-[var(--sps-border)] py-3">
                <span className="font-mono text-[12px] text-[var(--sps-gold)] w-12 shrink-0">{c.week}</span>
                <span className="text-[13px] leading-relaxed">{c.beat}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'spend' && (
          <div className="h-full overflow-y-auto p-4 max-w-3xl space-y-4 sps-atelier-pane">
            <p className="text-[12px] text-[var(--sps-muted)] m-0">Planning bands, not a quote. Outdoor first in AP/TS; digital for diaspora.</p>
            {(kit.research.spendBands || []).map((s) => (
              <div key={s.label} className="rounded-[var(--sps-radius)] border border-[var(--sps-border)] p-4 bg-[var(--sps-surface)]">
                <p className="text-[10px] uppercase text-[var(--sps-gold)] m-0">{s.range}</p>
                <h3 className="text-base m-0 mt-1">{s.label}</h3>
                <p className="text-[12px] m-0 mt-2">{s.note}</p>
              </div>
            ))}
            <p className="text-[10px] uppercase text-[var(--sps-muted)] m-0">Media mix</p>
            {(kit.research.mediaMix || []).map((m) => (
              <div key={m.bucket} className="flex gap-4 border-b border-[var(--sps-border)] py-2">
                <span className="font-mono text-[12px] text-[var(--sps-gold)] w-28 shrink-0">{m.bucket} {m.share}</span>
                <span className="text-[12px] leading-relaxed">{m.note}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'festival' && (
          <div className="h-full overflow-y-auto p-4 grid sm:grid-cols-2 gap-3 sps-atelier-pane">
            {(kit.research.festivals || []).map((f) => (
              <div key={f.id} className="rounded-[var(--sps-radius)] border border-[var(--sps-border)] p-4 bg-[var(--sps-surface)]">
                <p className="text-[10px] uppercase text-[var(--sps-gold)] m-0">{f.window}</p>
                <h3 className="text-lg m-0 mt-1" style={{ fontFamily: 'var(--sps-font-display)' }}>{f.name}</h3>
                <p className="text-[12px] m-0 mt-2 leading-relaxed">{f.fit}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'tests' && (
          <div className="h-full overflow-y-auto p-4 max-w-3xl space-y-4 sps-atelier-pane">
            {(kit.research.tests || []).map((t) => (
              <div key={t.id} className="rounded-[var(--sps-radius)] border border-[var(--sps-border)] p-4 bg-[var(--sps-surface)]">
                <h3 className="text-sm m-0">{t.name}</h3>
                <p className="text-[12px] m-0 mt-2">{t.method}</p>
              </div>
            ))}
            <p className="text-[10px] uppercase text-[var(--sps-muted)] m-0">KPIs</p>
            {(kit.research.kpis || []).map((k) => (
              <div key={k.id} className="flex gap-4 border-b border-[var(--sps-border)] py-2">
                <span className="text-[12px] font-semibold w-40 shrink-0">{k.name}</span>
                <span className="text-[12px] text-[var(--sps-muted)]">{k.target}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'copy' && (
          <div className="h-full overflow-y-auto p-4 max-w-2xl space-y-4 sps-atelier-pane">
            <div>
              <p className="text-[10px] uppercase text-[var(--sps-muted)] m-0 mb-1">Logline</p>
              <p className="text-[14px] leading-relaxed m-0">{kit.spine.logline}</p>
            </div>
            {(kit.spine.pillars || []).map((p) => (
              <div key={p.id}>
                <p className="text-[10px] uppercase text-[var(--sps-gold)] m-0">{p.label}</p>
                <p className="text-[13px] m-0 mt-1">{p.text}</p>
              </div>
            ))}
            <div>
              <p className="text-[10px] uppercase text-[var(--sps-muted)] m-0 mb-1">Tagline</p>
              <p className="text-[16px] italic m-0">“{kit.spine.tagline}”</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[var(--sps-muted)] m-0 mb-1">CTAs</p>
              <div className="flex flex-wrap gap-1.5">
                {(kit.research.ctas || []).map((c) => (
                  <button key={c} type="button" className="sps-chip text-[11px]" onClick={() => copyText(c, c)}>
                    {copied === c ? 'Copied' : c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[var(--sps-muted)] m-0 mb-1">Dialogue pulls</p>
              <ul className="m-0 pl-4 text-[12px] space-y-1">
                {(kit.spine.dialogues || []).map((d) => <li key={d}>{d}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-[10px] uppercase text-[var(--sps-muted)] m-0 mb-1">Press Q&A</p>
              {(kit.research.pressQ || []).map((p) => (
                <div key={p.q} className="mt-3">
                  <p className="text-[12px] font-semibold m-0">{p.q}</p>
                  <p className="text-[12px] text-[var(--sps-muted)] m-0 mt-1">{p.a}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(kit.spine.hashtags || []).map((h) => (
                <button key={h} type="button" className="sps-chip text-[11px]" onClick={() => copyText(h, h)}>
                  {copied === h ? 'Copied' : h}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="sps-btn text-[11px]"
              onClick={() => copyText((kit.spine.hashtags || []).join(' '), 'tags')}
            >
              {copied === 'tags' ? 'Copied' : 'Copy hashtags'}
            </button>
          </div>
        )}

        {tab === 'legal' && (
          <div className="h-full overflow-y-auto p-4 max-w-2xl space-y-2 sps-atelier-pane">
            {(kit.research.legal || []).map((n) => (
              <p key={n} className="text-[13px] leading-relaxed border-b border-[var(--sps-border)] py-3 m-0">{n}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (asRoom) return body;
  return (
    <div className="sps-overlay" style={{ zIndex: 88 }}>
      <div className="sps-shell sps-atelier-room">{body}</div>
    </div>
  );
}
