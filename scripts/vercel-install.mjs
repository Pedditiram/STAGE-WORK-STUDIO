#!/usr/bin/env node
/**
 * Vercel-only install: skip Electron, Playwright, and desktop tooling
 * so the cloud build stays compact. Mutates package.json on the Vercel
 * runner only (ephemeral). Local npm install is unchanged.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const SKIP = new Set([
  'electron',
  'electron-builder',
  'playwright',
  'concurrently',
  'cross-env',
  'oxlint',
  'wait-on',
]);

if (pkg.devDependencies) {
  for (const name of SKIP) delete pkg.devDependencies[name];
}
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const result = spawnSync('npm', ['install'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});
process.exit(result.status || 0);
