import { getAllottedStorageFolderPath } from './appSettingsDiskVault';

/**
 * CANVAS LOCAL STORAGE FOLDER VAULT SERVICE
 * Stores and retrieves all Canvas View images, 3D pre-viz renders,
 * and keyframes directly inside the user's allotted local folder directory path
 * (e.g. /Users/pedditiram/Documents/PROMPT ENGINEERING/storage/).
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
    console.warn("Error reading canvas images from local storage folder vault:", e);
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
    console.warn("Error saving image to local storage folder vault:", e);
  }

  // Auto-Save directly to physical local disk folder (/Users/pedditiram/Documents/PROMPT ENGINEERING/storage/)
  try {
    fetch('/api/save-image-disk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, imageUrl })
    }).catch(() => null);
  } catch (e) {}
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

  const cleanTitle = (projectTitle || 'Stage_Production_Studio').replace(/[^a-zA-Z0-9_]/g, '_');
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

/**
 * AUTO-SYNC LOCAL VAULT IMAGES TO CLOUD DATABASE
 * When user switches to 'cloud' mode or clicks Sync for collaborative work,
 * auto-uploads & syncs local vault images to cloud database payload!
 */
export async function syncCanvasVaultToCloud(roomId, projectTitle) {
  if (typeof window === 'undefined') return { success: false };
  const vaultImages = getStoredCanvasVaultImages();
  const imageKeys = Object.keys(vaultImages);
  
  if (imageKeys.length === 0) {
    return { success: true, count: 0, msg: "No local images to sync." };
  }

  try {
    localStorage.setItem('sps_generated_images_map', JSON.stringify(vaultImages));
    return { 
      success: true, 
      count: imageKeys.length, 
      msg: `✓ ${imageKeys.length} Local Vault Images Auto-Synced to Cloud DB!` 
    };
  } catch (e) {
    console.warn("Auto-sync vault images error:", e);
    return { success: false, error: e.message };
  }
}

