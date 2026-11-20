select pg_advisory_xact_lock(hashtextextended('kitchen-prep-schema-v1',0));

-- statement-breakpoint

create schema if not exists kitchen_prep;

-- statement-breakpoint

create or replace function kitchen_prep.valid_groups(value jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare g jsonb; item jsonb;
begin
  if jsonb_typeof(value) is distinct from 'array' then return false; end if;
  if jsonb_array_length(value) > 30 then return false; end if;
  for g in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(g) is distinct from 'object' or (g ? 'label' and (jsonb_typeof(g->'label') is distinct from 'string' or length(g->>'label') > 100)) or jsonb_typeof(g->'size') is distinct from 'string' or length(g->>'size') > 100 or jsonb_typeof(g->'ingredients') is distinct from 'array' then return false; end if;
    if jsonb_array_length(g->'ingredients') not between 1 and 100 then return false; end if;
    if (g - array['label','size','ingredients']) <> '{}'::jsonb then return false; end if;
    for item in select * from jsonb_array_elements(g->'ingredients') loop
      if jsonb_typeof(item) is distinct from 'string' or length(btrim(item #>> '{}')) = 0 or length(item #>> '{}') > 2000 then return false; end if;
    end loop;
  end loop;
  return true;
end $$;

-- statement-breakpoint

create or replace function kitchen_prep.valid_notes(value jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb;
begin
  if jsonb_typeof(value) is distinct from 'array' then return false; end if;
  if jsonb_array_length(value) > 100 then return false; end if;
  for item in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(item) is distinct from 'string' or length(btrim(item #>> '{}')) = 0 or length(item #>> '{}') > 2000 then return false; end if;
  end loop;
  return true;
end $$;

-- statement-breakpoint

create table if not exists kitchen_prep.dishes (
  id text primary key check (length(id) between 1 and 120 and id ~ '^[A-Za-z0-9_-]+$'),
  name text not null check (length(btrim(name)) > 0 and length(name) <= 200),
  category text not null check (length(btrim(category)) > 0 and length(category) <= 100),
  groups jsonb not null check (kitchen_prep.valid_groups(groups)),
  notes jsonb not null default '[]' check (kitchen_prep.valid_notes(notes)),
  source_page integer check (source_page > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  updated_by uuid
);

-- statement-breakpoint

create or replace function kitchen_prep.stamp_dish() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp(); new.updated_by = null;
  if TG_OP = 'UPDATE' then
    new.updated_at = greatest(new.updated_at, old.updated_at + interval '1 microsecond');
    new.created_at = old.created_at; new.id = old.id;
  end if;
  return new;
end $$;

-- statement-breakpoint

drop trigger if exists stamp_dish on kitchen_prep.dishes;

-- statement-breakpoint

create trigger stamp_dish before insert or update on kitchen_prep.dishes for each row execute function kitchen_prep.stamp_dish();

-- statement-breakpoint

create table if not exists kitchen_prep.favorites(dish_id text primary key references kitchen_prep.dishes(id) on delete cascade);

-- statement-breakpoint

create table if not exists kitchen_prep.seed_history(name text primary key,applied_at timestamptz not null default now());

-- statement-breakpoint

create or replace function kitchen_prep.save_dish(p_dish jsonb, p_expected timestamptz) returns kitchen_prep.dishes
language plpgsql security invoker set search_path = '' as $$
declare saved kitchen_prep.dishes;
begin
  -- Serializes create/update/delete/import for an ID, including concurrent inserts.
  perform pg_advisory_xact_lock(hashtextextended(p_dish->>'id',0));
  if p_expected is null then
    insert into kitchen_prep.dishes(id,name,category,groups,notes,source_page)
    values(p_dish->>'id',p_dish->>'name',p_dish->>'category',p_dish->'groups',p_dish->'notes',(p_dish->>'source_page')::integer) returning * into saved;
  else
    update kitchen_prep.dishes set name=p_dish->>'name',category=p_dish->>'category',groups=p_dish->'groups',notes=p_dish->'notes',source_page=(p_dish->>'source_page')::integer
    where id=p_dish->>'id' and updated_at=p_expected returning * into saved;
    if not found then raise exception 'This dish changed on another device. Keep your draft and reload the latest dish before saving.'; end if;
  end if;
  return saved;
end $$;

-- statement-breakpoint

create or replace function kitchen_prep.delete_dish(p_id text,p_expected timestamptz) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id,0));
  delete from kitchen_prep.dishes where id=p_id and updated_at=p_expected;
  if not found then raise exception 'Dish changed or was deleted. Reload before deleting.'; end if;
end $$;

-- statement-breakpoint

create or replace function kitchen_prep.import_dishes(p_rows jsonb,p_overwrite boolean default false) returns integer
language plpgsql security invoker set search_path = '' as $$
declare row jsonb; count integer := 0; exists_now boolean;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>2000 then raise exception 'Invalid backup'; end if;
  -- Sorted locks avoid deadlocks between concurrent imports. Entire operation is atomic.
  for row in select * from jsonb_array_elements(p_rows) order by value->'dish'->>'id' loop
    perform pg_advisory_xact_lock(hashtextextended(row->'dish'->>'id',0));
    select exists(select 1 from kitchen_prep.dishes where id=row->'dish'->>'id') into exists_now;
    if exists_now and not p_overwrite then continue; end if;
    if exists_now and row->>'expected' is null then raise exception 'A dish was added since preview. Preview again.'; end if;
    if not exists_now and row->>'expected' is not null then raise exception 'A dish was deleted since preview. Preview again.'; end if;
    perform kitchen_prep.save_dish(row->'dish',(row->>'expected')::timestamptz);
    count := count+1;
  end loop;
  return count;
end $$;

-- statement-breakpoint

create or replace function kitchen_prep.seed_original_dishes(p_dishes jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare inserted integer;
begin
  if jsonb_typeof(p_dishes) is distinct from 'array' then raise exception 'Seed must be a 56-dish array'; end if;
  if jsonb_array_length(p_dishes) <> 56 or (select count(distinct value->>'id') from jsonb_array_elements(p_dishes)) <> 56 then raise exception 'Seed needs 56 unique dish IDs'; end if;
  perform pg_advisory_xact_lock(hashtextextended('kitchen-original-seed-v1',0));
  if exists(select 1 from kitchen_prep.seed_history where name='original-56-v1') then return 0; end if;
  insert into kitchen_prep.dishes(id,name,category,groups,notes,source_page)
  select value->>'id',value->>'name',value->>'category',value->'groups',value->'notes',(value->>'source_page')::integer
  from jsonb_array_elements(p_dishes)
  on conflict(id) do nothing;
  get diagnostics inserted = row_count;
  insert into kitchen_prep.seed_history(name) values ('original-56-v1');
  return inserted;
end $$;

-- statement-breakpoint

create table if not exists kitchen_prep.schema_migrations(version integer primary key,applied_at timestamptz not null default now());

-- statement-breakpoint

insert into kitchen_prep.schema_migrations(version) values(1) on conflict do nothing;
