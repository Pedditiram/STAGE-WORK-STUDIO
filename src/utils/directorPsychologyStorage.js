/**
 * Canonical localStorage keys for Director Psychology / Vision Vault.
 * Snake: sps_director_psychology_${title} (+ fallback sps_global_director_psychology)
 * Legacy camel: sps_directorPsychology_${title} — migrated on read.
 */

export function getDirectorPsychologyKey(title) {
  return 'sps_director_psychology_' + (title || 'default');
}

function getLegacyCamelKey(title) {
  return 'sps_directorPsychology_' + (title || 'default');
}

export const GLOBAL_DIRECTOR_PSYCHOLOGY_KEY = 'sps_global_director_psychology';

/**
 * Load director psychology JSON string (or null).
 * Tries snake → camel (migrates to snake) → global.
 */
export function loadDirectorPsychology(title) {
  if (typeof window === 'undefined') return null;
  try {
    const snakeKey = getDirectorPsychologyKey(title);
    const snake = localStorage.getItem(snakeKey);
    if (snake) return snake;

    const camelKey = getLegacyCamelKey(title);
    const camel = localStorage.getItem(camelKey);
    if (camel) {
      try {
        localStorage.setItem(snakeKey, camel);
        localStorage.removeItem(camelKey);
      } catch (e) {}
      return camel;
    }

    return localStorage.getItem(GLOBAL_DIRECTOR_PSYCHOLOGY_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Persist director psychology. Writes snake key only; removes legacy camel duplicate.
 * @param {string} title
 * @param {object|string} data — object (stringified) or pre-stringified JSON
 */
export function saveDirectorPsychology(title, data) {
  if (typeof window === 'undefined') return;
  try {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const snakeKey = getDirectorPsychologyKey(title);
    localStorage.setItem(snakeKey, payload);
    try {
      localStorage.removeItem(getLegacyCamelKey(title));
    } catch (e) {}
  } catch (e) {}
}
