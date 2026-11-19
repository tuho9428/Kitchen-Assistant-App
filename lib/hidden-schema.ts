// Mirrors db/migrations/002_hidden_dishes.sql.
export const hiddenSchemaStatements = [
  "select pg_advisory_xact_lock(hashtextextended('kitchen-prep-hidden-v2',0));",
  "create table if not exists kitchen_prep.hidden_dishes(dish_id text primary key references kitchen_prep.dishes(id) on delete cascade,hidden_at timestamptz not null default now());",
  "insert into kitchen_prep.schema_migrations(version) values(2) on conflict do nothing;",
];
