/**
 * Dedicated Prompt Composer (PDF §4).
 * Deterministic, inspectable, model-aware — not Seedance-syntax hard-coded.
 */

import { compileMasterCinemaCompilerPrompt } from './compileMasterCinemaPrompt';

function line(label, value) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  return `${label}: ${v}`;
}

function dedupeBlocks(blocks) {
  const seen = new Set();
  const out = [];
  for (const b of blocks) {
    const key = b.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(b.trim());
  }
  return out;
}

/**
 * Stable field order from normalized Matrix data (PDF recommended order).
 */
export function composePromptFromNormalized(normalized, { exclusions = '' } = {}) {
  const n = normalized || {};
  const blocks = dedupeBlocks([
    line('SUBJECT/CHARACTER', [n.character?.name, n.character?.identity, n.character?.appearance, n.character?.costume, n.character?.expression, n.character?.mannerism, n.character?.eyeLooks, n.character?.psychology].filter(Boolean).join(' · ')),
    line('ACTION', [n.action?.primary, n.action?.secondary, n.action?.interaction, n.action?.choreography].filter(Boolean).join(' · ')),
    line('ENVIRONMENT', [n.environment?.location, n.environment?.context].filter(Boolean).join(' · ')),
    line('COMPOSITION', [n.composition?.subjectPlacement, n.composition?.synopsis].filter(Boolean).join(' · ')),
    line('CAMERA', [n.camera?.shotSize, n.camera?.framing, n.camera?.movement, n.camera?.lens, n.camera?.angle].filter(Boolean).join(' · ')),
    line('MOTION', [n.motion?.camera, n.motion?.body, n.motion?.edit].filter(Boolean).join(' · ')),
    line('LIGHTING', [n.lighting?.timeOfDay, n.lighting?.direction, n.lighting?.subject, n.lighting?.background].filter(Boolean).join(' · ')),
    line('ATMOSPHERE', [n.atmosphere?.volumetrics, n.atmosphere?.weather].filter(Boolean).join(' · ')),
    line('STYLE', [n.style?.visual, n.style?.gradeNotes].filter(Boolean).join(' · ')),
    line('COLOR GRADE', [n.colorGrade?.palette, n.colorGrade?.subject, n.colorGrade?.background].filter(Boolean).join(' · ')),
    line('TECHNICAL/QUALITY', [n.technical?.sound, n.technical?.score, 'photoreal cinematic, coherent continuity'].filter(Boolean).join(' · '))
  ]);
  const neg = String(exclusions || n.raw?.negativePrompt || '').trim();

  return {
    order: [
      'SUBJECT/CHARACTER',
      'ACTION',
      'ENVIRONMENT',
      'COMPOSITION',
      'CAMERA',
      'MOTION',
      'LIGHTING',
      'ATMOSPHERE',
      'STYLE',
      'COLOR GRADE',
      'TECHNICAL/QUALITY'
    ],
    blocks,
    prompt: blocks.join('\n'),
    negativePrompt: neg,
    source: 'normalized_matrix'
  };
}

/**
 * Prefer full cinema compiler when available; fall back to ordered Matrix composer.
 * Always expose final prompt for debugging (PDF §4).
 * Prompt, negative, and system instruction stay separate fields (architecture §6).
 */
function splitInstructionFields({ prompt, negativePrompt, systemInstruction }) {
  return {
    prompt: String(prompt || '').trim(),
    negativePrompt: String(negativePrompt || '').trim(),
    systemInstruction: String(systemInstruction || '').trim()
  };
}

export function composeModelPrompt({
  shot,
  shotIndex = 0,
  projectTitle = '',
  shots = [],
  normalized,
  promptOverride = '',
  negativePrompt = '',
  systemInstruction = ''
} = {}) {
  const sys = String(systemInstruction || shot?.systemInstruction || '').trim();
  const override = String(promptOverride || '').trim();
  if (override) {
    return {
      ...splitInstructionFields({ prompt: override, negativePrompt, systemInstruction: sys }),
      source: 'override',
      blocks: [override],
      order: ['OVERRIDE']
    };
  }

  const stagePrompt = String(shot?.stageVideoPrompt || '').trim();
  if (stagePrompt) {
    return {
      ...splitInstructionFields({
        prompt: stagePrompt,
        negativePrompt: negativePrompt || shot?.negativePrompt,
        systemInstruction: sys
      }),
      source: 'director_stage',
      blocks: [stagePrompt],
      order: ['DIRECTOR_STAGE']
    };
  }

  try {
    const compiled = compileMasterCinemaCompilerPrompt(shot, shotIndex, {
      projectTitle,
      shots: shots?.length ? shots : [shot]
    });
    const prompt = String(compiled.masterCinemaPrompt || compiled.mainPrompt || '').trim();
    if (prompt) {
      return {
        ...splitInstructionFields({
          prompt,
          negativePrompt: negativePrompt || shot?.negativePrompt,
          systemInstruction: sys
        }),
        source: 'compile_master_cinema',
        blocks: [prompt],
        order: ['MASTER_CINEMA'],
        compiledMeta: {
          hasMaster: Boolean(compiled.masterCinemaPrompt),
          hasMain: Boolean(compiled.mainPrompt)
        }
      };
    }
  } catch {
    /* fall through */
  }

  const composed = composePromptFromNormalized(normalized, {
    exclusions: negativePrompt || shot?.negativePrompt
  });
  return {
    ...composed,
    ...splitInstructionFields({
      prompt: composed.prompt,
      negativePrompt: negativePrompt || shot?.negativePrompt || composed.negativePrompt,
      systemInstruction: sys
    })
  };
}
