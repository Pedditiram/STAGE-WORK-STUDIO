/**
 * Factory reset — flush app library / session (and optional settings)
 * without deleting film project folders on disk (SWS PROJECTS/{TITLE}/…).
 */

const ALWAYS_KEEP = new Set([
  'sps_saas_device_id'
]);

/** Keys that are settings / prefs / admin — preserved unless flushSettings. */
const SETTINGS_KEY_EXACT = new Set([
  'sps_llm_provider',
  'sps_api_key',
  'sps_gemini_api_key',
  'sps_anthropic_api_key',
  'sps_openai_api_key',
  'sps_byteplus_api_key',
  'sps_byteplus_endpoint_url',
  'sps_byteplus_model_id',
  'sps_byteplus_video_model_id',
  'sps_magnific_api_key',
  'sps_magnific_email',
  'sps_video_api_key',
  'sps_minimax_api_key',
  'sps_kling_api_key',
  'sps_luma_api_key',
  'sps_gpt_oss_api_key',
  'sps_active_llm_engine',
  'sps_image_gen_engine',
  'sps_google_image_model',
  'sps_use_same_model_image_gen',
  'sps_model_engine',
  'sps_color_theme',
  'sps_enable_canvas_tab',
  'sps_app_version_mode',
  'sps_authorized_phone_users',
  'sps_authorized_user_email',
  'sps_authorized_admin_email',
  'sps_preset_profile',
  'sps_custom_genre_profiles',
  'sps_custom_admin_id',
  'sps_custom_admin_password',
  'sps_allotted_settings_folder',
  'sps_allotted_storage_folder',
  'sps_is_admin_logged_in',
  'sps_guest_browse_enabled',
  'sps_guest_url_enabled',
  'sps_admin_settings_fullscreen',
  'sps_collaboration_activity_log',
  'sps_issued_invite_otps',
  'sps_studio_modules',
  'sps_studio_default_consoles',
  'sps_presentation_mode',
  'sps_db_config',
  'sps_cloud_room_id',
  'sps_include_story_in_prompt',
  'sps_include_characters_in_prompt',
  'sps_include_world_in_prompt',
  'sps_include_dop_in_prompt',
  'sps_include_sound_in_prompt',
  'sps_export_lifecycle_mode',
  'sps_comfy_ui_base_url',
  'sps_last_open_folder',
  'sps_drive_client_id',
  'sps_drive_email',
  'sps_drive_root_id',
  'sps_drive_root_name',
  'sps_drive_user_folder_id',
  'sps_drive_user_folder_name',
  'sps_drive_project_folders',
  'sps_project_library_view',
  'sps_matrix_col_widths',
  'sps_mobile_gesture_help_seen',
  'sps_mobile_demo_dismissed'
]);

const SETTINGS_KEY_PREFIXES = [
  'sps_ui_',
  'sps_user_console_',
  'sps_export_lifecycle_',
  'sps_byok_',
  'sps_saas_session',
  'sps_token_'
];

const PROJECT_KEY_EXACT = new Set([
  'sps_project_library',
  'sps_current_project_title',
  'sps_current_shots',
  'sps_current_screenplay_text',
  'sps_current_target_model',
  'sps_current_aspect_ratio',
  'sps_active_workspace_at',
  'sps_active_view',
  'sps_active_shot_index',
  'sps_generated_images_map',
  'sps_extracted_master_story',
  'sps_narrative_prose_story',
  'sps_selected_story_mode',
  'sps_selected_character_source',
  'sps_character_bible_vault',
  'sps_writer_custom_script_synopsis',
  'sps_global_project_backups'
]);

const PROJECT_KEY_PREFIXES = [
  'sps_project_',
  'sps_bible_',
  'sps_world_',
  'sps_story_package',
  'sps_asset_registry',
  'sps_generation_jobs',
  'sps_creative_audit',
  'sps_autobackup_',
  'sps_cloud_',
  'sps_dop_',
  'sps_sound_',
  'sps_director_',
  'sps_production_',
  'sps_lifecycle_',
  'sps_spine_',
  'sps_continuity_',
  'sps_canvas_',
  'sps_screenplay_',
  'sps_collab_chat_',
  'sps_shot_',
  'sps_matrix_',
  'sps_active_spine',
  'sps_active_asset',
  'sps_active_story',
  'sps_active_lifecycle',
  'sps_film_',
  'sps_comfy_film',
  'sps_sws_'
];

function isSettingsKey(key) {
  if (SETTINGS_KEY_EXACT.has(key)) return true;
  return SETTINGS_KEY_PREFIXES.some((p) => key.startsWith(p));
}

function isProjectKey(key) {
  if (PROJECT_KEY_EXACT.has(key)) return true;
  if (isSettingsKey(key)) return false;
  return PROJECT_KEY_PREFIXES.some((p) => key.startsWith(p));
}

function deleteIndexedDb(name) {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(false);
      return;
    }
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function clearMatchingLocalStorage({ flushSettings }) {
  if (typeof localStorage === 'undefined') return { removed: 0, kept: [] };
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  let removed = 0;
  const kept = [];
  for (const key of keys) {
    if (ALWAYS_KEEP.has(key)) {
      kept.push(key);
      continue;
    }
    // flushSettings: clear almost all sps_* except device id.
    // projects-only: clear project/session keys; leave settings & API keys.
    const shouldDrop = flushSettings
      ? key.startsWith('sps_')
      : isProjectKey(key);
    if (shouldDrop) {
      try {
        localStorage.removeItem(key);
        removed += 1;
      } catch {
        /* ignore */
      }
    } else {
      kept.push(key);
    }
  }
  return { removed, kept };
}

async function callFactoryResetApi(options) {
  const body = {
    flushProjects: true,
    flushSettings: Boolean(options.flushSettings),
    preserveFilmFolders: true
  };
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.factoryReset) {
      return await window.electronAPI.factoryReset(body);
    }
  } catch {
    /* fall through */
  }
  try {
    const res = await fetch('/api/factory-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: err?.message || 'Disk factory-reset unreachable' };
  }
}

/**
 * @param {{ flushSettings?: boolean }} options
 * @returns {Promise<{ ok: boolean, message: string, details?: object }>}
 */
export async function runFactoryReset(options = {}) {
  const flushSettings = Boolean(options.flushSettings);
  const ls = clearMatchingLocalStorage({ flushSettings });

  // Empty library mirror explicitly
  try {
    localStorage.setItem('sps_project_library', '[]');
  } catch {
    /* ignore */
  }

  const idbResults = await Promise.all([
    deleteIndexedDb('sps_local_disk_vault_db'),
    deleteIndexedDb('sps_image_blobs_db'),
    deleteIndexedDb('sps_studio_brain_db'),
    flushSettings ? deleteIndexedDb('sps_app_settings_vault_db') : Promise.resolve(false)
  ]);

  const disk = await callFactoryResetApi({ flushSettings });

  try {
    window.dispatchEvent(
      new CustomEvent('sps_factory_reset', {
        detail: { flushSettings, at: new Date().toISOString() }
      })
    );
    window.dispatchEvent(new Event('sps_projects_updated'));
  } catch {
    /* ignore */
  }

  return {
    ok: disk.ok !== false,
    message: flushSettings
      ? 'App library flushed. Settings & preferences cleared. Film project folders on disk were not deleted.'
      : 'App library flushed. Film project folders on disk were not deleted. Settings kept.',
    details: {
      localStorageRemoved: ls.removed,
      idbCleared: {
        projectVault: idbResults[0],
        imageBlobs: idbResults[1],
        studioBrain: idbResults[2],
        settingsVault: idbResults[3]
      },
      disk
    }
  };
}
