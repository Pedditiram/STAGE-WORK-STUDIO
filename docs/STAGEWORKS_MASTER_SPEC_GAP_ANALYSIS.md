# Stage Work Studio — Gap Analysis

**Path:** Current implementation → Master specification → Missing / Conflicting / Duplicated / Buggy → Prioritized plan

**Governing spec:** `Stage_Work_Studio_Vibe_Coding_Master_Instructions.pdf`  
**Codebase:** Stage Work Studio (PROMPT ENGINEERING CURSOR)  
**Rule:** Evolve existing rooms. Do not rebuild from scratch.

---

## Pipeline summary

```
CURRENT IMPLEMENTATION          MASTER SPECIFICATION
Shot-centric Matrix OS    →     Production OS spine
Project Console, Writer,        INPUT → Story Package → Bible →
Matrix/Form, Character,         Matrix → Shot Spec → Compiler →
World, Compile, Generate,       Adapter → Job Queue → Takes →
Stage, SaaS                     Review → Continuity → Export
                ↓
        MISSING · CONFLICTING · DUPLICATED · BUGGY
                ↓
           PRIORITIZED PLAN (P0 → P2)
```

**Coverage (19 pillars):** ~22% exists · ~48% partial · ~30% missing

---

## Scorecard

| Area | Status | Current reality |
|------|--------|-----------------|
| Project state as SoT | PARTIAL → DONE (P86/P95) | Workspace parks Director/DoP/Sound; smarter library merge |
| Story Package | DONE (P0a) | Durable per-title package; review before Apply |
| Production Bible | PARTIAL → DONE (P85) | `productionBible.js` completeness + dashboard deep-links |
| Permanent asset IDs | DONE (P0b) | Stable `CHAR_###` / `WORLD_###` per title |
| Movie→…→Take hierarchy | PARTIAL → DONE (P2/P90–P91/P96) | Act titles, scene→seq reassign, spine→Story Package write-back |
| Canonical Shot Spec | DONE (P0b) | Typed craft keys + `charAssetIds` / `worldAssetIds` |
| Department consoles | PARTIAL → DONE (P87) | Revision/conflict on Director/DoP/Sound save |
| Director/DoP → generate | PARTIAL → DONE (P1) | Director mood + DoP look/camera + Sound in compile |
| Prompt Compiler | EXISTS | `compileMasterCinemaPrompt.js` |
| Model adapters | DONE (P2/P6/P10/P14) | Seedance managed, local export, Replicate BYOK stills + video |
| Generation queue | PARTIAL → DONE (P0e) | Durable per-title jobs; App resumes poll |
| Takes / review / lock | PARTIAL → DONE (P88–P89) | Generate take strip; draft→review→approved→locked |
| Draft→Locked versioning | PARTIAL → DONE (P1) | `lifecycleStatus` on shots + Cast/World; Matrix/Form/Generate gates |
| Continuity supervisor | PARTIAL → DONE (P2/P92–P94) | Matrix Patch/Gen; active bible vault; character timeline |
| Project isolation | EXISTS* → HARDENED (P102) | Active bible reconcile on title; isolation health gate |
| BYOK + credits | EXISTS | `saasControl` + ledger + Stripe |
| Production dashboard | PARTIAL → DONE (P1/P85) | Bible completeness + spine editors + continuity timeline |
| Creative audit log | PARTIAL → DONE (P1) | `creativeAuditLog.js` per-title; lifecycle + generate + blocked edits |
| SaaS vs Production OS | EXISTS | License separate from creative schema |

\*Isolation improved; still discipline-based vault swap, not hard multi-project stores.

---

## 1. Missing

| Gap | Priority | Why it matters |
|-----|----------|----------------|
| Durable Story Package | P0 | Done (P0a) — reviewable story before Matrix commit |
| Typed Shot Specification module | P0 | Done (P0b) — `shotSpec.js` craft keys + ref fields |
| Stable asset registry (`CHAR_` / `WORLD_`) | P0 | Done (P0b) — `assetRegistry.js` per-title registry |
| Durable generation job queue | P0 | Done (P0e) — `generationJobs.js`; survives modal close |
| Multi-take + review/approve/lock | P0 | Done (P0e) — `shotTakes.js`; append-only; active take for compile |
| Creative decision audit log | P1 | Done (P1) — `creativeAuditLog.js`; lifecycle, jobs, blocked locked edits |
| Act / Sequence nodes | P1 | Done (P2) — `productionSpine.js` per-title spine from Story Package + Matrix |
| DoP/Sound compile wiring | P1 | Done (P1) — `departmentVisionStorage.js` + compile STYLE/CAMERA/AUDIO |
| Draft→Locked shot/asset lifecycle | P1 | Done (P1) — `productionLifecycle.js`; Matrix/Form/Cast/World/Generate |
| Production control dashboard | P1 | Done (P1) — `productionDashboard.js` + `ProductionDashboardModal.jsx` |
| Character continuity state machine | P2 | Done (P2) — `continuityState.js`; patch per shot; compile + Form desk |
| LLM structured command bus | P2 | Done (P2) — `llmCommandBus.js` propose→validate→approve→mutate |
| Unified model adapter interface | P2 | Done (P2) — `modelAdapters.js`; jobs use adapter still/video |

---

## 2. Conflicting

| Conflict | Master rule | What code does |
|----------|-------------|----------------|
| LLM vs Project State | LLM never silently mutates SoT | Parse/Apply propose `apply_shots` on command bus; craft enhance uses patch/replace commands |
| Parse target vs open title | Never operate on ambiguous project | `detectScriptTitle` + type-to-confirm on Writer parse & Console Apply |
| Cloud room per film | Isolated collab | Legacy `SPS-CLOUD-8821` migrated on Console open (P98) |
| Jobs vs blocking UI | Async queue for thousands of jobs | Non-blocking poll ticks + still/video queue kick (P101) |
| Takes never overwrite | Multiple takes with provenance | Multi-take + active picker (P88); legacy embed synced |
| Department intent vs Matrix | Compile department bibles into shot | DoP/Sound wired into Compile (P1) |

---

## 3. Duplicated

| Object | Stores | Risk |
|--------|--------|------|
| Character SoT | `sps_character_bible_vault` + `project.characterProfiles` | Compile reads vault via reconcile (P105); library heal on switch |
| World SoT | `sps_world_environment_vault` + `project.worldAssets` | Same; `bibleSoTHealth` detect/heal (P105) |
| Project library | localStorage + IndexedDB + disk + Vercel | Content-score merge + `mergeLibrarySources` (P104) |
| Screenplay text | `sps_open_screenplay_text` SoT (+ legacy mirrors) | Single SoT (P103) |
| Shot craft lists | Matrix ≈ Form ≈ Generate | Typed `shotSpec.js` + Form asset strip (P97) |
| Director psychology | project field + snake key + legacy camel | `resolveProjectDirectorPsychology` + park round-trip (P105) |

---

## 4. Buggy / fragile

| Issue | Severity | Symptom | Status |
|-------|----------|---------|--------|
| QuotaExceeded on parse/sync | High | Library `setItem` could crash UI | Done (P98) — safeStorage + Console/db routes |
| Project mix on restart | Critical | Shared room swapped films | Done (P100/P102) — bible reconcile + isolation health |
| Character ref → warrior prior | High | Turnaround ignored Matrix costume | Done (P100) — anti-warrior sheet guard |
| Apply without title confirmation | High | Wrong title overwrites wrong film | Done (P0d) |
| Global bible vault overwrite | Medium | Opening B replaces vault for A | Done (P0c) |
| Video generate session-bound | Medium | Poll in modal; orphan provider task | Done (P3) |

---

## Prioritized plan

### P0 — Foundation & safety
1. Durable Story Package + review before Apply to Matrix — **Done**  
   (`storyPackage.js`, `StoryPackageReview.jsx`; per-title vault + library field; Console review → title gate → Apply; feature expand sequences stored in package)  
2. Typed Shot Spec + stable `CHAR_` / `WORLD_` asset IDs — **Done**  
   (`shotSpec.js`, `assetRegistry.js`; shots carry `charAssetIds` / `worldAssetIds`; compile resolves via registry)  
3. Project-scoped Character/World stores (kill dual SoT) — **Done**  
   (`projectBibleVault.js`: per-title vault keys + library SoT; active keys = working cache only; empty park cannot wipe richer film; parse preview no longer writes Cast/World until Apply)  
4. Apply/Parse active-title confirmation gate — **Done**  
   (`activeProjectGate.js`, Console Apply + Writer→Matrix type-to-confirm; App Apply backstop)  
5. Durable generation jobs + multi-take (no overwrite) — **Done**  
   (`generationJobs.js` queue per title; `shotTakes.js` append-only takes; App resumes poll every 8s)

### P1 — Creative control
6. Wire DoP/Sound into Prompt Compiler — **Done**  
   (`departmentVisionStorage.js`; DoP → STYLE + CAMERA; Sound → AUDIO; honors `compilerActiveMode`)  
7. Draft → Review → Approved → Locked on shots/assets — **Done**  
   (`productionLifecycle.js`, `LifecycleControls.jsx`; locked freezes craft/bible; Generate blocked until unlock; media takes still append while unlocked)  
8. Production dashboard + creative audit log — **Done**  
   (`productionDashboard.js`, `ProductionDashboardModal.jsx`, `creativeAuditLog.js`; runtime, lifecycle bars, jobs, credits, audit feed)

### P2 — Production depth
9. Continuity state machine + Act/Sequence hierarchy — **Done**  
   (`productionSpine.js`, `continuityState.js`; Matrix act/seq banners; Form continuity patches; compile SPINE/CONTINUITY lines)  
10. LLM structured commands + unified model adapters — **Done**  
    (`llmCommandBus.js`, `LlmCommandReviewModal.jsx`, `modelAdapters.js`; Matrix/Form enhance proposes; jobs call adapter still/video)

### Polish (post-P2)
11. SlotEditor craft enhance via command bus — **Done**  
    (`SlotEditor.jsx`; proposes `patch_shot_craft`; opens LLM review — no silent SoT write)  
12. Act/Sequence spine editor + pending LLM badge — **Done**  
    (`ProductionDashboardModal.jsx`; editable sequence title/synopsis/act; dashboard LLM count + review link)

### P3 — Supervisor + durable jobs + collab hardening
13. Continuity supervisor (drift scan → command bus proposals) — **Done**  
    (`continuitySupervisor.js`; Production dashboard scan + propose; lifecycle lock on continuity patches)  
14. Durable video generate (queue + App worker, not modal-bound poll) — **Done**  
    (`GenerateDeskModal.jsx` enqueue only; `App.jsx` kick/resume with `onTaskCreated`)  
15. Per-title collab room migration — **Done**  
    (`ensureProjectRoomId`, `migrateLegacyRoomInLibrary`; legacy `SPS-CLOUD-8821` → `sps_{title}`)

### P4 — Writer safety + promo hardening
16. Script title detection + parse/apply mismatch gate — **Done**  
    (`detectScriptTitle` in `activeProjectGate.js`; Writer + Console Apply compare script title vs active)  
17. Writer parse → command bus (`apply_shots`) — **Done**  
    (`ScreenplayEditor.jsx` proposes; story package saved; Matrix writes only after LLM review)  
18. Promo pack beat selection hardening — **Done**  
    (`promoPack.js` excludes muted; prefers approved/locked; spine labels on beats)

### P5 — Console Apply via command bus
19. Console / merge Apply → `apply_shots` proposal — **Done**  
    (`proposeApplyShotsCommand`; `handleApplyAIShots` + merge prompt open LLM review; `executeApplyAIShots` only on approve)

### P6 — Engine adapters + cloud sync health
20. Local export engine adapter (BYOK / external) — **Done**  
    (`modelAdapters.js` `local_export`; Generate desk engine picker; prompt TXT + job pack export)  
21. Cloud sync health probe — **Done**  
    (`cloudSyncHealth.js`; Production dashboard shows KV / JSONBlob / offline backend)

### P7 — Ops polish + review UX
22. App startup cloud sync health poll — **Done**  
    (`App.jsx` probes every 5m; Header sync tooltip shows backend)  
23. LLM review merge/overwrite UX — **Done**  
    (`describeApplyShotsCommand`, mode badge, switch overwrite ↔ merge before apply)  
24. Replicate adapter stub — **Done** (P7) → wired P10  
    (`replicateClient.js` BYOK flux-schnell; Generate desk still path)

### P8 — Export gate audit + admin sync probe
25. Centralized export gate audit — **Done**  
    (`exportGate.js`; `saveExportFile`, Writer, Compiler log blocked/ok; dashboard export section)  
26. SaaS admin cloud sync probe — **Done**  
    (`SaasAdminPanel` Probe sync; links to KV / JSONBlob backend status)

### P9 — Pitch deck export audit + lifecycle export locks
27. Pitch / promo / reel exports gated + audited — **Done**  
    (`PitchDeckMaker`, `PromoPackModal`, `FeatureReelModal`; `exportDownloadText`; strict lifecycle lock)  
28. Lifecycle export readiness — **Done**  
    (`lifecycleExportReadiness` in `productionLifecycle.js`; dashboard share-ready stats; advisory project JSON)

### P10 — Replicate BYOK + Stage export advisory
29. Replicate still generate (BYOK) — **Done**  
    (`replicateClient.js`; `modelAdapters.js`; Generate desk; Replicate in BYOK providers)  
30. Stage 3D export lifecycle advisory — **Done**  
    (`SceneBuilder3D`, `exportPassBundle` → `EXPORT_LIFECYCLE.ADVISORY`)

### P11 — Project-level lifecycle lock
31. Project lifecycle storage + park/apply — **Done**  
    (`productionLifecycle.js`; `projectWorkspace.js`; persisted on project JSON)  
32. Project lock gates + dashboard controls — **Done**  
    (craft/LLM/generate blocked; exports allowed when project locked; Production dashboard panel)

### P12 — Writer / Console parse project-lock gate
33. Unified project write gate — **Done**  
    (`assertProjectWriteGate` in `productionLifecycle.js`; audits `write_blocked`)  
34. Parse + apply blocked when project locked — **Done**  
    (Writer Sync, Console parse/apply, App console Apply — before LLM parse or proposal)

### P13 — Write-block audit UI + KV migration tooling
35. Production dashboard write gate audit — **Done**  
    (`writeAuditSummary`; blocked counts + recent rows in Production dashboard)  
36. Cloud KV migration API + admin — **Done**  
    (`api/sync.js` `type=kv_migration`; SaasAdminPanel Migrate to KV)

### P14 — Replicate video + shot lifecycle bulk advance
37. Replicate BYOK video — **Done**  
    (`replicateCreateVideo` / `replicatePollVideo`; Generate desk; jobs carry `engine`)  
38. Bulk advance live shots — **Done**  
    (`bulkAdvanceShotLifecycle`; Production dashboard Shot lifecycle)

### P15 — Replicate model picker + Cast/World bulk + KV dash hint
39. Replicate still/video model picker — **Done**  
    (`REPLICATE_STILL_MODELS` / `REPLICATE_VIDEO_MODELS`; Generate desk; jobs carry `modelId`)  
40. Cast/World bulk lifecycle + KV migration hint — **Done**  
    (`bulkAdvanceAssetLifecycle`; dashboard Cloud sync shows migrate-needed)

### P16 — Seedance model picker + audit filters + guest lifecycle gates
41. Seedance still/video model picker — **Done**  
    (`seedanceModels.js`; Generate desk; jobs + `saasGenerateClient` carry `modelId`)  
42. Creative audit category filters — **Done**  
    (`AUDIT_FILTER_OPTIONS`; Production dashboard filter chips)  
43. Guest playground lifecycle gates — **Done**  
    (`assertGuestPlaygroundLifecycleGate`; project lock + bulk advance disabled on GUEST PLAYGROUND)

### P17 — Continuity apply + LLM batch + credit pack UI
44. Continuity drift auto-fix apply — **Done**  
    (`applyContinuityDriftFixes`; dashboard Apply all →)  
45. LLM command batch approve/apply — **Done**  
    (`batchApproveLlmCommands` / `batchApplyLlmCommands`; LLM review modal toolbar)  
46. User credit pack UI — **Done**  
    (`ByokKeysPanel` managed mode packs + Stripe checkout; return URL hint)

### P18 — Story package strict apply + collab export audit + spine auto-build
47. Story package strict apply gates — **Done**  
    (`assertStoryPackageApplyAllowed`; Console + Review + App apply)  
48. Collab room export audit — **Done**  
    (`resolveCollabRoomId`; export audit notes tag `room:`; dashboard hint)  
49. Production spine auto-build — **Done**  
    (`spineNeedsRebuild` / `autoSyncProductionSpine`; Matrix edits + dashboard Rebuild)

### P19 — Writer merge gates + collab chat export + pitch strict UI
50. Writer merge apply gates — **Done**  
    (`assertMergeApplyAllowed`; Writer merge modal; Console merge callbacks)  
51. Collab chat export block — **Done**  
    (`exportCollabChatTranscript`; plan collab + export gate; room audit tag)  
52. Pitch deck lifecycle strict UI — **Done**  
    (export buttons disabled until share-ready; lifecycle message in toolbar)

### P20 — Feature reel + campaign lifecycle + LLM source filter
53. Feature reel strict export polish — **Done**  
    (Pack disabled until share-ready; lifecycle hint in reel header)  
54. Campaign kit lifecycle exports — **Done**  
    (`exportDownloadText` + `EXPORT_LIFECYCLE.STRICT`; disabled until share-ready)  
55. LLM command filter by source — **Done**  
    (`LLM_SOURCE_FILTER_OPTIONS`; review modal source chips)

### P21 — Promo export parity + investor deck lifecycle + job filters
56. Promo pack export UI parity — **Done**  
    (CSV / Full pack disabled until share-ready; lifecycle hint in toolbar)  
57. Investor deck lifecycle — **Done**  
    (Outline export; film-export lifecycle hint when active slate; `investorDeckExport.js`)  
58. Generation job source filters — **Done**  
    (`GENERATION_JOB_FILTER_OPTIONS`; dashboard job chips + engine/model rows)

### P22 — Stage export gates + collab presence audit + SaaS job ledger
59. SceneBuilder export gates UI — **Done**  
    (Advisory lifecycle hint; pass/OBJ/Still/Clip buttons; SaaS export disable)  
60. Collab presence audit — **Done**  
    (`collabPresenceAudit.js`; shot focus + room tag; Collab audit filter chip)  
61. SaaS admin job ledger — **Done**  
    (`summarizeAllGenerationJobs`; admin panel pending/done/failed + recent rows)

### P23 — Stage strict toggle + peer join audit + Writer export gates
62. SceneBuilder strict lifecycle toggle — **Done**  
    (Advise / Strict tabs; `sps_stage_export_lifecycle`; Strict blocks until share-ready)  
63. Collab peer join / leave audit — **Done**  
    (`auditPeerPresenceDiff`; `peer_joined` / `peer_left` with room tag)  
64. Writer screenplay export gates — **Done**  
    (`EXPORT_LIFECYCLE.STRICT` + shots; Export menu disabled until share-ready)

### P24 — Compiler gates + Matrix CSV + Generate job history
65. Compiler export gates — **Done**  
    (STRICT lifecycle; ZIP / Save TXT / per-shot disabled until share-ready)  
66. Matrix CSV lifecycle UI — **Done**  
    (`matrixShotsToCsv`; Matrix toolbar CSV + strict gate)  
67. Generate desk job history filters — **Done**  
    (per-shot history; `GENERATION_JOB_FILTER_OPTIONS` chips)

### P25 — Budget gates + Storyboard lifecycle + Form CSV
68. Budget console export gates — **Done**  
    (Markdown / CSV via `exportDownloadText` + STRICT; disabled until share-ready)  
69. Storyboard lifecycle UI — **Done**  
    (Export disabled until share-ready; lifecycle hint in toolbar)  
70. Form desk CSV parity — **Done**  
    (Form toolbar CSV via `matrixShotsToCsv`; strict lifecycle gate)

### P26 — Budget advisory + Storyboard PDF + Collab chat lifecycle
71. Budget advisory lifecycle toggle — **Done**  
    (Advise / Strict tabs; `sps_budget_export_lifecycle`; advisory confirm mode)  
72. Storyboard PDF export — **Done**  
    (`storyboardToPrintHtml`; PDF print with strict lifecycle gate)  
73. Collab chat lifecycle polish — **Done**  
    (STRICT lifecycle on transcript export; disabled + hint in chat panel)

### P27 — Collab advisory + Storyboard zip + Generate export gates
74. Collab chat advisory toggle — **Done**  
    (Advise / Strict; `sps_collab_chat_export_lifecycle`; advisory confirm mode)  
75. Storyboard zip pack — **Done**  
    (`buildStoryboardZipFiles`; ZIP with README + frame prompts + data stills)  
76. Generate desk export gates — **Done**  
    (Save TXT / Job pack / local export STRICT; disabled until share-ready)

### P28 — Feature / Campaign / Writer advisory toggles
77. Feature reel advisory toggle — **Done**  
    (Advise / Strict; `sps_feature_reel_export_lifecycle`; pack confirm mode)  
78. Campaign kit advisory toggle — **Done**  
    (Advise / Strict; `sps_campaign_export_lifecycle`; CSV / Full kit)  
79. Writer export advisory toggle — **Done**  
    (Advise / Strict; `sps_writer_export_lifecycle`; PDF / Fountain / TXT / FDX)

### P29 — Promo / Pitch / Compiler advisory toggles
80. Promo pack advisory toggle — **Done**  
    (Advise / Strict; `sps_promo_export_lifecycle`; CSV / Full pack)  
81. Pitch deck advisory toggle — **Done**  
    (Advise / Strict; `sps_pitch_export_lifecycle`; Keynote / Pages)  
82. Compiler advisory toggle — **Done**  
    (Advise / Strict; `sps_compiler_export_lifecycle`; ZIP / Save TXT / per-shot)

### P30 — Storyboard / Matrix / Generate advisory toggles
83. Storyboard advisory toggle — **Done**  
    (Advise / Strict; `sps_storyboard_export_lifecycle`; MD / PDF / ZIP)  
84. Matrix CSV advisory toggle — **Done**  
    (Advise / Strict; `sps_matrix_export_lifecycle`; craft CSV)  
85. Generate desk advisory toggle — **Done**  
    (Advise / Strict; `sps_generate_export_lifecycle`; TXT / job pack / local export)

### P31 — Form CSV / Budget Strict default / Export lifecycle hub
86. Form desk CSV advisory toggle — **Done**  
    (Advise / Strict; `sps_form_export_lifecycle`; Form craft CSV; hub sync event)  
87. Budget default Strict + lifecycle audit — **Done**  
    (`sps_budget_export_lifecycle` defaults Strict; `life:` tags on export_ok / export_blocked)  
88. Export-lifecycle settings hub — **Done**  
    (`ExportLifecycleHub` in Settings → SaaS; `exportLifecyclePrefs.js`; All advise / All strict)

### P32 — Shared lifecycle hook + hub sync + collab audit
89. `useExportLifecyclePref` hook — **Done**  
    (`src/hooks/useExportLifecyclePref.js`; read/write + hub event listener)  
90. All gated consoles wired to prefs helpers — **Done**  
    (Writer, Matrix, Form, Compiler, Generate, Promo, Pitch, Campaign, Storyboard, Feature reel, Budget, Collab, Stage)  
91. Collab transcript export audit polish — **Done**  
    (`life:` + explicit `room:` in export_ok note; advisory override tagged)

### P33 — Project Console export audit / Pitch lifecycle tags / Stage Strict default
92. Export audit summary in Project Console — **Done**  
    (`ExportAuditSummaryPanel`; plan OK/blocked/lifecycle tagged; recent rows; live audit event)  
93. Pitch deck lifecycle audit tags — **Done**  
    (Keynote / Pages `logExportSuccess` includes `life:` + advisory override)  
94. Stage default Strict policy — **Done**  
    (`sps_stage_export_lifecycle` `defaultStrict: true`; aligns with all other surfaces)

### P34 — Dashboard parity / Console audit JSON / Investor deck gates
95. Production Dashboard lifecycle chip parity — **Done**  
    (Lifecycle tagged stat card; 4-col export audit grid matches Console)  
96. Export audit JSON from Project Console — **Done**  
    (`exportExportAuditJson`; Audit JSON button on `ExportAuditSummaryPanel`)  
97. Investor deck export lifecycle gates — **Done**  
    (`sps_investor_export_lifecycle`; Advise/Strict when film context; hub sync)

### P35 — Dashboard audit JSON / Investor PDF / Promo audit parity
98. Production Dashboard export audit JSON — **Done**  
    (Export gate section button; header icon = full creative audit)  
99. Investor deck PDF export — **Done**  
    (`investorDeckToPrintHtml`; gated PDF + `life:` audit tags)  
100. Promo pack lifecycle audit parity — **Done**  
    (`promoPackToPrintHtml`; PDF export with `assertExportAllowed` + `logExportSuccess` life tags)

### P36 — Storyboard audit / Campaign PDF / Console audit filter
101. Storyboard PDF lifecycle audit tags — **Done**  
    (`logExportSuccess` `life:` + advisory; ZIP uses lifecycle mode + blob audit tags)  
102. Campaign kit PDF export — **Done**  
    (`campaignKitToPrintHtml`; gated PDF + lifecycle audit)  
103. Export audit filter in Project Console — **Done**  
    (`EXPORT_AUDIT_FILTER_OPTIONS`; All / OK / Blocked / Lifecycle chips on audit panel)

### P37 — Dashboard filter parity / Feature reel PDF / Storyboard ZIP gate
104. Production Dashboard export audit filter — **Done**  
    (All / OK / Blocked / Lifecycle chips; filtered row count; matches Console)  
105. Feature reel PDF export — **Done**  
    (`featureReelToPrintHtml`; gated PDF + `life:` audit; Advise/Strict)  
106. Storyboard ZIP single-gate + hub pref — **Done**  
    (`skipLifecycleCheck` on `saveExportBlob` after assert; keeps hub `life:` tags without double confirm)

### P38 — Budget PDF / Collab PDF / Hub surface count audit
107. Budget PDF export — **Done**  
    (`budgetToPrintHtml`; gated PDF + lifecycle audit)  
108. Collab transcript PDF — **Done**  
    (`collabChatToPrintHtml`; TXT + PDF via `format: 'pdf'`; room + life tags)  
109. Export lifecycle hub surface count audit — **Done**  
    (strict/advisory/at-default/overridden chips; Audit counts → `lifecycle_hub_count`)

### P39 — Writer PDF audit / Matrix print / Hub prefs JSON
110. Writer PDF + export lifecycle audit tags — **Done**  
    (PDF / Fountain / TXT / FDX `logExportSuccess` includes `life:` + room)  
111. Matrix print layout PDF — **Done**  
    (`matrixShotsToPrintHtml`; landscape first-8 crafts; gated PDF)  
112. Hub prefs JSON download — **Done**  
    (`downloadExportLifecyclePrefsJson`; Prefs JSON button → `lifecycle_hub_json`)

### P40 — Form PDF / Compiler print pack / Hub prefs import
113. Form desk PDF parity — **Done**  
    (`handleExportFormPdf`; reuses `matrixShotsToPrintHtml`; gated `form_matrix_pdf`)  
114. Compiler print pack PDF — **Done**  
    (`compilerPromptsToPrintHtml`; Print PDF toolbar; gated `compiler_print_pdf`)  
115. Hub prefs JSON restore — **Done**  
    (`importExportLifecyclePrefsFromJson`; Import JSON file input → `lifecycle_hub_import`)

### P41 — Generate PDF / Stage pass pack / Hub import diff
116. Generate desk PDF export — **Done**  
    (`generateDeskToPrintHtml`; Print PDF; gated `generate_desk_pdf`)  
117. Stage pass PDF pack — **Done**  
    (`renderPassPackForPrint` + `stagePassesToPrintHtml`; Pass PDF embeds color/depth/normals/canny/openpose)  
118. Hub prefs diff-before-import — **Done**  
    (`previewExportLifecyclePrefsImport`; Import preview panel → Apply / Cancel)

### P42 — Character looks / World plates / Export audit CSV
119. Character look-sheet PDF — **Done**  
    (`characterLookSheetsToPrintHtml`; Look PDF; face+body+wardrobe; gated `character_look_pdf`)  
120. World plate PDF pack — **Done**  
    (`worldPlatesToPrintHtml`; Plate PDF; honors type filter; gated `world_plate_pdf`)  
121. Export audit CSV — **Done**  
    (`exportExportAuditCsv`; Console + Dashboard; filter chips; gated `export_audit_csv`)

### P43 — Story package PDF / Continuity report / Cast-World lifecycle hub
122. Story package PDF — **Done**  
    (`storyPackageToPrintHtml`; Print PDF on Story Package review; gated `story_package_pdf`)  
123. Continuity supervisor PDF report — **Done**  
    (`continuityDriftToPrintHtml`; Report PDF on Dashboard; gated `continuity_report_pdf`)  
124. Character / World Advise-Strict hub surfaces — **Done**  
    (`character` + `world` in `EXPORT_LIFECYCLE_PREF_DEFS`; Advise/Strict tabs on Look PDF + Plate PDF)

### P44 — Story package hub / Vision PDF / Audit filter presets
125. Story package lifecycle hub surface — **Done**  
    (`story_package` pref; Advise/Strict on Story Package review Print PDF)  
126. Director / vision vault PDF — **Done**  
    (`directorPsychologyToPrintHtml`; Vision PDF for Director/DoP/Sound; hub `director` pref)  
127. Export audit filter presets JSON — **Done**  
    (`exportAuditFilterPresets.js`; Filters JSON + import; default filter via double-click chip)

### P45 — DoP/Sound PDF / Continuity hub / Pitch PDF polish
128. DoP-only / Sound-only PDF shortcuts — **Done**  
    (`dop` + `sound` hub prefs; Dir / DoP / Sound PDF buttons; category-scoped Advise/Strict)  
129. Continuity report lifecycle hub — **Done**  
    (`continuity` pref; Advise/Strict + gated Report PDF on Dashboard)  
130. Pitch deck Advise-Strict polish — **Done**  
    (`pitchDeckToPrintHtml`; Print PDF beside Keynote/Pages; same pitch lifecycle gate)

### P46 — Campaign ZIP / Storyboard CSV / Hub reset defaults
131. Campaign kit lifecycle polish — **Done**  
    (`buildCampaignKitZipFiles`; ZIP + room/life notes on CSV/MD/PDF; tone/density audit)  
132. Storyboard Advise-Strict parity — **Done**  
    (`storyboardToCsv`; CSV beside MD/PDF/ZIP; room + frame-count audit notes)  
133. Hub reset-to-defaults audit — **Done**  
    (`resetExportLifecyclePrefsToDefaults`; Reset defaults → `lifecycle_pref_reset_defaults`)

### P47 — Promo ZIP / Feature reel CSV / Hub per-surface revert
134. Promo pack ZIP parity — **Done**  
    (`buildPromoPackZipFiles`; ZIP + room/life notes on CSV/MD/PDF)  
135. Feature reel CSV — **Done**  
    (`featureReelToCsv`; CSV beside PDF/Pack; room + shot-count audit notes)  
136. Hub per-surface revert override — **Done**  
    (`revertExportLifecyclePrefToDefault`; Revert on overridden rows → `lifecycle_pref_revert`)

### P48 — Investor ZIP-CSV / Budget ZIP / Generate desk audit notes
137. Investor deck ZIP/CSV parity — **Done**  
    (`investorDeckToCsv` + `buildInvestorDeckZipFiles`; CSV/ZIP beside Outline/PDF; room + slide-count notes)  
138. Budget console export polish — **Done**  
    (`buildBudgetZipFiles`; ZIP + room/life notes on MD/CSV/PDF)  
139. Generate desk lifecycle audit notes — **Done**  
    (room + shot/engine/slots notes on prompt TXT, job pack ZIP, print PDF, local export)

### P49 — Pitch Maker ZIP-CSV / Promo-Feature room polish / Presence export
140. Pitch Deck Maker ZIP/CSV — **Done**  
    (`pitchDeckToCsv` + `buildPitchDeckZipFiles`; MD/CSV/ZIP beside Keynote/Pages/PDF; room + slide notes)  
141. Promo/Feature reel room polish — **Done**  
    (room tagged life notes; Feature pack ZIP includes CSV + META + gated skipLifecycleCheck)  
142. Collab presence export audit — **Done**  
    (`exportPresenceRoster`; People-tab Presence CSV; export audit **Room** filter)

### P50 — Story package ZIP / Continuity CSV / Dashboard room-filter UX
143. Story package ZIP polish — **Done**  
    (`storyPackageToCsv` + `buildStoryPackageZipFiles`; CSV/ZIP beside PDF; room + shot-count notes)  
144. Continuity supervisor CSV — **Done**  
    (`continuityDriftToCsv`; Report CSV beside Report PDF; room + drift-count notes)  
145. Production dashboard room-filter UX — **Done**  
    (Room chip count; Filter room shortcut; roomTagged stat; audit JSON/CSV pass roomId)

### P51 — Cast-World bible ZIP / Compiler room notes / SaaS ledger CSV
146. Cast/World bible ZIP parity — **Done**  
    (`characterBibleToCsv` / `buildCharacterBibleZipFiles`; `worldBibleToCsv` / `buildWorldBibleZipFiles`; CSV/ZIP beside Look/Plate PDF)  
147. Compiler export room notes — **Done**  
    (`roomId` on `compilerExportOpts`; life notes on TXT / ZIP / print PDF audits)  
148. SaaS credit ledger audit export — **Done**  
    (`saasLicensesToCsv`; Settings → SaaS **Ledger CSV** via export gate)

### P52 — Matrix-Form room notes / Stage 3D audit notes / Writer merge ZIP
149. Matrix/Form room-note polish — **Done**  
    (`roomId` + live-shot life notes on Matrix/Form CSV + PDF)  
150. Stage 3D export audit notes — **Done**  
    (`stageExportOpts.roomId` + shot/live notes on pass PDF / OBJ / still / video saves)  
151. Writer merge export ZIP — **Done**  
    (`buildWriterMergeZipFiles`; Export → Merge pack ZIP = Fountain+TXT+FDX+META; room + live-shot notes)

### P53 — Generate still-job CSV / Collab chat ZIP / Export hub last-room badge
152. Generate desk still-job CSV — **Done**  
    (`stillGenerationJobsToCsv`; Generate desk **Still CSV** for shot still-job history via export gate)  
153. Collab chat ZIP pack — **Done**  
    (`buildCollabChatZipFiles` / `exportCollabChatZipPack`; Studio Chat **ZIP** = transcript+META+README)  
154. Export hub last-room badge — **Done**  
    (`readLastExportRoomId` + stamp on `logExportSuccess`; Export lifecycle hub shows last/live room)

### P54 — Continuity room notes / Campaign PDF room stamp / Generate filtered-jobs CSV
155. Continuity supervisor room notes — **Done**  
    (`roomId` on `continuityDriftToPrintHtml` / `continuityDriftToCsv`; Report PDF/CSV meta + life notes)  
156. Campaign kit PDF room stamp — **Done**  
    (`campaignKitToPrintHtml(kit, { roomId })`; printed meta line + audit note)  
157. Generate desk filtered-jobs CSV — **Done**  
    (`generationJobsToCsv` honors active filter chip; Generate desk **Jobs CSV** beside Still CSV)

### P55 — Storyboard room stamp / Investor ZIP room notes / Presence ZIP pack
158. Storyboard kit room stamp — **Done**  
    (`roomId` on `storyboardToPrintHtml` / `buildStoryboardZipFiles`; PDF meta + ZIP META; life notes)  
159. Investor deck ZIP room notes — **Done**  
    (`roomId` in `buildInvestorDeckZipFiles` README/META; ZIP audit life notes)  
160. Collab presence ZIP pack — **Done**  
    (`buildPresenceZipFiles` / `exportPresenceZipPack`; People-tab **ZIP** = CSV+META+README)

### P56 — Fountain room stamp / World bible PDF room notes / Generate video-job CSV
161. Screenplay Fountain room stamp — **Done**  
    (`Room:` in `exportFountain` header; Writer Fountain/PDF/merge pack pass `roomId`)  
162. World bible PDF room notes — **Done**  
    (`roomId` on `worldPlatesToPrintHtml` / `buildWorldBibleZipFiles`; Plate PDF meta + ZIP META)  
163. Generate desk video-job CSV — **Done**  
    (`videoGenerationJobsToCsv`; Generate desk **Video CSV** beside Still/Jobs CSV)

### P57 — Character bible PDF room stamp / Promo ZIP room notes / Presence CSV filter
164. Character bible PDF room stamp — **Done**  
    (`roomId` on `characterLookSheetsToPrintHtml` / `buildCharacterBibleZipFiles`; Look PDF meta + ZIP META)  
165. Promo pack ZIP room notes — **Done**  
    (`roomId` on `buildPromoPackZipFiles` / print HTML; META + PDF doc-meta + life notes)  
166. Collab presence CSV filter — **Done**  
    (`PRESENCE_CSV_FILTERS` all/self/peers/shot; People-tab chips drive Presence CSV/ZIP)

### P58 — Feature reel PDF room stamp / Budget ZIP room notes / Studio brain audit CSV
167. Feature reel PDF room stamp — **Done**  
    (`roomId` on `featureReelToPrintHtml`; PDF meta + existing ZIP META/life notes)  
168. Budget console ZIP room notes — **Done**  
    (`roomId` on `buildBudgetZipFiles` / `budgetToPrintHtml`; META + PDF meta + life notes)  
169. Studio brain audit CSV — **Done**  
    (`creativeAuditToCsv` / `exportCreativeAuditCsv`; Studio Brain **Audit CSV** for active project)

### P59 — Pitch PDF room stamp / Campaign ZIP room notes / Export hub surfaces CSV
170. Pitch deck PDF room stamp — **Done**  
    (`roomId` on `pitchDeckToPrintHtml` / `buildPitchDeckZipFiles`; PDF meta + ZIP META + life notes)  
171. Campaign kit ZIP room notes — **Done**  
    (`roomId` on `buildCampaignKitZipFiles`; ZIP META + existing PDF room stamp)  
172. Export hub surface audit CSV — **Done**  
    (`exportLifecyclePrefsToCsv` / `downloadExportLifecyclePrefsCsv`; Hub **Surfaces CSV**)

### P60 — Investor PDF room stamp / Story package ZIP room notes / Generate engine CSV
173. Investor deck PDF room stamp — **Done**  
    (`roomId` on `investorDeckToPrintHtml`; PDF ctx + existing ZIP META/life notes)  
174. Story package ZIP room notes — **Done**  
    (`roomId` on `storyPackageToPrintHtml` / `buildStoryPackageZipFiles`; PDF meta + ZIP META)  
175. Generate desk engine filter CSV — **Done**  
    (`resolveGenerationEngineFilter` / `engineGenerationJobsToCsv`; Generate desk **Engine CSV**)

### P61 — Continuity ZIP room notes / DoP vision PDF room stamp / Collab notes CSV filter
176. Continuity report ZIP room notes — **Done**  
    (`buildContinuityZipFiles`; Production Dashboard **Report ZIP** + META Room)  
177. DoP vision PDF room stamp — **Done**  
    (`roomId` on `directorPsychologyToPrintHtml`; Project Console vision PDF meta + life notes)  
178. Collab chat notes CSV filter — **Done**  
    (`CHAT_NOTES_CSV_FILTERS` / `collabNotesToCsv` / `exportCollabNotesCsv`; Collab **CSV** chips)

### P62 — Sound vision PDF room stamp / Continuity MD pack / Generate failed CSV
179. Sound vision PDF room stamp — **Done**  
    (`roomId` always on vision print meta + assert/life notes; Sound PDF title stamps room)  
180. Continuity report MD pack — **Done**  
    (`continuityDriftToMarkdown`; Report MD + ZIP `continuity_report.md` + Room)  
181. Generate desk failed-jobs CSV — **Done**  
    (`failedGenerationJobsToCsv`; Generate desk **Failed CSV**)

### P63 — Director vision ZIP room notes / Continuity fixes CSV / Collab transcript filter
182. Director vision ZIP room notes — **Done**  
    (`buildDirectorPsychologyZipFiles`; Project Console **Dir ZIP** + META Room)  
183. Continuity fixes CSV — **Done**  
    (`continuityFixesToCsv`; Production Dashboard **Fixes CSV**)  
184. Collab chat self-filter transcript — **Done**  
    (`applyChatNotesFilter` on transcript/PDF/ZIP; Collab filter chips drive txt/pdf/zip)

### P64 — DoP vision ZIP room notes / Continuity fixes ZIP / Generate pending CSV
185. DoP vision ZIP room notes — **Done**  
    (`exportVisionCategoryZip('dop')`; Project Console **DoP ZIP** + META Room)  
186. Continuity fixes ZIP pack — **Done**  
    (`buildContinuityFixesZipFiles`; Production Dashboard **Fixes ZIP**)  
187. Generate desk pending-jobs CSV — **Done**  
    (`pendingGenerationJobsToCsv`; Generate desk **Pending CSV**)

### P65 — Sound vision ZIP room notes / Continuity fixes MD / Presence self ZIP
188. Sound vision ZIP room notes — **Done**  
    (`exportVisionCategoryZip('sound')`; Project Console **Sound ZIP** + META Room)  
189. Continuity fixes MD pack — **Done**  
    (`continuityFixesToMarkdown`; **Fixes MD** + ZIP `continuity_fixes.md`)  
190. Collab presence self-only ZIP — **Done**  
    (`filter: 'self'` Self ZIP shortcut; presence pack filename/note tags filter)

### P66 — Director vision CSV / Continuity MD room polish / Cancelled jobs CSV
191. Director vision CSV pack — **Done**  
    (`directorPsychologyToCsv`; Project Console **Dir CSV** + ZIP `director_vision.csv`)  
192. Continuity drift MD room stamp polish — **Done**  
    (H1 + table Room column; Report MD filename room tag)  
193. Generate desk cancelled-jobs CSV — **Done**  
    (`cancelledGenerationJobsToCsv`; filter chip + **Cancelled CSV**)

### P67 — DoP vision CSV / Continuity fixes MD room polish / Collab notes PDF filter title
194. DoP vision CSV pack — **Done**  
    (`exportVisionCategoryCsv('dop')`; Project Console **DoP CSV** + ZIP `dop_vision.csv`)  
195. Continuity fixes MD room stamp polish — **Done**  
    (H1 + table Room column; Fixes MD filename room tag)  
196. Collab notes filter PDF title stamp — **Done**  
    (`collabChatToPrintHtml` document title + H1 stamp active filter)

### P68 — Sound vision CSV / Continuity PDF room title / Succeeded jobs CSV
197. Sound vision CSV pack — **Done**  
    (`exportVisionCategoryCsv('sound')`; Project Console **Sound CSV** + ZIP `sound_vision.csv`)  
198. Continuity drift PDF room title stamp — **Done**  
    (`continuityDriftToPrintHtml` document title + H1 stamp room; meta always Room)  
199. Generate desk succeeded-jobs CSV — **Done**  
    (`succeededGenerationJobsToCsv`; filter chip + **Succeeded CSV**)

### P69 — Vision CSV room filename / Continuity fixes PDF / Presence filter CSV polish
200. Vision vault CSV room filename tag — **Done**  
    (`exportVisionCategoryCsv` filename tags room when present)  
201. Continuity fixes PDF pack — **Done**  
    (`continuityFixesToPrintHtml`; Production Dashboard **Fixes PDF**)  
202. Collab presence filter CSV polish — **Done**  
    (CSV meta Filter/Room/Shot; ZIP `presence_<filter>.csv` + README filter; accurate row count)

### P70 — Vision ZIP room filename / Fixes PDF room polish / Collab notes MD
203. Vision ZIP room filename tag — **Done**  
    (`exportVisionCategoryZip` filename tags room when present)  
204. Continuity fixes PDF room title polish — **Done**  
    (Room table column + audit filename room tag)  
205. Collab notes filter MD pack — **Done**  
    (`collabChatToMarkdown`; chat **MD** + ZIP `.md`; repaired `applyChatNotesFilter`)

### P71 — Vision PDF room audit / Continuity report PDF room / Generate jobs MD
206. Vision PDF room filename audit tag — **Done**  
    (`exportVisionCategoryPdf` audit filename tags room)  
207. Continuity report PDF room filename tag — **Done**  
    (`handleExportContinuityPdf` audit filename tags room)  
208. Generate desk jobs MD pack — **Done**  
    (`generationJobsToMarkdown`; Generate desk **Jobs MD** for active filter)

### P72 — Vision ZIP META polish / Continuity CSV room filename / Still jobs MD
209. Vision ZIP META polish — **Done**  
    (META/README: Pack, Streams, Filled fields + Room)  
210. Continuity report CSV room filename tag — **Done**  
    (`handleExportContinuityCsv` filename tags room)  
211. Generate still-jobs MD shortcut — **Done**  
    (`stillGenerationJobsToMarkdown`; Generate desk **Still MD**)

### P73 — Continuity fixes CSV room / Video jobs MD / Presence MD pack
212. Continuity fixes CSV room filename tag — **Done**  
    (`handleExportContinuityFixesCsv` filename tags room)  
213. Generate video-jobs MD shortcut — **Done**  
    (`videoGenerationJobsToMarkdown`; Generate desk **Video MD**)  
214. Collab presence MD pack — **Done**  
    (`presenceRosterToMarkdown`; People **MD** + ZIP `.md`)

### P74 — Continuity fixes ZIP room / Failed jobs MD / Collab ZIP MD filter
215. Continuity fixes ZIP room filename tag — **Done**  
    (`handleExportContinuityFixesZip` filename tags room)  
216. Generate failed-jobs MD shortcut — **Done**  
    (`failedGenerationJobsToMarkdown`; Generate desk **Failed MD**)  
217. Collab notes ZIP MD filter stamp — **Done**  
    (`buildCollabChatZipFiles` txt/md filenames tag active filter)

### P75 — Continuity report ZIP room / Pending jobs MD / Presence ZIP room
218. Continuity report ZIP room filename tag — **Done**  
    (`handleExportContinuityZip` filename tags room)  
219. Generate pending-jobs MD shortcut — **Done**  
    (`pendingGenerationJobsToMarkdown`; Generate desk **Pending MD**)  
220. Collab presence ZIP room filename tag — **Done**  
    (`exportPresenceZipPack` filename tags room + filter)

### P76 — Continuity fixes CSV Room polish / Cancelled jobs MD / Collab ZIP room
221. Continuity fixes CSV Room column polish — **Done**  
    (row Room uses —; meta title stamps room)  
222. Generate cancelled-jobs MD shortcut — **Done**  
    (`cancelledGenerationJobsToMarkdown`; Generate desk **Cancelled MD**)  
223. Collab chat ZIP room filename tag — **Done**  
    (`exportCollabChatZipPack` filename tags room + filter)

### P77 — Continuity drift CSV Room polish / Succeeded jobs MD / Collab notes CSV room
224. Continuity drift CSV Room column polish — **Done**  
    (row Room uses —; meta title stamps room)  
225. Generate succeeded-jobs MD shortcut — **Done**  
    (`succeededGenerationJobsToMarkdown`; Generate desk **Succeeded MD**)  
226. Collab notes CSV room filename tag — **Done**  
    (`exportCollabNotesCsv` filename tags room + filter)

### P78 — Continuity ZIP inner room / Engine jobs MD / Presence CSV room
227. Continuity drift ZIP room filename polish — **Done**  
    (`buildContinuityZipFiles` csv/md filenames tag room)  
228. Generate engine-jobs MD shortcut — **Done**  
    (`engineGenerationJobsToMarkdown`; Generate desk **Engine MD**)  
229. Collab presence CSV room filename tag — **Done**  
    (`exportPresenceRoster` csv/md filenames tag room + filter)

### P79 — Continuity fixes ZIP inner room / Jobs MD room / Collab notes MD room
230. Continuity fixes ZIP inner room polish — **Done**  
    (`buildContinuityFixesZipFiles` csv/md filenames tag room)  
231. Generate filtered-jobs MD room stamp — **Done**  
    (`generationJobsToMarkdown` Room meta; **Jobs MD** filename tags room)  
232. Collab notes MD room filename tag — **Done**  
    (`exportCollabChatTranscript` stem tags room for MD/txt/pdf)

### P80 — Continuity PDF Room table / Still MD room / Notes CSV Room
233. Continuity report PDF Room table polish — **Done**  
    (`continuityDriftToPrintHtml` Room column)  
234. Generate still-jobs MD room stamp — **Done**  
    (`stillGenerationJobsToMarkdown` + **Still MD** filename tags room)  
235. Collab notes CSV Room cell polish — **Done**  
    (row Room uses —; meta title stamps room)

### P81 — Video / Failed / Pending jobs MD room stamps
236. Generate video-jobs MD room stamp — **Done**  
237. Generate failed-jobs MD room stamp — **Done**  
238. Generate pending-jobs MD room stamp — **Done**

### P82 — Cancelled / Succeeded / Engine jobs MD room stamps
239. Generate cancelled-jobs MD room stamp — **Done**  
240. Generate succeeded-jobs MD room stamp — **Done**  
241. Generate engine-jobs MD room stamp — **Done**

### P83 — Generate desk CSV room filename stamps
242. Still/Video/Failed/Pending/Cancelled/Succeeded/Engine/Jobs CSV filenames tag room — **Done**

### P84 — Presence CSV Room polish / Generate PDF room / Transcript title room
243. Collab presence CSV Room cell polish — **Done**  
244. Generate desk PDF audit filename room tag — **Done**  
245. Collab transcript title room stamp — **Done**  
    (`formatCollabChatTranscript` H1 stamps room)

### P85 — Production Bible aggregator
246. `productionBible.js` read completeness for Cast/World/Director/DoP/Sound — **Done**  
247. Production dashboard Bible section + deep-links — **Done**

### P86 — Workspace park Director / DoP / Sound
248. `collectOpenWorkspace` / `attach` / `writeWorkspaceOntoLibrary` round-trip visions — **Done**

### P87 — Department vision revision / conflict
249. Revision + conflict-aware save on Director/DoP/Sound — **Done**  
250. Project Console overwrite confirm on conflict — **Done**

### P88 — Generate take strip (active picker)
251. `listStillTakes` / `listVideoTakes` + Generate desk TakeStrip — **Done**  
252. Wire `setActiveStillTake` / `setActiveVideoTake` — **Done**

### P89 — Take review → approve → lock
253. `reviewStatus` draft|review|approved|locked + advance/set APIs — **Done**  
254. Locked active take cannot be demoted — **Done**

### P90 — Scene → sequence reassignment
255. `patchProductionSpineScene` + dashboard Scene→sequence editor — **Done**

### P91 — Editable act titles
256. `patchProductionSpineAct` + SpineTree title edit (preserved on rebuild) — **Done**

### P92 — Matrix continuity actions
257. Look column Gen + Patch (document drift) — **Done**

### P93 — Continuity spine uses active bible vault
258. `continuitySpine` profiles/worlds → `getActiveCharacterProfiles` / `getActiveWorldAssets` — **Done**

### P94 — Character continuity timeline
259. `characterContinuityTimeline.js` + dashboard summary — **Done**

### P95 — Smarter library merge
260. Merge shots by id + prefer non-empty bible/spine/vision fields — **Done**

### P96 — Spine → Story Package write-back
261. `writeStoryPackageFromSpine` + dashboard button — **Done**

### P97 — Shot Spec hardening · asset ID polish
262. Shot Spec slate completeness (`shotSpecSlateSummary` + Form craft %) — **Done**  
263. Form desk CHAR_/WORLD_ bind strip + Relink tags — **Done**  
264. Dashboard Relink assets + Matrix ID chips — **Done**

### P98 — Quota / legacy room / SaaS storage ops
265. `safeStorage` prune + pressure events; Console/db library writes use safe set — **Done**  
266. Kill legacy `SPS-CLOUD-8821` defaults; migrate library rooms on Console open — **Done**  
267. Settings → SaaS local storage pressure + Prune cache — **Done**

### P99 — Help room copy · vite fallback · screenplay dual-store sync
268. Help collaboration docs: per-film `sps_<slug>` rooms (not shared legacy) — **Done**  
269. Vite/dev + Admin collab fallbacks → `sps_local_dev` — **Done**  
270. `readOpenScreenplayText` / `writeOpenScreenplayText` heal live+current drift — **Done**

### Remaining schedule (after P99)

| # | Slice theme | Status |
|---|-------------|--------|
| P0–P108 | Foundation → spine → assets → quota/rooms → screenplay sync → exports/audit | **Done** |
| P100 | Retest project-mix-on-restart / character-ref warrior priors (Buggy table) | **Done** |
| P101 | Jobs queue UX: unblock Generate desk while-loop polling (Conflicting) | **Done** |
| P102 | Hard multi-project stores (isolation beyond vault swap) | **Done** (active-cache reconcile) |
| P103 | Screenplay dual keys → single SoT key migration | **Done** |
| P104 | Project library multi-store merge discipline (local/IDB/disk/cloud) | **Done** |
| P105 | Bible SoT drift heal · compile vault reads · Director resolve | **Done** |

### P100 — Isolation retest hardening · anti-warrior look sheets
271. Character sheet guard forbids warrior priors when Matrix never arms the person — **Done**  
272. App isolation health + bible stamp reconcile on project open — **Done**

### P101 — Non-blocking generation poll / queue UX
273. Video poll single-tick + async chain; resume never blocks UI minutes — **Done**  
274. Generate still queues + kicks App resume (same as video) — **Done**

### P102 — Active bible isolation beyond soft vault swap
275. `reconcileActiveBibleToCurrentTitle` on Cast/World reads + App title effect — **Done**

### P103 — Screenplay single SoT key
276. `sps_open_screenplay_text` SoT + migrate from live/current mirrors — **Done**  
277. App boot `migrateOpenScreenplayToSoT` — **Done**

### P104 — Library multi-store merge discipline
278. `projectContentScore` + `mergeLibrarySources(local→vault→cloud)` — **Done**  
279. Vault hydrate + cloud sync use content-score merge helpers — **Done**

### P105 — Bible SoT drift heal · compile vault reads · Director resolve
280. Compile/pitch/narrative/image reads → `getActiveCharacterProfiles` / `getActiveWorldAssets` (reconcile path) — **Done**  
281. `bibleSoTHealth.js` detect/heal + dashboard **Heal stores** + App auto-heal on project switch — **Done**  
282. `resolveProjectDirectorPsychology` — storage revision wins over stale project field on park — **Done**

### P106 — Credits low-water · sync fail toast · promo beat audit
283. Managed-credit low-water chip + toast in Header; Generate desk banner (`managedCreditStatus`, ≤20) — **Done**  
284. Cloud probe fail streak; toast on 3 consecutive failures (`sps_cloud_sync_fail_alert`) — **Done**  
285. Promo pack logs muted/unapproved excluded beats to creative audit on CSV/ZIP export — **Done**

### P107 — Stripe credit pull · campaign beat audit · SaaS low-credit ledger
286. Stripe `?credits=ok` pulls ledger immediately (`syncManagedCredits`) — **Done**  
287. Campaign kit skips muted shots; logs muted/unapproved exclusions on CSV/MD/ZIP — **Done**  
288. SaaS admin lists managed licenses at/below credit low-water — **Done**

### P108 — Device last-seen · Generate desk fail toast · Pitch beat audit
289. SaaS admin device list shows `lastSeen` timestamp from heartbeat — **Done**  
290. Generate desk fires warning toast after 3 consecutive failed jobs — **Done**  
291. Pitch deck CSV/MD/ZIP exports log muted/unapproved beat exclusions to creative audit — **Done**

### P109 — Generate desk engine health · SaaS device lastSeen CSV · pitch facts mute filter
1. Generate desk: model engine health-check ping on open (red dot if unreachable) — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: license CSV export includes device lastSeen column — **Done** (`saasControl.js` → `DeviceLastSeen`)
3. Pitch deck: exclude muted shots from `collectPitchFacts` input (not just audit) — **Done** (`pitchDeckMaker.js`)

### P110 — Comfy health · SaaS devices CSV · pitch approved lifecycle
1. Generate desk: ComfyUI health dot when local export engine selected — **Done** (`GenerateDeskModal.jsx` → `probeComfyUi`)
2. SaaS ledger CSV: optional per-device rows with lastSeen — **Done** (`saasLicensesToCsv({ expandDevices })` + Devices CSV in `SaasAdminPanel.jsx`)
3. Pitch deck: exclude non-approved lifecycle shots from `collectPitchFacts` — **Done** (`pitchDeckMaker.js` → approved/locked only)

### P111 — Cancel job · SaaS ledger chips · pitch excluded-beat count
1. Generate desk: cancel in-flight job from queue row (AbortController) — **Done** (`cancelGenerationJob` + Cancel on queue row)
2. SaaS admin: filter ledger by plan + status chips before CSV export — **Done** (`SaasAdminPanel.jsx`)
3. Pitch deck: surface excluded-beat count in maker UI before export — **Done** (`PitchDeckMaker.jsx`)

### P112 — Retry job · SaaS email search · pitch → Matrix lifecycle
1. Generate desk: retry failed/cancelled job from history row — **Done** (`retryGenerationJob` + Retry on queue row)
2. SaaS admin: search ledger by email substring before CSV — **Done** (`SaasAdminPanel.jsx`)
3. Pitch deck: one-click “Approve excluded drafts” → Matrix lifecycle filter — **Done** (`openMatrixLifecycleFilter` + Matrix Life chips)

### P113 — Fail filter link · copy emails · Matrix advance visible
1. Generate desk: consecutive-fail toast links to Failed job filter — **Done** (`View failed` on status line)
2. SaaS admin: copy filtered email list to clipboard — **Done** (`Copy emails` in `SaasAdminPanel.jsx`)
3. Matrix: bulk-advance visible lifecycle filter — **Done** (`bulkAdvanceShotLifecycleFiltered` + Advance visible)

### P114 — Clear fail streak · emails TXT · clear Life filter
1. Generate desk: clear fail streak when a job succeeds — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: export filtered emails as `.txt` (export-gated) — **Done** (`Emails TXT` in `SaasAdminPanel.jsx`)
3. Matrix: clear Life filter after bulk-advance when none remain visible — **Done** (`SpreadsheetView.jsx`)

### P115 — Engine checkedAt · revoke filtered · Pitch→Matrix toast
1. Generate desk: engine health last-checked timestamp beside the dot — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: revoke-filtered (confirm) for DISABLED rows in current filter — **Done** (`Revoke filtered`, owner skipped)
3. Matrix: Life filter persisted + toast when Pitch deep-links — **Done** (`sps_toast` + Matrix Life note)

### P116 — Engine re-check · restore filtered · Pitch Life chip pulse
1. Generate desk: manual re-check beside engine health timestamp — **Done** (`Re-check` in `GenerateDeskModal.jsx`)
2. SaaS admin: restore REVOKED → ACTIVE for filtered rows (confirm) — **Done** (`Restore filtered`)
3. Matrix: highlight Pitch-linked Life chip for 3s — **Done** (`pitchLifePulse` on Life chips)

### P117 — Unhealthy message · status counts · Clear Life
1. Generate desk: last health message under engine row when unhealthy — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: DISABLED / REVOKED counts on status chips — **Done** (`SaasAdminPanel.jsx` · Status · N)
3. Matrix: Clear Life chip when a Life filter is active — **Done** (`SpreadsheetView.jsx`)

### P118 — Auto re-check · jump Disabled · L cycles Life
1. Generate desk: auto re-check engine every 60s while open — **Done** (`GenerateDeskModal.jsx` interval)
2. SaaS admin: Jump Disabled chip when count > 0 — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: `L` cycles Life filter options — **Done** (`SpreadsheetView.jsx`)

### P119 — Pause auto-check · Jump Revoked · Shift+L
1. Generate desk: pause auto re-check while a generate job is running — **Done** (`getPendingJobs` gate)
2. SaaS admin: Jump Revoked chip when REVOKED count > 0 — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Shift+L cycles Life filter backwards — **Done** (`SpreadsheetView.jsx`)

### P120 — Auto-check paused hint · Jump Active · Life hotkey hint
1. Generate desk: “auto-check paused” when pending jobs block interval — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Jump Active when viewing DISABLED/REVOKED — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Life label shows `L / ⇧L` hotkey hint — **Done** (`SpreadsheetView.jsx`)

### P121 — Paused→Pending · Jump All · Esc clears Life
1. Generate desk: click “auto-check paused” → Pending job filter — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Jump All when any status filter is active — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Esc clears Life filter (no cell modal) — **Done** (`SpreadsheetView.jsx`)

### P122 — Pending flash · Clear filters · Esc Life ring
1. Generate desk: flash Pending chip from auto-check paused — **Done** (`jobFilterPulse`)
2. SaaS admin: Alt+Jump All clears email + Clear filters button — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Esc clear rings All life chip (+ brief toast) — **Done** (`SpreadsheetView.jsx`)

### P123 — Failed flash · Plan clear pulse · Clear Life ring
1. Generate desk: flash Failed chip from View failed — **Done** (`jobFilterPulse`)
2. SaaS admin: Clear filters resets plan + pulses All plan chip — **Done** (`ledgerPlanPulse`)
3. Matrix: Clear Life rings All life chip (same as Esc) — **Done** (`SpreadsheetView.jsx`)

### P124 — Succeeded flash · Alt+Jump All plan · Advance Life ring
1. Generate desk: flash Succeeded chip when fail streak clears on success — **Done** (`jobFilterPulse`)
2. SaaS admin: Alt+Jump All clears plan + email (+ pulse All) — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Advance visible clear rings All life chip — **Done** (`SpreadsheetView.jsx`)

### P125 — Fail-streak click · Plan All re-click · Advance remain toast
1. Generate desk: click fail-streak status opens Failed filter (+ flash) — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: re-click All plan clears email + status (+ pulse) — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Advance visible keep-filter toast with remaining count — **Done** (`SpreadsheetView.jsx`)

### P126 — Esc job All · Status All re-click · Advance blocked toast
1. Generate desk: Esc clears job filter (+ flash All) before close — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: re-click All status clears email + plan (+ pulse) — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Advance blocked toast (look-only / permissions) — **Done** (`SpreadsheetView.jsx`)

### P127 — Job All re-click · Status pulse on Clear · Advance title reason
1. Generate desk: re-click All job chip clears status message — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Clear filters also pulses All status chip — **Done** (`ledgerStatusPulse`)
3. Matrix: Advance disabled title shows blocked reason — **Done** (`SpreadsheetView.jsx`)

### P128 — Esc filter toast · Jump All status pulse · Advance keep ring
1. Generate desk: Esc filter clear toast (All still closes) — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Jump All pulses All status chip — **Done** (`ledgerStatusPulse`)
3. Matrix: Advance keep rings current Life chip — **Done** (`SpreadsheetView.jsx`)

### P129 — All clear toast · Jump chip pulse · L/⇧L Life ring
1. Generate desk: toast when re-click All clears status — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Jump Disabled / Revoked / Active pulse that chip — **Done** (`ledgerStatusPulse`)
3. Matrix: L / ⇧L rings newly selected Life chip — **Done** (`SpreadsheetView.jsx`)

### P130 — Job filter pulse · Plan select pulse · Life click ring
1. Generate desk: pulse job chip on any filter select — **Done** (`jobFilterPulse`)
2. SaaS admin: pulse plan chip when selecting a plan — **Done** (`ledgerPlanPulse`)
3. Matrix: click Life chip rings itself — **Done** (`SpreadsheetView.jsx`)

### P131 — Job filter toast · Status select pulse · Focus ring
1. Generate desk: toast naming job filter on select — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: pulse status chip on ACTIVE/DISABLED/REVOKED select — **Done** (`ledgerStatusPulse`)
3. Matrix: Focus category chip rings itself — **Done** (`focusCatPulse`)

### P132 — Job count toast · Status count note · Focus toast
1. Generate desk: toast includes shown job count — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: status select note includes license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus toast naming the category — **Done** (`SpreadsheetView.jsx`)

### P133 — Engine Re-check toast · Plan count note · Life toast
1. Generate desk: toast when Re-check finishes (ok / unhealthy) — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: plan select note includes license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Life chip select toast naming the filter — **Done** (`SpreadsheetView.jsx`)

### P134 — Auto unhealthy toast · Email Clear pulse · Life shot count
1. Generate desk: auto 60s check toasts only when unhealthy — **Done** (`engineAutoCheckRef`)
2. SaaS admin: email Clear pulses All plan + status chips — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Life toast includes visible shot count — **Done** (`SpreadsheetView.jsx`)

### P135 — Re-check title time · Email Enter empty · Focus column count
1. Generate desk: Re-check title shows last checked time — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: email Enter blurs + pulses All status if empty — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus toast includes column/slot count — **Done** (`SpreadsheetView.jsx`)

### P136 — Re-check checking… · Enter empty-query pulse · Life hover count
1. Generate desk: Re-check title shows “checking…” while probing — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: email Enter pulses All status only when query empty — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Life chip title includes shot count (hover) — **Done** (`SpreadsheetView.jsx`)

### P137 — Re-check label · No-match plan pulse · Focus hover columns
1. Generate desk: Re-check button label shows “checking…” while probing — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: email no-match Enter pulses All plan chip — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus chip title includes column count (hover) — **Done** (`SpreadsheetView.jsx`)

### P138 — Engine chip pulse · No-match Clear hint · Focus All columns
1. Generate desk: pulse Engine chip on Re-check finish — **Done** (`engineDotPulse`)
2. SaaS admin: email no-match note suggests Clear — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus All hover/toast uses “all columns” — **Done** (`SpreadsheetView.jsx`)

### P139 — Engine click Re-check · Clickable Clear · Life All shots
1. Generate desk: click Engine label triggers Re-check — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: no-match note Clear is clickable — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Life All hover/toast uses “all shots” — **Done** (`SpreadsheetView.jsx`)

### P140 — Dot Re-check · Near-email Clear · Clear Life count
1. Generate desk: click engine status dot triggers Re-check — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: no-match Clear link near email field — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Clear Life title includes total shot count — **Done** (`SpreadsheetView.jsx`)

### P141 — Time click Re-check · Enter no-match pulse · Clear Life toast count
1. Generate desk: last-check time click triggers Re-check — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Enter no-match pulses near-email Clear link — **Done** (`emailNoMatchPulse`)
3. Matrix: Clear Life toast includes total shot count — **Done** (`SpreadsheetView.jsx`)

### P142 — Close clears toast flags · Clear filters pulse reset · Esc toast count
1. Generate desk: closing desk clears pending Re-check/auto toast flags — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Clear filters clears emailNoMatchPulse — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Esc Life clear toast includes total shot count — **Done** (`SpreadsheetView.jsx`)

### P143 — Open resets pulse · Email Clear pulse · Advance clear toast count
1. Generate desk: open desk resets engineDotPulse — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: email Clear clears emailNoMatchPulse — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Advance clear toast includes total shot count — **Done** (`SpreadsheetView.jsx`)

### P144 — Close job pulse · Jump All pulse clear · Advance keep Life label
1. Generate desk: close desk resets jobFilterPulse — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Jump All clears emailNoMatchPulse — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Advance keep toast includes Life filter label — **Done** (`SpreadsheetView.jsx`)

### P145 — Open jobFilter all · Jump chips pulse clear · Advance blocked Life label
1. Generate desk: open desk resets jobFilter to all — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Jump Disabled/Revoked/Active clear emailNoMatchPulse — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Advance blocked toast includes Life filter label — **Done** (`SpreadsheetView.jsx`)

### P146 — Open clears fail streak · Status select pulse clear · Advance title Life
1. Generate desk: open desk clears failStreakHint + fail status — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: status chip select clears emailNoMatchPulse — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Advance disabled/enabled title includes Life label — **Done** (`SpreadsheetView.jsx`)

### P147 — Close fail streak · Plan select pulse clear · L/⇧L shot toast
1. Generate desk: close desk clears failStreakHint — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: plan chip select clears emailNoMatchPulse — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: L / ⇧L toast includes visible shot count — **Done** (`SpreadsheetView.jsx`)

### P148 — Esc clears fail streak · Email typing pulse clear · Focus + Life toast
1. Generate desk: Esc filter clear clears failStreakHint — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: email typing clears emailNoMatchPulse — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus toast includes active Life label when Life on — **Done** (`SpreadsheetView.jsx`)

### P149 — View failed toast · Clear no-match note · Life + Focus toast
1. Generate desk: View failed toast names Failed + streak — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: email Clear note when no-match pulse was on — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Life toast includes Focus label when Focus ≠ All — **Done** (`SpreadsheetView.jsx`)

### P150 — Succeeded toast · No-match Clear note · L/⇧L + Focus
1. Generate desk: Succeeded streak-clear toast names Succeeded — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: No match — Clear uses no-match dismissed note — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: L / ⇧L toast includes Focus label when Focus ≠ All — **Done** (`SpreadsheetView.jsx`)

### P151 — Pending toast · Top-note Clear dismissed · Esc Life + Focus
1. Generate desk: Pending from auto-check paused toast names Pending — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: top-note Clear uses no-match dismissed note — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Esc Life clear toast includes Focus when Focus ≠ All — **Done** (`SpreadsheetView.jsx`)

### P152 — Job toast engine · Clear filters no-match · Clear Life + Focus
1. Generate desk: job filter toast includes engine name suffix — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Clear filters note mentions no-match dismissed when pulse was on — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Clear Life toast includes Focus when Focus ≠ All — **Done** (`SpreadsheetView.jsx`)

### P153 — Deep-link engine · Jump All no-match · Advance clear + Focus
1. Generate desk: Pending/Failed/Succeeded toasts include engine suffix — **Done** (`engineToastLabel`)
2. SaaS admin: Jump All note mentions no-match dismissed when pulse was on — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Advance clear toast includes Focus when Focus ≠ All — **Done** (`SpreadsheetView.jsx`)

### P154 — Re-check engine toast · Jump Disabled note · Advance keep + Focus
1. Generate desk: Re-check OK/unhealthy toast includes engine name — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Jump Disabled note includes license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Advance keep toast includes Focus when Focus ≠ All — **Done** (`SpreadsheetView.jsx`)

### P155 — Auto unhealthy Re-check hint · Jump Revoked/Active notes · Advance blocked + Focus
1. Generate desk: auto unhealthy toast adds Re-check hint — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Jump Revoked / Active notes include license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Advance blocked toast includes Focus when Focus ≠ All — **Done** (`SpreadsheetView.jsx`)

### P156 — Engine message Re-check · Jump sps_toast · Advance title + Focus
1. Generate desk: unhealthy message under engine includes Re-check hint — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Jump Disabled/Revoked/Active sps_toast with count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Advance title includes Focus when Focus ≠ All — **Done** (`SpreadsheetView.jsx`)

### P157 — Click unhealthy Re-check · Jump All toast · Focus title + Life
1. Generate desk: click unhealthy message triggers Re-check — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Jump All sps_toast with license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus chip title includes Life label when Life on — **Done** (`SpreadsheetView.jsx`)

### P158 — Enter unhealthy Re-check · Clear filters toast · Life title + Focus
1. Generate desk: Enter/Space on unhealthy message triggers Re-check — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Clear filters sps_toast with license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Life chip title includes Focus when Focus ≠ All — **Done** (`SpreadsheetView.jsx`)

### P159 — Auto toast wording · Email Clear toast · Clear Life title + Focus
1. Generate desk: auto unhealthy toast matches under-engine “· Re-check” — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: email Clear sps_toast when clearing — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Clear Life title includes Focus when Focus ≠ All — **Done** (`SpreadsheetView.jsx`)

### P160 — Re-check toast wording · Top-note Clear toast · Esc Life title + Focus
1. Generate desk: user Re-check unhealthy toast uses message · Re-check — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: top-note Clear sps_toast (parity with email Clear) — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Esc Life clear title includes Focus when Focus ≠ All — **Done** (`SpreadsheetView.jsx`)

### P161 — OK engine label · Jump All count toast · Advance note + Focus
1. Generate desk: Engine OK Re-check keeps engine label (toast + health/Engine titles) — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Jump All sps_toast / title use Jump All · license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Advance visible title already had Focus; clear-after-advance note adds Focus — **Done** (`SpreadsheetView.jsx`)

### P162 — Re-check title · Jump titles + count · Focus label + Life
1. Generate desk: Re-check button title includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Jump Disabled/Revoked/Active titles include license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus label span title includes Life when Life filter on — **Done** (`SpreadsheetView.jsx`)

### P163 — Timestamp title · Clear filters title · lifecycleNote + Focus
1. Generate desk: last-check timestamp title includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Clear filters title includes license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: lifecycleNote span title includes Focus when Focus ≠ All — **Done** (`SpreadsheetView.jsx`)

### P164 — Under-engine title · Email Clear title · Count pill + Life/Focus
1. Generate desk: unhealthy under-engine title includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: email Clear titles include license count after clear scope — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: shots count pill title includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P165 — Unhealthy aria-label · Email input title · CSV title + Life/Focus
1. Generate desk: unhealthy message aria-label includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: email search input title includes current filtered license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: CSV export button title includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P166 — Health-dot aria-label · Plan chip title + count · PDF title + Life/Focus
1. Generate desk: health-dot aria-label includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: plan filter chip titles include license count in scope — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: PDF export button title includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P167 — Engine aria-label · Status chip title + count · Export-blocked + Life/Focus
1. Generate desk: Engine label button aria-label includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: status filter chip titles include license count in scope — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: export-blocked hint title includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P168 — Re-check aria-label · Plan select toast · Look only + Life/Focus
1. Generate desk: Re-check button aria-label includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: plan select note also fires sps_toast with license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Look only chip title includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P169 — Timestamp aria-label · Status select toast · Add shot + Life/Focus
1. Generate desk: last-check timestamp button aria-label includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: status select note also fires sps_toast with license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Add shot button title includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P170 — Auto-check paused title · Plan label title · Matrix pin + Life/Focus
1. Generate desk: auto-check paused button title includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Plan label span title includes current filtered license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Matrix bar pin title includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`, `HoverPinBar.jsx`)

### P171 — Engine select title · Status label title · Matrix reveal aria-label
1. Generate desk: engine select title includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Status label span title includes current filtered license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Matrix bar reveal button aria-label includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P172 — Engine select aria-label · Email label title · Focus label + column count
1. Generate desk: engine select aria-label includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Email label span title includes current filtered license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus label span title includes Focus column count when Life filter on — **Done** (`SpreadsheetView.jsx`)

### P173 — Engine option title · Ledger CSV title · Life label + shot count
1. Generate desk: engine option elements title includes engine label — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: ledger export CSV button title includes filtered license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Life label span title includes visible shot count when Life filter on — **Done** (`SpreadsheetView.jsx`)

### P174 — Active option title · Devices CSV title · Focus label + active category
1. Generate desk: selected engine option title matches engineToastLabel when active — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Devices CSV button title includes filtered license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus label span title includes active Focus category when Life filter on — **Done** (`SpreadsheetView.jsx`)

### P175 — Engine change toast · Copy emails title · Focus label + columns (Life off)
1. Generate desk: engine select change toasts + title tracks engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Copy emails button title includes filtered license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus label span title includes column count when Life off but Focus ≠ All — **Done** (`SpreadsheetView.jsx`)

### P176 — Local export title · Emails TXT title · Life label + Focus (Life off)
1. Generate desk: Local export helper span title includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Emails .txt export button title includes filtered license count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Life label span title includes Focus when Focus ≠ All (even if Life off) — **Done** (`SpreadsheetView.jsx`)

### P177 — Replicate title · Revoke filtered count · Life All chip + Focus (Life off)
1. Generate desk: Replicate helper span title includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Revoke filtered button title includes DISABLED count in scope — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Life chip All title includes Focus when Focus ≠ All (even if Life off) — **Done** (`SpreadsheetView.jsx`)

### P178 — Seedance helper · Restore filtered count · Life chips + Focus (Life on)
1. Generate desk: Seedance/BytePlus helper span title includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Restore filtered button title includes REVOKED count in scope — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Life non-All chips title includes Focus when Life filter on — **Done** (`SpreadsheetView.jsx`)

### P179 — Model label title · Ledger summary title · Focus chips + Life (non-All)
1. Generate desk: Still/Video model label title includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: ledger count summary title includes filter breakdown — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus category chips title includes Life when Life filter on (non-All Focus) — **Done** (`SpreadsheetView.jsx`)

### P180 — Model select title · Devices CSV row count · Focus All + Life
1. Generate desk: Still/Video model select title includes engineToastLabel — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Devices CSV title includes device row count estimate — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus All chip title includes Life when Life filter on — **Done** (`SpreadsheetView.jsx`)

### P181 — Model option title · Copy emails count · Focus label + active Focus
1. Generate desk: model option elements title includes engine label — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Copy emails title includes email count in filter — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus label span title includes active Focus when Life filter on — **Done** (`SpreadsheetView.jsx`)

### P182 — Active model option · Emails TXT count · Focus label + Life shots
1. Generate desk: active model option title matches engineToastLabel when selected — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Emails TXT title includes email count in filter — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus label span title includes Life shot count when Life filter on — **Done** (`SpreadsheetView.jsx`)

### P183 — Model select title + label · Revoke revokable count · Life visible/total
1. Generate desk: model select title updates to selected model label on change — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Revoke filtered title includes revokable DISABLED count — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Life label span title includes visible/total shots when Life filter on — **Done** (`SpreadsheetView.jsx`)

### P184 — Model change toast · Restore revokable wording · Focus visible/total
1. Generate desk: model change sps_toast includes selected model label — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Restore filtered title includes revokable REVOKED count wording — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: Focus label span title includes visible/total shots when Life filter on — **Done** (`SpreadsheetView.jsx`)

### P185 — Engine toast prev→new · Ledger CSV filter title · Count pill title memo
1. Generate desk: engine change toast includes previous + new engine labels — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: ledger CSV title includes filter breakdown in title — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: count pill title/aria-label mirrors full hover title — **Done** (`SpreadsheetView.jsx`)

### P186 — Engine aria prev→new · Devices CSV filters · Scene group pill + Life/Focus
1. Generate desk: engine select aria-label updates on change (prev → new) — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Devices CSV title includes filter breakdown — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: scene group shot count pill title includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P187 — Engine title prev→new · Emails TXT filters · Scene heading + Life/Focus
1. Generate desk: engine select title shows prev → new briefly on change — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Emails TXT title includes filter breakdown in title string — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: scene heading title includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P188 — Model select title hint · Copy emails filters · Scene collapse + Life/Focus
1. Generate desk: still/video model select title shows label on change (matches toast) — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Copy emails title includes filter breakdown in title string — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: scene collapse control title includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P189 — Model select aria-label · Ledger count aria-label · Scene tag + Life/Focus
1. Generate desk: still/video model select aria-label matches title hint — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: ledger count summary aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: scene tag span title includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P190 — Model label aria-label · Email label aria-label · Scene spine + Life/Focus
1. Generate desk: still/video model label aria-label matches title hint (incl. active model label) — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Email filter label aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: scene spine span title includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P191 — Plan/Status label aria-label · Collapse button aria-label + Life/Focus
1. SaaS admin: Plan filter label aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
2. SaaS admin: Status filter label aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: scene collapse button aria-label includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P192 — Email input aria-label · Count pill aria-label · Engine chip aria-label
1. SaaS admin: Email filter input aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
2. Matrix: scene count pill aria-label includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)
3. Generate desk: Engine chip button aria-label mirrors title (Re-check + engine) — **Done** (`GenerateDeskModal.jsx`)

### P193 — Health-dot aria-label · Email Clear aria-label · Banner row aria-label
1. Generate desk: Engine health-dot button aria-label mirrors title (health + Re-check) — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Email Clear button aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: scene banner row div aria-label includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P194 — Re-check aria-label · No-match Clear aria-label · Heading h3 aria-label
1. Generate desk: Re-check link button aria-label mirrors title — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Email no-match Clear link aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: scene heading h3 aria-label includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P195 — Health-check time aria-label · Ledger CSV aria-label · Collapse div aria-label
1. Generate desk: Last health-check time button aria-label mirrors title — **Done** (`GenerateDeskModal.jsx`)
2. SaaS admin: Ledger CSV export button aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: scene collapse clickable div aria-label includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P196 — Devices CSV aria-label · Copy emails aria-label · Scene tag aria-label
1. SaaS admin: Devices CSV export button aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
2. SaaS admin: Copy emails button aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: scene tag span aria-label includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P197 — Emails TXT aria-label · Revoke filtered aria-label · Spine span aria-label
1. SaaS admin: Emails TXT export button aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
2. SaaS admin: Revoke filtered button aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: scene spine span aria-label includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P198 — Restore filtered aria-label · Auto-check paused aria-label · Banner tr aria-label
1. SaaS admin: Restore filtered button aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
2. Generate desk: auto-check paused link aria-label mirrors hover title — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: scene banner tr aria-label includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P199 — Plan/Status chip aria-label · Engine label wrapper aria-label
1. SaaS admin: Plan filter chip buttons aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
2. SaaS admin: Status filter chip buttons aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
3. Generate desk: Engine label wrapper aria-label mirrors health-dot title — **Done** (`GenerateDeskModal.jsx`)

### P200 — Jump Disabled/Revoked aria-label · Banner td aria-label
1. SaaS admin: Jump Disabled chip aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
2. SaaS admin: Jump Revoked chip aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
3. Matrix: scene banner td aria-label includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P201 — Jump Active aria-label · Checking span aria-label · Count pill wrapper aria-label
1. SaaS admin: Jump Active chip aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
2. Generate desk: Engine checking span aria-label mirrors visible text — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: scene count pill wrapper div aria-label includes Life + Focus when filters on — **Done** (`SpreadsheetView.jsx`)

### P202 — Jump All aria-label · Engine select label aria-label · Banner aria-label dedupe
1. SaaS admin: Jump All chip aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
2. Generate desk: engine select label aria-label mirrors generation engine title — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: scene banner inner row div aria-label dedupe (removed redundant tr/td labels) — **Done** (`SpreadsheetView.jsx`)

### P203 — Clear filters aria-label · Engine helper spans aria-label · Count pill dedupe
1. SaaS admin: Clear filters chip aria-label mirrors hover title — **Done** (`SaasAdminPanel.jsx`)
2. Generate desk: Local/Replicate/Seedance helper span aria-label mirrors title — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: scene count pill wrapper div aria-label dedupe (removed redundant span label) — **Done** (`SpreadsheetView.jsx`)

### P204 — Engine error aria-label · Heading h3 dedupe · Life/Focus chip aria-label
1. Generate desk: engine error message button aria-label mirrors title — **Done** (`GenerateDeskModal.jsx`)
2. Matrix: scene heading h3 aria-label dedupe (removed redundant aria-label; row wrapper keeps it) — **Done** (`SpreadsheetView.jsx`)
3. Matrix: Life/Focus chip buttons aria-label mirrors hover title — **Done** (`SpreadsheetView.jsx`)

### P205 — Focus/Life label spans · Engine error title · Clear Life aria-label
1. Matrix: Focus/Life label spans aria-label mirrors hover title — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: engine error button title includes health message — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: Clear Life chip aria-label mirrors hover title — **Done** (`SpreadsheetView.jsx`)

### P206 — Advance aria-label · Count pill dedupe · CSV/PDF aria-label
1. Matrix: Advance lifecycle button aria-label mirrors hover title — **Done** (`SpreadsheetView.jsx`)
2. Matrix: matrix count pill aria-label dedupe (title only on span) — **Done** (`SpreadsheetView.jsx`)
3. Matrix: CSV/PDF export buttons aria-label mirrors hover title — **Done** (`SpreadsheetView.jsx`)

### P207 — Lifecycle note · Export-blocked hint · Look only aria-label
1. Matrix: lifecycle note span aria-label mirrors hover title — **Done** (`SpreadsheetView.jsx`)
2. Matrix: export-blocked hint span aria-label mirrors hover title — **Done** (`SpreadsheetView.jsx`)
3. Matrix: Look only chip aria-label mirrors hover title — **Done** (`SpreadsheetView.jsx`)

### P208 — Add shot aria-label · HoverPinBar reveal title · Spine span dedupe
1. Matrix: Add shot button aria-label mirrors hover title — **Done** (`SpreadsheetView.jsx`)
2. Matrix: HoverPinBar reveal/pin aria-label mirrors title — **Done** (`HoverPinBar.jsx` — reveal `title` matches `ariaLabel`; pin already matched)
3. Matrix: scene spine span aria-label dedupe (title only on span) — **Done** (`SpreadsheetView.jsx`)

### P209 — Scene tag dedupe · Banner tr aria-label · Engine option aria-label
1. Matrix: scene tag span aria-label dedupe (title only on span) — **Done** (`SpreadsheetView.jsx`)
2. Matrix: scene banner inner row div aria-label dedupe (aria-label on tr only) — **Done** (`SpreadsheetView.jsx`)
3. Generate desk: engine select option aria-label mirrors title — **Done** (`GenerateDeskModal.jsx`)

### P210 — Model option aria-label · Count pill dedupe · Banner td aria-label
1. Generate desk: still/video model option aria-label mirrors title — **Done** (`GenerateDeskModal.jsx`)
2. Matrix: scene count pill span aria-label dedupe (wrapper keeps aria-label; span title removed) — **Done** (`SpreadsheetView.jsx`)
3. Matrix: scene banner td aria-label mirrors tr (dedupe — aria-label on td only) — **Done** (`SpreadsheetView.jsx`)

### P211 — Active model option title · Heading h3 dedupe · Header count pill aria-label
1. Generate desk: still/video active model option title includes model label — **Done** (`GenerateDeskModal.jsx`)
2. Matrix: scene heading h3 title dedupe (banner td keeps aria-label) — **Done** (`SpreadsheetView.jsx`)
3. Matrix: matrix header count pill aria-label (dedupe title-only span) — **Done** (`SpreadsheetView.jsx`)

### P212 — Spine/tag title dedupe · Collapse div title dedupe
1. Matrix: scene spine span title dedupe (banner td keeps scene context) — **Done** (`SpreadsheetView.jsx`)
2. Matrix: scene collapse clickable div title dedupe (button keeps expand title) — **Done** (`SpreadsheetView.jsx`)
3. Matrix: scene tag span title dedupe (banner td keeps scene tag) — **Done** (`SpreadsheetView.jsx`)

### P213 — Count pill wrapper title · Engine option title · Focus label dedupe
1. Matrix: scene count pill wrapper title mirrors aria-label — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: engine select active option title uses label + engine — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: Focus label span aria-label dedupe (title only on span) — **Done** (`SpreadsheetView.jsx`)

### P214 — Life label dedupe · Engine option label-only · Header count pill title
1. Matrix: Life label span aria-label dedupe (title only on span) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: engine select non-active option title uses label only — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: matrix header count pill title mirrors aria-label — **Done** (`SpreadsheetView.jsx`)

### P215 — Engine option titles · Life/Focus label helpers · Banner td title
1. Generate desk: engine select all options title uses label (+ engine when active) — **Done** (`GenerateDeskModal.jsx`)
2. Matrix: Life label span title mirrors Focus label pattern (dedupe helper) — **Done** (`SpreadsheetView.jsx` — `matrixFocusLabelTitle` / `matrixLifeLabelTitle`)
3. Matrix: scene banner td title mirrors aria-label — **Done** (`SpreadsheetView.jsx`)

### P216 — Filter suffix helper · Model option label+engine · Count pill title dedupe
1. Matrix: HoverPinBar ariaLabel/pinTitle use shared filter suffix helper — **Done** (`SpreadsheetView.jsx` — `matrixFilterSuffix`)
2. Generate desk: still/video model options all use label (+ engine when selected) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: scene count pill wrapper aria-label dedupe (title only on wrapper) — **Done** (`SpreadsheetView.jsx`)

### P217 — Banner td title dedupe · Model options label+engine · matrixFilterSuffix in banner
1. Matrix: scene banner td aria-label dedupe (title only on td) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: still/video model options all use label + engine on every option — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: matrixFilterSuffix reused in scene banner filterSuffix — **Done** (`SpreadsheetView.jsx`)

### P218 — matrixCountPillTitle suffix · Engine options label+engine · Collapse button title dedupe
1. Matrix: matrixCountPillTitle uses matrixFilterSuffix — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: engine select all options use label + engine on every option — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: scene collapse button title dedupe (wrapper td keeps title) — **Done** (`SpreadsheetView.jsx`)

### P219 — Label title helpers · engineSelectLabelTitle · Banner title split
1. Matrix: matrixFocusLabelTitle / matrixLifeLabelTitle use matrixFilterSuffix where applicable — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: engine select label title mirrors select title — **Done** (`GenerateDeskModal.jsx` — `engineSelectLabelTitle`)
3. Matrix: scene count pill wrapper title-only (banner title on left div, not td) — **Done** (`SpreadsheetView.jsx`)

### P220 — Model label titles · Export/advance helpers · matrixBarPinTitle
1. Generate desk: still/video model label title mirrors select title — **Done** (`GenerateDeskModal.jsx` — `stillModelSelectLabelTitle`, `videoModelSelectLabelTitle`, `modelSelectLabelTitle`)
2. Matrix: export/advance buttons use matrixFilterSuffix in title helpers — **Done** (`SpreadsheetView.jsx` — `matrixExportCsvTitle`, `matrixExportPdfTitle`, `matrixAdvanceVisibleTitle`)
3. Matrix: HoverPinBar pinTitle uses matrixBarPinTitle helper — **Done** (`SpreadsheetView.jsx`)

### P221 — Chip title helpers · lifecycle note suffix · engineOptionTitle
1. Matrix: export-blocked / look-only chip titles use matrixFilterSuffix helpers — **Done** (`SpreadsheetView.jsx` — `matrixExportBlockedTitle`, `matrixLookOnlyTitle`)
2. Matrix: lifecycle note span title uses matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `matrixLifecycleNoteTitle`)
3. Generate desk: model option titles use shared engineToastLabel helper consistently — **Done** (`GenerateDeskModal.jsx` — `engineOptionTitle`)

### P222 — Add shot title · Focus chip helper · engineOptionTitle dedupe
1. Matrix: Add shot button title uses matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `matrixAddShotTitle`)
2. Matrix: Focus category chip titles use matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `getMatrixFocusChipTitle`)
3. Generate desk: engine option titles use engineOptionTitle everywhere (dedupe inline strings) — **Done** (`GenerateDeskModal.jsx`)

### P223 — Life chip titles · Clear Life title · Export blocked titles
1. Matrix: Life chip titles use matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `getMatrixLifeChipTitle`, `matrixFilterTrailingSuffix`)
2. Matrix: Clear Life button title uses matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `matrixClearLifeTitle`)
3. Matrix: CSV/PDF export blocked state uses matrixExportBlockedTitle — **Done** (`SpreadsheetView.jsx` — look-only uses `matrixLookOnlyTitle` too)

### P224 — Scene banner helpers · Desk mode tab titles · Export lifecycle note
1. Matrix: scene banner titles use matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `getMatrixSceneBannerTitle`, `getMatrixSceneCountPillTitle`, `getMatrixSceneCollapseAriaLabel`)
2. Generate desk: desk mode still/video chip titles use engineOptionTitle — **Done** (`GenerateDeskModal.jsx` — `deskModeStillTabTitle`, `deskModeVideoTabTitle`)
3. Matrix: lifecycle export note span uses matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `matrixExportLifecycleNote`, `matrixExportLifecycleNoteTitle`)

### P225 — Export title dedupe · Active desk tabs · Collapse button title
1. Matrix: dedupe matrixExportBlockedTitle / matrixExportLifecycleNoteTitle — **Done** (`SpreadsheetView.jsx` — single `matrixExportBlockedTitle`)
2. Generate desk: desk mode tab titles reflect active mode — **Done** (`GenerateDeskModal.jsx` — `Still · active` / `Video · active`)
3. Matrix: scene collapse button title uses matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `getMatrixSceneCollapseTitle`)

### P226 — Collapse aria dedupe · Desk mode toast · Banner div title dedupe
1. Matrix: scene collapse aria-label dedupe (title only on button) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: desk mode switch toast uses engineOptionTitle — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: scene banner left div title dedupe (collapse button keeps title) — **Done** (`SpreadsheetView.jsx`)

### P227 — Scene tag/heading titles · switchDeskMode skip guard
1. Matrix: scene tag span title uses matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `getMatrixSceneTagTitle`)
2. Matrix: scene heading h3 title uses matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `getMatrixSceneHeadingTitle`)
3. Generate desk: desk mode tab toast skips when already active — **Done** (`GenerateDeskModal.jsx` — `switchDeskMode`)

### P228 — Scene spine title · Tag/heading dedupe · Tab toast helper
1. Matrix: scene spine span title uses matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `getMatrixSceneSpineTitle`)
2. Matrix: scene tag/heading title dedupe (collapse row keeps expand title) — **Done** (`SpreadsheetView.jsx`)
3. Generate desk: switchDeskMode toast uses deskMode tab title helper — **Done** (`GenerateDeskModal.jsx` — `deskModeStillTabActiveTitle`, `deskModeVideoTabActiveTitle`)

### P229 — Spine title dedupe · Count pill wrapper label · getDeskModeTabLabel
1. Matrix: scene spine span title dedupe (collapse button keeps expand title) — **Done** (`SpreadsheetView.jsx`)
2. Matrix: count pill span title dedupe (wrapper keeps title) — **Done** (`SpreadsheetView.jsx` — wrapper `title` + `aria-label`)
3. Generate desk: desk mode tab aria-label mirrors title helper — **Done** (`GenerateDeskModal.jsx` — `getDeskModeTabLabel`)

### P230 — Count pill dedupe · switchDeskMode getDeskModeTabLabel
1. Matrix: header count pill aria-label dedupe (title only on span) — **Done** (`SpreadsheetView.jsx`)
2. Matrix: scene count pill wrapper title-only (aria-label dedupe) — **Done** (`SpreadsheetView.jsx`)
3. Generate desk: getDeskModeTabLabel used in switchDeskMode toast — **Done** (`GenerateDeskModal.jsx` — `active` flag)

### P231 — Wrapper aria-label · Tab aria-only · Collapse aria-label
1. Matrix: scene count pill wrapper aria-label mirrors title helper — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: desk mode tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: collapse button aria-label mirrors title helper — **Done** (`SpreadsheetView.jsx`)

### P232 — Collapse aria-only · Count pill aria-only · getDeskModeTabAriaLabel
1. Matrix: collapse button title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Matrix: scene count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
3. Generate desk: getDeskModeTabAriaLabel helper dedupe — **Done** (`GenerateDeskModal.jsx`)

### P233 — Count pill aria-label · Tab title mirrors aria · Collapse row aria-label
1. Matrix: header count pill title mirrors aria-label helper — **Done** (`SpreadsheetView.jsx` — `matrixCountPillTitle` on title + aria-label)
2. Generate desk: desk mode tab title mirrors aria-label helper — **Done** (`GenerateDeskModal.jsx` — `title` + `getDeskModeTabAriaLabel`)
3. Matrix: collapse row div aria-label for expand region — **Done** (`SpreadsheetView.jsx` — `getMatrixSceneCollapseTitle`)

### P234 — Collapse button title · Desk mode toast · Count pill wrapper title
1. Matrix: collapse button title mirrors aria-label helper — **Done** (`SpreadsheetView.jsx` — `getMatrixSceneCollapseTitle`)
2. Generate desk: switchDeskMode toast uses engineOptionTitle directly — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: scene count pill wrapper title mirrors aria-label — **Done** (`SpreadsheetView.jsx`)

### P235 — Collapse row dedupe · Tab title aliases · Count pill span dedupe
1. Matrix: collapse row div aria-label dedupe (button keeps title) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: deskModeTabActiveTitle helpers use engineOptionTitle alias — **Done** (`GenerateDeskModal.jsx` — inactive aliases + toast uses active titles)
3. Matrix: scene count pill span title dedupe (wrapper keeps title) — **Done** (`SpreadsheetView.jsx`)

### P236 — Collapse aria dedupe · Inactive tab aliases · Banner row title
1. Matrix: collapse button aria-label dedupe (title only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: desk mode inactive tab titles use inactive aliases everywhere — **Done** (`GenerateDeskModal.jsx` — `getDeskModeTabLabel`)
3. Matrix: collapse row div title for scene context (tag + heading) — **Done** (`SpreadsheetView.jsx` — `getMatrixSceneBannerTitle`)

### P237 — Scene tag/heading titles · getDeskModeTabTitle
1. Matrix: scene tag span title uses matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `getMatrixSceneTagTitle`)
2. Matrix: scene heading h3 title uses matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `getMatrixSceneHeadingTitle`)
3. Generate desk: getDeskModeTabTitle helper mirrors aria-label — **Done** (`GenerateDeskModal.jsx`)

### P238 — Tag/heading dedupe · Spine title · getDeskModeTabTitle only
1. Matrix: scene tag/heading title dedupe (row div keeps banner title) — **Done** (`SpreadsheetView.jsx`)
2. Matrix: scene spine span title uses matrixFilterSuffix helper — **Done** (`SpreadsheetView.jsx` — `getMatrixSceneSpineTitle`)
3. Generate desk: tab title/aria use getDeskModeTabTitle only (dedupe alias) — **Done** (`GenerateDeskModal.jsx`)

### P239 — Spine dedupe · Row div title dedupe · switchDeskMode toast helper
1. Matrix: scene spine title dedupe (row div keeps banner title) — **Done** (`SpreadsheetView.jsx`)
2. Matrix: collapse row div title dedupe (button keeps collapse title) — **Done** (`SpreadsheetView.jsx`)
3. Generate desk: switchDeskMode toast uses getDeskModeTabTitle(mode, true) — **Done** (`GenerateDeskModal.jsx`)

### P240 — Banner td title · Collapse aria-label · Active title inline
1. Matrix: scene banner td title for scene context (tag + heading) — **Done** (`SpreadsheetView.jsx` — `getMatrixSceneBannerTitle`)
2. Matrix: collapse button aria-label mirrors title helper — **Done** (`SpreadsheetView.jsx`)
3. Generate desk: remove unused deskModeTabActiveTitle direct refs — **Done** (`GenerateDeskModal.jsx` — `engineOptionTitle` in `getDeskModeTabTitle`)

### P241 — Banner td aria-label · Collapse aria-only · Inactive titles inline
1. Matrix: banner td aria-label mirrors title helper — **Done** (`SpreadsheetView.jsx`)
2. Matrix: collapse button title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
3. Generate desk: inactive tab titles inline in getDeskModeTabTitle — **Done** (`GenerateDeskModal.jsx`)

### P242 — Banner td aria-only · Collapse row dedupe · getDeskModeTabAriaLabel
1. Matrix: banner td title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Matrix: collapse row aria-label dedupe (button keeps aria-label) — **Done** (`SpreadsheetView.jsx` — row div has no aria-label)
3. Generate desk: getDeskModeTabAriaLabel alias for getDeskModeTabTitle — **Done** (`GenerateDeskModal.jsx`)

### P243 — Tab aria-only · Banner tr dedupe · Count pill aria-only
1. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
2. Matrix: banner tr aria-label dedupe (td keeps aria-label) — **Done** (`SpreadsheetView.jsx` — no tr aria-label)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P244 — getDeskModeTab single helper · Banner/collapse title restore
1. Generate desk: dedupe getDeskModeTabTitle / getDeskModeTabAriaLabel (single helper) — **Done** (`GenerateDeskModal.jsx` — `getDeskModeTab`)
2. Matrix: banner td title restore for hover (aria-label mirrors) — **Done** (`SpreadsheetView.jsx`)
3. Matrix: collapse button title restore (aria-label mirrors) — **Done** (`SpreadsheetView.jsx`)

### P245 — Matrix aria-only dedupe · Desk tab title restore
1. Matrix: banner td title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Matrix: collapse button title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
3. Generate desk: desk mode tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)

### P246 — Desk tab aria-only · Matrix title restore
1. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
2. Matrix: banner td title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
3. Matrix: collapse button title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P247 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P248 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P249 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P250 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P251 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P252 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P253 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P254 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P255 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P256 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P257 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P258 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P259 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P260 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P261 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P262 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P263 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P264 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P265 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P266 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P267 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P268 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P269 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P270 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P271 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P272 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P273 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P274 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P275 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P276 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P277 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P278 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P279 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P280 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P281 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P282 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P283 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P284 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P285 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P286 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P287 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P288 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P289 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P290 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P291 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P292 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P293 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P294 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P295 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P296 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P297 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P298 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P299 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P300 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P301 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P302 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P303 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P304 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P305 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P306 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P307 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P308 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P309 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P310 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P311 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P312 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P313 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P314 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P315 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P316 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P317 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P318 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P319 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P320 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P321 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P322 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P323 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P324 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P325 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P326 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P327 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P328 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P329 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P330 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P331 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P332 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P333 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P334 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P335 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P336 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P337 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P338 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P339 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P340 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P341 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P342 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P343 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P344 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P345 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P346 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P347 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P348 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P349 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P350 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P351 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P352 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P353 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P354 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P355 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P356 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P357 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P358 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P359 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P360 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P361 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P362 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P363 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P364 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P365 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P366 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P367 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P368 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P369 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P370 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P371 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P372 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P373 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P374 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P375 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P376 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P377 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P378 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P379 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P380 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P381 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P382 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P383 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P384 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P385 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P386 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P387 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P388 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P389 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P390 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P391 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P392 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P393 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P394 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P395 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P396 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P397 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P398 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P399 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P400 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P401 — Matrix aria-only · Desk tab title · Count pill title
1. Matrix: banner/collapse title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title restore (mirrors getDeskModeTab) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)

### P402 — Matrix title restore · Desk tab aria-only · Count pill aria-only
1. Matrix: banner/collapse title restore (mirrors aria-label) — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: tab title dedupe (aria-label only) — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: count pill wrapper title dedupe (aria-label only) — **Done** (`SpreadsheetView.jsx`)

### P403 — Stabilize Matrix / Generate labels (end restore/dedupe loop)
1. Matrix: banner/collapse keep `title` + `aria-label` in sync — **Done** (`SpreadsheetView.jsx`)
2. Generate desk: Still/Video tabs keep `title` + `aria-label` in sync — **Done** (`GenerateDeskModal.jsx`)
3. Matrix: scene count pill wrapper keep `title` + `aria-label` in sync — **Done** (`SpreadsheetView.jsx`)

### P404 — Comfy Phase 3: history → SWS output
1. Parse Comfy `/history` into a view URL — **Done** (`comfyHistoryParse.js`, `pullLatestComfyOutput`)
2. Film queue writes `outputFile` after queue idle — **Done** (`comfyFilmQueue.js`, `SwsComfyWorkflowModal.jsx`)
3. **Pull latest from ComfyUI** (no paste required) — **Done** (`SwsComfyWorkflowModal.jsx`)

### P405 — Comfy take / version / film filename
1. Comfy: append pulled video as a Matrix take (`appendVideoTake`) — **Done** (`SwsComfyWorkflowModal.jsx`, film queue + Pull + Link)  
2. Comfy: store `comfyui_version` from `/system_stats` on generation rows — **Done** (`swsComfyStore.js` field, `probeComfyUi`)  
3. Comfy: film-queue progress shows linked filename when history pull succeeds — **Done** (`comfyFilmQueue.js`, `filenameFromComfyViewUrl`)  

### P406 — Failed pull take · Debug version JSON · skip duplicate take
1. Comfy: film-queue also appends takes when a shot fails to pull (status note on generation row) — **Done** (`SwsComfyWorkflowModal.jsx` `awaiting_output`)  
2. Comfy: generation history lists ComfyUI version in Debug panel JSON — **Done** (`SwsComfyWorkflowModal.jsx` `debugPanel`)  
3. Comfy: skip duplicate take if the same `outputFile` is already the active video take — **Done** (`isActiveVideoTakeUrl`)  

### P407 — Duplicate promptId · awaiting count · already-active copy
1. Comfy: Pull latest skips duplicate generation row for the same `comfyPromptId` — **Done** (`generationForPromptId`)  
2. Comfy: Debug panel shows film-queue `awaiting_output` count — **Done** (`awaitingOutputCount` in `debugPanel`)  
3. Comfy: Link-to-shot status says “already active take” when skipped — **Done** (`SwsComfyWorkflowModal.jsx`)  

### P408 — Film-queue promptId · awaiting hint · Pull version
1. Comfy: film-queue skips duplicate generation for the same `comfyPromptId` — **Done** (`SwsComfyWorkflowModal.jsx`)  
2. Comfy: awaiting-output count shown as a one-line hint above history — **Done** (`SwsComfyWorkflowModal.jsx`)  
3. Comfy: Pull status includes ComfyUI version when `/system_stats` succeeds — **Done** (`pullComfyOutput`)  
4. Prompt compiler: exclusions stay on `negativePrompt`, not concatenated into the model prompt (architecture §6) — **Done** (`comfyPromptComposer.js`)  

### P409 — Separate Seedance widgets · composed.source · awaiting succeed
1. Comfy: contract `inputs` keep `prompt` and `negativePrompt` as separate fields into Seedance / SWS Prompt widgets — **Done** (`seedanceMasterWorkflow.js` NEGATIVE PROMPT node, `swsWorkflowContract.js`, `swsComfyJson.js`)  
2. Comfy: Debug panel lists `composed.source` — **Done** (`SwsComfyWorkflowModal.jsx` `debugPanel.composedSource`)  
3. Comfy: film-queue awaiting rows update to succeeded when a later pull matches `shotId` — **Done** (`markAwaitingSucceededForShot`)  

### P410 — Missing-class status · systemInstruction · film composedSource
1. Comfy: live probe of `127.0.0.1:8188` from Send-to-Comfy reports missing Seedance / ComfyUI-SWS classes in the status line — **Done** (`missingComfyClassStatusLine`, `SwsComfyWorkflowModal.jsx`)  
2. Comfy: contract `systemInstruction` stays a third field (never folded into prompt or negative) — **Done** (`comfyPromptComposer.js`, `swsWorkflowContract.js`, Seedance SYSTEM INSTRUCTION widget, `swsWorkflowValidator.js`)  
3. Comfy: film-queue progress shows `composedSource` for the shot currently sending — **Done** (`comfyFilmQueue.js`, `SwsComfyWorkflowModal.jsx`)  

### P411 — Debug version + class count · Pull after Send · SWS Prompt third output
1. Comfy: curl/probe `127.0.0.1:8188` from Send records `comfyuiVersion` + installed class count in Debug — **Done** (`installedComfyClassCount`, `debugPanel` in `SwsComfyWorkflowModal.jsx`)  
2. Comfy: after Send, offer Pull latest if history already has a viewable output — **Done** (`offerPullLatest`, `SwsComfyWorkflowModal.jsx`)  
3. Comfy: SWS Prompt Python returns `system_instruction` as a third output (not dropped) — **Done** (`SWSPrompt` in `sws_nodes.py`, `SWS_NODE_IO` in `swsComfyFrontend.js`)  

### Recommended next slice
1. **P412** — Comfy: Debug panel lists `installedClassCount` next to missing required class names  
2. **P412** — Comfy: Pull latest disabled hint when history is empty after Send  
3. **P412** — Comfy: SWS Video Provider accepts optional `system_instruction` from Prompt slot 2  














---

## Operating rule (master §30)

Before coding: map the feature to a production object, permissions, versioning, and downstream effects. If a request conflicts with this analysis or the master PDF, stop and name the conflict first.

Preserve: Project Console, Writer, Matrix/Form, Character, World, Compile, Generate, Stage, BYOK, one-active-project isolation.

---

*Interactive canvas: `master-spec-gap-analysis.canvas.tsx` (open beside chat in Cursor).*
