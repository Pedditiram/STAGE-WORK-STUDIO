/**
 * Shared SWS↔Comfy constants (no browser / compile imports).
 */

export const SWS_WORKFLOW_CONTRACT_VERSION = '1.0';
export const SWS_COMFY_PACKAGE_NAME = 'ComfyUI-SWS';
export const SWS_COMFY_PACKAGE_VERSION = '1.0.0';
export const SWS_APP_VERSION = '1.0.0';

export const SWS_PROVIDERS = Object.freeze({
  BYTEPLUS: 'byteplus',
  LOCAL_COMFY: 'local_comfy',
  FAL: 'fal.ai',
  GOOGLE: 'google',
  OPENAI: 'openai',
  KLING: 'kling',
  RUNWAY: 'runway'
});

const IMPLEMENTED_PROVIDERS = new Set([SWS_PROVIDERS.BYTEPLUS, SWS_PROVIDERS.LOCAL_COMFY]);

export function isProviderImplemented(provider) {
  return IMPLEMENTED_PROVIDERS.has(String(provider || '').toLowerCase());
}

export function slugWorkflowPart(value, fallback = 'item') {
  const s = String(value || '')
    .trim()
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
  return s || fallback;
}
