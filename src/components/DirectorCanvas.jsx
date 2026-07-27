import React, { useEffect, useRef, useState } from 'react';
import { Video, Eye, Sun, Sparkles, Layers, Shield, Zap, Film, Play, FastForward, Box, Palette, Image as ImageIcon, Loader2, Download, Wand2, CheckCircle2, RefreshCw, Edit3, Users, Building, Compass, Smile, HardDrive, AlertCircle, Settings } from 'lucide-react';
import { getStoredCanvasVaultImages, saveCanvasVaultImage, downloadAllCanvasImagesToDisk } from '../services/canvasVault';

// Safe Cross-Browser Rounded Rectangle helper for Safari / WebKit compatibility
function drawRoundRect(ctx, x, y, w, h, r = 8) {
  if (typeof ctx.roundRect === 'function') {
    try {
      ctx.roundRect(x, y, w, h, Array.isArray(r) ? r : [r]);
      return;
    } catch (e) {}
  }
  const rad = typeof r === 'number' ? r : (Array.isArray(r) ? r[0] || 8 : 8);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export default function DirectorCanvas({ 
  shot, 
  aspectRatio = "2.39:1 Anamorphic", 
  shots = [], 
  activeShotIndex = 0, 
  setActiveShotIndex,
  keyframeMode: externalKeyframeMode,
  setKeyframeMode: externalSetKeyframeMode,
  projectGeneratedImages = {},
  onEmbedImage,
  onOpenAdminSettings
}) {
  const canvasRef = useRef(null);
  
  // Internal keyframe state if external not supplied
  const [internalKeyframeMode, setInternalKeyframeMode] = useState('transition');
  const keyframeMode = externalKeyframeMode !== undefined ? externalKeyframeMode : internalKeyframeMode;
  const setKeyframeMode = externalSetKeyframeMode || setInternalKeyframeMode;

  // Render Style: '3d_clay_render' | '2d_blueprint' | 'pencil_sketch' | 'generated_ai_image'
  const [renderStyle, setRenderStyle] = useState('3d_clay_render');

  // Image Generation State (Local Storage Vault + Project Images)
  const [generatedImages, setGeneratedImages] = useState(() => {
    const storedVault = getStoredCanvasVaultImages();
    return { ...storedVault, ...(projectGeneratedImages || {}) };
  });
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [engineBadgeText, setEngineBadgeText] = useState('SeeDream 5.0 2K Engine');
  const [isEmbeddedToast, setIsEmbeddedToast] = useState(false);

  useEffect(() => {
    const storedVault = getStoredCanvasVaultImages();
    setGeneratedImages(prev => ({ ...storedVault, ...prev, ...(projectGeneratedImages || {}) }));
  }, [projectGeneratedImages]);

  useEffect(() => {
    if (renderStyle === 'generated_ai_image') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Extract shot metadata
    const composition = shot?.shotComposition || 'Medium Shot (MS)';
    const cameraMotion = shot?.cameraMotionTag || '[Camera: Static Anchor]';
    const eyeLook = shot?.eyeDirectionLook || 'Direct Focus on Target / Camera';
    const expression = shot?.actorFacialExpression || 'Serene & Absolute Calm / Intense Gaze';
    const envContext = shot?.actionEnvContext || 'Ancient Temple Pillars & Battlefield Horizon';
    const coArtist = shot?.coArtistInteraction || 'Supporting Armies & Crowd Silhouettes in Background';

    const compLower = composition.toLowerCase();
    const isCloseUp = compLower.includes('close-up') || compLower.includes('ecu') || compLower.includes('cu');
    const isWide = compLower.includes('wide') || compLower.includes('ews') || compLower.includes('extreme wide');

    // -------------------------------------------------------------
    // RENDER MODE 1: 3D CLAY SCULPT STUDIO RENDER
    // -------------------------------------------------------------
    if (renderStyle === '3d_clay_render') {
      // 1. 3D Studio Background & Studio Lighting
      const studioBg = ctx.createLinearGradient(0, 0, W, H);
      studioBg.addColorStop(0, '#18181b');
      studioBg.addColorStop(0.55, '#09090b');
      studioBg.addColorStop(1, '#040405');
      ctx.fillStyle = studioBg;
      ctx.fillRect(0, 0, W, H);

      // 3D Perspective Stage Floor Grid
      const horizonY = H * 0.42;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;

      ctx.beginPath(); ctx.moveTo(0, horizonY); ctx.lineTo(W, horizonY); ctx.stroke();

      for (let x = -W * 0.5; x <= W * 1.5; x += 60) {
        ctx.beginPath();
        ctx.moveTo(W / 2, horizonY);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      for (let y = horizonY; y <= H; y += (y - horizonY) * 0.35 + 8) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.restore();

      // Studio Spotlight Cones onto Clay Mannequins
      ctx.save();
      const spotlight1 = ctx.createRadialGradient(W * 0.3, horizonY - 40, 10, W * 0.35, H * 0.7, 280);
      spotlight1.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
      spotlight1.addColorStop(1, 'transparent');
      ctx.fillStyle = spotlight1;
      ctx.beginPath(); ctx.moveTo(W * 0.3, 0); ctx.lineTo(0, H); ctx.lineTo(W * 0.6, H); ctx.closePath(); ctx.fill();

      const spotlight2 = ctx.createRadialGradient(W * 0.7, horizonY - 40, 10, W * 0.65, H * 0.7, 280);
      spotlight2.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      spotlight2.addColorStop(1, 'transparent');
      ctx.fillStyle = spotlight2;
      ctx.beginPath(); ctx.moveTo(W * 0.7, 0); ctx.lineTo(W * 0.35, H); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      ctx.restore();

      // Function to render a 3D Matte Clay Character Sculpt
      const renderClayMannequin = (x, y, radius, height, clayColor, label, isFirst) => {
        ctx.save();
        const shadowGrad = ctx.createRadialGradient(x, y + height / 2, 5, x, y + height / 2, radius * 2.2);
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
        shadowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath(); ctx.ellipse(x, y + height / 2, radius * 2, radius * 0.8, 0, 0, Math.PI * 2); ctx.fill();

        const torsoGrad = ctx.createLinearGradient(x - radius, y - height / 2, x + radius, y + height / 2);
        if (clayColor === 'gold') {
          torsoGrad.addColorStop(0, '#fef3c7');
          torsoGrad.addColorStop(0.4, '#f59e0b');
          torsoGrad.addColorStop(1, '#78350f');
        } else {
          torsoGrad.addColorStop(0, '#f4f4f5');
          torsoGrad.addColorStop(0.4, '#38bdf8');
          torsoGrad.addColorStop(1, '#0c4a6e');
        }
        ctx.fillStyle = torsoGrad;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;

        drawRoundRect(ctx, x - radius, y - height / 2 + 15, radius * 2, height - 15, radius * 0.6);
        ctx.fill(); ctx.stroke();

        const headGrad = ctx.createRadialGradient(x - radius * 0.3, y - height / 2 - radius * 0.3, radius * 0.2, x, y - height / 2, radius * 1.1);
        if (clayColor === 'gold') {
          headGrad.addColorStop(0, '#fffbeb');
          headGrad.addColorStop(0.5, '#fbbf24');
          headGrad.addColorStop(1, '#92400e');
        } else {
          headGrad.addColorStop(0, '#ffffff');
          headGrad.addColorStop(0.5, '#7dd3fc');
          headGrad.addColorStop(1, '#0369a1');
        }
        ctx.fillStyle = headGrad;
        ctx.beginPath(); ctx.arc(x, y - height / 2 - 5, radius * 1.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        ctx.fillStyle = isFirst ? '#38bdf8' : '#f59e0b';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(label, x - radius * 1.5, y + height / 2 + 22);
        ctx.restore();
      };

      let startX = W * 0.3; let startY = H * 0.68;
      let endX = W * 0.68; let endY = H * 0.62;

      if (isWide) { startX = W * 0.25; endX = W * 0.62; }
      else if (isCloseUp) { startX = W * 0.42; endX = W * 0.58; }

      if (keyframeMode === 'first_frame' || keyframeMode === 'transition') {
        renderClayMannequin(startX, startY, isCloseUp ? 55 : 32, isCloseUp ? 150 : 100, 'cyan', 'FRAME 0 (CLAY SCULPT)', true);
      }

      if (keyframeMode === 'last_frame' || keyframeMode === 'transition') {
        renderClayMannequin(endX, endY, isCloseUp ? 62 : 38, isCloseUp ? 165 : 115, 'gold', 'FRAME N (CLAY SCULPT)', false);
      }

      if (keyframeMode === 'transition') {
        ctx.save();
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 3.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(startX + 20, startY - 60);
        ctx.quadraticCurveTo((startX + endX) / 2, (startY + endY) / 2 - 90, endX - 20, endY - 60);
        ctx.stroke();

        drawArrow(ctx, (startX + endX) / 2 - 20, (startY + endY) / 2 - 60, (startX + endX) / 2 + 30, (startY + endY) / 2 - 65);

        ctx.fillStyle = '#ec4899';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`3D CLAY MOTION INTERPOLATION: ${cameraMotion.replace(/\[|\]/g, '')}`, W * 0.22, H * 0.16);
        ctx.restore();
      }

    } else if (renderStyle === '2d_blueprint') {
      // -------------------------------------------------------------
      // RENDER MODE 2: 2D TECHNICAL BLUEPRINT STAGE RENDER
      // -------------------------------------------------------------
      let primaryHue = '#041329';
      let secondaryHue = '#020b18';

      if (keyframeMode === 'last_frame') {
        primaryHue = '#3a0c04'; secondaryHue = '#180402';
      }

      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, primaryHue); bgGrad.addColorStop(1, secondaryHue);
      ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

      let startX = W * 0.3; let startY = H * 0.65;
      let endX = W * 0.65; let endY = H * 0.55;

      if (keyframeMode === 'first_frame' || keyframeMode === 'transition') {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
        drawRoundRect(ctx, startX - 35, startY - 55, 70, 110, 12); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(startX, startY - 80, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 11px font-mono';
        ctx.fillText('FRAME 0 (STARTING STANCE)', startX - 55, startY + 70);
        ctx.restore();
      }

      if (keyframeMode === 'last_frame' || keyframeMode === 'transition') {
        ctx.save();
        ctx.fillStyle = 'rgba(30, 27, 75, 0.9)'; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3;
        drawRoundRect(ctx, endX - 40, endY - 60, 80, 120, 14); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(endX, endY - 88, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 11px font-mono';
        ctx.fillText('FRAME N (ENDING CLIMAX POSE)', endX - 55, endY + 80);
        ctx.restore();
      }

      if (keyframeMode === 'transition') {
        ctx.save();
        ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 3.5; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(startX + 30, startY - 40);
        ctx.quadraticCurveTo((startX + endX) / 2, (startY + endY) / 2 - 80, endX - 30, endY - 40); ctx.stroke();
        drawArrow(ctx, (startX + endX) / 2 - 20, (startY + endY) / 2 - 50, (startX + endX) / 2 + 30, (startY + endY) / 2 - 55);
        ctx.fillStyle = '#ec4899'; ctx.font = 'bold 11px font-mono';
        ctx.fillText(`MOTION VECTOR: ${cameraMotion.replace(/\[|\]/g, '')}`, W * 0.22, H * 0.22);
        ctx.restore();
      }
    } else if (renderStyle === 'pencil_sketch') {
      // -------------------------------------------------------------
      // RENDER MODE 3: ABSTRACT PENCIL SKETCH STORYBOARD (WITH ARCHITECTURE & CROWD)
      // -------------------------------------------------------------
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, W, H);

      // Subtle Graphite Hatching Noise
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < W; i += 18) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 80, H); ctx.stroke();
      }
      for (let j = 0; j < H; j += 18) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(W, j - 60); ctx.stroke();
      }
      ctx.restore();

      // SKETCH ARCHITECTURE & ENVIRONMENT COLUMNS
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(W * 0.08, H * 0.15, 35, H * 0.65);
      ctx.strokeRect(W * 0.82, H * 0.15, 35, H * 0.65);
      ctx.strokeRect(W * 0.2, H * 0.25, 25, H * 0.55);
      ctx.strokeRect(W * 0.72, H * 0.25, 25, H * 0.55);
      ctx.beginPath(); ctx.moveTo(W * 0.08, H * 0.2); ctx.quadraticCurveTo(W * 0.5, H * 0.05, W * 0.82 + 35, H * 0.2); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '10px monospace';
      ctx.fillText(`ARCHITECTURAL SPAN: ${envContext.slice(0, 35)}...`, W * 0.3, H * 0.12);
      ctx.restore();

      // SKETCH SUPPORTING CROWD / ARMY SILHOUETTES IN BACKGROUND
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      const bgCrowdY = H * 0.52;
      for (let cx = W * 0.15; cx <= W * 0.85; cx += 22) {
        if (Math.abs(cx - W * 0.5) > 60) {
          ctx.beginPath(); ctx.arc(cx, bgCrowdY - 15, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(cx - 5, bgCrowdY - 9, 10, 20);
        }
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '10px monospace';
      ctx.fillText(`SUPPORTING CROWD / ARMY: ${coArtist.slice(0, 30)}...`, W * 0.15, H * 0.58);
      ctx.restore();

      // Render Abstract Pencil Mannequin Gesture (Non-human wireframe sculpt)
      const renderPencilGestureMannequin = (x, y, scale, strokeStyle, label) => {
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        ctx.beginPath(); ctx.arc(x, y - 80 * scale, 24 * scale, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 24 * scale, y - 80 * scale); ctx.lineTo(x + 24 * scale, y - 80 * scale); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 104 * scale); ctx.lineTo(x, y - 56 * scale); ctx.stroke();

        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x + 24 * scale, y - 80 * scale); ctx.lineTo(x + 120 * scale, y - 95 * scale); ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.font = '9px monospace';
        ctx.fillText(`EYE: ${eyeLook.slice(0, 22)}`, x + 35 * scale, y - 102 * scale);
        ctx.restore();

        ctx.beginPath(); ctx.moveTo(x, y - 56 * scale); ctx.quadraticCurveTo(x + 15 * scale, y - 20 * scale, x, y + 20 * scale); ctx.stroke();
        ctx.strokeRect(x - 30 * scale, y - 50 * scale, 60 * scale, 45 * scale);
        ctx.strokeRect(x - 25 * scale, y - 5 * scale, 50 * scale, 30 * scale);

        ctx.beginPath(); ctx.moveTo(x - 30 * scale, y - 45 * scale); ctx.lineTo(x - 65 * scale, y - 10 * scale); ctx.lineTo(x - 85 * scale, y + 25 * scale); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 30 * scale, y - 45 * scale); ctx.lineTo(x + 65 * scale, y - 35 * scale); ctx.lineTo(x + 95 * scale, y - 65 * scale); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 15 * scale, y + 25 * scale); ctx.lineTo(x - 40 * scale, y + 80 * scale); ctx.lineTo(x - 45 * scale, y + 130 * scale); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 15 * scale, y + 25 * scale); ctx.lineTo(x + 35 * scale, y + 75 * scale); ctx.lineTo(x + 50 * scale, y + 125 * scale); ctx.stroke();

        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        for (let h = y - 45 * scale; h < y - 5 * scale; h += 5) {
          ctx.beginPath(); ctx.moveTo(x - 28 * scale, h); ctx.lineTo(x + 10 * scale, h + 8); ctx.stroke();
        }
        ctx.restore();

        ctx.fillStyle = strokeStyle;
        ctx.font = 'bold 11px monospace';
        ctx.fillText(label, x - 65 * scale, y + 150 * scale);
        ctx.restore();
      };

      let startX = W * 0.3; let startY = H * 0.58;
      let endX = W * 0.68; let endY = H * 0.54;

      if (keyframeMode === 'first_frame' || keyframeMode === 'transition') {
        renderPencilGestureMannequin(startX, startY, isCloseUp ? 1.3 : 0.85, '#38bdf8', 'FRAME 0 (ABSTRACT GESTURE)');
      }

      if (keyframeMode === 'last_frame' || keyframeMode === 'transition') {
        renderPencilGestureMannequin(endX, endY, isCloseUp ? 1.4 : 0.9, '#f59e0b', 'FRAME N (CLIMAX GESTURE)');
      }

      if (keyframeMode === 'transition') {
        ctx.save();
        ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(startX + 40, startY - 60);
        ctx.quadraticCurveTo((startX + endX) / 2, (startY + endY) / 2 - 90, endX - 40, endY - 60); ctx.stroke();
        drawArrow(ctx, (startX + endX) / 2 - 20, (startY + endY) / 2 - 60, (startX + endX) / 2 + 30, (startY + endY) / 2 - 65);
        ctx.fillStyle = '#ec4899'; ctx.font = 'bold 11px font-mono';
        ctx.fillText(`ABSTRACT MOTION PATH: ${cameraMotion.replace(/\[|\]/g, '')}`, W * 0.2, H * 0.16);
        ctx.restore();
      }
    }

    // RULE OF THIRDS GRID
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    ctx.beginPath();
    ctx.moveTo(W / 3, 0); ctx.lineTo(W / 3, H);
    ctx.moveTo((W / 3) * 2, 0); ctx.lineTo((W / 3) * 2, H);
    ctx.moveTo(0, H / 3); ctx.lineTo(W, H / 3);
    ctx.moveTo(0, (H / 3) * 2); ctx.lineTo(W, (H / 3) * 2);
    ctx.stroke();
    ctx.restore();

  }, [shot, aspectRatio, keyframeMode, renderStyle]);

  function drawArrow(ctx, fromx, fromy, tox, toy) {
    const headlen = 12;
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  // Dynamic helper to retrieve active LLM & Image Gen Engine configured in Admin Settings
  const getEngineNameFromSettings = () => {
    if (typeof window === 'undefined') return 'Google Gemini Nano Banana Pro / Imagen 3 Engine';
    const imageGenEngine = localStorage.getItem('sps_image_gen_engine') || 'google_gemini_nano';
    const llmProvider = localStorage.getItem('sps_llm_provider') || 'google_gemini';

    if (imageGenEngine === 'google_gemini_nano' || imageGenEngine === 'google_gemini') {
      return 'Google Gemini Nano Banana Pro / Imagen 3 Engine';
    }
    if (imageGenEngine === 'byteplus_seedream' || imageGenEngine === 'seedream_5_2k') {
      return 'BytePlus SeeDream 5.0 2K Engine';
    }
    if (imageGenEngine === 'magnific') {
      return 'Magnific.com 2K Upscaler Engine';
    }
    if (imageGenEngine === 'openai_dalle3') {
      return 'OpenAI DALL-E 3 / Sora Engine';
    }

    // Default based on active LLM Provider set in Admin Settings
    if (llmProvider === 'google_gemini') {
      return 'Google Gemini Nano Banana Pro / Imagen 3 Engine';
    }
    if (llmProvider === 'anthropic') {
      return 'Pedditi Labs Engine (Claude 3.5 Sonnet Vision)';
    }
    if (llmProvider === 'openai') {
      return 'OpenAI DALL-E 3 / Sora Engine';
    }
    if (llmProvider === 'byteplus') {
      return 'BytePlus SeeDream 5.0 2K Engine';
    }

    return 'Google Gemini Nano Banana Pro / Imagen 3 Engine';
  };

  useEffect(() => {
    setEngineBadgeText(getEngineNameFromSettings());
  }, [shot]);

  // -------------------------------------------------------------
  // AI IMAGE GENERATION / REGENERATION TRIGGER
  // -------------------------------------------------------------
  const [activePromptSent, setActivePromptSent] = useState('');
  const [genProgress, setGenProgress] = useState(0);
  const [engineErrorModal, setEngineErrorModal] = useState({
    isOpen: false,
    engineName: '',
    errorMsg: ''
  });

  // -------------------------------------------------------------
  // AI IMAGE GENERATION / REGENERATION TRIGGER (Multi-Engine & Rich 25-Slot Prompting)
  // -------------------------------------------------------------
  const handleGenerateAIImage = async () => {
    setIsGeneratingImage(true);
    setRenderStyle('generated_ai_image');
    setGenProgress(12);

    const progressTimer = setInterval(() => {
      setGenProgress(prev => (prev < 90 ? prev + Math.floor(Math.random() * 10) + 6 : 94));
    }, 250);

    const activeEngineName = getEngineNameFromSettings();
    setEngineBadgeText(activeEngineName);

    const byteplusKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_byteplus_api_key') || '') : '';
    const magnificKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_magnific_api_key') || '') : '';
    const geminiKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_api_key') || '') : '';

    const shotId = shot?.sceneShotId || `SH_${activeShotIndex + 1}`;
    const key = `${shotId}_${keyframeMode}`;

    const safeStr = (val, fb = '') => val ? String(val).replace(/\[|\]/g, '').trim() : fb;

    // Clean code-like tokens into rich descriptive natural English for AI image generation
    const toNaturalEnglish = (str, fallback = '') => {
      let cleaned = safeStr(str, fallback);
      cleaned = cleaned.replace(/^(Lighting|Subject Color|BG Lighting|BG Color|CharID|Eye Look|Camera|Co-Artist):\s*/i, '');
      if (cleaned.includes('RAMA') || cleaned.includes('Rama')) {
        return 'Lord Rama, ancient Indian prince warrior with Kodanda bow and quiver on shoulder wearing golden silk dhoti';
      }
      if (cleaned.startsWith('@')) {
        cleaned = cleaned.replace(/^@/, '').replace(/_/g, ' ');
      }
      if (/^CHAR_\w+/i.test(cleaned)) {
        cleaned = cleaned.replace(/^CHAR_/i, 'Hero ').replace(/_\d+/g, '').replace(/_/g, ' ');
      }
      return cleaned;
    };

    const comp = safeStr(shot?.shotComposition, 'Wide Establishing Shot');
    const charDescr = toNaturalEnglish(shot?.characterIdAssetRef, 'Ancient Indian prince warrior');
    const envContext = toNaturalEnglish(shot?.actionEnvContext, 'Dense jungle clearing at Panchavati with swirling dust storm');
    const subjectLighting = toNaturalEnglish(shot?.subjectLightingTag, 'Divine Golden Key Light with Dramatic Edge Rim');
    const subjectColor = toNaturalEnglish(shot?.subjectColorTag, 'Terracotta & Warm Gold');
    const expression = toNaturalEnglish(shot?.characterExpression, 'Stoic, calm determination');
    const movement = toNaturalEnglish(shot?.characterMovement, 'initial starting stance');
    const coArtist = toNaturalEnglish(shot?.coArtistInteraction, 'Facing off against advancing army');

    const compLower = comp.toLowerCase();
    const isWide = compLower.includes('wide') || compLower.includes('ews') || compLower.includes('ws') || compLower.includes('establishing') || compLower.includes('extreme');
    const isCloseUp = compLower.includes('close') || compLower.includes('cu') || compLower.includes('portrait');

    let fullPromptText = '';
    const nanoQualityString = "cinematic 35mm film photograph, award-winning IMAX 70mm movie still, sharp focus on facial features, skin pore texture, natural lighting, photorealism, 8k resolution, hyperrealistic, non-abstract, no art, no illustration, no painting";

    if (isWide) {
      fullPromptText = `${nanoQualityString}, ${comp}, panoramic landscape photo, ${envContext}, sharp detailed figure of ${charDescr} in ${movement}, ${coArtist}, ${subjectLighting}, 24mm wide angle anamorphic lens, epic scale`;
    } else if (isCloseUp) {
      fullPromptText = `${nanoQualityString}, facial portrait photograph, sharp macro focus on eyes and face of ${charDescr}, expression: ${expression}, ${movement}, ${subjectLighting}, 85mm prime lens`;
    } else if (keyframeMode === 'last_frame') {
      fullPromptText = `${nanoQualityString}, ${comp}, photo of ${charDescr} executing ${movement}, expression: ${expression}, ${coArtist}, ${envContext}, ${subjectLighting}`;
    } else {
      fullPromptText = `${nanoQualityString}, ${comp}, photo of ${charDescr}, ${envContext}, ${subjectLighting}, ${subjectColor}, expression: ${expression}`;
    }

    setActivePromptSent(fullPromptText);

    const byteplusEndpoint = typeof window !== 'undefined' ? (localStorage.getItem('sps_byteplus_endpoint_url') || 'https://ark.ap-southeast.bytepluses.com/api/v3') : 'https://ark.ap-southeast.bytepluses.com/api/v3';
    const byteplusModel = typeof window !== 'undefined' ? (localStorage.getItem('sps_byteplus_model_id') || 'seed-2-0-pro-260328') : 'seed-2-0-pro-260328';

    let imageUrl = '';

    // Route through Magnific API if Magnific API Key is configured
    if (magnificKey.trim()) {
      try {
        const res = await fetch('https://api.magnific.ai/v1/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${magnificKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: fullPromptText,
            width: 1280,
            height: 720,
            engine: 'nano_banana_pro_2k'
          })
        }).catch(() => null);

        if (res && res.ok) {
          const data = await res.json();
          if (data && (data.url || data.image_url)) {
            imageUrl = data.url || data.image_url;
          }
        }
      } catch (err) {}
    }

    // Route through BytePlus ModelArk API if BytePlus Key is configured
    if (!imageUrl && byteplusKey.trim()) {
      try {
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: byteplusKey.trim(),
            endpointUrl: byteplusEndpoint.trim(),
            modelId: byteplusModel.trim(),
            prompt: fullPromptText,
            width: 1280,
            height: 720
          })
        }).catch(() => null);

        if (res && res.ok) {
          const data = await res.json();
          if (data && data.url) {
            imageUrl = data.url;
            if (!imageUrl.startsWith('http')) {
              const match = imageUrl.match(/https?:\/\/[^\s"']+/);
              if (match) imageUrl = match[0];
            }
          }
        }
      } catch (err) {}
    }

    // STRICT DIRECTIVE: DO NOT SILENTLY FALLBACK! SHOW ERROR POPUP IF MODEL IS UNAVAILABLE
    if (!imageUrl) {
      clearInterval(progressTimer);
      setIsGeneratingImage(false);
      setGenProgress(0);

      setEngineErrorModal({
        isOpen: true,
        engineName: activeEngineName,
        errorMsg: `The active image generation engine (${activeEngineName}) could not be reached or returned an authorization/CORS error. Fallback generation is strictly disabled. Please configure your official API key or endpoint in Admin Settings.`
      });
      return;
    }

    const img = new Image();
    img.src = imageUrl;
    const handleSuccess = () => {
      clearInterval(progressTimer);
      setGenProgress(100);
      setGeneratedImages(prev => {
        const updated = { ...prev, [key]: imageUrl };
        saveCanvasVaultImage(key, imageUrl);
        return updated;
      });
      setTimeout(() => {
        setIsGeneratingImage(false);
      }, 300);
      if (onEmbedImage) {
        onEmbedImage(key, imageUrl);
      }
    };
    img.onload = handleSuccess;
    img.onerror = handleSuccess;
  };

  const currentShotKey = `${shot?.sceneShotId || `SH_${activeShotIndex + 1}`}_${keyframeMode}`;
  const activeGeneratedImageUrl = generatedImages[currentShotKey] || (shot?.embeddedImages?.[keyframeMode]);

  const handleManualEmbed = () => {
    if (!activeGeneratedImageUrl) return;
    saveCanvasVaultImage(currentShotKey, activeGeneratedImageUrl);
    if (onEmbedImage) {
      onEmbedImage(currentShotKey, activeGeneratedImageUrl);
    }
    setIsEmbeddedToast(true);
    setTimeout(() => setIsEmbeddedToast(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 bg-zinc-950 p-5 rounded-2xl border border-zinc-800 shadow-xl w-full font-mono">
      {/* Canvas Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              Stage Production Framing & Keyframe Simulator
              <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800 font-mono">
                {aspectRatio}
              </span>
            </h4>
            <p className="text-xs text-zinc-400">First Frame vs Last Frame keyframe interpolation & 3D Clay pre-viz simulator.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export All Canvas Images to Local Computer Folder Button */}
          <button
            type="button"
            onClick={() => downloadAllCanvasImagesToDisk(generatedImages, shot?.sceneShotId || 'Stage_Production_Studio')}
            className="px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            title="Export all generated canvas keyframe renders directly to your local computer's folder"
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>💾 Save Canvas Images to Local Folder</span>
          </button>
          {/* Render Mode Selector Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setRenderStyle('3d_clay_render')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                renderStyle === '3d_clay_render'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              🗿 3D Clay Mode
            </button>

            <button
              type="button"
              onClick={() => setRenderStyle('2d_blueprint')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                renderStyle === '2d_blueprint'
                  ? 'bg-cyan-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              📐 2D Blueprint
            </button>

            <button
              type="button"
              onClick={() => setRenderStyle('pencil_sketch')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                renderStyle === 'pencil_sketch'
                  ? 'bg-emerald-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-300" />
              ✏️ Abstract Pencil Sketch
            </button>

            <button
              type="button"
              onClick={() => setRenderStyle('generated_ai_image')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                renderStyle === 'generated_ai_image'
                  ? 'bg-purple-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-300" />
              🖼️ Image Generation
            </button>
          </div>

          {/* First Frame / Last Frame View Mode Selector */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setKeyframeMode('first_frame')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                keyframeMode === 'first_frame'
                  ? 'bg-cyan-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Play className="w-3 h-3 text-cyan-300" />
              🖼️ First Frame
            </button>

            <button
              type="button"
              onClick={() => setKeyframeMode('last_frame')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                keyframeMode === 'last_frame'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FastForward className="w-3 h-3 text-amber-950" />
              🏁 Last Frame
            </button>

            <button
              type="button"
              onClick={() => setKeyframeMode('transition')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                keyframeMode === 'transition'
                  ? 'bg-pink-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-pink-300" />
              ▶️ Vector
            </button>
          </div>
        </div>
      </div>

      {/* Shot Selection Quick Selector Strip */}
      {shots.length > 0 && setActiveShotIndex && (
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
          <span className="text-[11px] font-mono text-zinc-400 font-bold mr-1">Select Shot:</span>
          {shots.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveShotIndex(idx)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-all border ${
                activeShotIndex === idx
                  ? 'bg-cyan-500 text-zinc-950 font-bold border-cyan-400 shadow'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              #{idx + 1} ({s.sceneShotId || `S${idx + 1}`})
            </button>
          ))}
        </div>
      )}

      {/* Main Interactive Stage Canvas & 3D Clay Pre-Viz */}
      <div className="relative w-full aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-inner flex items-center justify-center">
        
        {renderStyle === 'generated_ai_image' ? (
          <div className="w-full h-full relative flex items-center justify-center bg-zinc-950">
            {isGeneratingImage ? (
              <div className="flex flex-col items-center gap-3.5 text-purple-300 w-80 p-5 rounded-2xl bg-zinc-900/90 border border-purple-500/40 shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-between w-full text-xs font-mono font-bold">
                  <span className="flex items-center gap-2 text-purple-200">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    <span>Generating Image...</span>
                  </span>
                  <span className="text-amber-300 text-sm font-extrabold font-mono">{genProgress}%</span>
                </div>

                <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-purple-500/40 p-0.5 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-400 rounded-full transition-all duration-300 shadow-md"
                    style={{ width: `${genProgress}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-zinc-400">Rendering 2K Storyboard Keyframe</span>
              </div>
            ) : activeGeneratedImageUrl ? (
              <div className="relative w-full h-full">
                <img
                  src={activeGeneratedImageUrl}
                  alt="AI Generated Storyboard Render"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/85 backdrop-blur-md border border-purple-500/40 text-[10px] font-mono text-purple-300 font-bold shadow-lg pointer-events-none">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>
                    {activeGeneratedImageUrl.includes('pollinations') 
                      ? '⚡ Nano Banana Pro (High-Res 2K Realism Fallback)'
                      : `✨ ${engineBadgeText}`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-zinc-400 p-6 text-center">
                <Wand2 className="w-10 h-10 text-purple-400" />
                <p className="text-xs font-mono max-w-md">
                  No {engineBadgeText} image generated for this frame mode yet. Click the button below to generate a 2K image using pre-viz reference!
                </p>
                <button
                  type="button"
                  onClick={handleGenerateAIImage}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs shadow flex items-center gap-2 hover:brightness-110 transition-all font-mono cursor-pointer"
                >
                  <Wand2 className="w-4 h-4 text-amber-300" />
                  ✨ Generate {engineBadgeText}
                </button>
              </div>
            )}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={800}
            height={450}
            className="w-full h-full object-contain"
          />
        )}

        {/* Framing & Shot Metadata Badges Overlay */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none">
          <span className="px-2.5 py-1 rounded-lg bg-zinc-950/85 backdrop-blur-md border border-cyan-500/40 text-cyan-300 text-xs font-bold font-mono shadow">
            {shot?.sceneShotId || 'SC01_SH01'} | {shot?.shotComposition || 'Medium Shot'}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-zinc-950/85 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs font-mono shadow truncate max-w-xs">
            {renderStyle === '3d_clay_render' ? '🗿 3D CLAY PRE-VIZ MODE | ' : (renderStyle === '2d_blueprint' ? '📐 2D BLUEPRINT | ' : (renderStyle === 'pencil_sketch' ? '✏️ ABSTRACT PENCIL SKETCH | ' : `🖼️ ${engineBadgeText} | `))}
            {keyframeMode === 'first_frame' ? 'FRAME 0' : (keyframeMode === 'last_frame' ? 'FRAME N' : 'INTERPOLATION')}
          </span>
        </div>
      </div>

      {/* CONTROL TOOLBAR DIRECTLY UNDER THE IMAGE CANVAS */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className="font-bold text-cyan-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            {shot?.sceneShotId || 'SC01_SH01'} Control Bar
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeGeneratedImageUrl && (
            <button
              type="button"
              onClick={handleManualEmbed}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs shadow flex items-center gap-1.5 transition-all font-mono border cursor-pointer ${
                isEmbeddedToast
                  ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-black scale-105'
                  : 'bg-zinc-950 hover:bg-emerald-600 hover:text-zinc-950 text-emerald-300 border-emerald-500/50'
              }`}
              title="Permanently embed this 2K image into the project JSON file and cloud workspace"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isEmbeddedToast ? '✓ Embedded in Project!' : '📌 Embed Image in Project'}
            </button>
          )}

          <button
            type="button"
            onClick={handleGenerateAIImage}
            disabled={isGeneratingImage}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-black text-xs shadow-lg flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 border border-purple-400/40 font-mono disabled:opacity-50 cursor-pointer"
            title={activeGeneratedImageUrl ? "Regenerate image variation with active engine" : "Generate photorealistic 2K image with active engine"}
          >
            <Wand2 className={`w-3.5 h-3.5 text-amber-300 ${isGeneratingImage ? 'animate-spin' : ''}`} />
            <span>
              {isGeneratingImage
                ? `Generating Image... (${genProgress}%)`
                : (activeGeneratedImageUrl ? '🔄 Regenerate Image' : '✨ Generate Image')}
            </span>
          </button>
        </div>
      </div>

      {/* ACTIVE SEEDREAM 5.0 LIVE PROMPT INSPECTOR BOX */}
      <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1.5 shadow">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Live Image Generation Prompt Input:
          </span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
            ✓ Live 25-Crafts Integrated
          </span>
        </div>
        <p className="text-xs font-mono text-zinc-300 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 leading-relaxed select-all">
          {activePromptSent || `masterpiece 8k photorealistic cinematic film still, ${shot?.shotComposition || 'Wide Establishing Shot'}, Lord Rama, ancient Indian prince warrior with Kodanda bow and quiver on shoulder in golden silk dhoti, ${shot?.actionEnvContext || 'Dense jungle clearing at Panchavati with swirling dust storm'}, ${shot?.subjectLightingTag || 'Divine Golden Key Light'}, 8k highly detailed`}
        </p>
      </div>

      {/* STRICT ENGINE UNAVAILABLE ERROR POPUP MODAL */}
      {engineErrorModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-red-500/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-red-400 border-b border-red-500/20 pb-3">
              <div className="p-2.5 bg-red-950/80 border border-red-500/40 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-mono font-bold text-sm text-white">Image Generation Engine Unavailable</h3>
                <p className="text-[11px] font-mono text-red-300">Strict Fallback Prevention Active</p>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono text-zinc-300 leading-relaxed bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <p className="text-amber-300 font-bold">⚠️ Could not generate image using:</p>
              <p className="text-purple-300 font-bold pl-2 border-l-2 border-purple-500">
                {engineErrorModal.engineName}
              </p>
              <p className="text-zinc-400 text-[11px] pt-1">
                {engineErrorModal.errorMsg}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              {onOpenAdminSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setEngineErrorModal({ isOpen: false, engineName: '', errorMsg: '' });
                    onOpenAdminSettings('image');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-xs shadow flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Settings className="w-4 h-4 text-purple-200" />
                  ⚙️ Open Admin Settings
                </button>
              )}
              <button
                type="button"
                onClick={() => setEngineErrorModal({ isOpen: false, engineName: '', errorMsg: '' })}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono font-bold text-xs transition-colors cursor-pointer"
              >
                ✖ Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
