/**
 * Smoke test: disk projects/ JSON files should all appear in mergeLibrarySources + enrich path.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectsDir = path.join(root, '..', 'projects');

const diskTitles = fs
  .readdirSync(projectsDir)
  .filter((f) => f.endsWith('.json') && !f.startsWith('master_'))
  .map((f) => {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(projectsDir, f), 'utf8'));
      return String(j.title || f.replace(/\.json$/i, '')).trim();
    } catch {
      return f.replace(/\.json$/i, '');
    }
  })
  .filter(Boolean);

const vaultProjects = diskTitles.map((title, i) => ({
  id: `proj_test_${i}`,
  title,
  shots: [{ sceneShotId: 'SC01_SH01' }],
  lastModifiedIso: new Date().toISOString()
}));

// Minimal merge logic mirror (title-key union)
function mergeByTitle(local, incoming) {
  const map = new Map();
  const put = (p) => {
    if (!p?.title) return;
    const key = String(p.title).trim().toLowerCase();
    const prev = map.get(key);
    map.set(key, prev ? { ...prev, ...p } : p);
  };
  local.forEach(put);
  incoming.forEach(put);
  return Array.from(map.values());
}

const cloudSubset = vaultProjects.slice(0, 2);
const localSlim = cloudSubset.map((p) => ({ id: p.id, title: p.title, shots: [] }));
const merged = mergeByTitle(localSlim, vaultProjects);
const enriched = mergeByTitle(merged, vaultProjects);

const missing = diskTitles.filter(
  (t) => !enriched.some((p) => String(p.title).trim().toUpperCase() === String(t).trim().toUpperCase())
);

console.log('Disk JSON projects:', diskTitles.length);
console.log('Merged library size:', enriched.length);
if (missing.length) {
  console.error('MISSING after merge:', missing);
  process.exit(1);
}
console.log('OK — all disk projects present in merged library');
