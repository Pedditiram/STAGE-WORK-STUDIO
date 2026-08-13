import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Globe2, Sparkles, Plus, Trash2, Edit3, Check, Save,
  Mountain, Trees, Box, CloudFog, Layers, Copy, Image as ImageIcon, LogOut
} from 'lucide-react';
import { extractWorldEnvironmentAssetsWithLLM } from '../services/aiScriptParser';
import SaveCloseConfirmModal from './SaveCloseConfirmModal';
import CinematicReferencesPanel from './CinematicReferencesPanel';

const ASSET_TYPES = [
  { id: 'location', label: 'Location / Set', icon: Mountain },
  { id: 'background', label: 'Background Plate', icon: Trees },
  { id: 'prop', label: 'Set Prop', icon: Box },
  { id: 'element', label: 'World Element', icon: Layers },
  { id: 'atmosphere', label: 'Atmosphere', icon: CloudFog }
];

const VAULT_KEY = 'sps_world_environment_vault';
const INCLUDE_KEY = 'sps_include_world_in_prompt';

export function getStoredWorldEnvironmentAssets() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveStoredWorldEnvironmentAssets(assets) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(assets || []));
    window.dispatchEvent(new CustomEvent('sps_world_vault_updated'));
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
  return {
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
    includeInPrompt: true
  };
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
    const stored = getStoredWorldEnvironmentAssets();
    const cloned = cloneAssets(stored);
    snapshotRef.current = cloneAssets(stored);
    setAssets(cloned);
    setSelectedId(cloned[0]?.id || '');
    setHasUnsaved(false);
    setShowConfirmClose(false);
    setIncludeInPrompt(localStorage.getItem(INCLUDE_KEY) !== 'false');
  }, [isOpen]);

  useEffect(() => {
    const found = assets.find((a) => a.id === selectedId) || assets[0] || null;
    setEditing(found ? { ...found } : null);
    if (found && found.id !== selectedId) setSelectedId(found.id);
  }, [selectedId, assets]);

  const filtered = useMemo(() => {
    if (filterType === 'all') return assets;
    return assets.filter((a) => a.type === filterType);
  }, [assets, filterType]);

  const flash = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2400);
  };

  const commitEditingToAssets = (list = assets, draft = editing) => {
    if (!draft?.id) return list;
    return list.map((a) => (a.id === draft.id ? { ...draft } : a));
  };

  const persistAndClose = (nextAssets) => {
    saveStoredWorldEnvironmentAssets(nextAssets);
    snapshotRef.current = cloneAssets(nextAssets);
    setAssets(nextAssets);
    setHasUnsaved(false);
    setShowConfirmClose(false);
    onClose?.();
  };

  const handleSaveEditing = () => {
    if (!editing) return;
    const next = commitEditingToAssets(assets, editing);
    setAssets(next);
    saveStoredWorldEnvironmentAssets(next);
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
    saveStoredWorldEnvironmentAssets(snap);
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
    setEditing((prev) => ({ ...prev, [key]: value }));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md font-mono">
      <div
        className="bg-zinc-900 border border-emerald-500/40 rounded-2xl w-full max-w-5xl h-[88vh] max-h-[88vh] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-zinc-800 bg-zinc-950/90 shrink-0 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-700 shrink-0">
              <Globe2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white font-sans flex items-center gap-2 flex-wrap">
                World & Environment Console
                <span className="text-[10px] bg-emerald-950 text-amber-300 border border-emerald-700 px-2 py-0.5 rounded font-mono">
                  {projectTitle || 'Current Project'}
                </span>
              </h3>
              <p className="text-xs text-zinc-400 truncate">
                Locations, backgrounds, props & atmosphere plates — AI or writer prompts for image→video assets
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
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                includeInPrompt
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/70'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-700'
              }`}
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
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-xs font-bold flex items-center gap-1.5 border border-emerald-400/40 cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin' : ''}`} />
              {isExtracting ? 'Extracting…' : 'AI Extract from Shots'}
            </button>

            <button
              type="button"
              onClick={handleCreate}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center gap-1.5 border border-zinc-600 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-300" />
              New Asset
            </button>

            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black flex items-center gap-1.5 border border-emerald-300 cursor-pointer shadow"
              title="Save vault and close"
            >
              <Save className="w-3.5 h-3.5" />
              Save & Close
            </button>

            <button
              type="button"
              onClick={handleRequestClose}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[240px_1fr]">
          <aside className="border-r border-zinc-800 bg-zinc-950/70 overflow-y-auto p-3 space-y-3">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                  filterType === 'all' ? 'bg-emerald-500 text-black border-emerald-300' : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                }`}
              >
                All
              </button>
              {ASSET_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilterType(t.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                    filterType === t.id ? 'bg-emerald-500 text-black border-emerald-300' : 'bg-zinc-900 text-zinc-400 border-zinc-700'
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
                    className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                      active
                        ? 'bg-emerald-950/70 border-emerald-500/60 text-white'
                        : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{asset.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono truncate">{asset.tag}</div>
                        <div className="text-[10px] text-emerald-500/80 uppercase tracking-wide mt-0.5">{asset.type}</div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </aside>

          <section className="overflow-y-auto p-4 space-y-4 bg-[#0b1118]">
            <CinematicReferencesPanel
              sectionId="art"
              genreKey={
                (typeof window !== 'undefined' && localStorage.getItem('sps_preset_profile')) ||
                'mythological'
              }
              projectTitle={projectTitle}
              compact
            />
            {!editing ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                Select or create a world asset to edit prompts & plates.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <TypeIcon className="w-5 h-5 text-emerald-400" />
                    <h4 className="text-sm font-bold text-white">{editing.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-400 font-mono">
                      {editing.tag}
                    </span>
                    {hasUnsaved ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                        Unsaved
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEditing}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Asset
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(editing.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-700/50 text-xs font-bold flex items-center gap-1 cursor-pointer"
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
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-300">Tag</label>
                    <input
                      value={editing.tag || ''}
                      onChange={(e) => updateField('tag', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-400"
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
                    <label className="text-[11px] font-bold text-zinc-400">Reference image URL (optional — after you generate the plate)</label>
                    <input
                      value={editing.referenceImageUrl || ''}
                      onChange={(e) => updateField('referenceImageUrl', e.target.value)}
                      placeholder="https://… or data:image/…"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-200 font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  {editing.referenceImageUrl ? (
                    <img
                      src={editing.referenceImageUrl}
                      alt={editing.name}
                      className="max-h-40 rounded-lg border border-zinc-700 object-cover"
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

        <div className="shrink-0 border-t border-zinc-800 px-4 py-3 bg-zinc-950/90 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] text-zinc-500">
            {assets.length} world assets · Esc → Save & Close / Don&apos;t Save
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Close
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow"
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
