# SWS → ComfyUI requirements map

**Specs:**
- `SWS_ComfyUI_Workflow_Architecture_Instructions.pdf` — ComfyUI-SWS custom-node graphs
- `SWS_ComfyUI_Matrix_to_Workflow_Instructions.pdf` — Matrix → Seedance 2.0 master canvas

**SWS source of truth:** Matrix shot + Character bible + World vault + Compile prompt  
**ComfyUI JSON:** executable representation only — never the movie database

## Dual paths

| Path | Template | Nodes | Entry |
|------|----------|-------|-------|
| **SWS pack** | `image_*` / `video_*` (non-master) | ComfyUI-SWS class_types only | Generate desk → ComfyUI workflow |
| **Seedance master** | `video_seedance2_master` (default for video) | `LoadImage` ×9 + `Seedance2VideoGenerate` + `SaveVideo` + Notes | Same modal; Matrix → normalize → composer → ref router → param mapper → fill template |

## Matrix → Seedance master (PDF 2)

| Step | Module |
|------|--------|
| Normalize shot | `src/utils/normalizedShotData.js` |
| Prompt Composer | `src/utils/comfyPromptComposer.js` (+ `compileMasterCinemaCompilerPrompt`) |
| Reference Router (image_1…9) | `src/utils/comfyReferenceRouter.js` |
| Parameter Mapper | `src/utils/comfyParameterMapper.js` |
| Master fill + groups | `src/utils/seedanceMasterWorkflow.js` |
| Assemble + debug | `src/utils/assembleMatrixSeedanceWorkflow.js` |
| UI / Send | `src/components/SwsComfyWorkflowModal.jsx` |
| Adapter flag | `src/services/modelAdapters.js` `supports.comfyWorkflow` |

Required ComfyUI install for master path: **ComfyUI-Seedance2** (`Seedance2VideoGenerate`) + core `LoadImage` / `SaveVideo`. Canvas load still uses ComfyUI-SWS `/sws/load_workflow`.

## PDF → existing SWS

| PDF concept | Existing SWS | Implementation |
|-------------|--------------|----------------|
| Project | `projectTitle` / library record | Contract `projectId` |
| Scene / Shot | `sceneShotId`, Matrix row | `parseSceneAndShotID` |
| Character | `charAssetIds`, Character bible | SWS Character Context / normalized.character |
| Location | `worldAssetIds`, World vault | SWS Location Context / normalized.environment |
| Camera / lens | `shotComposition`, `cameraMotionTag`, `lensAndFocalLength` | SWS Camera Context / normalized.camera |
| Lighting | `timeAndLightingEnv`, lighting tags | SWS Lighting Context / normalized.lighting |
| Prompt | `compileMasterCinemaCompilerPrompt` | Prompt Composer — **no silent rewrite** |
| Duration / FPS / res | `shotDurationAndImages` + user settings | Parameter Mapper → Seedance widgets |
| Provider / model | BytePlus Seedance | SWS Provider **or** Seedance2VideoGenerate |
| Takes / output | `shotTakes.js`, Generate desk | Save Video naming `SWS/{project}/{scene}_{shot}` |
| Export gate | `exportGate.js` | Download JSON / ZIP |

## Templates

Registered in `src/utils/swsComfyTemplates.js`. Graphs are filled templates, not free-form graphs.

## Node class types

- **SWS pack path:** only classes defined in `ComfyUI-SWS`. No invented KSampler/CLIP/VAE.
- **Seedance master path:** `Seedance2VideoGenerate`, `LoadImage`, `SaveVideo`, `Note` (debug groups).

## Ambiguities (safest SWS-consistent choice)

1. **Reference Loader node ID** — PDF ID table omits it; assigned stable `160` adjacent to Prompt `150`.
2. **Metadata node ID** — assigned stable `170`.
3. **Seedance node** — master uses Pedditi Labs `Seedance2VideoGenerate` (image_1…9). Marketplace “ByteDance Seedance 2.5” branding maps to the same Matrix→fill architecture.
4. **Phase 3 webhook** — later. This ship: download + canvas load via `/sws/load_workflow`.
5. **`video_upscale`** — validator blocks unless a source video asset is referenced.
6. **ComfyUI version** — recorded from `/system_stats` when available.

## Non-goals

Do not rebuild the ComfyUI editor. Do not run GPU jobs inside SWS. Do not replace Generate desk Seedance/Replicate API paths. Do not duplicate the full Matrix inside ComfyUI.
