import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Sparkles, Edit3, Save, Copy, Check, X, 
  FileText, Cpu, AlertCircle, RefreshCw
} from 'lucide-react';
import { extractMasterScriptSynopsisWithLLM } from '../services/aiScriptParser';

export default function ScriptSynopsisModal({ isOpen, onClose }) {
  const [scriptSynopsisSource, setScriptSynopsisSource] = useState('auto_llm');
  const [llmAutoSynopsis, setLlmAutoSynopsis] = useState('');
  const [writerCustomSynopsis, setWriterCustomSynopsis] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load saved synopses from localStorage
    const savedSource = localStorage.getItem('sps_script_synopsis_source') || 'auto_llm';
    setScriptSynopsisSource(savedSource);

    const autoCand = localStorage.getItem('sps_extracted_master_story') || 
                     localStorage.getItem('sps_master_script_story') || 
                     localStorage.getItem('sps_narrative_prose_story') || '';
    setLlmAutoSynopsis(autoCand);

    const customCand = localStorage.getItem('sps_writer_custom_script_synopsis') || '';
    setWriterCustomSynopsis(customCand);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('sps_script_synopsis_source', scriptSynopsisSource);
    localStorage.setItem('sps_writer_custom_script_synopsis', writerCustomSynopsis);
    if (llmAutoSynopsis) {
      localStorage.setItem('sps_extracted_master_story', llmAutoSynopsis);
    }
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2000);
  };

  const handleAIExtract = async () => {
    try {
      setIsGenerating(true);
      const rawScript = localStorage.getItem('sps_current_screenplay_text') || '';
      
      const aiResult = await extractMasterScriptSynopsisWithLLM(rawScript);
      if (aiResult && aiResult.trim()) {
        const cleanRes = aiResult.trim();
        setLlmAutoSynopsis(cleanRes);
        localStorage.setItem('sps_extracted_master_story', cleanRes);
      }
    } catch (err) {
      console.warn("Error auto-generating Script Synopsis:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    const activeText = scriptSynopsisSource === 'writer_custom' ? writerCustomSynopsis : llmAutoSynopsis;
    if (navigator.clipboard && activeText) {
      navigator.clipboard.writeText(activeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const activeTextDisplay = scriptSynopsisSource === 'writer_custom' ? writerCustomSynopsis : llmAutoSynopsis;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-950 border border-amber-500/50 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-4 px-5 bg-gradient-to-r from-amber-950/80 via-zinc-900 to-purple-950/80 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
              <BookOpen className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white font-sans tracking-tight flex items-center gap-2">
                📜 Master Script Synopsis Editor
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Overall screenplay story arc overview used directly under <span className="text-amber-400 font-bold">Script Synopsis:</span> in compiled prompts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Synopsis Mode Selector */}
          <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Active Script Synopsis Version:
            </span>

            <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              <button
                type="button"
                onClick={() => setScriptSynopsisSource('auto_llm')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  scriptSynopsisSource === 'auto_llm'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>🤖 LLM Auto-Generated</span>
              </button>

              <button
                type="button"
                onClick={() => setScriptSynopsisSource('writer_custom')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  scriptSynopsisSource === 'writer_custom'
                    ? 'bg-purple-600 text-white font-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-purple-200" />
                <span>✍️ Writer Custom Synopsis</span>
              </button>
            </div>
          </div>

          {/* AI Auto-Extract Button */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-bold">
              {scriptSynopsisSource === 'auto_llm' ? '🤖 LLM Auto-Extracted Screenplay Synopsis:' : '✍️ Writer Manual Script Synopsis Input:'}
            </span>

            <button
              type="button"
              onClick={handleAIExtract}
              disabled={isGenerating}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-slate-950 text-xs font-black font-mono flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 text-slate-950 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Analyzing Screenplay...' : '⚡ AI Re-Extract Synopsis'}</span>
            </button>
          </div>

          {/* Text Area Input / Display */}
          {scriptSynopsisSource === 'writer_custom' ? (
            <textarea
              rows={8}
              value={writerCustomSynopsis}
              onChange={(e) => setWriterCustomSynopsis(e.target.value)}
              placeholder="Enter complete Writer Script Synopsis here..."
              style={{ backgroundColor: '#FFEE00', color: '#000000' }}
              className="w-full bg-[#FFEE00] text-black border border-[#E6C200] rounded-xl p-3.5 text-sm font-mono leading-relaxed resize-y font-black shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-zinc-700/60"
            />
          ) : (
            <textarea
              rows={8}
              value={llmAutoSynopsis || 'No LLM script synopsis extracted yet. Click "⚡ AI Re-Extract Synopsis" above or switch to Writer Custom Synopsis.'}
              onChange={(e) => setLlmAutoSynopsis(e.target.value)}
              style={{ backgroundColor: '#FFEE00', color: '#000000' }}
              className="w-full bg-[#FFEE00] text-black border border-[#E6C200] rounded-xl p-3.5 text-sm font-mono leading-relaxed resize-y font-black shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-zinc-700/60"
            />
          )}

          {/* Preview Note */}
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Active in Prompt Compiler: <strong className="text-amber-300">{scriptSynopsisSource === 'writer_custom' ? 'Writer Custom' : 'LLM Auto'}</strong>
            </span>
            <span className="text-zinc-400 font-bold">{activeTextDisplay ? activeTextDisplay.length : 0} chars</span>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold font-mono flex items-center gap-1.5 border border-zinc-700 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>

            {saveSuccessMsg && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> Saved to Vault!
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold font-mono transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => {
                handleSave();
                onClose();
              }}
              className="px-5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black font-mono flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
            >
              <Save className="w-4 h-4 text-slate-950" />
              <span>💾 Save & Apply Synopsis</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
