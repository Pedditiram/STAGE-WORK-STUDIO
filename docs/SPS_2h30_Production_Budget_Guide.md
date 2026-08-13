# Stage Production Studio
## Budget & Maintenance Guide — Idea → 2:30 Cinema

**Version:** Aug 2026 planning envelope  
**Product:** Stage Production Studio (SPS)  
**Scope:** Cursor · Vercel · GitHub · LLMs · Domain hosting · Video gen (hybrid / VFX / edit)

> These are **planning envelopes, not vendor quotes**. Re-check live pricing before purchase orders. Regen is the budget killer — prove look with Promo Pack / Compiler before mass generation.

---

## 1. Planning tiers (pick one)

| Tier | Monthly platform ops | One 2:30 film envelope | Year (ops + 1 film) |
|------|----------------------|------------------------|---------------------|
| **Studio ops only** | ~$180 | — | ~$2,160 |
| **2:30 hybrid cinema** (recommended) | ~$320 | ~$103,000 | ~$106,840 |
| **2:30 AI-heavy cinema** | ~$480 | ~$312,000 | ~$317,760 |

### Hybrid film line items (recommended)

| Line | USD |
|------|-----|
| LLM / intelligence | $2,800 |
| Video generation | $45,000 |
| VFX · edit · finish | $38,000 |
| Domain · host extras | $400 |
| Contingency (20%) | ~$17,240 |
| **Film total** | **~$103,440** |

### AI-heavy film line items

| Line | USD |
|------|-----|
| LLM / intelligence | $8,500 |
| Video generation | $185,000 |
| VFX · edit · finish | $55,000 |
| Domain · host extras | $900 |
| Contingency (25%) | ~$62,350 |
| **Film total** | **~$311,750** |

**Assumptions for 2:30 (150 min):** ~1,500–2,200 Matrix shots at ~4–6s average; Promo Pack for trailer/teaser/reels; video regen multiplier **2.5×** (hybrid) to **5×** (AI-heavy).

---

## 2. Pipeline — core idea → production

| # | Phase | Owner | SPS / tools |
|---|--------|--------|-------------|
| 1 | Core idea | Director / Writer | Writer Console, Master Synopsis |
| 2 | Screenplay | Writer | Screenplay Editor, voice-to-type, Telugu/EN |
| 3 | Bibles | Creative | Character Vault, World Console, Director Psychology |
| 4 | 26-Craft Matrix | AD / Craft leads | Matrix, Form, Studio Brain |
| 5 | Compile prompts | Pipeline | Compiler, Promo Pack, Master Cinema frame |
| 6 | Video generation | AI / VFX | Seedance, Kling, Runway, Veo, Sora |
| 7 | Edit · VFX · grade | Post | Hybrid edit, VFX, DI, sound |
| 8 | Ship & host | Prod / Eng | Vercel, domain, GitHub, backups |

---

## 3. Cursor — engineering & agent maintenance

### Budget

| Item | Monthly |
|------|---------|
| Cursor Pro (1 designer-dev) | $20 |
| Cursor Business / extra seats | $40–$80 |
| Agent / SDK automation (optional) | $0–$50 |

### Guidelines

- One seat owns deploy + Compiler / Promo / Matrix bugs.
- Keep `.cursor` rules: deploy-with-token, no silent project archive, Vercel-first.
- **Weekly:** smoke Promo Pack, Compiler, sync, Writer Console.
- **After every ship:** hard-refresh check on production URL (`⌘⇧R`).
- Deploy with valid token: `npx vercel --prod --yes --token $VERCEL_TOKEN`
- Never commit secrets (`.env`, OIDC, API keys).
- Rebuild Electron only after web prod is green.

---

## 4. Vercel — projects · storage · database · deployment

### Projects & deployment

| Item | Guidance |
|------|----------|
| Plan | **Pro** ($20/seat + $20 usage credit) for commercial SPS |
| Hobby | Personal R&D only — pauses on overage |
| Project | `stage-production-studio` · lock production alias |
| Preview | Every PR / branch preview before promoting |
| CLI | `npx vercel --prod --yes --token $VERCEL_TOKEN` |
| Spend alerts | Soft $50 then $150; optional hard stop |

### Storage (Blob)

| Use | Budget cue |
|-----|------------|
| Character / world plates | Start 20–100 GB · ~$0.023/GB on Pro |
| Compiled prompt packs / ZIP | Cheap; watch transfer $ |
| Generated video masters | **Prefer R2 / S3 / Drive / NAS** — not Blob alone |
| Hobby free | 1 GB + 10 GB transfer — not enough for a feature |

### Database

| Layer | Role |
|-------|------|
| Neon / Postgres (if wired) | Projects, rooms, sync, OTP |
| Vercel KV / Redis (optional) | Session / rate limits |
| IndexedDB + localStorage | Offline vault, Studio Brain |
| Cloud sync API (`api/sync.js`) | Never tombstone live titles |

**Warning:** Do not store 150 minutes of masters on Vercel Blob. Use Blob for app assets; park cinema renders on object storage or editorial NAS; link refs in Matrix / World Console.

Typical Pro + Blob + Functions for SPS collab: **~$45–$160 / month** inside the ops envelope.

---

## 5. GitHub — source of truth

### Budget

| Item | Monthly |
|------|---------|
| GitHub Free (private) | $0 |
| GitHub Team (recommended) | $4 / user |
| Actions minutes overage | $0–$20 |

### Guidelines

- `main` = production; feature branches for Promo / Compiler work.
- Protect `main`: PR + build green before merge.
- Tag releases: `sps-web-YYYYMMDD` after Vercel promote.
- Secrets only in Vercel / GitHub Actions — never in repo.
- Ignore `release/` Electron binaries in git.

---

## 6. Intelligence — LLMs for AI cinema

Route by job: flagship for synopsis / psychology / hard breakdown; mid for craft fill; cheap for captions, tags, batch cleanup.

| Model family | Best SPS job | In / Out (per 1M tokens) | Film cue |
|--------------|--------------|--------------------------|----------|
| GPT-5.6 Sol | Director psychology, hard scenes | $5 / $30 | Hero passes |
| GPT-5.6 Terra | 26-craft Matrix breakdown | $2 / $12 | Workhorse |
| GPT-5.6 Luna | Captions, tags, Promo VO | $0.20 / $1.20 | Batch cheap |
| Claude Sonnet 5 | Script polish, Bible prose | $2 / $10 | Writer assist |
| Claude Opus / high | Story surgery, continuity | ~$5 / $25 | Selective |
| Gemini 3.x Pro / Flash | Long script + PDF extract | ~$2 / $12 · Flash lower | Long context |
| Grok 4.x | Alt takes / brainstorm | ~$2 / $6 | Optional |

### Suggested mix (one 2:30 breakdown + iterate)

| Bucket | Share |
|--------|-------|
| Terra / Flash craft | ~55% |
| Sol / Opus hero | ~20% |
| Luna / Haiku batch | ~25% |

**SPS wiring:** Keep Admin `targetModel` + API keys in Vercel env. Prefer server routes for keys. Cache craft presets in Studio Brain to cut repeat tokens.

---

## 7. Domain hosting

| Item | Cost / notes |
|------|----------------|
| .com / .studio domain | $12–$40 / year |
| Vercel DNS + SSL | Included on project |
| Pro free 1st-year domain offer | Claim within 30 days if eligible |
| Email (Google / Zoho) | $0–$7 / user / mo |
| Status page (optional) | $0–$20 / mo |

### Checklist

1. Buy domain → add in Vercel Project → Domains  
2. Point A / CNAME per Vercel DNS instructions  
3. Enforce HTTPS; apex + www both redirect  
4. Map custom host → production (`stage-production-studio.vercel.app`)  
5. Update Electron / marketing links to the custom host  
6. Calendar reminder 30 days before domain renewal  

---

## 8. Video gen — hybrid · VFX · editing · generation

Compiler **Master Cinema** prompts feed image→video suites. Finished picture ≈ **9,000 seconds**; billed generation is higher due to takes.

| Engine | Role in SPS | ~$/sec cue | Use |
|--------|-------------|------------|-----|
| Seedance 2.0 | Primary I2V from First/Last frame | $0.24–$0.68 | Hero motion |
| Kling 3.0 | Coverage / action volume | $0.08–$0.17 | Volume |
| Runway Gen-4 / 4.5 | Controlled camera / edit tools | $0.05–$0.12 | Precision |
| Veo 3.1 | Audio-aware plates | $0.10–$0.40 | Select scenes |
| Sora 2 / Pro | High-spec hero beats | $0.10–$0.70 | Key moments |
| SeeDream / stills | Keyframes for conditioning | per image | Frame 0 / end |

### Generation
- Promo Pack → beat prompts  
- Compiler suite → shot prompts  
- Batch by scene; lock Character ID  
- Hybrid video line: **~$45k** · AI-heavy: **~$185k**

### Hybrid + VFX
- AI for plates / crowd / skies  
- Practical + CG for hero fights  
- Continuity pass per scene bible  

### Editing
- Assembly from Matrix order  
- Trailer / Teaser / Reels from Promo Pack  
- DI · sound · titles (last 2–3s cards)  
- VFX/edit line: **~$38k** (hybrid) · **~$55k** (AI-heavy)

### Critical rule
Plan **2.5×–5×** generated seconds vs final cut. Lock prompts in Compiler before mass gen. Use **Manual Edit + AI Enhanced** in Promo Pack for trailers first — prove look before burning the feature envelope.

---

## 9. Maintenance rhythm (keep production ready)

| Cadence | Action | Owner |
|---------|--------|--------|
| Daily | Cloud sync health; no silent project archive | Eng |
| Weekly | Promo + Compiler smoke; LLM key quotas | Eng / Pipeline |
| Weekly | Vercel usage vs spend alert | Producer |
| Per deploy | Build green → prod → hard refresh Safari | Eng |
| Per film | Freeze Craft Matrix; export JSON + prompt ZIPs | AD |
| Monthly | Blob / DB backup snapshot; rotate tokens | Eng |
| Quarterly | Re-price LLM + video APIs; update Admin models | Producer |

---

## 10. One-page summary (hybrid recommended)

```
Monthly ops (hybrid) .............. ~$320
LLM / intelligence ................ ~$2,800
Video generation .................. ~$45,000
VFX · edit · finish ............... ~$38,000
Domain · host extras .............. ~$400
Contingency (20%) ................. ~$17,240
──────────────────────────────────────────
2:30 film envelope ................ ~$103,440
Ops × 12 months ................... ~$3,840
──────────────────────────────────────────
Year (ops + one film) ............. ~$107,280
```

---

## Disclaimer

Not a vendor quote. Cross-check Vercel, OpenAI, Anthropic, Google, xAI, Runway, Kling, and Seedance pricing pages before POs. **Stage Production Studio** owns the craft → prompt spine; video APIs and post finish the picture.

---

*Generated for Pedditi Labs · Stage Production Studio · Aug 2026*
