`dishes.json` is the original, unchanged 56-dish English dataset copied from `C:\Tu\Kitchen-Assistant-App\data\dishes.json`.

`seedRows` in `lib/dishes.ts` validates all 56 unique IDs and maps only `sourcePage` to the database column `source_page`. IDs, names, categories, groups, quantities, notes and page numbers are preserved. Optional group labels are supported for later editing; labels are not added to the original groups. Sizes describe preparation groups, not servings.

The app automatically initializes and seeds its Neon schema. `npm run seed` is also available for manual initialization. The initial seed skips existing IDs, including edited dishes. An atomic seed ledger makes every later run a no-op, so later deletions are preserved too. The source file is never changed by seeding or app edits. Backups use version 1 with the database’s snake_case source page and audit metadata; import/export round-trips preserve all recipe content.
