/**
 * Resolve Stage mannequin identities from the shot's CHAR_ ids + Cast bible.
 * Shot-data shape stays the same if a later GLB replaces the figure.
 */
import { readActiveAssetRegistry, resolveRegistryCharacters } from './assetRegistry';
import { getActiveCharacterProfiles } from './projectBibleVault';
import { resolveHumanFigure } from './stageFigure';

const TINTS = ['#e8b84a', '#d4a84e', '#c9a36a', '#e0c080', '#b8954a', '#f0d090'];

function displayName(entry, profile) {
  const p = profile || {};
  const e = entry || {};
  return String(p.name || p.tag || e.name || e.tag || e.assetId || '').trim();
}

/**
 * @returns {{ id: string, charAssetId: string, figureSource: string, color: string }[]}
 */
export function resolveStageCastForShot(shot = {}) {
  const ids = Array.isArray(shot?.charAssetIds) ? shot.charAssetIds.filter(Boolean) : [];
  let profiles = [];
  try {
    profiles = getActiveCharacterProfiles() || [];
  } catch {
    profiles = [];
  }

  const fromIds = [];
  try {
    const registry = readActiveAssetRegistry();
    if (registry && ids.length) {
      resolveRegistryCharacters(registry, ids).forEach((entry, i) => {
        const profile = profiles.find(
          (c) =>
            c.assetId === entry.assetId ||
            c.id === entry.legacyId ||
            (c.tag && entry.tag && String(c.tag).toLowerCase() === String(entry.tag).toLowerCase())
        );
        const name = displayName(entry, profile) || entry.assetId;
        const fig = resolveHumanFigure({}, profile || {});
        fromIds.push({
          id: name,
          charAssetId: entry.assetId || ids[i],
          figureSource: fig.figureSource,
          glbUrl: fig.glbUrl,
          color: TINTS[i % TINTS.length]
        });
      });
    }
  } catch {
    /* ignore */
  }

  if (!fromIds.length && ids.length) {
    ids.slice(0, 6).forEach((id, i) => {
      const profile = profiles.find((c) => c.assetId === id || c.id === id);
      const fig = resolveHumanFigure({}, profile || {});
      fromIds.push({
        id: displayName(null, profile) || id,
        charAssetId: id,
        figureSource: fig.figureSource,
        glbUrl: fig.glbUrl,
        color: TINTS[i % TINTS.length]
      });
    });
  }

  if (fromIds.length) return fromIds.slice(0, 6);

  return profiles.slice(0, 2).map((p, i) => {
    const fig = resolveHumanFigure({}, p || {});
    return {
      id: displayName(null, p) || `Character ${i + 1}`,
      charAssetId: p.assetId || p.id || '',
      figureSource: fig.figureSource,
      glbUrl: fig.glbUrl,
      color: TINTS[i % TINTS.length]
    };
  });
}
