# Stage Production Studio — Brand Book

**Pedditi Labs · Stage Production Studio**  
Owner contact: [pedditiram@gmail.com](mailto:pedditiram@gmail.com)  
Living expression: in-app **Investor Deck & Studio Showcase**

---

## 1. Brand story & positioning

**Stage Production Studio** is cinema craft intelligence for directors who refuse to compromise the frame. It turns screenplay text into a production-ready **24-craft shot matrix**, with cloud rooms where Directors, DPs, and Editors co-author without overwrite chaos — then compiles prompt-ready keyframes for modern AI video pipelines.

**Pedditi Labs** is the maker mark: disciplined, cinematic, craft-first. Not “another AI writing tool.” Not purple SaaS. A director’s table that happens to ship as software.

### Positioning line
> Cinema craft intelligence for the modern slate.

### One-liner (investor)
> Cut pre-viz cost, accelerate turnaround, and keep directorial control — from script page to AI-ready keyframes.

### Audience
| Segment | What they need from the brand |
|--------|--------------------------------|
| Investors / prospects | Confidence, scale, clarity of moat |
| Collaborators | Precision, trust, allotment clarity |
| Guests | Showcase only — invite them in |

---

## 2. Logo & wordmark

No separate SVG logo file is required. Use the **typographic lockup** already in product:

| Element | Treatment |
|--------|-----------|
| Product | **Stage Production Studio** — `Syne` (display), bold/extrabold |
| Maker | **Pedditi Labs** — `Outfit`, uppercase or small caps tracking, cyan or muted slate |
| Icon mark | Film glyph in cyan→sky→blue gradient disc (header / splash / deck) |

### Lockup rules
1. Product name is the **hero-level signal** on pitch surfaces — never demote it to nav-only.
2. Pedditi Labs sits **above or beside** as maker mark (eyebrow), never louder than the product.
3. Prefer dark stage fields for lockups; paper mode uses deep slate on light panels.
4. Do not stretch, outline, or add purple/glow “AI” treatments.
5. Minimum clear space: roughly the height of the capital “S” around the wordmark.

### Incorrect
- Inter/Roboto/Arial as brand display
- Purple-on-white SaaS gradients
- Cream + terracotta “warm craft” clichés
- Dense broadsheet / hairline newspaper layouts

---

## 3. Color palette

Match elevated cinema UI tokens (`src/index.css`).

### Stage Dark (primary brand field)

| Token | Hex | Role |
|-------|-----|------|
| `--sps-bg` | `#07090f` | Stage black |
| `--sps-bg-elevated` | `#0e1219` | Elevated plane |
| `--sps-surface` | `#141a24` | Panels |
| `--sps-text` | `#e8edf5` | Primary text |
| `--sps-muted` | `#94a3b8` | Secondary |
| `--sps-accent` | `#22d3ee` | Cyan craft accent |
| `--sps-accent-2` | `#38bdf8` | Sky support |
| `--sps-warn` | `#f59e0b` | Amber craft / CTA heat |
| `--sps-success` | `#34d399` | Confirm / access |

### Paper mode
Light paper surfaces (`#f4f7fb` / white) with slate text; cyan/amber accents remain for craft signals. Director Canvas may stay force-dark.

### Atmosphere
Radial cyan / sky / amber washes on deep black + subtle film grain + vignette. Accents are **craft lights**, not decoration spam.

---

## 4. Typography

| Role | Family | CSS |
|------|--------|-----|
| Display / brand | **Syne** | `--sps-font-display` / `.font-display` |
| UI / body | **Outfit** | `--sps-font` |
| Data / codes | **JetBrains Mono** | `--sps-font-mono` |

### Hierarchy
- Hero product name: Syne extrabold, large, tight tracking
- Section titles: Syne bold
- Body / UI: Outfit medium–semibold
- Captions / room IDs: Mono, small

---

## 5. Voice & tone

| Do | Don’t |
|----|-------|
| Confident, cinematic, precise | Hype-y “disrupting Hollywood with AI!!!” |
| Craft vocabulary (slate, craft, keyframe, allotment) | Generic SaaS (“synergies”, “leverage”) |
| Short sentences for pitch | Jargon walls without payoff |
| Invite: Request access / Login / Contact Owner | Shame guests for browsing |

**Sample pitch sentence**  
“Stage Production Studio is the operating system for modern cinematic pre-production — script to 24-craft matrix, cloud sync, prompt-ready frames.”

---

## 6. UI patterns — do’s & don’ts

### Do
- Brand-first first viewport on Investor Deck (product name as hero)
- Cyan/amber accents on stage black
- Intentional motion (fade-up enter, aurora, title pulse) — 2–3+ on pitch surfaces
- Strong CTAs: Request access · Login · Contact Owner
- Guest = showcase only; collaborator = allotted projects

### Don’t
- Purple SaaS gradients or neon glow stacks
- Cream + terracotta “artisan” templates
- Broadsheet newspaper chrome
- Cards in the hero for decoration
- Guest access to Projects / Console / Settings / allotments

---

## 7. Photography & motion

### Visual guidance
- Deep blacks, practical stage light (cyan key, amber rim)
- Film grain, soft vignette, anamorphic suggestion — not stock “AI brain”
- Prefer product UI or typographic lockups over random people stock

### Motion
- Deck enter: fade + slight rise
- Atmospheric aurora drift
- Soft title glow pulse
- Prefer `cubic-bezier(0.22, 1, 0.36, 1)` easings; avoid bounce spam

Key visual asset: [`sps-brand-key-visual.png`](./sps-brand-key-visual.png)

---

## 8. Guest vs collaborator experience

| | Guest (unauthenticated) | Collaborator / Owner |
|--|-------------------------|----------------------|
| Investor Deck | ✅ Full showcase | ✅ |
| Projects / Console | ❌ → Deck | ✅ Allotted / Owner library |
| Studio editing views | ❌ → Deck | ✅ Per role |
| Admin / Settings | ❌ → Deck or Login | Owner only |
| Allotted projects list | Hidden | Shown |
| CTAs | Request access / Login / Contact Owner | Normal studio tools |

Enforcement: `isGuestSession()` in `projectPermissions.js`, Header, App, Project Console.

---

## Related files

- [PROMO_COPY.md](./PROMO_COPY.md) — pitch outline, social, email, WhatsApp
- [promo/investor-onepager.html](./promo/investor-onepager.html) — one-pager sheet
- [promo/social-og-sheet.html](./promo/social-og-sheet.html) — OG / social pattern
- In-app: `src/components/InvestorDeckModal.jsx`
