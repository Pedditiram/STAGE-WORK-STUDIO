# Production notes — Stage Production Studio

## Owner / Admin login (do not lock yourself out)

**Primary Owner:** `pedditiram@gmail.com` (always Owner; never removed from collaborators).

### Recommended unlock path
1. Open the app → **Login** → **Gmail / Email** tab.
2. Enter `pedditiram@gmail.com` → launch workspace (Owner session).
3. Open **Admin Settings** → Authenticate (password optional while Owner email session is active).
4. Set a **strong custom Admin ID + password** (min 10 chars; not `admin123` / similar).

### Studio Admin password tab
- Accepts **only** a strong custom password stored in the browser.
- Weak defaults (`admin` / `admin123` / `sps2026` / `studio2026`) and “any password” bypasses are **disabled**.
- OTP recovery still works for the authorized admin email; the new password must be strong.
- Recovery OTP is **always shown in-UI**. Optional email delivery runs only when Resend env vars are set (see below).

### Collaborators
- Sign in with an allotted email, or an invite OTP from the Owner.

---

## Durable sync (Vercel serverless)

Default durable store: **JSONBlob** (public, ~10KB, rate-limited). The API:

- Retries with backoff on 429; opens a short circuit breaker so PUTs do not thrash.
- Coalesces concurrent durable writes in a warm instance.
- Refuses empty / failed-hydrate overwrites for projects, collaborators, rooms, and chat.
- Keeps RESTFUL hubs as best-effort secondary.
- **Without KV secrets the app keeps working** on JSONBlob — no fake tokens required.

### Optional stronger durable (recommended if JSONBlob keeps rate-limiting)

`api/sync.js` prefers Upstash / Vercel KV when configured. REST uses the Upstash **command-array** format:

`POST <REST_URL>` body `["GET"|"SET", "sps:…", value?]`.

#### 1) Create an Upstash Redis database
1. Open [https://console.upstash.com](https://console.upstash.com) (or Vercel → Storage → Create → Upstash Redis).
2. Create a free Redis DB.
3. Copy **REST URL** and **REST TOKEN**.

#### 2) Add env vars on Vercel (dashboard — you must paste secrets)

| Env (preferred) | Also accepted aliases | Purpose |
|-----------------|----------------------|---------|
| `SPS_KV_REST_URL` | `KV_REST_API_URL`, `UPSTASH_REDIS_REST_URL` | REST base URL (e.g. `https://….upstash.io`) — **no** trailing path |
| `SPS_KV_REST_TOKEN` | `KV_REST_API_TOKEN`, `UPSTASH_REDIS_REST_TOKEN` | REST token |

Keys used: `sps:rooms`, `sps:projects`, `sps:collaborators`, `sps:chat`, `sps:presence`.

**Dashboard (clearest):** Vercel project → **Settings → Environment Variables** → add both for **Production** (and Preview if you want) → Redeploy.

**CLI (after `vercel login`):**

```bash
# Paste the real values from Upstash — do not invent tokens
printf '%s' 'https://YOUR-db.upstash.io' | npx vercel env add SPS_KV_REST_URL production
printf '%s' 'YOUR_UPSTASH_REST_TOKEN' | npx vercel env add SPS_KV_REST_TOKEN production
npx vercel --prod
```

If the Vercel Marketplace Upstash integration already injected `KV_REST_API_*` or `UPSTASH_REDIS_REST_*`, you do **not** need the `SPS_KV_*` copies — aliases are read automatically.

---

## Optional OTP email (Resend)

Endpoint: `POST /api/send-otp` (`api/send-otp.js`).

| Env | Purpose |
|-----|---------|
| `SPS_RESEND_API_KEY` (or `RESEND_API_KEY`) | Resend API key — **required for real email** |
| `SPS_OTP_FROM_EMAIL` | From address (default `onboarding@resend.dev` sandbox) |
| `SPS_OTP_FROM_NAME` | From display name (default `Stage Production Studio`) |

### Setup
1. Create a free key at [https://resend.com](https://resend.com).
2. Add `SPS_RESEND_API_KEY` in Vercel → Environment Variables → Production.
3. For production recipients beyond your own inbox, verify a domain in Resend and set `SPS_OTP_FROM_EMAIL` to an address on that domain.
4. Redeploy.

### Behavior
- **Configured:** recovery + invite OTPs are emailed; UI still shows the code.
- **Not configured / Resend fails:** API returns `{ emailed: false, fallback: true }` — **in-UI OTP remains** so Owner is never locked out.

```bash
printf '%s' 're_xxxxxxxx' | npx vercel env add SPS_RESEND_API_KEY production
npx vercel --prod
```

---

## Deploy web

```bash
npx vercel login          # if CLI token is expired
npm run deploy:web        # vercel --prod
```

Requires a valid Vercel session. If CLI says the token is invalid, re-login in the browser, then redeploy.

---

## Electron (macOS)

```bash
npm run electron:build:dir   # unpackaged .app under release/
npm run electron:pack        # DMG when needed
```

### Code signing & Gatekeeper
- **No paid Apple Developer cert required** for local/dir builds.
- Scripts set `CSC_IDENTITY_AUTO_DISCOVERY=false` when no cert is present — **builds do not fail** looking for signing identities.
- Without `CSC_LINK` / `CSC_NAME` / `APPLE_IDENTITY`, the build is **ad-hoc / unsigned** — Gatekeeper will warn on first open.
- Optional signing: `export CSC_NAME="Developer ID Application: Your Name (TEAMID)"` then rebuild.
- **Notarization is not wired** (needs Apple ID + app-specific password + Team ID). Until a paid **Developer ID Application** cert is installed, distribution outside your Mac will keep hitting Gatekeeper.
- First-open workaround: right-click → Open, or `xattr -cr "release/mac-arm64/Stage Production Studio.app"`.

Hardened runtime + entitlements are configured in `package.json` / `build/entitlements.mac.plist`.

---

## Residual checklist

| Item | Status |
|------|--------|
| Durable JSONBlob path | Done — works without secrets |
| Upstash / Vercel KV | **Done** — `KV_REST_API_*` on Vercel; `/api/sync?type=projects` returns `kvConfigured: true` |
| Resend OTP email | **Done** — `SPS_RESEND_API_KEY` live; `POST /api/send-otp` returns `emailed: true` |
| Vercel deploy | Done (`npx vercel --prod`) |
| Apple Developer ID + notarization | **Still needs you** — enroll in Apple Developer Program ($99/yr), install **Developer ID Application** cert, then `export CSC_NAME="Developer ID Application: …"` and rebuild. Until then: unsigned/ad-hoc builds only (Gatekeeper workaround above). |
