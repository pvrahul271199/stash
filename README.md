# Stash

A calm expense tracker built around one question: **"How much can I spend today?"**

Stash divides your monthly money to live on (`income - bills - savings`) by the days until your next salary. Spend less and every day ahead gets a little more; spend more and every day ahead adjusts gently. All data lives locally on your device in IndexedDB and the app works completely offline after the first visit.

---

## Tech Stack

- **Framework:** Next.js (App Router, static export `output: 'export'`, strict TypeScript)
- **Styling:** Tailwind CSS with custom design tokens + self-hosted `Bricolage Grotesque` & `Figtree` via `next/font/google`
- **Database:** IndexedDB via Dexie + `dexie-react-hooks` (`useLiveQuery`)
- **UI State:** Zustand (UI state only; money data is always read from Dexie)
- **Charts:** Custom interactive SVG components (daily bars, running total, linked category donut, weekday & time-of-day breakdowns)
- **PWA:** Web app manifest (`app/manifest.ts`), generated icons (`scripts/gen-icons.mjs`), and precaching service worker (`public/sw.js` + `scripts/build-sw.mjs`)
- **Tests:** Vitest (unit & database logic) + Playwright (mobile `390×844` and desktop end-to-end flows)

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run in development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On desktop browsers, Stash previews inside a centered `380×780` phone frame; on mobile viewports (`≤ 420px`) or when installed as a standalone PWA, it fills the screen with safe-area insets.

---

## Testing

### Unit & Database Tests (Vitest)

Runs 56 tests covering budget math, overspend/underspend spreading, big spend rules, calendar sync, catch-up estimates, pace/projection, sample generation, CSV formatting, and Dexie queries:

```bash
npm test
```

### Typecheck

```bash
npm run lint
```

### End-to-End Tests (Playwright)

First build the static export, then run Playwright (tests run against both `mobile` `390×844` and `desktop` viewports):

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

---

## Building the Static Export

```bash
npm run build
```

This runs `next build` to output the static site into `out/` and then runs `scripts/build-sw.mjs` to inject the content-hashed version and precache manifest into `out/sw.js`.

To preview the production static export locally:

```bash
node scripts/serve-out.mjs
```

Then visit [http://127.0.0.1:3100](http://127.0.0.1:3100).

---

## Deploying to Vercel (or any static host)

1. Push the repository to GitHub / GitLab / Bitbucket, or run the Vercel CLI:
   ```bash
   npx vercel --prod
   ```
2. **Build Command:** `npm run build`
3. **Output Directory:** `out`
4. HTTPS is provided automatically by Vercel, which is required for Service Worker registration and PWA installation.

---

## Installing on Phones

### Android (Chrome)
1. Open the deployed HTTPS URL in Chrome.
2. Tap the **Install Stash** prompt (or open **Plan** inside the app and tap **Install Stash**, or use Chrome's menu → **Add to Home screen / Install app**).
3. Launch **Stash** from your home screen. It opens full-screen without browser chrome and works offline.

### iPhone (Safari, iOS 16.4+)
1. Open the deployed HTTPS URL in **Safari**.
2. Tap the **Share** button at the bottom of Safari.
3. Scroll down and tap **Add to Home Screen**, then tap **Add**.
4. Open **Stash** from your home screen. It runs in standalone full-screen mode and works offline.
