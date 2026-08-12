#!/usr/bin/env node
/**
 * Electron package build that preserves the Vite source index.html.
 * ELECTRON_BUILD=true vite can rewrite root index.html with hashed asset tags
 * (breaking local Vite). We snapshot + restore around the build.
 *
 * Code signing (macOS):
 * - If CSC_LINK (+ CSC_KEY_PASSWORD) or CSC_NAME is set, electron-builder signs with that identity.
 * - Otherwise the build is ad-hoc / unsigned — Gatekeeper will warn on first open.
 * - Paid Apple Developer ID is NOT required for local/dir builds; notarization is optional.
 * - Open unsigned builds via: right-click → Open, or `xattr -cr "Stage Production Studio.app"`.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const backupPath = path.join(root, '.index.html.electron-bak');

const args = process.argv.slice(2);
let builderArgs = ['--mac'];
if (args.includes('--dir')) builderArgs = ['--mac', '--dir'];
if (args.includes('--dmg')) builderArgs = ['--mac', 'dmg'];

function run(cmd, cmdArgs, env = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
}

const hasSigningIdentity = Boolean(
  process.env.CSC_LINK ||
  process.env.CSC_NAME ||
  process.env.APPLE_IDENTITY
);

if (!hasSigningIdentity) {
  console.log(
    '[electron-build] No CSC_LINK / CSC_NAME / APPLE_IDENTITY — building unsigned (ad-hoc).\n' +
      '  Gatekeeper will warn on first launch. Optional: export CSC_NAME="Developer ID Application: …" to sign.\n' +
      '  Paid Apple Developer cert is not required for local testing.'
  );
} else {
  console.log('[electron-build] Signing identity detected — electron-builder will attempt code signing.');
}

const original = fs.readFileSync(indexPath, 'utf8');
if (!original.includes('/src/main.jsx')) {
  console.error('Refusing electron build: index.html is missing /src/main.jsx (already corrupted). Restore it first.');
  process.exit(1);
}
fs.writeFileSync(backupPath, original, 'utf8');

function restoreIndex() {
  try {
    if (fs.existsSync(backupPath)) {
      fs.writeFileSync(indexPath, fs.readFileSync(backupPath, 'utf8'), 'utf8');
      fs.unlinkSync(backupPath);
      console.log('Restored source index.html (/src/main.jsx).');
    }
  } catch (e) {
    console.error('Failed to restore index.html:', e.message);
  }
}

let restored = false;
const safeRestore = () => {
  if (restored) return;
  restored = true;
  restoreIndex();
};

process.on('exit', safeRestore);
process.on('SIGINT', () => {
  safeRestore();
  process.exit(130);
});

try {
  run('npx', ['cross-env', 'ELECTRON_BUILD=true', 'vite', 'build']);
  // Restore immediately so a failed electron-builder never leaves a broken entry
  if (fs.existsSync(backupPath)) {
    fs.writeFileSync(indexPath, fs.readFileSync(backupPath, 'utf8'), 'utf8');
  }

  // Skip notarize / force identity only when provided; otherwise let builder ad-hoc
  const builderEnv = {};
  if (!hasSigningIdentity) {
    // Explicitly avoid failing the build when no cert is present
    builderEnv.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
  }

  run('npx', ['cross-env', 'ELECTRON_RUN_AS_NODE=', 'electron-builder', ...builderArgs], builderEnv);
} catch (e) {
  safeRestore();
  throw e;
}

safeRestore();
console.log('Electron build complete.');
if (!hasSigningIdentity) {
  console.log(
    '[electron-build] Residual: unsigned app — users may see a Gatekeeper warning until a Developer ID is configured.'
  );
}
