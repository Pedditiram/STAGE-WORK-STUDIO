import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Globe2, Sparkles, Plus, Trash2, Edit3, Check, Save,
  Mountain, Trees, Box, CloudFog, Layers, Copy, Image as ImageIcon, LogOut, Download, Archive
} from 'lucide-react';
import { assertExportAllowed, logExportSuccess, exportDownloadText, resolveCollabRoomId } from '../utils/exportGate';
import {
  worldPlatesToPrintHtml,
  worldBibleToCsv,
  buildWorldBibleZipFiles
} from '../utils/worldBibleExport';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';
import { extractWorldEnvironmentAssetsWithLLM } from '../services/aiScriptParser';
import { readLockedImageFile } from '../utils/continuitySpine';
import SaveCloseConfirmModal from './SaveCloseConfirmModal';
import CinematicReferencesPanel from './CinematicReferencesPanel';
import StudioProfileControl from './StudioProfileControl';
import { isGuestSession, canGuestBrowseApp } from '../utils/projectPermissions';
import { GUEST_PLAY_WORLD } from '../utils/guestPlayground';
import {
  getActiveWorldAssets,
  saveActiveWorldAssets
} from '../utils/projectBibleVault';
import {
  assertCanMutateContent,
  ensureLifecycle,
  isLifecycleLocked,
  ASSET_LOCKED_MUTABLE_KEYS
} from '../utils/productionLifecycle';
import LifecycleControls from './LifecycleControls';

const ASSET_TYPES = [
  { id: 'location', label: 'Location / Set', icon: Mountain },
  { id: 'background', label: 'Background Plate', icon: Trees },
  { id: 'prop', label: 'Set Prop', icon: Box },
  { id: 'element', label: 'World Element', icon: Layers },
  { id: 'atmosphere', label: 'Atmosphere', icon: CloudFog }
];

const INCLUDE_KEY = 'sps_include_world_in_prompt';

export function getStoredWorldEnvironmentAssets() {
  if (typeof window === 'undefined') return [];
  try {
    if (isGuestSession() && canGuestBrowseApp()) return GUEST_PLAY_WORLD.map((a) => ({ ...a }));
    return getActiveWorldAssets();
  } catch (e) {
    return [];
  }
}

export function saveStoredWorldEnvironmentAssets(assets, { title = '', silent = false } = {}) {
  if (typeof window === 'undefined') return;
  try {
    if (isGuestSession()) return;
    saveActiveWorldAssets(assets, { title, silent });
  } catch (e) {}
}

export function getActiveWorldAssetPrompt(asset) {
  if (!asset) return '';
  if (asset.promptSource === 'writer_custom' && String(asset.promptCustom || '').trim()) {
    return String(asset.promptCustom).trim();
  }
  return String(asset.promptAuto || asset.description || '').trim();
}

function typeMeta(type) {
  return ASSET_TYPES.find((t) => t.id === type) || ASSET_TYPES[0];
}

function blankAsset(index = 0) {
  return ensureLifecycle({
    id: `world_${Date.now()}_${index}`,
    tag: `@World_New_Asset_${index + 1}`,
    name: 'New World Asset',
    type: 'location',
    description: 'Describe the location, set, background, prop, or atmosphere for consistent plates…',
    promptAuto: '',
    promptCustom: '',
    promptSource: 'writer_custom',
    weather: '',
    timeOfDay: '',
    materials: '',
    lightingNotes: '',
    referenceImageUrl: '',
    lockedPlate: { url: '', locked: false },
    includeInPrompt: true,
    lifecycleStatus: 'draft'
  });
}

function cloneAssets(list) {
  try {
    return JSON.parse(JSON.stringify(list || []));
  } catch (e) {
    return [...(list || [])];
  }
}

export default function WorldEnvironmentConsole({
  isOpen,
  onClose,
  shots = [],
  projectTitle = ''
}) {
  const [assets, setAssets] = useState(() => getStoredWorldEnvironmentAssets());
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [isExtracting, setIsExtracting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [includeInPrompt, setIncludeInPrompt] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(INCLUDE_KEY) !== 'false';
  });
  const [copied, setCopied] = useState(false);
  const snapshotRef = useRef([]);

  useEffect(() => {
    if (!isOpen) return;
    const reload = () => {
      const stored = getStoredWorldEnvironmentAssets();
      const cloned = cloneAssets(stored);
      snapshotRef.current = cloneAssets(stored);
      setAssets(cloned);
      setSelectedId(cloned[0]?.id || '');
      setHasUnsaved(false);
      setShowConfirmClose(false);
      setIncludeInPrompt(localStorage.getItem(INCLUDE_KEY) !== 'false');
    };
    reload();
    window.addEventListener('sps_world_vault_updated', reload);
    return () => window.removeEventListener('sps_world_vault_updated', reload);
  }, [isOpen, projectTitle]);

  useEffect(() => {
    const found = assets.find((a) => a.id === selectedId) || assets[0] || null;
    setEditing(found ? { ...found } : null);
    if (found && found.id !== selectedId) setSelectedId(found.id);
  }, [selectedId, assets]);

  const filtered = useMemo(() => {
    if (filterType === 'all') return assets;
    return assets.filter((a) => a.type === filterType);
  }, [assets, filterType]);

  const exportLife = useMemo(() => lifecycleExportReadiness(shots, projectTitle), [shots, projectTitle]);
  const {
    strict: worldLifecycleStrict,
    mode: worldLifecycleMode
  } = useExportLifecyclePref('world');
  const worldExportBlocked = worldLifecycleStrict && !exportLife.exportReady;
  const roomId = resolveCollabRoomId();
  const worldSlug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);

  const exportWorldCsv = () => {
    const pack = filterType === 'all' ? assets : filtered;
    if (!pack.length) {
      flash('No world assets to export.');
      return;
    }
    const lifeNote = `${pack.length} assets · ${pack.filter((a) => a?.referenceImageUrl || a?.lockedPlate?.url).length} plates${roomId ? ` · room:${roomId}` : ''}`;
    exportDownloadText(`${worldSlug}_world.csv`, worldBibleToCsv(pack, projectTitle), {
      projectTitle,
      auditLabel: 'world_bible_csv',
      auditFormat: 'csv',
      mime: 'text/csv;charset=utf-8',
      lifecycleMode: worldLifecycleMode,
      shots,
      roomId,
      note: lifeNote
    });
  };

  const exportWorldZip = async () => {
    const pack = filterType === 'all' ? assets : filtered;
    if (worldExportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'world_bible_zip',
        format: 'zip',
        lifecycleMode: worldLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'world_bible_zip',
      format: 'zip',
      lifecycleMode: worldLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    if (!pack.length) {
      flash('No world assets to export.');
      return;
    }
    const lifeNote = `${pack.length} assets · ${pack.filter((a) => a?.referenceImageUrl || a?.lockedPlate?.url).length} plates${roomId ? ` · room:${roomId}` : ''}`;
    const files = buildWorldBibleZipFiles(pack, projectTitle, { roomId });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, `${worldSlug}_world_bible.zip`, {
      projectTitle,
      shots,
      lifecycleMode: worldLifecycleMode,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      auditLabel: 'world_bible_zip',
      auditFormat: 'zip',
      roomId,
      note: lifeNote,
      showAlert: false
    });
    flash('World bible ZIP saved.');
  };

  const flash = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2400);
  };

  const commitEditingToAssets = (list = assets, draft = editing) => {
    if (!draft?.id) return list;
    return list.map((a) => (a.id === draft.id ? { ...draft } : a));
  };

  const persistAndClose = (nextAssets) => {
    saveStoredWorldEnvironmentAssets(nextAssets, { title: projectTitle });
    snapshotRef.current = cloneAssets(nextAssets);
    setAssets(nextAssets);
    setHasUnsaved(false);
    setShowConfirmClose(false);
    onClose?.();
  };

  const handleSaveEditing = () => {
    if (!editing) return;
    const next = commitEditingToAssets(assets, ensureLifecycle(editing));
    setAssets(next);
    saveStoredWorldEnvironmentAssets(next, { title: projectTitle });
    snapshotRef.current = cloneAssets(next);
    setHasUnsaved(false);
    flash('✓ World asset saved');
  };

  const handleSaveAndClose = () => {
    const next = commitEditingToAssets(assets, editing);
    persistAndClose(next);
  };

  const handleCloseWithoutSave = () => {
    const snap = cloneAssets(snapshotRef.current);
    saveStoredWorldEnvironmentAssets(snap, { title: projectTitle });
    setAssets(snap);
    setHasUnsaved(false);
    setShowConfirmClose(false);
    onClose?.();
  };

  const isDirty = () => {
    const draftDirty =
      hasUnsaved ||
      (editing &&
        JSON.stringify(editing) !== JSON.stringify(assets.find((a) => a.id === editing.id) || null));
    const listDirty = JSON.stringify(assets) !== JSON.stringify(snapshotRef.current);
    return Boolean(draftDirty || listDirty);
  };

  const handleRequestClose = () => {
    if (isDirty()) {
      setShowConfirmClose(true);
      return;
    }
    onClose?.();
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (showConfirmClose) {
        setShowConfirmClose(false);
        return;
      }
      if (isDirty()) {
        setShowConfirmClose(true);
        return;
      }
      onClose?.();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  });

  if (!isOpen) return null;

  const updateField = (key, value) => {
    if (!editing) return;
    if (ASSET_LOCKED_MUTABLE_KEYS.includes(key)) {
      setEditing((prev) => ({ ...prev, [key]: value }));
      setHasUnsaved(true);
      return;
    }
    if (!assertCanMutateContent(editing).ok) {
      flash('Locked — unlock to edit this world asset.');
      return;
    }
    setEditing((prev) => ({ ...prev, [key]: value }));
    setHasUnsaved(true);
  };

  const handleLifecycleChange = (nextEntity) => {
    if (!nextEntity?.id) return;
    setEditing(nextEntity);
    setAssets((prev) => prev.map((a) => (a.id === nextEntity.id ? nextEntity : a)));
    setHasUnsaved(true);
  };

  const handleCreate = () => {
    const nextAsset = blankAsset(assets.length);
    const next = [nextAsset, ...assets];
    setAssets(next);
    setSelectedId(nextAsset.id);
    setEditing({ ...nextAsset });
    setHasUnsaved(true);
  };

  const handleDelete = (id) => {
    const target = assets.find((a) => a.id === id);
    if (target && isLifecycleLocked(target)) {
      flash('Unlock before deleting a locked world asset.');
      return;
    }
    const next = assets.filter((a) => a.id !== id);
    setAssets(next);
    setSelectedId(next[0]?.id || '');
    setHasUnsaved(true);
    flash('Asset removed (save to keep)');
  };

  const handleExtract = async () => {
    setIsExtracting(true);
    try {
      const extracted = await extractWorldEnvironmentAssetsWithLLM(shots, projectTitle);
      if (Array.isArray(extracted) && extracted.length) {
        setAssets(extracted);
        setSelectedId(extracted[0].id);
        setHasUnsaved(true);
        flash(`✨ Extracted ${extracted.length} world assets — Save & Close to keep`);
      } else {
        flash('No world assets found — add manually');
      }
    } catch (e) {
      flash('Extract failed — try again or add manually');
    } finally {
      setIsExtracting(false);
    }
  };

  const activePrompt = getActiveWorldAssetPrompt(editing);

  const handleCopyPrompt = () => {
    if (!activePrompt || !navigator.clipboard) return;
    navigator.clipboard.writeText(activePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const TypeIcon = typeMeta(editing?.type).icon;

  return (
    <div className="sps-overlay">
      <div
        className="sps-shell sps-atelier-room"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-3 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] shrink-0 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="sps-mark shrink-0">
              <Globe2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[var(--sps-text)] font-sans flex items-center gap-2 flex-wrap m-0">
                World
                <span className="sps-chip text-[10px] normal-case tracking-normal">
                  {projectTitle || 'Current Project'}
                </span>
              </h3>
              <p className="text-xs text-[var(--sps-muted)] truncate">
                Locations, plates and atmosphere — lock the place for the take
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {toastMsg ? (
              <span className="text-xs text-emerald-300 font-bold bg-emerald-950/90 border border-emerald-700 px-2.5 py-1 rounded-lg">
                {toastMsg}
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => {
                const next = !includeInPrompt;
                setIncludeInPrompt(next);
                localStorage.setItem(INCLUDE_KEY, next ? 'true' : 'false');
                flash(next ? '✓ World bible enabled in prompts' : 'World bible excluded from prompts');
              }}
              className={`sps-btn text-[10px] ${includeInPrompt ? 'sps-btn-primary' : ''}`}
              title="Include World & Environment bible in compiled prompts"
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${includeInPrompt ? 'bg-emerald-500 border-emerald-300 text-black' : 'border-zinc-600'}`}>
                {includeInPrompt ? <Check className="w-3 h-3 stroke-[3]" /> : null}
              </span>
              Add to Final Prompt
            </button>

            <button
              type="button"
              onClick={handleExtract}
              disabled={isExtracting}
              className="sps-btn sps-btn-primary text-[10px]"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin' : ''}`} />
              {isExtracting ? 'Extracting…' : 'AI Extract from Shots'}
            </button>

            <button
              type="button"
              onClick={handleCreate}
              className="sps-btn text-[10px]"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-300" />
              New Asset
            </button>

            <button
              type="button"
              className="sps-btn text-[10px] disabled:opacity-40"
              disabled={worldExportBlocked}
              title={worldExportBlocked ? exportLife.message : 'Print world plates as PDF pack'}
              onClick={() => {
                if (worldExportBlocked) {
                  assertExportAllowed({
                    projectTitle,
                    label: 'world_plate_pdf',
                    format: 'pdf',
                    lifecycleMode: worldLifecycleMode,
                    shots,
                    roomId,
                    showAlert: true
                  });
                  return;
                }
                const gate = assertExportAllowed({
                  projectTitle,
                  label: 'world_plate_pdf',
                  format: 'pdf',
                  lifecycleMode: worldLifecycleMode,
                  shots,
                  roomId,
                  showAlert: true
                });
                if (!gate.ok) return;
                const pack = filterType === 'all' ? assets : filtered;
                if (!pack.length) {
                  flash('No world assets to print.');
                  return;
                }
                const printWindow = window.open('', '_blank');
                if (!printWindow) {
                  window.alert('Please allow popups to export PDF.');
                  return;
                }
                printWindow.document.write(worldPlatesToPrintHtml(pack, projectTitle, { roomId }));
                printWindow.document.close();
                const lifeNote = `${pack.length} assets · ${
                  pack.filter((a) => a?.referenceImageUrl || a?.lockedPlate?.url).length
                } plates${roomId ? ` · room:${roomId}` : ''}`;
                logExportSuccess({
                  projectTitle,
                  label: 'world_plate_pdf',
                  format: 'pdf',
                  filename: `${worldSlug}_world_plates.pdf`,
                  roomId,
                  note: lifeNote,
                  lifecycleMode: gate.advisory ? `${worldLifecycleMode}+ok` : worldLifecycleMode
                });
                flash('Plate pack opened — save as PDF.');
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Plate PDF
            </button>
            <button
              type="button"
              className="sps-btn text-[10px] disabled:opacity-40"
              disabled={worldExportBlocked}
              title={worldExportBlocked ? exportLife.message : 'Export world CSV'}
              onClick={exportWorldCsv}
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              type="button"
              className="sps-btn text-[10px] disabled:opacity-40"
              disabled={worldExportBlocked}
              title={worldExportBlocked ? exportLife.message : 'Download world bible ZIP'}
              onClick={exportWorldZip}
            >
              <Archive className="w-3.5 h-3.5" />
              ZIP
            </button>

            <StudioProfileControl />
            <button
              type="button"
              onClick={handleRequestClose}
              className="sps-icon-btn"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[240px_1fr]">
          <aside className="sps-atelier-pane border-r border-[var(--sps-border)] overflow-y-auto p-3 space-y-3">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`sps-cat-chip px-2 py-0.5 text-[10px] ${
                  filterType === 'all' ? 'is-on' : ''
                }`}
              >
                All
              </button>
              {ASSET_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilterType(t.id)}
                  className={`sps-cat-chip px-2 py-0.5 text-[10px] ${
                    filterType === t.id ? 'is-on' : ''
                  }`}
                >
                  {t.label.split(' ')[0]}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="text-xs text-zinc-500 p-3 border border-dashed border-zinc-700 rounded-xl">
                No world assets yet. Run <strong className="text-emerald-400">AI Extract</strong> or add one manually.
              </div>
            ) : (
              filtered.map((asset) => {
                const Icon = typeMeta(asset.type).icon;
                const active = asset.id === (editing?.id || selectedId);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      if (hasUnsaved && editing?.id !== asset.id) {
                        setShowConfirmClose(true);
                        return;
                      }
                      setSelectedId(asset.id);
                    }}
                    className={`w-full text-left p-2.5 rounded-[10px] border transition-all ${
                      active
                        ? 'bg-[var(--sps-row-active)] border-[var(--sps-gold)] text-[var(--sps-text)]'
                        : 'bg-[var(--sps-surface)] border-[var(--sps-border)] text-[var(--sps-text)] hover:border-[var(--sps-gold)]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="w-4 h-4 text-[var(--sps-gold)] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{asset.name}</div>
                        <div className="text-[10px] text-[var(--sps-muted)] font-mono truncate">{asset.tag}</div>
                        <div className="text-[10px] text-[var(--sps-gold)] uppercase tracking-wide mt-0.5">
                          {asset.type}
                          <span className="text-[var(--sps-muted)] ml-1 normal-case tracking-normal">
                            · {String(asset.lifecycleStatus || 'draft')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </aside>

          <section className="sps-atelier-pane overflow-y-auto p-4 space-y-4">
            {!editing ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                Select or create a world asset to edit prompts & plates.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TypeIcon className="w-5 h-5 text-[var(--sps-gold)]" />
                    <h4 className="text-sm font-bold text-[var(--sps-text)]">{editing.name}</h4>
                    <span className="sps-count-pill font-mono">
                      {editing.tag}
                    </span>
                    <LifecycleControls entity={editing} onChange={handleLifecycleChange} />
                    {isLifecycleLocked(editing) ? (
                      <span className="text-[10px] text-[var(--sps-gold)] font-mono">Locked</span>
                    ) : null}
                    {hasUnsaved ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                        Unsaved
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <CinematicReferencesPanel
                      sectionId="art"
                      genreKey={
                        (typeof window !== 'undefined' && localStorage.getItem('sps_preset_profile')) ||
                        'mythological'
                      }
                      projectTitle={projectTitle}
                      compact
                    />
                    <button
                      type="button"
                      onClick={handleSaveEditing}
                      className="sps-btn sps-btn-primary text-[10px]"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Asset
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(editing.id)}
                      disabled={isLifecycleLocked(editing)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-700/50 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-300">Name</label>
                    <input
                      value={editing.name || ''}
                      onChange={(e) => updateField('name', e.target.value)}
                      disabled={isLifecycleLocked(editing)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400 disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-300">Tag</label>
                    <input
                      value={editing.tag || ''}
                      onChange={(e) => updateField('tag', e.target.value)}
                      disabled={isLifecycleLocked(editing)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-400 disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-300">Asset Type</label>
                    <select
                      value={editing.type || 'location'}
                      onChange={(e) => updateField('type', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                    >
                      {ASSET_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-300">Prompt Source</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => updateField('promptSource', 'auto_llm')}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1 ${
                          editing.promptSource === 'auto_llm'
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" /> AI Auto
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('promptSource', 'writer_custom')}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1 ${
                          editing.promptSource === 'writer_custom'
                            ? 'bg-amber-500 text-zinc-950 border-amber-300'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        <Edit3 className="w-3 h-3" /> Writer
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-emerald-300">Visual Bible / Description</label>
                  <textarea
                    rows={3}
                    value={editing.description || ''}
                    onChange={(e) => updateField('description', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-100 leading-relaxed focus:outline-none focus:border-emerald-400 resize-y"
                    placeholder="Consistent look of this world asset across all shots…"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-300">Weather</label>
                    <input
                      value={editing.weather || ''}
                      onChange={(e) => updateField('weather', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-300">Time of Day</label>
                    <input
                      value={editing.timeOfDay || ''}
                      onChange={(e) => updateField('timeOfDay', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-300">Materials / Textures</label>
                    <input
                      value={editing.materials || ''}
                      onChange={(e) => updateField('materials', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-300">Lighting Notes</label>
                    <input
                      value={editing.lightingNotes || ''}
                      onChange={(e) => updateField('lightingNotes', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="space-y-1 bg-purple-950/20 border border-purple-500/30 rounded-xl p-3">
                    <label className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> AI Auto-Generated Image Prompt
                    </label>
                    <textarea
                      rows={5}
                      value={editing.promptAuto || ''}
                      onChange={(e) => updateField('promptAuto', e.target.value)}
                      className="w-full bg-zinc-950 border border-purple-500/30 rounded-lg p-2.5 text-xs text-purple-100 leading-relaxed focus:outline-none focus:border-purple-400 resize-y"
                      placeholder="LLM plate prompt for this asset…"
                    />
                  </div>
                  <div className="space-y-1 bg-amber-950/20 border border-amber-500/30 rounded-xl p-3">
                    <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5" /> Writer Custom Image Prompt
                    </label>
                    <textarea
                      rows={5}
                      value={editing.promptCustom || ''}
                      onChange={(e) => updateField('promptCustom', e.target.value)}
                      className="w-full bg-zinc-950 border border-amber-500/30 rounded-lg p-2.5 text-xs text-amber-50 leading-relaxed focus:outline-none focus:border-amber-400 resize-y"
                      placeholder="Your locked plate prompt for image→video…"
                    />
                  </div>
                </div>

                <div className="bg-zinc-950 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Active plate prompt ({editing.promptSource === 'writer_custom' ? 'Writer' : 'AI Auto'})
                    </label>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-bold text-zinc-200 flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy for Image Gen'}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{activePrompt || '—'}</p>
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-bold text-zinc-400">Locked location plate</label>
                    <input
                      value={editing.referenceImageUrl || editing.lockedPlate?.url || ''}
                      onChange={(e) => {
                        updateField('referenceImageUrl', e.target.value);
                        updateField('lockedPlate', { url: e.target.value, locked: !!e.target.value });
                      }}
                      placeholder="Paste URL or upload below"
                      className="w-full bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 text-xs text-[var(--sps-text)] font-mono focus:outline-none"
                    />
                    <label className="sps-btn text-[10px] cursor-pointer inline-flex">
                      Upload plate
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await readLockedImageFile(file);
                          updateField('referenceImageUrl', url);
                          updateField('lockedPlate', { url, locked: true });
                        }}
                      />
                    </label>
                  </div>
                  {(editing.referenceImageUrl || editing.lockedPlate?.url) ? (
                    <img
                      src={editing.referenceImageUrl || editing.lockedPlate?.url}
                      alt={editing.name}
                      className="max-h-40 border border-zinc-700 object-cover"
                    />
                  ) : null}
                </div>

                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editing.includeInPrompt}
                    onChange={(e) => updateField('includeInPrompt', e.target.checked)}
                    className="accent-emerald-500"
                  />
                  Include this asset when World bible is enabled in Prompt Compiler
                </label>
              </>
            )}
          </section>
        </div>

        <div className="shrink-0 border-t border-[var(--sps-border)] px-4 py-1.5 bg-[var(--sps-bg-elevated)] flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] text-[var(--sps-muted)]">
            {assets.length} world assets · Esc closes
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRequestClose}
              className="sps-btn text-[10px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Close
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="sps-btn sps-btn-primary text-[10px]"
            >
              <Save className="w-3.5 h-3.5" />
              Save & Close
            </button>
          </div>
        </div>
      </div>

      <SaveCloseConfirmModal
        isOpen={showConfirmClose}
        title="Save World Console before closing?"
        onSaveAndClose={handleSaveAndClose}
        onCloseWithoutSave={handleCloseWithoutSave}
        onCancel={() => setShowConfirmClose(false)}
      />
    </div>
  );
}
