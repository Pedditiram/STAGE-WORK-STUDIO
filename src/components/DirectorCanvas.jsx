import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Film, Play, FastForward, Box, Palette, Image as ImageIcon, Loader2, Download, Wand2, CheckCircle2, Edit3, Compass, HardDrive, AlertCircle, Settings } from 'lucide-react';
import { getStoredCanvasVaultImages, saveCanvasVaultImage, downloadAllCanvasImagesToDisk } from '../services/canvasVault';
import { parseSceneAndShotID } from '../utils/sceneShotUtils';
import { buildCinematicImagePrompt } from '../utils/cinematicImagePrompt';

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
  onOpenAdminSettings,
  projectTitle = ''
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
  const [activePromptSent, setActivePromptSent] = useState('');
  const [genProgress, setGenProgress] = useState(0);
  const [engineErrorModal, setEngineErrorModal] = useState({
    isOpen: false,
    engineName: '',
    errorMsg: ''
  });

  useEffect(() => {
    const storedVault = getStoredCanvasVaultImages();
    setGeneratedImages(prev => ({ ...storedVault, ...prev, ...(projectGeneratedImages || {}) }));
  }, [projectGeneratedImages]);

  const aspectNumeric = useMemo(() => {
    const s = String(aspectRatio || '');
    if (/2\.39|anamorphic/i.test(s)) return 2.39;
    if (/2\.35/.test(s)) return 2.35;
    if (/21\s*:\s*9/.test(s)) return 21 / 9;
    if (/9\s*:\s*16|vertical|portrait/i.test(s)) return 9 / 16;
    if (/1\s*:\s*1|square/i.test(s)) return 1;
    if (/4\s*:\s*3/.test(s)) return 4 / 3;
    if (/3\s*:\s*4/.test(s)) return 3 / 4;
    if (/16\s*:\s*9/.test(s)) return 16 / 9;
    const m = s.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
    if (m) {
      const w = Number(m[1]);
      const h = Number(m[2]);
      if (w > 0 && h > 0) return w / h;
    }
    return 16 / 9;
  }, [aspectRatio]);

  const canvasPixelSize = useMemo(() => {
    const width = 960;
    return { width, height: Math.max(240, Math.round(width / aspectNumeric)) };
  }, [aspectNumeric]);

  useLayoutEffect(() => {
    if (renderStyle === 'generated_ai_image') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Keep backing store in sync with project aspect ratio (e.g. 2.39:1)
    if (canvas.width !== canvasPixelSize.width || canvas.height !== canvasPixelSize.height) {
      canvas.width = canvasPixelSize.width;
      canvas.height = canvasPixelSize.height;
    }

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Extract shot metadata safely
    const safeStr = (val, fb = '') => (val !== null && val !== undefined) ? String(val) : fb;

    const composition = safeStr(shot?.shotComposition, 'Medium Shot (MS)');
    const cameraMotion = safeStr(shot?.cameraMotionTag, '[Camera: Static Anchor]');
    const eyeLook = safeStr(shot?.characterEyeLooks || shot?.eyeDirectionLook, 'Direct Focus on Target / Camera');
    const expression = safeStr(shot?.characterExpression || shot?.actorFacialExpression, 'Serene & Absolute Calm / Intense Gaze');
    const envContext = safeStr(shot?.actionEnvContext, 'Ancient Temple Pillars & Battlefield Horizon');
    const coArtist = safeStr(shot?.coArtistInteraction, 'Supporting Armies & Crowd Silhouettes in Background');

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

      // Technical blueprint grid
      ctx.save();
      ctx.strokeStyle = keyframeMode === 'last_frame' ? 'rgba(251, 146, 60, 0.12)' : 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y <= H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.strokeStyle = keyframeMode === 'last_frame' ? 'rgba(251, 146, 60, 0.28)' : 'rgba(56, 189, 248, 0.28)';
      ctx.strokeRect(24, 24, W - 48, H - 48);
      ctx.restore();

      let startX = W * 0.3; let startY = H * 0.65;
      let endX = W * 0.65; let endY = H * 0.55;

      if (keyframeMode === 'first_frame' || keyframeMode === 'transition') {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3;
        drawRoundRect(ctx, startX - 35, startY - 55, 70, 110, 12); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(startX, startY - 80, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 11px monospace';
        ctx.fillText('FRAME 0 (STARTING STANCE)', startX - 55, startY + 70);
        ctx.restore();
      }

      if (keyframeMode === 'last_frame' || keyframeMode === 'transition') {
        ctx.save();
        ctx.fillStyle = 'rgba(30, 27, 75, 0.9)'; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3;
        drawRoundRect(ctx, endX - 40, endY - 60, 80, 120, 14); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(endX, endY - 88, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 11px monospace';
        ctx.fillText('FRAME N (ENDING CLIMAX POSE)', endX - 55, endY + 80);
        ctx.restore();
      }

      if (keyframeMode === 'transition') {
        ctx.save();
        ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 3.5; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(startX + 30, startY - 40);
        ctx.quadraticCurveTo((startX + endX) / 2, (startY + endY) / 2 - 80, endX - 30, endY - 40); ctx.stroke();
        drawArrow(ctx, (startX + endX) / 2 - 20, (startY + endY) / 2 - 50, (startX + endX) / 2 + 30, (startY + endY) / 2 - 55);
        ctx.fillStyle = '#ec4899'; ctx.font = 'bold 11px monospace';
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
        ctx.fillStyle = '#ec4899'; ctx.font = 'bold 11px monospace';
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

  }, [shot, aspectRatio, keyframeMode, renderStyle, canvasPixelSize]);

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

  const mapStudioAspectToApi = (ar = '') => {
    const s = String(ar).toLowerCase();
    if (s.includes('2.39') || s.includes('2.35') || s.includes('21:9') || s.includes('anamorphic')) return '21:9';
    if (s.includes('9:16') || s.includes('vertical') || s.includes('portrait')) return '9:16';
    if (s.includes('1:1') || s.includes('square')) return '1:1';
    if (s.includes('4:3')) return '4:3';
    if (s.includes('3:4')) return '3:4';
    return '16:9';
  };

  /** Map Admin / LLM text-model IDs onto real Gemini Image (Nano Banana) models. */
  const resolveGoogleImageModel = (raw) => {
    const m = String(raw || '').trim();
    const textOnly = new Set([
      'gemini-3.6-flash', 'gemini_36_flash', 'google_gemini_nano', 'google_gemini',
      'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-2.0-flash',
      'gemini-3-flash', 'gemini-3.0-flash'
    ]);
    if (!m || textOnly.has(m)) return 'gemini-3.1-flash-image';
    if (m.includes('flash-image') || m.includes('pro-image') || m.includes('lite-image')) return m;
    if (m.startsWith('imagen-')) return m;
    return 'gemini-3.1-flash-image';
  };

  const extractBase64Image = (data) => {
    if (!data || typeof data !== 'object') return '';

    const pack = (b64, mime = 'image/png') => {
      if (!b64 || typeof b64 !== 'string') return '';
      const clean = b64.replace(/^data:[^;]+;base64,/, '');
      return `data:${mime};base64,${clean}`;
    };

    if (data.output_image?.data) {
      return pack(data.output_image.data, data.output_image.mime_type || data.output_image.mimeType || 'image/png');
    }

    const walkBlocks = (blocks) => {
      if (!Array.isArray(blocks)) return '';
      for (const block of blocks) {
        if (!block) continue;
        if ((block.type === 'image' || block.inlineData || block.inline_data) && (block.data || block.inlineData?.data || block.inline_data?.data)) {
          const b64 = block.data || block.inlineData?.data || block.inline_data?.data;
          const mime = block.mime_type || block.mimeType || block.inlineData?.mimeType || block.inline_data?.mime_type || 'image/png';
          return pack(b64, mime);
        }
        if (Array.isArray(block.content)) {
          const nested = walkBlocks(block.content);
          if (nested) return nested;
        }
        if (Array.isArray(block.parts)) {
          const nested = walkBlocks(block.parts);
          if (nested) return nested;
        }
      }
      return '';
    };

    if (Array.isArray(data.outputs)) {
      const fromOutputs = walkBlocks(data.outputs);
      if (fromOutputs) return fromOutputs;
    }
    if (Array.isArray(data.steps)) {
      for (const step of data.steps) {
        const found = walkBlocks(step?.content || step?.outputs || []);
        if (found) return found;
      }
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        const inline = part?.inlineData || part?.inline_data;
        if (inline?.data) return pack(inline.data, inline.mimeType || inline.mime_type || 'image/png');
      }
    }

    const genImg = data?.generatedImages?.[0]?.image;
    if (genImg?.imageBytes) return pack(genImg.imageBytes, genImg.mimeType || 'image/jpeg');

    const pred = data?.predictions?.[0];
    if (pred?.bytesBase64Encoded) return pack(pred.bytesBase64Encoded, pred.mimeType || 'image/png');

    return '';
  };

  const fetchWithTimeout = async (url, options = {}, ms = 55000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const waitForImageReady = (url, ms = 45000) => new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('Empty image URL'));
      return;
    }
    if (url.startsWith('data:')) {
      resolve(url);
      return;
    }
    const img = new Image();
    // Do not set crossOrigin — Pollinations and some CDNs omit CORS headers,
    // which would fail the load even though <img> display works fine.
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      reject(new Error('Image load timed out'));
    }, ms);
    img.onload = () => {
      clearTimeout(timer);
      resolve(url);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Image failed to load'));
    };
    img.src = url;
  });

  // Dynamic helper to retrieve active LLM & Image Gen Engine configured in Admin Settings
  const getEngineNameFromSettings = () => {
    if (typeof window === 'undefined') return 'Gemini 3.1 Flash Image Engine';
    const useSame = localStorage.getItem('sps_use_same_model_image_gen') !== 'false';
    const imageGenEngine = localStorage.getItem('sps_image_gen_engine') || 'gemini_36_flash';
    const llmProvider = localStorage.getItem('sps_llm_provider') || 'google_gemini_36_high';
    const googleModel = resolveGoogleImageModel(localStorage.getItem('sps_google_image_model') || 'gemini-3.1-flash-image');

    if (useSame || imageGenEngine === 'gemini_36_flash' || imageGenEngine === 'google_gemini_nano' || imageGenEngine === 'google_gemini') {
      if (googleModel.includes('pro-image')) return 'Gemini 3 Pro Image Engine';
      if (googleModel.includes('lite-image')) return 'Gemini 3.1 Flash Lite Image Engine';
      if (googleModel.startsWith('imagen-')) return `Google Imagen (${googleModel})`;
      return 'Gemini 3.1 Flash Image Engine';
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

    if (llmProvider.startsWith('google_gemini') || llmProvider === 'google_gemini') {
      return 'Gemini 3.1 Flash Image Engine';
    }
    if (llmProvider.startsWith('anthropic')) {
      return 'Pedditi Labs Engine (Claude 3.5 Sonnet Vision)';
    }
    if (llmProvider === 'openai') {
      return 'OpenAI DALL-E 3 / Sora Engine';
    }
    if (llmProvider === 'byteplus') {
      return 'BytePlus SeeDream 5.0 2K Engine';
    }

    return 'Gemini 3.1 Flash Image Engine';
  };

  useEffect(() => {
    setEngineBadgeText(getEngineNameFromSettings());
  }, [shot]);

  // Keep Live Prompt Inspector in sync with the active shot / frame slot
  useEffect(() => {
    const imageSlotMode = keyframeMode === 'transition' ? 'first_frame' : keyframeMode;
    const { fullPrompt } = buildCinematicImagePrompt(shot || {}, {
      imageSlotMode,
      aspectRatio,
      projectTitle
    });
    setActivePromptSent(fullPrompt);
  }, [shot, keyframeMode, aspectRatio, projectTitle]);

  // -------------------------------------------------------------
  // AI IMAGE GENERATION / REGENERATION TRIGGER (Multi-Engine & Rich 25-Slot Prompting)
  // -------------------------------------------------------------
  const handleGenerateAIImage = async () => {
    setIsGeneratingImage(true);
    setRenderStyle('generated_ai_image');
    setGenProgress(12);

    const progressTimer = setInterval(() => {
      setGenProgress(prev => (prev < 88 ? prev + Math.floor(Math.random() * 8) + 4 : 92));
    }, 400);

    const failGeneration = (engineName, errorMsg) => {
      clearInterval(progressTimer);
      setIsGeneratingImage(false);
      setGenProgress(0);
      setEngineErrorModal({ isOpen: true, engineName, errorMsg });
    };

    const commitImage = (imageUrl, key) => {
      clearInterval(progressTimer);
      setGenProgress(100);
      setGeneratedImages(prev => {
        const updated = { ...prev, [key]: imageUrl };
        saveCanvasVaultImage(key, imageUrl);
        return updated;
      });
      setTimeout(() => setIsGeneratingImage(false), 250);
      if (onEmbedImage) onEmbedImage(key, imageUrl);
    };

    const activeEngineName = getEngineNameFromSettings();
    setEngineBadgeText(activeEngineName);

    const byteplusKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_byteplus_api_key') || '') : '';
    const magnificKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_magnific_api_key') || '') : '';
    const geminiKey = typeof window !== 'undefined' ? (localStorage.getItem('sps_api_key') || '') : '';

    const shotId = shot?.sceneShotId || `SH_${activeShotIndex + 1}`;
    // Vector (transition) is motion path only — image slots are First/Last Frame
    const imageSlotMode = keyframeMode === 'transition' ? 'first_frame' : keyframeMode;
    if (keyframeMode === 'transition') {
      setKeyframeMode('first_frame');
    }
    const key = `${shotId}_${imageSlotMode}`;
    const apiAspect = mapStudioAspectToApi(aspectRatio);
    // Imagen predict only supports a smaller ratio set
    const imagenAspect = ['1:1', '3:4', '4:3', '9:16', '16:9'].includes(apiAspect) ? apiAspect : '16:9';

    const { fullPrompt: fullPromptText, shortPrompt: shortPromptText } = buildCinematicImagePrompt(shot || {}, {
      imageSlotMode,
      aspectRatio,
      projectTitle
    });

    setActivePromptSent(fullPromptText);

    const byteplusEndpoint = typeof window !== 'undefined' ? (localStorage.getItem('sps_byteplus_endpoint_url') || 'https://ark.ap-southeast.bytepluses.com/api/v3') : 'https://ark.ap-southeast.bytepluses.com/api/v3';
    const byteplusModel = typeof window !== 'undefined' ? (localStorage.getItem('sps_byteplus_model_id') || 'seed-2-0-pro-260328') : 'seed-2-0-pro-260328';

    let imageUrl = '';
    let lastEngineError = '';

    // 1. Magnific (optional)
    if (magnificKey.trim()) {
      try {
        const res = await fetchWithTimeout('https://api.magnific.ai/v1/generations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${magnificKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: fullPromptText,
            width: 1280,
            height: 720,
            engine: 'nano_banana_pro_2k'
          })
        }, 40000).catch(() => null);

        if (res?.ok) {
          const data = await res.json();
          if (data?.url || data?.image_url) imageUrl = data.url || data.image_url;
        } else if (res) {
          lastEngineError = `Magnific HTTP ${res.status}`;
        }
      } catch (err) {
        lastEngineError = err?.message || 'Magnific request failed';
      }
    }

    // 2. Google Gemini Image (Interactions) → generateContent → Imagen predict
    if (!imageUrl && geminiKey.trim()) {
      const keyParam = encodeURIComponent(geminiKey.trim());
      const rawModel = typeof window !== 'undefined'
        ? (localStorage.getItem('sps_google_image_model') || 'gemini-3.1-flash-image')
        : 'gemini-3.1-flash-image';
      const googleModel = resolveGoogleImageModel(rawModel);
      const geminiImageModels = [
        googleModel,
        'gemini-3.1-flash-image',
        'gemini-2.5-flash-image',
        'gemini-3.1-flash-lite-image'
      ].filter((m, i, arr) => m && !m.startsWith('imagen-') && arr.indexOf(m) === i);

      // 2a. Interactions API (Nano Banana / Gemini Image)
      for (const modelId of geminiImageModels) {
        if (imageUrl) break;
        try {
          const res = await fetchWithTimeout(
            'https://generativelanguage.googleapis.com/v1beta/interactions',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': geminiKey.trim()
              },
              body: JSON.stringify({
                model: modelId,
                input: fullPromptText,
                response_format: {
                  type: 'image',
                  mime_type: 'image/png',
                  aspect_ratio: apiAspect,
                  image_size: '2K'
                }
              })
            },
            70000
          ).catch(() => null);

          if (res?.ok) {
            const data = await res.json();
            imageUrl = extractBase64Image(data);
            if (imageUrl) {
              setEngineBadgeText(`Gemini Image (${modelId})`);
              break;
            }
            lastEngineError = `Interactions ${modelId}: no image in response`;
          } else if (res) {
            const errText = await res.text().catch(() => '');
            lastEngineError = `Interactions ${modelId}: HTTP ${res.status} ${errText.slice(0, 180)}`;
          }
        } catch (err) {
          lastEngineError = err?.message || `Interactions ${modelId} failed`;
        }
      }

      // 2b. generateContent multimodal image fallback
      if (!imageUrl) {
        for (const modelId of geminiImageModels) {
          if (imageUrl) break;
          try {
            const res = await fetchWithTimeout(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${keyParam}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ role: 'user', parts: [{ text: fullPromptText }] }],
                  generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    imageConfig: { aspectRatio: apiAspect === '21:9' ? '16:9' : apiAspect }
                  }
                })
              },
              70000
            ).catch(() => null);

            if (res?.ok) {
              const data = await res.json();
              imageUrl = extractBase64Image(data);
              if (imageUrl) {
                setEngineBadgeText(`Gemini Image (${modelId})`);
                break;
              }
              lastEngineError = `generateContent ${modelId}: no image in response`;
            } else if (res) {
              lastEngineError = `generateContent ${modelId}: HTTP ${res.status}`;
            }
          } catch (err) {
            lastEngineError = err?.message || `generateContent ${modelId} failed`;
          }
        }
      }

      // 2c. Imagen :predict (legacy, still useful if key has Imagen access)
      if (!imageUrl) {
        const imagenModels = [
          googleModel.startsWith('imagen-') ? googleModel : null,
          'imagen-4.0-generate-001',
          'imagen-3.0-generate-002'
        ].filter((m, i, arr) => m && arr.indexOf(m) === i);

        for (const modelId of imagenModels) {
          if (imageUrl) break;
          try {
            let res = await fetchWithTimeout(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predict?key=${keyParam}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  instances: [{ prompt: fullPromptText }],
                  parameters: { sampleCount: 1, aspectRatio: imagenAspect }
                })
              },
              70000
            ).catch(() => null);

            if (!res?.ok) {
              res = await fetchWithTimeout(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateImages?key=${keyParam}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    prompt: fullPromptText,
                    config: {
                      numberOfImages: 1,
                      aspectRatio: imagenAspect,
                      outputMimeType: 'image/jpeg'
                    }
                  })
                },
                70000
              ).catch(() => null);
            }

            if (res?.ok) {
              const data = await res.json();
              imageUrl = extractBase64Image(data);
              if (imageUrl) {
                setEngineBadgeText(`Google Imagen (${modelId})`);
                break;
              }
            } else if (res) {
              lastEngineError = `Imagen ${modelId}: HTTP ${res.status}`;
            }
          } catch (err) {
            lastEngineError = err?.message || `Imagen ${modelId} failed`;
          }
        }
      }
    }

    // 3. BytePlus — local proxy first, then direct Ark endpoints (Electron has no /api proxy)
    if (!imageUrl && byteplusKey.trim()) {
      const tryParseByteplus = (data) => {
        let url = data?.data?.[0]?.url || data?.url || data?.image_url || '';
        if (url && !url.startsWith('http')) {
          const match = String(url).match(/https?:\/\/[^\s"']+/);
          if (match) url = match[0];
        }
        return url && url.startsWith('http') ? url : '';
      };

      try {
        const res = await fetchWithTimeout('/api/generate-image', {
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
        }, 55000).catch(() => null);

        if (res?.ok) {
          const data = await res.json();
          imageUrl = tryParseByteplus(data);
          if (imageUrl) setEngineBadgeText('BytePlus SeeDream 5.0 2K Engine');
        }
      } catch (err) {
        lastEngineError = err?.message || 'BytePlus proxy failed';
      }

      if (!imageUrl) {
        const hostBase = byteplusEndpoint.replace(/\/$/, '');
        const endpoints = [
          `${hostBase}/images/generations`,
          'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations',
          'https://ark.cn-beijing.volces.com/api/v3/images/generations'
        ];
        for (const url of endpoints) {
          if (imageUrl) break;
          try {
            const res = await fetchWithTimeout(url, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${byteplusKey.trim()}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: byteplusModel.trim(),
                prompt: fullPromptText,
                size: '1280x720',
                response_format: 'url'
              })
            }, 55000).catch(() => null);
            if (res?.ok) {
              const data = await res.json();
              imageUrl = tryParseByteplus(data);
              if (imageUrl) setEngineBadgeText('BytePlus SeeDream 5.0 2K Engine');
            } else if (res) {
              lastEngineError = `BytePlus HTTP ${res.status}`;
            }
          } catch (err) {
            lastEngineError = err?.message || 'BytePlus direct failed';
          }
        }
      }
    }

    // 4. Pollinations Flux — short prompt + verify load (never leave UI at 94%)
    if (!imageUrl) {
      try {
        const seed = Math.floor(Math.random() * 1000000);
        const encodedPrompt = encodeURIComponent(shortPromptText);
        const pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&seed=${seed}&nologo=true&model=flux&referrer=stageproductionstudio`;
        await waitForImageReady(pollUrl, 50000);
        imageUrl = pollUrl;
        setEngineBadgeText('Pollinations Flux (Fallback)');
      } catch (e) {
        lastEngineError = e?.message || 'Pollinations fallback failed';
      }
    }

    if (!imageUrl) {
      failGeneration(
        activeEngineName,
        `Image generation failed. ${lastEngineError || 'No engine returned an image.'} Add a Google AI Studio key (Gemini Image) or BytePlus key in Admin Settings, then try again.`
      );
      return;
    }

    try {
      await waitForImageReady(imageUrl, imageUrl.startsWith('data:') ? 5000 : 45000);
      commitImage(imageUrl, key);
    } catch (err) {
      failGeneration(
        activeEngineName,
        `Generated image could not be loaded (${err?.message || 'load error'}). Try regenerating or check API / network settings.`
      );
    }
  };

  const shotIdForImages = shot?.sceneShotId || `SH_${activeShotIndex + 1}`;
  const imageLookupMode = keyframeMode === 'transition' ? null : keyframeMode;
  const currentShotKey = imageLookupMode ? `${shotIdForImages}_${imageLookupMode}` : '';
  const activeGeneratedImageUrl = imageLookupMode
    ? (generatedImages[currentShotKey] || shot?.embeddedImages?.[imageLookupMode] || '')
    : '';

  const handleManualEmbed = () => {
    if (!activeGeneratedImageUrl || !currentShotKey) return;
    saveCanvasVaultImage(currentShotKey, activeGeneratedImageUrl);
    if (onEmbedImage) {
      onEmbedImage(currentShotKey, activeGeneratedImageUrl);
    }
    setIsEmbeddedToast(true);
    setTimeout(() => setIsEmbeddedToast(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 bg-zinc-950/90 p-5 rounded-2xl border border-white/10 shadow-xl w-full force-dark sps-view-enter" data-force-dark="true">
      {/* Canvas Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-300 border border-cyan-400/20 shrink-0">
            <Film className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white font-display flex flex-wrap items-center gap-2">
              Framing & Keyframe Simulator
              <span className="text-[10px] bg-cyan-500/10 text-cyan-200 px-2 py-0.5 rounded-full border border-cyan-400/25 font-semibold tracking-wide">
                {aspectRatio}
              </span>
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">Pre-viz styles, first/last frames, and AI storyboard generation.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadAllCanvasImagesToDisk(generatedImages, shot?.sceneShotId || 'Stage_Production_Studio')}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Export all generated canvas keyframe renders directly to your local computer's folder"
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-300" />
            <span>Save images</span>
          </button>

          <div className="sps-seg">
            <button
              type="button"
              onClick={() => setRenderStyle('3d_clay_render')}
              className={`sps-seg-btn ${renderStyle === '3d_clay_render' ? 'is-active-amber' : ''}`}
            >
              <Box className="w-3.5 h-3.5" />
              Clay
            </button>
            <button
              type="button"
              onClick={() => setRenderStyle('2d_blueprint')}
              className={`sps-seg-btn ${renderStyle === '2d_blueprint' ? 'is-active' : ''}`}
            >
              <Palette className="w-3.5 h-3.5" />
              Blueprint
            </button>
            <button
              type="button"
              onClick={() => setRenderStyle('pencil_sketch')}
              className={`sps-seg-btn ${renderStyle === 'pencil_sketch' ? 'is-active-emerald' : ''}`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Sketch
            </button>
            <button
              type="button"
              onClick={() => setRenderStyle('generated_ai_image')}
              className={`sps-seg-btn ${renderStyle === 'generated_ai_image' ? 'is-active-violet' : ''}`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Image Gen
            </button>
          </div>

          <div className="sps-seg">
            <button
              type="button"
              onClick={() => setKeyframeMode('first_frame')}
              className={`sps-seg-btn ${keyframeMode === 'first_frame' ? 'is-active' : ''}`}
            >
              <Play className="w-3 h-3" />
              First
            </button>
            <button
              type="button"
              onClick={() => setKeyframeMode('last_frame')}
              className={`sps-seg-btn ${keyframeMode === 'last_frame' ? 'is-active-amber' : ''}`}
            >
              <FastForward className="w-3 h-3" />
              Last
            </button>
            <button
              type="button"
              onClick={() => setKeyframeMode('transition')}
              className={`sps-seg-btn ${keyframeMode === 'transition' ? 'is-active-rose' : ''}`}
            >
              <Sparkles className="w-3 h-3" />
              Vector
            </button>
          </div>
        </div>
      </div>

      {/* Shot Selection Quick Selector Strip */}
      {shots.length > 0 && setActiveShotIndex && (
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5 scrollbar-thin">
          <span className="text-[11px] text-zinc-500 font-semibold mr-1 shrink-0">Shot</span>
          {shots.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveShotIndex(idx)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border shrink-0 ${
                activeShotIndex === idx
                  ? 'bg-cyan-400 text-zinc-950 border-cyan-300 shadow'
                  : 'bg-white/[0.03] text-zinc-400 hover:text-white border-white/10 hover:bg-white/[0.06]'
              }`}
            >
              #{idx + 1} · {s.sceneShotId || `S${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Main Interactive Stage Canvas & 3D Clay Pre-Viz */}
      <div
        className="relative w-full bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shadow-inner flex items-center justify-center"
        style={{ aspectRatio: String(aspectNumeric) }}
      >
        {/* Keep canvas mounted so Clay/Blueprint/Sketch redraw reliably after leaving Image Gen */}
        <canvas
          ref={canvasRef}
          width={canvasPixelSize.width}
          height={canvasPixelSize.height}
          className={`w-full h-full object-contain ${renderStyle === 'generated_ai_image' ? 'invisible absolute inset-0 pointer-events-none' : ''}`}
          aria-hidden={renderStyle === 'generated_ai_image'}
        />

        {renderStyle === 'generated_ai_image' && (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-zinc-950">
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
            ) : keyframeMode === 'transition' ? (
              (() => {
                const shotId = shot?.sceneShotId || `SH_${activeShotIndex + 1}`;
                const firstUrl = generatedImages[`${shotId}_first_frame`] || shot?.embeddedImages?.first_frame;
                const lastUrl = generatedImages[`${shotId}_last_frame`] || shot?.embeddedImages?.last_frame;
                if (firstUrl || lastUrl) {
                  return (
                    <div className="relative w-full h-full grid grid-cols-2 gap-px bg-zinc-800">
                      <div className="relative bg-zinc-950 flex items-center justify-center overflow-hidden">
                        {firstUrl ? (
                          <img src={firstUrl} alt="First frame" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-mono text-zinc-500 px-3 text-center">No First Frame yet</span>
                        )}
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 font-bold">FRAME 0</span>
                      </div>
                      <div className="relative bg-zinc-950 flex items-center justify-center overflow-hidden">
                        {lastUrl ? (
                          <img src={lastUrl} alt="Last frame" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-mono text-zinc-500 px-3 text-center">No Last Frame yet</span>
                        )}
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-amber-950/90 border border-amber-500/40 text-[10px] font-mono text-amber-300 font-bold">FRAME N</span>
                      </div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-pink-950/90 border border-pink-500/50 text-[10px] font-mono text-pink-300 font-bold shadow pointer-events-none">
                        → VECTOR
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="flex flex-col items-center gap-3 text-zinc-400 p-6 text-center">
                    <Sparkles className="w-10 h-10 text-pink-400" />
                    <p className="text-xs font-mono max-w-md">
                      Vector compares First → Last frames. Generate First Frame and Last Frame first, then return here to preview the pair.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setKeyframeMode('first_frame')}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 text-white font-bold text-xs shadow font-mono cursor-pointer"
                      >
                        Open First Frame
                      </button>
                      <button
                        type="button"
                        onClick={() => setKeyframeMode('last_frame')}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs shadow font-mono cursor-pointer"
                      >
                        Open Last Frame
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : activeGeneratedImageUrl ? (
              <div className="relative w-full h-full">
                <img
                  src={activeGeneratedImageUrl}
                  alt="AI Generated Storyboard Render"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950/85 backdrop-blur-md border border-purple-500/40 text-[10px] font-mono text-purple-300 font-bold shadow-lg pointer-events-none">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>
                    {activeGeneratedImageUrl.includes('pollinations')
                      ? '⚡ Flux Fallback (High-Res)'
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
        )}

        {/* Framing & Shot Metadata Badges Overlay */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none z-10">
          <span className="px-2.5 py-1 rounded-lg bg-zinc-950/85 backdrop-blur-md border border-cyan-500/40 text-cyan-300 text-xs font-bold font-mono shadow">
            {parseSceneAndShotID(shot, activeShotIndex).shortId} | {shot?.shotComposition || 'Medium Shot'}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-zinc-950/85 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs font-mono shadow truncate max-w-xs">
            {renderStyle === '3d_clay_render' ? '🗿 3D CLAY PRE-VIZ MODE | ' : (renderStyle === '2d_blueprint' ? '📐 2D BLUEPRINT | ' : (renderStyle === 'pencil_sketch' ? '✏️ ABSTRACT PENCIL SKETCH | ' : `🖼️ ${engineBadgeText} | `))}
            {keyframeMode === 'first_frame' ? 'FRAME 0' : (keyframeMode === 'last_frame' ? 'FRAME N' : 'INTERPOLATION')}
          </span>
        </div>
      </div>

      {/* CONTROL TOOLBAR DIRECTLY UNDER THE IMAGE CANVAS */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 shadow">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            {parseSceneAndShotID(shot, activeShotIndex).shortId} controls
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeGeneratedImageUrl && (
            <button
              type="button"
              onClick={handleManualEmbed}
              className={`px-3.5 py-1.5 rounded-xl font-semibold text-xs shadow flex items-center gap-1.5 transition-all border cursor-pointer ${
                isEmbeddedToast
                  ? 'bg-emerald-400 text-zinc-950 border-emerald-300 scale-[1.02]'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
              }`}
              title="Permanently embed this 2K image into the project JSON file and cloud workspace"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isEmbeddedToast ? 'Embedded' : 'Embed in project'}
            </button>
          )}

          <button
            type="button"
            onClick={handleGenerateAIImage}
            disabled={isGeneratingImage}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 hover:brightness-110 text-white font-bold text-xs shadow-lg flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 border border-white/20 disabled:opacity-50 cursor-pointer"
            title={
              keyframeMode === 'transition'
                ? 'Generate First Frame, then switch to Last Frame for the ending keyframe'
                : (activeGeneratedImageUrl ? 'Regenerate image variation with active engine' : 'Generate photorealistic 2K image with active engine')
            }
          >
            <Wand2 className={`w-3.5 h-3.5 text-amber-200 ${isGeneratingImage ? 'animate-spin' : ''}`} />
            <span>
              {isGeneratingImage
                ? `Generating… ${genProgress}%`
                : keyframeMode === 'transition'
                  ? 'Generate First Frame'
                  : (activeGeneratedImageUrl ? 'Regenerate' : 'Generate Image')}
            </span>
          </button>
        </div>
      </div>

      {/* ACTIVE LIVE PROMPT INSPECTOR BOX */}
      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 shadow">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Live image prompt
          </span>
          <span className="text-[10px] font-semibold text-emerald-200 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-400/25">
            Craft slots linked
          </span>
        </div>
        <p className="text-xs text-zinc-300 bg-black/40 p-3 rounded-xl border border-white/5 leading-relaxed select-all max-h-36 overflow-y-auto">
          {activePromptSent || 'Building cinematic image prompt from shot craft slots…'}
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
