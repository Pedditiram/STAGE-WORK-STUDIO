// =========================================================
// STAGE PRODUCTION STUDIO - PERSISTENT APP SETTINGS & VAULT
// =========================================================

const SETTINGS_DB_NAME = 'sps_app_settings_vault_db';
const SETTINGS_DB_VERSION = 1;
const SETTINGS_STORE_NAME = 'sps_settings_store';

let settingsDbInstance = null;

// Initialize IndexedDB for app settings
export const initSettingsVaultDB = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    if (settingsDbInstance) {
      resolve(settingsDbInstance);
      return;
    }

    const request = window.indexedDB.open(SETTINGS_DB_NAME, SETTINGS_DB_VERSION);

    request.onerror = (event) => {
      console.warn('Settings IndexedDB initialization warning:', event.target.error);
      resolve(null);
    };

    request.onsuccess = (event) => {
      settingsDbInstance = event.target.result;
      resolve(settingsDbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'key' });
      }
    };
  });
};

// Default Allotted Settings Storage Directory
export const getAllottedSettingsFolderPath = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('sps_allotted_settings_folder') || '/Users/pedditiram/Documents/PROMPT ENGINEERING/settings/';
  }
  return '/Users/pedditiram/Documents/PROMPT ENGINEERING/settings/';
};

// Set Allotted Settings Storage Directory
export const setAllottedSettingsFolderPath = (pathStr) => {
  if (typeof window !== 'undefined' && pathStr) {
    localStorage.setItem('sps_allotted_settings_folder', pathStr);
  }
};

// Default Allotted Image & Asset Storage Directory Path (Local Disk Folder)
export const getAllottedStorageFolderPath = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('sps_allotted_storage_folder') || '/Users/pedditiram/Documents/PROMPT ENGINEERING/storage/';
  }
  return '/Users/pedditiram/Documents/PROMPT ENGINEERING/storage/';
};

// Set Allotted Image & Asset Storage Directory Path
export const setAllottedStorageFolderPath = (pathStr) => {
  if (typeof window !== 'undefined' && pathStr) {
    localStorage.setItem('sps_allotted_storage_folder', pathStr);
  }
};

// Save a setting key-value pair to IndexedDB and localStorage
export const saveAppSettingToVault = async (key, value) => {
  if (!key) return;

  try {
    const db = await initSettingsVaultDB();
    if (db) {
      const tx = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SETTINGS_STORE_NAME);
      store.put({ key, value, updatedAt: new Date().toISOString() });
    }
  } catch (e) {
    console.warn('Error saving setting to IndexedDB:', e);
  }

  try {
    if (typeof value === 'object') {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      localStorage.setItem(key, String(value));
    }
  } catch (e) {}

  // Auto-Save directly to physical local disk folder (/Users/pedditiram/Documents/PROMPT ENGINEERING/settings/)
  try {
    const fullPkg = getFullAppSettingsPackage();
    fetch('/api/save-settings-disk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPkg)
    }).catch(() => null);
  } catch (e) {}
};

// Collect complete app settings object with all API keys, LLM allotments & configurations
export const getFullAppSettingsPackage = () => {
  if (typeof window === 'undefined') return {};

  const keysToExport = [
    'sps_llm_provider',
    'sps_gemini_api_key',
    'sps_anthropic_api_key',
    'sps_openai_api_key',
    'sps_byteplus_api_key',
    'sps_minimax_api_key',
    'sps_kling_api_key',
    'sps_luma_api_key',
    'sps_gpt_oss_api_key',
    'sps_active_llm_engine',
    'sps_color_theme',
    'sps_enable_canvas_tab',
    'sps_app_version_mode',
    'sps_authorized_phone_users',
    'sps_authorized_user_email',
    'sps_project_library',
    'sps_preset_profile',
    'sps_custom_genre_profiles',
    'sps_custom_admin_id',
    'sps_custom_admin_password',
    'sps_allotted_settings_folder',
    'sps_allotted_storage_folder'
  ];

  const settingsData = {};
  keysToExport.forEach(k => {
    const val = localStorage.getItem(k);
    if (val !== null) {
      try {
        settingsData[k] = JSON.parse(val);
      } catch (e) {
        settingsData[k] = val;
      }
    }
  });

  // Guarantee Google Gemini is set if default
  if (!settingsData['sps_llm_provider']) {
    settingsData['sps_llm_provider'] = 'google_gemini';
  }

  return {
    sps_app_version: '2.5',
    exported_at: new Date().toISOString(),
    allotted_folder: getAllottedSettingsFolderPath(),
    settings: settingsData
  };
};

// Export app settings package file (.json) to user's local disk folder
export const exportAppSettingsToFile = () => {
  const pkg = getFullAppSettingsPackage();
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `sps_app_settings_${dateStr}.json`;

  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Import & restore app settings package file (.json)
export const importAppSettingsFromFile = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file selected'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        const parsed = JSON.parse(content);
        const settingsMap = parsed.settings || parsed;

        if (!settingsMap || typeof settingsMap !== 'object') {
          reject(new Error('Invalid SPS App Settings file format.'));
          return;
        }

        // Write all restored settings to localStorage & IndexedDB
        for (const [key, val] of Object.entries(settingsMap)) {
          const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
          localStorage.setItem(key, valStr);
          await saveAppSettingToVault(key, val);
        }

        // Ensure default LLM provider is google_gemini if missing
        if (!localStorage.getItem('sps_llm_provider')) {
          localStorage.setItem('sps_llm_provider', 'google_gemini');
        }

        resolve(settingsMap);
      } catch (err) {
        reject(new Error('Failed to import app settings: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('Error reading settings file'));
    reader.readAsText(file);
  });
};
