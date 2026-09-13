/**
 * Film Intel — Matrix + Writer screenplay analysis for the Film Intel desk.
 * Rules-first; LLM Advise stays out of this pass.
 */

import { analyzeScreenplay } from './screenplayIntelligence';
import {
  matchCharactersForShot,
  matchWorldForShot,
  lightingBucket,
  shotDurationSec,
  continuityFlagsForShot,
  reelStats
} from './continuitySpine';
import { parseSceneAndShotID } from './sceneShotUtils';
import { getActiveCharacterProfiles, getActiveWorldAssets } from './projectBibleVault';
import {
  resolveCharacterKeysForShot,
  resolveStateAtShot,
  diffContinuityStates
} from './continuityState';
import { detectBibleSoTDrift, bibleSoTHealthSummary } from './bibleSoTHealth';

function charKey(c) {
  return String(c?.id || c?.tag || c?.name || c?.assetId || '')
    .trim()
    .toLowerCase();
}

function worldKey(w) {
  return String(w?.id || w?.tag || w?.name || '')
    .trim()
    .toLowerCase();
}

function normLook(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function lookBucketKey(label, value) {
  const v = normLook(value);
  if (!v) return '';
  return `${label}:${v.slice(0, 80)}`;
}

/**
 * @param {{ projectTitle?: string, shots?: array, characters?: array, worldAssets?: array, scriptText?: string, entityFilter?: { type: string, key: string } }} opts
 */
export function buildFilmIntel({
  projectTitle = '',
  shots = [],
  characters = null,
  worldAssets = null,
  scriptText = '',
  entityFilter = null
} = {}) {
  const profiles = Array.isArray(characters) ? characters : getActiveCharacterProfiles() || [];
  const worlds = Array.isArray(worldAssets) ? worldAssets : getActiveWorldAssets() || [];
  const live = (Array.isArray(shots) ? shots : []).filter((s) => !s?.isArchived && !s?.isMuted);
  const script = String(scriptText || '');
  const shotTagHint = (script.match(/\[SHOT\s+S\d+-\w+\]/gi) || []).length;

  const screenplay = analyzeScreenplay(script, { shotCountHint: shotTagHint });

  const presenceByChar = new Map();
  profiles.forEach((c) => {
    const key = charKey(c);
    if (!key) return;
    presenceByChar.set(key, {
      key,
      name: c.name || c.tag || key,
      tag: c.tag || '',
      shotCount: 0,
      sec: 0,
      firstShot: null,
      lastShot: null,
      shots: []
    });
  });

  const presenceByWorld = new Map();
  worlds.forEach((w) => {
    const key = worldKey(w);
    if (!key) return;
    presenceByWorld.set(key, {
      key,
      name: w.name || w.tag || key,
      tag: w.tag || '',
      shotCount: 0,
      sec: 0,
      shots: []
    });
  });

  const lightingCounts = { day: 0, night: 0, dawn: 0, unset: 0 };
  const presenceByCostume = new Map();
  const presenceByProp = new Map();
  const marks = [];

  const bumpLook = (map, kind, value, meta) => {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw.length < 2) return;
    const key = lookBucketKey(kind, raw);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        key,
        kind,
        name: raw.slice(0, 100),
        shotCount: 0,
        sec: 0,
        characters: new Set(),
        shots: [],
        versions: 1
      });
    }
    const row = map.get(key);
    row.shotCount += 1;
    row.sec += meta.sec;
    if (meta.charName) row.characters.add(meta.charName);
    row.shots.push({ index: meta.index, shotId: meta.shotId, sec: meta.sec, char: meta.charName });
  };

  live.forEach((shot, index) => {
    const sec = shotDurationSec(shot);
    const parsed = parseSceneAndShotID(shot, index);
    const shotId = parsed.shortId || shot.sceneShotId || `SH_${index + 1}`;
    const matched = matchCharactersForShot(shot, profiles);
    matched.forEach((c) => {
      const key = charKey(c);
      if (!presenceByChar.has(key)) {
        presenceByChar.set(key, {
          key,
          name: c.name || c.tag || key,
          tag: c.tag || '',
          shotCount: 0,
          sec: 0,
          firstShot: null,
          lastShot: null,
          shots: []
        });
      }
      const row = presenceByChar.get(key);
      row.shotCount += 1;
      row.sec += sec;
      row.lastShot = shotId;
      if (row.firstShot == null) row.firstShot = shotId;
      row.shots.push({ index, shotId, sec });
    });

    const world = matchWorldForShot(shot, worlds);
    if (world) {
      const key = worldKey(world);
      if (!presenceByWorld.has(key)) {
        presenceByWorld.set(key, {
          key,
          name: world.name || world.tag || key,
          tag: world.tag || '',
          shotCount: 0,
          sec: 0,
          shots: []
        });
      }
      const row = presenceByWorld.get(key);
      row.shotCount += 1;
      row.sec += sec;
      row.shots.push({ index, shotId, sec });
    }

    const contEntries = resolveCharacterKeysForShot(shot, null);
    contEntries.forEach((entry) => {
      const ck = entry?.key || '';
      const profile = entry?.char || null;
      const state = resolveStateAtShot(ck, profile, live, index);
      const prevState = index > 0 ? resolveStateAtShot(ck, profile, live, index - 1) : null;
      const deltas = prevState ? diffContinuityStates(prevState, state) : [];
      const charName = profile?.name || profile?.tag || ck;
      bumpLook(presenceByCostume, 'costume', state.costume, { sec, index, shotId, charName });
      bumpLook(presenceByProp, 'prop', state.prop, { sec, index, shotId, charName });
      if (deltas.includes('costume') && !shot?.continuityPatch?.[ck]) {
        marks.push({
          id: `${shotId}_costume_drift_${ck}`,
          shotIndex: index,
          shotId,
          severity: 'warn',
          source: 'matrix',
          craftHint: 'costume',
          message: `Costume change undocumented: ${charName}`,
          block: false
        });
      }
      if (deltas.includes('prop') && !shot?.continuityPatch?.[ck]) {
        marks.push({
          id: `${shotId}_prop_drift_${ck}`,
          shotIndex: index,
          shotId,
          severity: 'warn',
          source: 'matrix',
          craftHint: 'prop',
          message: `Prop change undocumented: ${charName}`,
          block: false
        });
      }
    });

    const light = lightingBucket(shot);
    lightingCounts[light] = (lightingCounts[light] || 0) + 1;

    const flags = continuityFlagsForShot(shot, live, index);
    flags.forEach((f) => {
      marks.push({
        id: `${shotId}_${f.id}`,
        shotIndex: index,
        shotId,
        severity: f.block ? 'block' : 'warn',
        source: 'matrix',
        craftHint: f.id,
        message: f.label || f.id,
        block: Boolean(f.block)
      });
    });
  });

  (screenplay.flags || []).forEach((f) => {
    marks.push({
      id: `script_${f.id}`,
      shotIndex: null,
      shotId: null,
      severity: f.severity === 'warn' ? 'warn' : 'note',
      source: 'writer',
      craftHint: 'screenplay',
      message: f.message,
      offset: f.offset,
      block: false
    });
  });

  const filterType = entityFilter?.type || 'film';
  const filterKey = String(entityFilter?.key || '')
    .trim()
    .toLowerCase();

  let filteredMarks = marks;
  let focusPresence = null;
  if (filterType === 'character' && filterKey) {
    focusPresence = presenceByChar.get(filterKey) || null;
    const idxs = new Set((focusPresence?.shots || []).map((s) => s.index));
    filteredMarks = marks.filter(
      (m) =>
        (m.shotIndex != null && idxs.has(m.shotIndex)) ||
        (m.source === 'writer' &&
          String(m.message || '')
            .toLowerCase()
            .includes(String(focusPresence?.name || filterKey).toLowerCase()))
    );
  } else if (filterType === 'world' && filterKey) {
    focusPresence = presenceByWorld.get(filterKey) || null;
    const idxs = new Set((focusPresence?.shots || []).map((s) => s.index));
    filteredMarks = marks.filter((m) => m.shotIndex != null && idxs.has(m.shotIndex));
  } else if (filterType === 'costume' && filterKey) {
    focusPresence = presenceByCostume.get(filterKey) || null;
    const idxs = new Set((focusPresence?.shots || []).map((s) => s.index));
    filteredMarks = marks.filter(
      (m) =>
        (m.shotIndex != null && idxs.has(m.shotIndex)) ||
        m.craftHint === 'costume' ||
        /costume/i.test(m.message || '')
    );
  } else if (filterType === 'prop' && filterKey) {
    focusPresence = presenceByProp.get(filterKey) || null;
    const idxs = new Set((focusPresence?.shots || []).map((s) => s.index));
    filteredMarks = marks.filter(
      (m) =>
        (m.shotIndex != null && idxs.has(m.shotIndex)) ||
        m.craftHint === 'prop' ||
        /prop/i.test(m.message || '')
    );
  } else if (filterType === 'lighting') {
    filteredMarks = marks.filter((m) => m.craftHint === 'light' || /light/i.test(m.message || ''));
  }

  const charPresence = Array.from(presenceByChar.values()).sort((a, b) => b.sec - a.sec);
  const worldPresence = Array.from(presenceByWorld.values()).sort((a, b) => b.sec - a.sec);
  const costumePresence = Array.from(presenceByCostume.values())
    .map((row) => ({
      ...row,
      characters: Array.from(row.characters || [])
    }))
    .sort((a, b) => b.sec - a.sec);
  const propPresence = Array.from(presenceByProp.values())
    .map((row) => ({
      ...row,
      characters: Array.from(row.characters || [])
    }))
    .sort((a, b) => b.sec - a.sec);
  const reel = reelStats(live);
  const totalSec = Math.max(1, reel.sec || 1);
  charPresence.forEach((c) => {
    c.sharePct = Math.round((c.sec / totalSec) * 100);
  });
  worldPresence.forEach((w) => {
    w.sharePct = Math.round((w.sec / totalSec) * 100);
  });
  costumePresence.forEach((c) => {
    c.sharePct = Math.round((c.sec / totalSec) * 100);
  });
  propPresence.forEach((p) => {
    p.sharePct = Math.round((p.sec / totalSec) * 100);
  });

  const blockCount = marks.filter((m) => m.severity === 'block').length;
  const warnCount = marks.filter((m) => m.severity === 'warn').length;
  const writerScore = screenplay.readiness?.score ?? 0;
  const continuityPts = Math.max(0, 28 - blockCount * 4 - Math.min(12, warnCount));
  const coveragePts =
    charPresence.filter((c) => c.shotCount > 0).length >= 2
      ? 18
      : charPresence.some((c) => c.shotCount > 0)
        ? 8
        : 0;
  const matrixPts = live.length >= 3 ? 18 : live.length > 0 ? 8 : 0;

  const craftKeys = [
    'sceneSynopsis',
    'shotComposition',
    'actionEnvContext',
    'timeAndLightingEnv',
    'characterIdAssetRef',
    'shotDurationAndImages',
    'subjectLightingTag',
    'cameraMotionTag'
  ];
  let craftFilled = 0;
  let craftTotal = 0;
  const weakCraftShots = [];
  live.forEach((shot, index) => {
    let filled = 0;
    craftKeys.forEach((k) => {
      craftTotal += 1;
      if (String(shot?.[k] || '').trim().length > 2) {
        craftFilled += 1;
        filled += 1;
      }
    });
    const pct = Math.round((filled / craftKeys.length) * 100);
    if (pct < 50) {
      const parsed = parseSceneAndShotID(shot, index);
      weakCraftShots.push({
        index,
        shotId: parsed.shortId || shot.sceneShotId || `SH_${index + 1}`,
        fillPct: pct
      });
    }
  });
  const craftFillPct = craftTotal > 0 ? Math.round((craftFilled / craftTotal) * 100) : 0;
  const craftPts = Math.round((craftFillPct / 100) * 16);

  const filmScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(writerScore * 0.4 + continuityPts + coveragePts + matrixPts * 0.7 + craftPts)
    )
  );
  let grade = 'Draft';
  if (filmScore >= 85) grade = 'Picture';
  else if (filmScore >= 70) grade = 'Production Strong';
  else if (filmScore >= 50) grade = 'Developing';
  else if (filmScore >= 30) grade = 'Outline';

  const dimensions = [
    { id: 'writer', label: 'Writer readiness', value: writerScore },
    {
      id: 'continuity',
      label: 'Continuity',
      value: Math.round((continuityPts / 28) * 100)
    },
    {
      id: 'coverage',
      label: 'Cast coverage',
      value: Math.round((coveragePts / 18) * 100)
    },
    {
      id: 'matrix',
      label: 'Matrix body',
      value: Math.round((matrixPts / 18) * 100)
    },
    { id: 'craft', label: 'Craft fill', value: craftFillPct }
  ];

  const qualityIssues = [];
  if (live.length === 0) {
    qualityIssues.push({
      id: 'no_shots',
      severity: 'block',
      title: 'No live Matrix shots',
      detail: 'Add shots in Matrix/Form before quality can be gauged.',
      action: 'Open Matrix'
    });
  }
  if (blockCount > 0) {
    qualityIssues.push({
      id: 'blocks',
      severity: 'block',
      title: `${blockCount} blocking continuity mark${blockCount === 1 ? '' : 's'}`,
      detail: 'Look sheets, bridges, or durations are blocking Generate readiness.',
      action: 'Review marks'
    });
  }
  if (craftFillPct < 60) {
    qualityIssues.push({
      id: 'craft_thin',
      severity: 'warn',
      title: `Craft fill ${craftFillPct}%`,
      detail: `${weakCraftShots.length} shot(s) under 50% on critical crafts (synopsis, framing, env, cast, duration, light).`,
      action: 'Fill weak crafts'
    });
  }
  if (charPresence.filter((c) => c.shotCount > 0).length === 1 && live.length >= 4) {
    qualityIssues.push({
      id: 'solo_cast',
      severity: 'warn',
      title: 'Single character dominates screen time',
      detail: 'Only one bible character matched across the reel — check tags or ensemble coverage.',
      action: 'Check cast tags'
    });
  }
  const topShare = charPresence[0]?.sharePct || 0;
  if (topShare >= 70 && charPresence.filter((c) => c.shotCount > 0).length >= 2) {
    qualityIssues.push({
      id: 'screen_imbalance',
      severity: 'info',
      title: `${charPresence[0].name} holds ${topShare}% screen time`,
      detail: 'Hero-heavy reels are fine if intentional — otherwise rebalance Act middle.',
      action: 'Review presence'
    });
  }
  if ((screenplay.flags || []).some((f) => f.severity === 'warn')) {
    qualityIssues.push({
      id: 'writer_warns',
      severity: 'warn',
      title: 'Writer continuity warnings',
      detail: 'Script flags (orphan dialogue, name clashes, missing sluglines) need a pass.',
      action: 'Open Writer flags'
    });
  }
  const lightUnset = lightingCounts.unset || 0;
  if (live.length >= 3 && lightUnset / live.length >= 0.5) {
    qualityIssues.push({
      id: 'light_unset',
      severity: 'info',
      title: 'Lighting unset on most shots',
      detail: 'Add time/lighting crafts so day/night continuity can be scored.',
      action: 'Fill lighting crafts'
    });
  }
  const costumeDrifts = marks.filter((m) => m.craftHint === 'costume').length;
  if (costumeDrifts > 0) {
    qualityIssues.push({
      id: 'costume_drift',
      severity: 'warn',
      title: `${costumeDrifts} undocumented costume change${costumeDrifts === 1 ? '' : 's'}`,
      detail: 'Costume jumped without continuityPatch — lock look changes on the shot.',
      action: 'Patch costume'
    });
  }
  const propDrifts = marks.filter((m) => m.craftHint === 'prop').length;
  if (propDrifts > 0) {
    qualityIssues.push({
      id: 'prop_drift',
      severity: 'warn',
      title: `${propDrifts} undocumented prop change${propDrifts === 1 ? '' : 's'}`,
      detail: 'Props appeared/changed without explicit continuity patch.',
      action: 'Patch props'
    });
  }

  const bibleDrift = detectBibleSoTDrift({
    projectTitle,
    project: {
      title: projectTitle,
      characterProfiles: profiles,
      worldAssets: worlds
    }
  });
  const bibleSoT = bibleSoTHealthSummary(bibleDrift);
  if (bibleDrift?.drift) {
    qualityIssues.push({
      id: 'bible_sot',
      severity: 'warn',
      title: 'Bible source-of-truth drift',
      detail: `${bibleSoT.issueCount || (bibleDrift.issues || []).length} Cast/World store mismatch(es) — heal from Production Ops or Settings.`,
      action: 'Heal bible SoT'
    });
  }

  const severityRank = { block: 3, warn: 2, note: 1, info: 1 };
  const reelMap = live.map((shot, index) => {
    const parsed = parseSceneAndShotID(shot, index);
    const shotId = parsed.shortId || shot.sceneShotId || `SH_${index + 1}`;
    const shotMarks = marks.filter((m) => m.shotIndex === index);
    let severity = 'ok';
    shotMarks.forEach((m) => {
      if ((severityRank[m.severity] || 0) > (severityRank[severity] || 0)) severity = m.severity;
    });
    return {
      index,
      shotId,
      sec: shotDurationSec(shot),
      severity,
      markCount: shotMarks.length,
      light: lightingBucket(shot)
    };
  });

  const suggestions = buildSuggestions({
    marks: filteredMarks,
    qualityIssues,
    weakCraftShots,
    screenplay,
    charPresence,
    costumePresence,
    propPresence,
    liveCount: live.length
  });

  const searchIndex = buildSearchIndex({
    live,
    charPresence,
    worldPresence,
    costumePresence,
    propPresence,
    marks: filteredMarks,
    screenplay,
    qualityIssues,
    suggestions
  });

  return {
    projectTitle,
    generatedAt: new Date().toISOString(),
    screenplay,
    filmHealth: {
      score: filmScore,
      grade,
      dimensions
    },
    quality: {
      score: filmScore,
      grade,
      dimensions,
      issues: qualityIssues,
      craftFill: {
        pct: craftFillPct,
        filled: craftFilled,
        total: craftTotal,
        weakShots: weakCraftShots.slice(0, 24)
      },
      lighting: lightingCounts,
      bibleSoT,
      checklist: (screenplay.readiness?.factors || []).map((f) => ({
        ok: Boolean(f.ok),
        label: f.label
      }))
    },
    suggestions,
    searchIndex,
    reelMap,
    runtime: reel,
    lighting: lightingCounts,
    characters: charPresence,
    worlds: worldPresence,
    costumes: costumePresence,
    props: propPresence,
    marks: filteredMarks,
    marksAll: marks,
    focus: focusPresence,
    entityFilter: { type: filterType, key: filterKey },
    stats: {
      liveShots: live.length,
      blockMarks: blockCount,
      warnMarks: warnCount,
      writerFlags: (screenplay.flags || []).length,
      suggestionCount: suggestions.length,
      qualityIssues: qualityIssues.length,
      costumeLooks: costumePresence.length,
      propsTracked: propPresence.length,
      bibleDrift: Boolean(bibleDrift?.drift)
    }
  };
}

function buildSuggestions({
  marks = [],
  qualityIssues = [],
  weakCraftShots = [],
  screenplay = {},
  charPresence = [],
  costumePresence = [],
  propPresence = [],
  liveCount = 0
}) {
  const out = [];
  let pri = 1;

  marks
    .filter((m) => m.severity === 'block')
    .slice(0, 8)
    .forEach((m) => {
      out.push({
        id: `sug_mark_${m.id}`,
        priority: pri++,
        severity: 'block',
        title: `Fix blocking: ${m.shotId || 'shot'}`,
        detail: m.message,
        actionLabel: m.source === 'writer' ? 'Open Writer' : 'Open shot',
        target: {
          type: m.source === 'writer' ? 'writer' : 'shot',
          shotIndex: m.shotIndex,
          offset: m.offset,
          craftKey: m.craftHint === 'time' ? 'shotDurationAndImages' : m.craftHint === 'look' ? 'characterIdAssetRef' : undefined
        },
        source: 'rules'
      });
    });

  marks
    .filter((m) => m.craftHint === 'costume' || m.craftHint === 'prop')
    .slice(0, 6)
    .forEach((m) => {
      out.push({
        id: `sug_look_${m.id}`,
        priority: pri++,
        severity: 'warn',
        title: m.craftHint === 'costume' ? 'Document costume change' : 'Document prop change',
        detail: m.message,
        actionLabel: 'Open shot',
        target: { type: 'shot', shotIndex: m.shotIndex },
        source: 'rules'
      });
    });

  weakCraftShots.slice(0, 6).forEach((w) => {
    out.push({
      id: `sug_craft_${w.shotId}`,
      priority: pri++,
      severity: 'warn',
      title: `Fill crafts on ${w.shotId}`,
      detail: `Only ${w.fillPct}% of critical crafts filled — synopsis, framing, env, cast, duration, light.`,
      actionLabel: 'Open shot',
      target: { type: 'shot', shotIndex: w.index, craftKey: 'sceneSynopsis' },
      source: 'rules'
    });
  });

  (screenplay.flags || [])
    .filter((f) => f.severity === 'warn')
    .slice(0, 5)
    .forEach((f) => {
      out.push({
        id: `sug_flag_${f.id}`,
        priority: pri++,
        severity: 'warn',
        title: 'Writer continuity',
        detail: f.message,
        actionLabel: 'Open Writer',
        target: { type: 'writer', offset: f.offset },
        source: 'rules'
      });
    });

  qualityIssues
    .filter((q) => q.severity === 'info' || q.severity === 'warn')
    .slice(0, 4)
    .forEach((q) => {
      if (out.some((s) => s.detail === q.detail)) return;
      out.push({
        id: `sug_q_${q.id}`,
        priority: pri++,
        severity: q.severity,
        title: q.title,
        detail: q.detail,
        actionLabel: q.action || 'Review',
        target: { type: 'quality' },
        source: 'rules'
      });
    });

  if (liveCount >= 3 && charPresence[0] && (charPresence[0].sharePct || 0) >= 65) {
    out.push({
      id: 'sug_balance',
      priority: pri++,
      severity: 'info',
      title: 'Consider screen-time balance',
      detail: `${charPresence[0].name} is ~${charPresence[0].sharePct}% of reel. Add supporting beat shots if ensemble is intended.`,
      actionLabel: 'View presence',
      target: { type: 'character', key: charPresence[0].key },
      source: 'rules'
    });
  }

  if (costumePresence.length >= 4) {
    out.push({
      id: 'sug_costume_versions',
      priority: pri++,
      severity: 'info',
      title: `${costumePresence.length} costume looks tracked`,
      detail: 'Many wardrobe versions — confirm intentional look changes vs accidental drift.',
      actionLabel: 'Costume lens',
      target: { type: 'costume', key: costumePresence[0]?.key },
      source: 'rules'
    });
  }

  if (propPresence.length === 1 && liveCount >= 6) {
    out.push({
      id: 'sug_prop_payoff',
      priority: pri++,
      severity: 'info',
      title: 'Single prop thread',
      detail: `${propPresence[0].name} — check introduce → payoff spacing across the reel.`,
      actionLabel: 'Prop lens',
      target: { type: 'prop', key: propPresence[0].key },
      source: 'rules'
    });
  }

  if (!out.length) {
    out.push({
      id: 'sug_clean',
      priority: 1,
      severity: 'info',
      title: 'Reel looks healthy',
      detail: 'No blocking marks. Optional: Ask LLM Advise for taste / structure notes (never auto-applies).',
      actionLabel: 'Ask LLM',
      target: { type: 'llm' },
      source: 'rules'
    });
  }

  return out.slice(0, 28);
}

function buildSearchIndex({
  live = [],
  charPresence = [],
  worldPresence = [],
  costumePresence = [],
  propPresence = [],
  marks = [],
  screenplay = {},
  qualityIssues = [],
  suggestions = []
}) {
  const rows = [];

  live.forEach((shot, index) => {
    const parsed = parseSceneAndShotID(shot, index);
    const shotId = parsed.shortId || shot.sceneShotId || `SH_${index + 1}`;
    const hay = [
      shotId,
      shot.sceneSynopsis,
      shot.shotComposition,
      shot.actionEnvContext,
      shot.timeAndLightingEnv,
      shot.characterIdAssetRef,
      shot.coArtistInteraction,
      shot.cameraMotionTag,
      shot.subjectLightingTag
    ]
      .map((x) => String(x || ''))
      .join(' ');
    rows.push({
      id: `shot_${index}`,
      kind: 'shot',
      title: shotId,
      subtitle: String(shot.sceneSynopsis || shot.shotComposition || '').slice(0, 80),
      haystack: hay.toLowerCase(),
      shotIndex: index
    });
  });

  charPresence.forEach((c) => {
    rows.push({
      id: `char_${c.key}`,
      kind: 'character',
      title: c.name,
      subtitle: `${c.shotCount} shots · ${formatPresenceDuration(c.sec)}`,
      haystack: `${c.name} ${c.tag} character cast`.toLowerCase(),
      entityKey: c.key
    });
  });

  worldPresence.forEach((w) => {
    rows.push({
      id: `world_${w.key}`,
      kind: 'world',
      title: w.name,
      subtitle: `${w.shotCount} shots · ${formatPresenceDuration(w.sec)}`,
      haystack: `${w.name} ${w.tag} world location set`.toLowerCase(),
      entityKey: w.key
    });
  });

  costumePresence.forEach((c) => {
    rows.push({
      id: `costume_${c.key}`,
      kind: 'costume',
      title: c.name,
      subtitle: `${c.shotCount} shots · ${(c.characters || []).slice(0, 3).join(', ')}`,
      haystack: `${c.name} costume wardrobe look ${(c.characters || []).join(' ')}`.toLowerCase(),
      entityKey: c.key
    });
  });

  propPresence.forEach((p) => {
    rows.push({
      id: `prop_${p.key}`,
      kind: 'prop',
      title: p.name,
      subtitle: `${p.shotCount} shots · ${(p.characters || []).slice(0, 3).join(', ')}`,
      haystack: `${p.name} prop accessory object ${(p.characters || []).join(' ')}`.toLowerCase(),
      entityKey: p.key
    });
  });

  marks.forEach((m) => {
    rows.push({
      id: `mark_${m.id}`,
      kind: 'mark',
      title: `${m.shotId || 'Writer'} · ${m.severity}`,
      subtitle: m.message,
      haystack: `${m.message} ${m.shotId || ''} ${m.craftHint || ''} mark`.toLowerCase(),
      shotIndex: m.shotIndex,
      offset: m.offset,
      severity: m.severity
    });
  });

  (screenplay.beats || [])
    .filter((b) => !/^ACT\s+/i.test(b.title))
    .forEach((b, i) => {
      rows.push({
        id: `beat_${i}`,
        kind: 'beat',
        title: b.title || `Beat ${i + 1}`,
        subtitle: b.summary || b.emotion || '',
        haystack: `${b.title} ${b.summary} ${b.emotion} ${(b.characters || []).join(' ')}`.toLowerCase(),
        offset: b.offset
      });
    });

  (screenplay.flags || []).forEach((f) => {
    rows.push({
      id: `flag_${f.id}`,
      kind: 'flag',
      title: 'Writer flag',
      subtitle: f.message,
      haystack: `${f.message} flag writer`.toLowerCase(),
      offset: f.offset,
      severity: f.severity
    });
  });

  qualityIssues.forEach((q) => {
    rows.push({
      id: `quality_${q.id}`,
      kind: 'quality',
      title: q.title,
      subtitle: q.detail,
      haystack: `${q.title} ${q.detail} quality`.toLowerCase(),
      severity: q.severity
    });
  });

  suggestions.forEach((s) => {
    rows.push({
      id: `suggestion_${s.id}`,
      kind: 'suggestion',
      title: s.title,
      subtitle: s.detail,
      haystack: `${s.title} ${s.detail} suggestion fix`.toLowerCase(),
      shotIndex: s.target?.shotIndex,
      offset: s.target?.offset,
      severity: s.severity
    });
  });

  return rows;
}

/**
 * Search Film Intel index (shots, cast, world, marks, beats, flags, quality, suggestions).
 */
export function searchFilmIntel(intel, query = '') {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  const index = intel?.searchIndex || [];
  if (!q) return { query: '', hits: index.slice(0, 40), total: index.length };
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = [];
  index.forEach((row) => {
    const hay = row.haystack || '';
    let score = 0;
    tokens.forEach((t) => {
      if (hay.includes(t)) score += 2;
      if (String(row.title || '')
        .toLowerCase()
        .includes(t))
        score += 3;
      if (String(row.kind || '') === t) score += 4;
    });
    if (score > 0) scored.push({ ...row, score });
  });
  scored.sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)));
  return { query: q, hits: scored.slice(0, 60), total: scored.length };
}

export function formatPresenceDuration(sec = 0) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}
