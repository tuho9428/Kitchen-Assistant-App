# Shared Kitchen Prep Book

Open the app and start looking up dishes. The app needs no account, password or login. Everyone using the app can add, edit and back up dishes. Everyone can manage timer settings and permanently delete dishes after typing the dish name. Recipes and shared favorites are saved in the existing **Neon PostgreSQL** database.

## Run

The project is at C:\Tu\Kitchen-Assistant-App. Its existing .env.local already contains DATABASE_URL. Keep that server-only connection string private; it is never sent to browsers.

```text
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The app automatically creates its isolated kitchen_prep schema and imports all 56 original dishes on first use. No SQL editor, login, Supabase project or extra credentials are required. Existing neon_auth and other database tables are untouched. Initial seeding is atomic and recorded once, so restarts and seed reruns preserve edits and deletions.

## Use

- Search names or ingredients instantly with multiple partial terms, or filter by category.
- Type to see up to five actual dish recommendations, ranked by dish name before ingredient matches. Tap one to open its prep directly, or use the arrow keys and Enter.
- Focus an empty search to reuse up to six recent searches. History is saved per device when opening a matching dish or pressing Enter. Use Clear in the history list to remove it; recipe data and shared favorites remain in Neon.
- Open Menu for Add dish, favorites, practice, hidden dishes, backups and sync. The menu stays collapsed until opened, leaving more room for cards.
- Open dishes to see exact prep groups, container sizes, quantities, notes and original source pages.
- Star dishes to add them to the shared favorites; the whole kitchen uses the same list.
- Hide dish removes a whole dish from normal lookup, favorites and practice without changing its recipe or favorite status. Open Hidden dishes to restore it. Visibility is shared and saved in Neon; JSON exports still include hidden recipes.
- Practice with a random dish and reveal the ingredients when ready.
- Add or edit dishes directly. Saved rows appear immediately; other devices update on focus, manual Sync or the 30-second visible-page sync.
- Delete only after typing the dish name. Stale edits/deletions are rejected rather than overwriting another person's changes.
- Export JSON backups. Imports show current and backup contents and default to adding new IDs. Replacement requires explicit review. An import is atomic and stops if a reviewed dish changed.

The original data/dishes.json remains unchanged: 56 English dishes in 8 categories. All text and source-page references are preserved, including five dishes with notes but no ingredient groups. Mongolian Beef remains M → Beef; L → Red onion, Green onion. The supplied vocabulary glossary is not treated as the recipe PDF.

When Neon is temporarily unavailable, a saved device snapshot is used where available; the original reference remains the server fallback with a visible notice. Failed edits keep the draft open. The app never claims that a local-only change was saved; PostgreSQL is the source of truth and there is no localStorage or local database fallback for shared recipe edits. Active timers and search history are device-local.

## Database

The schema is in db/migrations/001_shared_prep.sql. Its statements are also bundled in lib/neon-schema.ts so Vercel and local startup can initialize safely. The application validates inputs and uses parameterized PostgreSQL queries, conflict-safe stored functions, foreign keys and cascading favorite deletion. The database connection stays in server-only code. Everyone who can use this shared app can edit it, as requested.

The unused Supabase implementation was archived outside the project. The running app uses only the existing Neon connection.

## Timers

The bottom navigation has Prep book and Timers tabs. Anyone can start custom timers or enabled shared presets from Timers, with independent pause, resume, cancel and repeating sound alarms. A compact indicator stays visible while using the rest of the app. Use Enable sound after a reload if needed; browsers require a user gesture for audio.

Active timers stay in this browser's localStorage. Remaining time is calculated from an absolute completion timestamp, including after navigation, reload or browser sleep. Pausing saves the remaining duration; resuming creates a new deadline. Keep the browser open for sound: suspended or closed browsers can delay alarms. No countdown jobs, ticks or active timer state are stored in Neon.

Shared presets and dish timer switches are stored in Neon, using db/migrations/003_timers.sql (also bundled in lib/timers/schema.ts). Schema initialization is automatic and adds no presets or durations. Every dish starts with timers disabled. Recipe notes, including the Chicken Wings cooking instruction, are never converted into durations. Anyone can manually create presets and enable Start Timer per dish in Timer settings. Disabling a dish or removing a preset leaves already-running timers intact.

Open Timer settings at /timers/settings to create or edit presets and enable timers per dish. For an enabled dish, choose the saved-preset dropdown, enter default minutes and seconds directly, or enter a duration each time. Direct dish defaults save independently of shared presets. These shared changes save to Neon without signing in. Existing /admin/timers links redirect there. Migration 004_shared_timers.sql enables shared editing while preserving saved presets, dish settings and recipes.

For deployment, only the existing server-only DATABASE_URL is required. TIMER_ADMIN_USERNAME, TIMER_ADMIN_PASSWORD, ADMIN_PASSWORD and TIMER_SESSION_SECRET are no longer used and can be removed from Vercel. Do not commit .env.local.

Timer configuration is cached on each device for one hour, including across reloads. Focus and visibility events reuse fresh settings; overlapping requests share one fetch. Saving settings forces a refresh and notifies other tabs on the same origin. Reconnecting or using Refresh presets on Timers also forces a refresh. A saved-change revision also survives navigation or reload before the refresh finishes, preventing an older snapshot from being treated as fresh. Other devices retain their one-hour copy until expiry, reconnect, or Refresh presets; no realtime connection is used. Unchanged responses do not replace the React configuration state. Countdown ticks never fetch configuration. Successful HTTP responses use a private one-hour cache, while forced refreshes bypass it.

## Main tab navigation

Prep book and Timers switch locally without a document reload, online or offline. Their view state (search, filters, scroll position and timer form drafts) is kept for up to one hour of inactivity. Active timers live outside the cached views and are unaffected by view expiration. Returning to Prep book checks shared data in the background only when the last automatic read is at least 30 seconds old. Activation, focus and polling share one in-flight request; rapid tab switches do not cause duplicate reads. Manual Sync and reconnect force a fresh read. Main route links are fully prefetched for a one-hour client cache; dynamic settings pages keep their normal freshness.

## Offline use

Open the production app online on each device, open Menu, and wait for **Offline ready**. The menu shows the last prep-book sync time. The app then supports reopening and refreshing the prep book, dish details, search, category filters, practice and timers without internet. Saved favorites and hidden-dish visibility remain available for reading.

The service worker saves an offline page, its JavaScript/CSS/fonts, icons and sounds/sounds_1.mp3. IndexedDB stores validated snapshots of the latest dishes, favorites, hidden IDs and timer configuration. Timers continue in localStorage with absolute deadlines. The alarm MP3 is decoded from the local cache after enabling sound; the app must remain open for reliable alarms.

While offline, an indicator shows the last sync time. Recipe edits, favorite/visibility changes, deletion, imports and shared timer settings are disabled. Nothing is queued or represented as saved to Neon. Reconnecting refreshes the open prep book and timer configuration automatically. Conflicts continue to use existing server version checks.

Offline support requires HTTPS (as on Vercel) or localhost, an online first load and browser storage. A fresh device or one whose site data was cleared needs another online load. Invalid or missing snapshots show an explicit message instead of pretending to contain the latest dishes. Browsers may remove stored site data; reopen online to refresh it. Add to Home Screen is optional.

Service workers are enabled in production builds, including browser tests. For local offline verification use:

```text
npm run build
npm start
```

The development server remains optimized for live code changes and does not register the offline service worker. Offline assets are refreshed online as complete versioned copies; a failed download leaves the prior complete copy available. Server actions, API responses and database credentials are never put in the service-worker cache.

## Browser console troubleshooting

Hydration warnings listing data-qb-installed, fdprocessedid or an unexpected suppresshydrationwarning HTML attribute indicate a browser extension changed the page before React loaded. Those attributes are not emitted by Kitchen Prep. Disable writing-assistant, autofill or form-processing extensions for localhost, or test in an extension-free browser profile. App hydration warnings are not globally suppressed.

The React DevTools suggestion and HMR connected messages are normal development logs. A failed /__nextjs_font/geist-mono-latin.woff2 request while offline belongs to the Next.js development overlay. Test offline behavior with a production preview after Menu shows Offline ready; development does not install the offline service worker.

Development writes to .next-dev, production to .next, and browser tests to .next-e2e. This prevents a running development server from overwriting production scripts, styles or manifests. Restart existing servers after changing build configuration.

## Verify

```text
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Browser tests use installed Chrome and a loopback Neon-compatible HTTP endpoint backed by PostgreSQL/PGlite, with fake credentials. They exercise the real Next.js production build and SQL queries without changing the restaurant's live dishes. Live verification uses temporary records only and removes them afterward.

## Vercel

No deployment has been performed. After approval, deploy with the Next.js preset, npm ci and npm run build. Add the existing Neon DATABASE_URL as a server-side environment variable. No NEXT_PUBLIC database credentials or login callback settings are needed. Development and build use the supported webpack path on this Windows setup.
