select pg_advisory_xact_lock(hashtextextended('kitchen-dish-default-schema-v5',0));

-- statement-breakpoint

alter table kitchen_prep.dish_timer_settings add column if not exists default_duration_seconds integer check(default_duration_seconds between 1 and 86400);

-- statement-breakpoint

create or replace function kitchen_prep.save_dish_timer_options(p_dish_id text,p_enabled boolean,p_preset_id uuid,p_duration integer,p_expected timestamptz) returns kitchen_prep.dish_timer_settings language plpgsql set search_path='' as $$ declare saved kitchen_prep.dish_timer_settings; begin perform pg_advisory_xact_lock(hashtextextended('dish-timer:'||p_dish_id,0)); if p_preset_id is not null and p_duration is not null then raise exception 'Choose a saved preset or a default duration.'; end if; if p_enabled and p_preset_id is not null and not exists(select 1 from kitchen_prep.timer_presets where id=p_preset_id and enabled) then raise exception 'Choose an enabled preset or set a default duration.'; end if; if p_expected is null then insert into kitchen_prep.dish_timer_settings(dish_id,timer_enabled,preset_id,default_duration_seconds,updated_by) values(p_dish_id,p_enabled,p_preset_id,p_duration,null) returning * into saved; else update kitchen_prep.dish_timer_settings set timer_enabled=p_enabled,preset_id=p_preset_id,default_duration_seconds=p_duration,updated_by=null where dish_id=p_dish_id and updated_at=p_expected returning * into saved; if not found then raise exception 'Dish timer changed. Reload the latest setting before saving.'; end if; end if; return saved; end $$;

-- statement-breakpoint

revoke all on function kitchen_prep.save_dish_timer_options(text,boolean,uuid,integer,timestamptz) from public;

-- statement-breakpoint

insert into kitchen_prep.schema_migrations(version) values(5) on conflict do nothing;
