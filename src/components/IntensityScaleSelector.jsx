import React from 'react';

/**
 * Utility helper to apply or update intensity tags in a craft string.
 * Example tag: [Intensity: High / Intense 75%]
 */
export function applyIntensityToField(currentText = '', label = 'Moderate', percent = '50%') {
  const intensityTag = `[Intensity: ${label} ${percent}]`;
  const regex = /\[Intensity:[^\]]+\]/gi;
  if (regex.test(currentText)) {
    return currentText.replace(regex, intensityTag);
  }
  if (!currentText || !currentText.trim()) {
    return intensityTag;
  }
  return `${currentText.trim()} ${intensityTag}`;
}

/**
 * Domain-aware Intensity Scale Selector Component
 * Provides 25%, 50%, 75%, 100% intensity buttons for facial expressions,
 * camera/action motion, exposure/lighting darkness, atmosphere, stunts, VFX, audio, etc.
 */
export default function IntensityScaleSelector({ value = '', onChange, craftKey = '', isPaperTheme = false }) {
  const domainScales = {
    characterExpression: [
      { label: 'Subtle', pct: '25%', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' },
      { label: 'Moderate', pct: '50%', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30' },
      { label: 'Intense Focus', pct: '75%', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' },
      { label: 'Extreme Climax', pct: '100%', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' }
    ],
    cameraMotionTag: [
      { label: 'Gentle', pct: '25%', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' },
      { label: 'Moderate Paced', pct: '50%', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30' },
      { label: 'High Kinetic', pct: '75%', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' },
      { label: 'Extreme Action Speed', pct: '100%', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' }
    ],
    characterMovement: [
      { label: 'Subtle Movement', pct: '25%', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' },
      { label: 'Paced Performance', pct: '50%', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30' },
      { label: 'High Stunt Action', pct: '75%', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' },
      { label: 'Extreme Explosive Sprint', pct: '100%', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' }
    ],
    subjectLightingTag: [
      { label: 'Soft Diffuse Fill', pct: '25%', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' },
      { label: 'Balanced Key Light', pct: '50%', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30' },
      { label: 'High Contrast Chiaroscuro', pct: '75%', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' },
      { label: 'Extreme Solar Sunbeam', pct: '100%', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' }
    ],
    timeAndLightingEnv: [
      { label: 'Soft Daylight', pct: '25%', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' },
      { label: 'Balanced Golden Hour', pct: '50%', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30' },
      { label: 'Deep Shadow Darkness', pct: '75%', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' },
      { label: 'Extreme Midday Exposure', pct: '100%', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' }
    ],
    directionalLightingAndHighlight: [
      { label: 'Subtle Fill Bounce', pct: '25%', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' },
      { label: 'Moderate 45° Key', pct: '50%', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30' },
      { label: 'Sharp Kicker Rim', pct: '75%', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' },
      { label: 'Extreme Beam Flare', pct: '100%', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' }
    ],
    atmosphereVolumetricsTag: [
      { label: 'Light Haze', pct: '25%', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' },
      { label: 'Moderate Fog', pct: '50%', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30' },
      { label: 'Heavy Dust Storm', pct: '75%', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' },
      { label: 'Extreme Opaque Steam', pct: '100%', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' }
    ],
    stuntAndSafetyNotes: [
      { label: 'Gentle Stunt', pct: '25%', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' },
      { label: 'Moderate Choreography', pct: '50%', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30' },
      { label: 'High Wirework Stunt', pct: '75%', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' },
      { label: 'Extreme Pyrotechnic Explosion', pct: '100%', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' }
    ],
    vfxCgiBreakdown: [
      { label: 'Subtle CGI Touchup', pct: '25%', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' },
      { label: 'Moderate VFX', pct: '50%', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30' },
      { label: 'Heavy CGI Particle Aura', pct: '75%', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' },
      { label: 'Extreme Disintegration FX', pct: '100%', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' }
    ],
    soundFxAndFoley: [
      { label: 'Subtle Background Foley', pct: '25%', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' },
      { label: 'Balanced Audio', pct: '50%', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30' },
      { label: 'Heavy Bass Impact', pct: '75%', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' },
      { label: 'Extreme Sub-Boom Climax', pct: '100%', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' }
    ]
  };

  const defaultScales = [
    { label: 'Gentle', pct: '25%', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30' },
    { label: 'Moderate', pct: '50%', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30' },
    { label: 'High', pct: '75%', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' },
    { label: 'Extreme', pct: '100%', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30' }
  ];

  const scales = domainScales[craftKey] || defaultScales;

  // Extract current percentage if set in value
  const currentMatch = (value || '').match(/\[Intensity:[^\]]*?(\d+%)\]/i);
  const activePct = currentMatch ? currentMatch[1] : null;

  return (
    <div className="sps-compact-toolbar my-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--sps-muted)] select-none">
        Intensity
      </span>
      <div className="sps-compact-toolbar">
        {scales.map((s) => {
          const isSelected = activePct === s.pct;
          const short = s.pct.replace('%', '');
          return (
            <button
              key={s.pct}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!onChange) return;
                onChange(applyIntensityToField(value, s.label, s.pct));
              }}
              className={`sps-btn sps-btn-compact ${isSelected ? 'sps-btn-primary' : ''}`}
              title={`${s.label} (${s.pct})`}
            >
              {short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
