/**
 * CANVAS LOCAL STORAGE VAULT SERVICE
 * Permanently stores and retrieves all Canvas View images, 3D pre-viz renders,
 * and keyframes in local browser storage & disk files.
 */

const STORAGE_KEY = 'sps_canvas_vault_images';

export function getStoredCanvasVaultImages() {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.warn("Error reading canvas vault from localStorage:", e);
  }
  return {};
}

export function saveCanvasVaultImage(key, imageUrl) {
  if (typeof window === 'undefined' || !key || !imageUrl) return;
  try {
    const current = getStoredCanvasVaultImages();
    const updated = { ...current, [key]: imageUrl };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('sps_canvas_vault_updated'));
  } catch (e) {
    console.warn("Error saving image to canvas vault:", e);
  }
}

export function saveAllCanvasVaultImages(imagesMap) {
  if (typeof window === 'undefined' || !imagesMap) return;
  try {
    const current = getStoredCanvasVaultImages();
    const updated = { ...current, ...imagesMap };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('sps_canvas_vault_updated'));
  } catch (e) {
    console.warn("Error saving images map to canvas vault:", e);
  }
}

export function downloadAllCanvasImagesToDisk(imagesMap, projectTitle = "Stage_Production_Studio") {
  if (!imagesMap || Object.keys(imagesMap).length === 0) {
    alert("⚠️ No canvas images generated yet to save.");
    return;
  }

  const cleanTitle = (projectTitle || 'Stage_Production_Studio').replace(/[^a-[A-Z0-9_]/gi, '_');
  const entries = Object.entries(imagesMap);
  let savedCount = 0;

  entries.forEach(([key, url]) => {
    if (!url) return;
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${cleanTitle}_${key}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      savedCount++;
    } catch (e) {
      console.warn("Download error for key:", key, e);
    }
  });

  alert(`💾 ${savedCount} Canvas Keyframe Images Exported to Local Downloads Folder!`);
}
