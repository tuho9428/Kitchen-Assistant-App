# Shared Kitchen Prep Book

Open the app and start looking up dishes. There are no accounts or login screens. Everyone using the app can add, edit, delete and back up dishes. Recipes and shared favorites are saved in the existing **Neon PostgreSQL** database.

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

When Neon is temporarily unavailable, the original reference remains searchable with a visible notice. Failed edits keep the draft open. The app never claims that a local-only change was saved; PostgreSQL is the source of truth and there is no localStorage or local database fallback.

## Database

The schema is in db/migrations/001_shared_prep.sql. Its statements are also bundled in lib/neon-schema.ts so Vercel and local startup can initialize safely. The application validates inputs and uses parameterized PostgreSQL queries, conflict-safe stored functions, foreign keys and cascading favorite deletion. The database connection stays in server-only code. Everyone who can use this shared app can edit it, as requested.

The unused Supabase implementation was archived outside the project. The running app uses only the existing Neon connection.

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




