# SWS → ComfyUI implementation report

Modular addition for `SWS_ComfyUI_Workflow_Architecture_Instructions.pdf`. Existing Generate still/video paths are unchanged.

## What was implemented

- Requirements map: PDF concepts → existing SWS modules (contract separate from Comfy JSON).
- Versioned templates (image + video families) filled from shot/scene/character/camera/prompt/settings.
- ComfyUI **API-format** JSON using only **ComfyUI-SWS** `class_type` names (stable IDs 100–300).
- Validation before download or `/prompt` queue; missing/unknown nodes reported; no silent custom-node install.
- Manifest (custom node list, assets by URL/path, versions).
- Generation store: project → scene → shot → generation → workflow → output.
- Generate desk button **ComfyUI workflow** (creative controls). Advanced inspect/edit JSON.
- Phase 1: download ZIP (frontend workflow JSON + API JSON + manifest + contract).
- Send to ComfyUI loads **frontend** workflow JSON onto the editor via ComfyUI-SWS `POST /sws/load_workflow` + `app.loadGraphData` (not `/prompt`).
- Custom node pack `ComfyUI-SWS/` — BytePlus HTTP from env, never from workflow JSON.

## Files / components

| Area | Path |
|------|------|
| Map | `docs/SWS_COMFYUI_REQUIREMENTS_MAP.md` |
| Templates / IDs | `src/utils/swsComfyTemplates.js` |
| Constants | `src/utils/swsComfyConstants.js` |
| Contract | `src/utils/swsWorkflowContract.js` |
| JSON generator | `src/utils/swsComfyJson.js` |
| Validator | `src/utils/swsWorkflowValidator.js` |
| Store | `src/utils/swsComfyStore.js` |
| Self-test | `src/utils/swsComfySelfTest.js` |
| Comfy HTTP | `src/services/comfyuiClient.js` |
| UI | `src/components/SwsComfyWorkflowModal.jsx` |
| Entry | `src/components/GenerateDeskModal.jsx` |
| Pack | `ComfyUI-SWS/` |
| CLI test | `scripts/test-sws-comfy.mjs` |

## New npm dependencies

None. ComfyUI-SWS uses Python stdlib only.

## Custom nodes required

Install **manually**: copy `ComfyUI-SWS` into `ComfyUI/custom_nodes/`.

- SWS Shot Context, Character Context, Location Context, Camera Context, Lighting Context
- SWS Prompt, SWS Reference Loader, SWS Metadata
- SWS Video Provider, SWS Image Provider, SWS Output

Env on the ComfyUI host: `BYTEPLUS_API_KEY` or `SPS_BYTEPLUS_API_KEY`. Optional `BYTEPLUS_API_HOST`.

## Workflow formats

- ComfyUI **prompt / API** JSON (`{ "100": { "class_type", "inputs", "_meta" } }`).
- Sidecar **manifest** + SWS **contract** 1.0.
- Templates: `image_text_to_image`, `image_reference_to_image`, `image_character_consistency`, `image_environment`, `image_keyframe`, `video_text_to_video`, `video_image_to_video`, `video_reference_to_video`, `video_first_last_frame`, `video_shot_continuation`, `video_upscale`.

## Tests performed

- `npm run test:sws-comfy` — class_type parity, Python compile, sample graph IDs, missing-node and KSampler rejection, no keys in sample JSON.
- In-app **Self-test** (Generate → ComfyUI workflow): Ramayana / Panchavati / SC24_SH07 / Rama / slow tracking / 35mm / golden hour / 5s / BytePlus; empty prompt; missing node; unknown class; secrets stripped/rejected; reserved provider; upscale without source; empty `/object_info`.

Not run here: live ComfyUI GPU queue against a real `8188` server (environment has no ComfyUI). Phase 2 send reports connection / missing-node errors instead of emitting broken JSON.

## Remaining limitations

- Phase 3 webhook / auto-attach of Comfy output is not shipped; paste output URL to link the take.
- fal.ai / Google / OpenAI / Kling / Runway are reserved and **rejected** until specified.
- Local ComfyUI still executes the SWS Video/Image Provider (BytePlus REST). No invented KSampler/VAE graph.
- Reference Loader stable ID **160** and Metadata **170** are documented ambiguities (printed ID table omitted them).
- `comfyui_version` stays `unknown` until `/system_stats` succeeds.
- Compile prompt still uses existing SWS compiler; empty Matrix rows fail validation until a prompt exists.
