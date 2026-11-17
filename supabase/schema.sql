set client_min_messages = warning;
-- =============================================================================
-- Wonder Sync on Supabase — database setup
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste the
-- whole file -> Run. It is safe to run again later (it only (re)creates things).
--
-- Design: every Base44 entity (Game, PlayerState, Card, Wonder, Edifice,
-- ChainSymbol) lives in ONE table, `records`, with the entity name in a column
-- and the entity's fields in a JSON `data` column. That mirrors how Base44
-- stores data, keeps every existing record id and lets the app keep using the
-- same base44.entities.X.list/filter/create/update/... calls.
--
-- There are no logins: like the Base44 app, anyone with the link can play and
-- edit custom cards/wonders/edifices.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create or replace function public.new_record_id() returns text
language sql volatile as $$
  -- 24 hex chars, the same shape as Base44 ids.
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
$$;

create table if not exists public.records (
  id            text primary key default public.new_record_id(),
  entity        text not null,
  data          jsonb not null default '{}'::jsonb,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by    text,
  created_by_id text
);


create index if not exists records_entity_created_idx on public.records (entity, created_date desc);
create index if not exists records_game_idx on public.records (entity, (data->>'game_id'));
create index if not exists records_code_idx on public.records (entity, (data->>'code'));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The record as the app sees it: its fields plus the built-in ones.
create or replace function public.record_json(r public.records) returns jsonb
language sql immutable as $$
  select coalesce(r.data, '{}'::jsonb) || jsonb_build_object(
    'id', r.id,
    'created_date', r.created_date,
    'updated_date', r.updated_date,
    'created_by', r.created_by,
    'created_by_id', r.created_by_id
  )
$$;

-- Built-in fields are columns, never stored inside `data`.
create or replace function public.records_strip(p jsonb) returns jsonb
language sql immutable as $$
  select coalesce(p, '{}'::jsonb) - 'id' - 'created_date' - 'updated_date' - 'created_by' - 'created_by_id'
$$;

-- Reads one field of a record (built-in column, top-level field, or a.b path).
create or replace function public.record_field(r public.records, k text) returns jsonb
language sql immutable as $$
  select case k
    when 'id' then to_jsonb(r.id)
    when 'created_date' then to_jsonb(r.created_date)
    when 'updated_date' then to_jsonb(r.updated_date)
    when 'created_by' then to_jsonb(r.created_by)
    when 'created_by_id' then to_jsonb(r.created_by_id)
    else case when position('.' in k) > 0 then r.data #> string_to_array(k, '.') else r.data -> k end
  end
$$;

-- Equality the way Base44 (MongoDB) does it: null matches missing, and an
-- array field matches if it contains the value.
create or replace function public.json_eq(fv jsonb, v jsonb) returns boolean
language sql immutable as $$
  select case
    when v is null or v = 'null'::jsonb then (fv is null or fv = 'null'::jsonb)
    when fv is null then false
    when fv = v then true
    when jsonb_typeof(fv) = 'array' and jsonb_typeof(v) <> 'array' then fv @> jsonb_build_array(v)
    else false
  end
$$;

create or replace function public.json_cmp(fv jsonb, op text, v jsonb) returns boolean
language plpgsql immutable as $$
declare a numeric; b numeric; ta text; tb text;
begin
  if fv is null or fv = 'null'::jsonb or v is null or v = 'null'::jsonb then return false; end if;
  if jsonb_typeof(fv) = 'number' and jsonb_typeof(v) = 'number' then
    a := (fv #>> '{}')::numeric; b := (v #>> '{}')::numeric;
    return case op when '$gt' then a > b when '$gte' then a >= b when '$lt' then a < b else a <= b end;
  end if;
  ta := fv #>> '{}'; tb := v #>> '{}';
  return case op when '$gt' then ta > tb when '$gte' then ta >= tb when '$lt' then ta < tb else ta <= tb end;
end $$;

-- Does a record match a Base44-style filter object?
-- Supports: plain equality, $eq $ne $in $nin $gt $gte $lt $lte $exists
-- $regex (+ $options 'i'), and $or / $and / $nor.
create or replace function public.record_matches(r public.records, f jsonb) returns boolean
language plpgsql stable as $$
declare
  k text; v jsonb; op text; arg jsonb; fv jsonb; hit boolean; ci boolean;
begin
  if f is null or f = '{}'::jsonb then return true; end if;
  for k, v in select * from jsonb_each(f) loop
    if k = '$or' then
      if not exists (select 1 from jsonb_array_elements(v) e where public.record_matches(r, e)) then return false; end if;
    elsif k = '$and' then
      if exists (select 1 from jsonb_array_elements(v) e where not public.record_matches(r, e)) then return false; end if;
    elsif k = '$nor' then
      if exists (select 1 from jsonb_array_elements(v) e where public.record_matches(r, e)) then return false; end if;
    else
      fv := public.record_field(r, k);
      if jsonb_typeof(v) = 'object' and exists (select 1 from jsonb_object_keys(v) ok where left(ok, 1) = '$') then
        ci := coalesce(v->>'$options', '') ilike '%i%';
        for op, arg in select * from jsonb_each(v) loop
          if op = '$options' then continue; end if;
          if op = '$eq' then
            hit := public.json_eq(fv, arg);
          elsif op = '$ne' then
            hit := not public.json_eq(fv, arg);
          elsif op in ('$in', '$nin') then
            hit := exists (select 1 from jsonb_array_elements(arg) a where public.json_eq(fv, a));
            if op = '$nin' then hit := not hit; end if;
          elsif op in ('$gt', '$gte', '$lt', '$lte') then
            hit := public.json_cmp(fv, op, arg);
          elsif op = '$exists' then
            hit := ((fv is not null and fv <> 'null'::jsonb) = (arg = 'true'::jsonb));
          elsif op = '$regex' then
            if fv is null or jsonb_typeof(fv) <> 'string' then hit := false;
            elsif ci then hit := (fv #>> '{}') ~* (arg #>> '{}');
            else hit := (fv #>> '{}') ~ (arg #>> '{}');
            end if;
          else
            raise exception 'Unsupported filter operator: %', op;
          end if;
          if not hit then return false; end if;
        end loop;
      else
        if not public.json_eq(fv, v) then return false; end if;
      end if;
    end if;
  end loop;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Reads / writes the app calls (through src/api/base44Client.js)
-- ---------------------------------------------------------------------------

create or replace function public.records_query(
  p_entity text, p_filter jsonb default '{}'::jsonb, p_sort text default null,
  p_limit int default null, p_skip int default 0
) returns setof jsonb
language plpgsql stable set search_path = public as $$
declare ord text; fld text; dir text;
begin
  if p_sort is null or p_sort = '' then
    ord := 'created_date desc, id';
  else
    dir := case when left(p_sort, 1) = '-' then 'desc' else 'asc' end;
    fld := ltrim(p_sort, '-+');
    if fld in ('id', 'created_date', 'updated_date', 'created_by', 'created_by_id') then
      ord := format('%I %s', fld, dir);
    else
      ord := format('(data -> %L) %s nulls %s', fld, dir, case dir when 'asc' then 'first' else 'last' end);
    end if;
    ord := ord || ', created_date desc, id';
  end if;
  -- The common lookups (by id, game or lobby code) use an index first; the
  -- full filter is then checked on just those rows.
  return query execute format(
    'select public.record_json(r) from public.records r
      where r.entity = $1
        and ($5::text is null or r.id = $5)
        and ($6::text is null or r.data->>''game_id'' = $6)
        and ($7::text is null or r.data->>''code'' = $7)
        and public.record_matches(r, $2)
      order by %s limit $3 offset $4', ord)
    using p_entity, coalesce(p_filter, '{}'::jsonb), least(coalesce(p_limit, 10000), 10000), greatest(coalesce(p_skip, 0), 0),
      case when jsonb_typeof(p_filter->'id') = 'string' then p_filter->>'id' end,
      case when jsonb_typeof(p_filter->'game_id') = 'string' then p_filter->>'game_id' end,
      case when jsonb_typeof(p_filter->'code') = 'string' then p_filter->>'code' end;
end $$;

create or replace function public.records_get(p_entity text, p_id text) returns jsonb
language plpgsql stable set search_path = public as $$
declare out jsonb;
begin
  select public.record_json(r) into out from public.records r where r.entity = p_entity and r.id = p_id;
  if out is null then raise exception 'Entity % % not found', p_entity, p_id using errcode = 'P0002'; end if;
  return out;
end $$;

create or replace function public.records_create(p_entity text, p_data jsonb) returns jsonb
language sql volatile set search_path = public as $$
  insert into public.records (entity, data) values (p_entity, public.records_strip(p_data))
  returning public.record_json(records)
$$;

create or replace function public.records_bulk_create(p_entity text, p_items jsonb) returns setof jsonb
language sql volatile set search_path = public as $$
  insert into public.records (entity, data)
  select p_entity, public.records_strip(i.value)
  from jsonb_array_elements(p_items) with ordinality as i(value, n)
  order by i.n
  returning public.record_json(records)
$$;


-- `data || patch` runs under the row lock, so two players writing different
-- fields of the same record at the same moment both land.
create or replace function public.records_update(p_entity text, p_id text, p_patch jsonb) returns jsonb
language plpgsql volatile set search_path = public as $$
declare out jsonb;
begin
  update public.records r set data = r.data || public.records_strip(p_patch)
   where r.entity = p_entity and r.id = p_id
  returning public.record_json(r) into out;
  if out is null then raise exception 'Entity % % not found', p_entity, p_id using errcode = 'P0002'; end if;
  return out;
end $$;

create or replace function public.records_bulk_update(p_entity text, p_items jsonb) returns setof jsonb
language sql volatile set search_path = public as $$
  update public.records r set data = r.data || (public.records_strip(i.value))
    from jsonb_array_elements(p_items) i
   where r.entity = p_entity and r.id = i.value->>'id'
  returning public.record_json(r)
$$;

-- Edits a list inside a record in one atomic step: removes the items whose
-- "id" is in p_remove, then appends p_add. p_path is the field name, or e.g.
-- {armada_islands,2} for a list inside an object. Used for the shared discard
-- pile and island pools, so simultaneous moves never overwrite each other.
create or replace function public.records_list_edit(
  p_entity text, p_id text, p_path text[], p_add jsonb default '[]'::jsonb, p_remove text[] default '{}'
) returns jsonb
language plpgsql volatile set search_path = public as $$
declare d jsonb; lst jsonb; parent text[]; k int;
begin
  select data into d from public.records where entity = p_entity and id = p_id for update;
  if d is null then raise exception 'Entity % % not found', p_entity, p_id using errcode = 'P0002'; end if;
  lst := case when jsonb_typeof(d #> p_path) = 'array' then d #> p_path else '[]'::jsonb end;
  if coalesce(array_length(p_remove, 1), 0) > 0 then
    select coalesce(jsonb_agg(e order by n), '[]'::jsonb) into lst
      from jsonb_array_elements(lst) with ordinality t(e, n)
     where coalesce(e->>'id', '') <> all (p_remove);
  end if;
  if jsonb_typeof(p_add) = 'array' then lst := lst || p_add; end if;
  -- Make sure parent objects exist (jsonb_set won't create them).
  for k in 1 .. coalesce(array_length(p_path, 1), 0) - 1 loop
    parent := p_path[1:k];
    if jsonb_typeof(d #> parent) is distinct from 'object' then d := jsonb_set(d, parent, '{}'::jsonb, true); end if;
  end loop;
  d := jsonb_set(d, p_path, lst, true);
  update public.records set data = d where entity = p_entity and id = p_id;
  return public.records_get(p_entity, p_id);
end $$;

-- Adds p_delta to a number inside a record in one atomic step (e.g. an
-- edifice's remaining-donations counter when two players donate at once).
create or replace function public.records_incr(p_entity text, p_id text, p_path text[], p_delta numeric) returns jsonb
language plpgsql volatile set search_path = public as $$
declare d jsonb; cur numeric; parent text[]; k int;
begin
  select data into d from public.records where entity = p_entity and id = p_id for update;
  if d is null then raise exception 'Entity % % not found', p_entity, p_id using errcode = 'P0002'; end if;
  cur := case when jsonb_typeof(d #> p_path) = 'number' then (d #>> p_path)::numeric else 0 end;
  for k in 1 .. coalesce(array_length(p_path, 1), 0) - 1 loop
    parent := p_path[1:k];
    if jsonb_typeof(d #> parent) is distinct from 'object' then d := jsonb_set(d, parent, '{}'::jsonb, true); end if;
  end loop;
  d := jsonb_set(d, p_path, to_jsonb(cur + coalesce(p_delta, 0)), true);
  update public.records set data = d where entity = p_entity and id = p_id;
  return public.records_get(p_entity, p_id);
end $$;

-- Creates a record only if none matches p_match (e.g. a lobby code that is
-- free, or a seat that is not taken). Serialized per entity so two people
-- can't grab the same one at the same moment.
create or replace function public.records_create_unique(p_entity text, p_match jsonb, p_data jsonb) returns jsonb
language plpgsql volatile set search_path = public as $$
declare existing jsonb; created jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('records_create_unique:' || p_entity));
  select public.record_json(r) into existing from public.records r
   where r.entity = p_entity and public.record_matches(r, p_match)
   order by r.created_date limit 1;
  if existing is not null then
    return jsonb_build_object('created', false, 'record', existing);
  end if;
  insert into public.records (entity, data) values (p_entity, public.records_strip(p_data))
  returning public.record_json(records) into created;
  return jsonb_build_object('created', true, 'record', created);
end $$;

create or replace function public.records_update_many(p_entity text, p_filter jsonb, p_update jsonb) returns jsonb
language plpgsql volatile set search_path = public as $$
declare n int; setp jsonb; unsetk text[];
begin
  if p_update ? '$set' or p_update ? '$unset' then
    setp := coalesce(p_update->'$set', '{}'::jsonb);
    unsetk := coalesce((select array_agg(k) from jsonb_object_keys(coalesce(p_update->'$unset', '{}'::jsonb)) k), '{}');
  else
    setp := p_update; unsetk := '{}';
  end if;
  update public.records r set data = (r.data - unsetk) || public.records_strip(setp)
   where r.entity = p_entity and public.record_matches(r, p_filter);
  get diagnostics n = row_count;
  return jsonb_build_object('success', true, 'updated', n, 'has_more', false);
end $$;

create or replace function public.records_delete(p_entity text, p_id text) returns jsonb
language sql volatile set search_path = public as $$
  with d as (delete from public.records where entity = p_entity and id = p_id returning id)
  select jsonb_build_object('success', true, 'deleted', (select count(*) from d))
$$;

create or replace function public.records_delete_many(p_entity text, p_filter jsonb) returns jsonb
language plpgsql volatile set search_path = public as $$
declare n int;
begin
  delete from public.records r where r.entity = p_entity and public.record_matches(r, p_filter);
  get diagnostics n = row_count;
  return jsonb_build_object('success', true, 'deleted', n, 'has_more', false);
end $$;


-- ---------------------------------------------------------------------------
-- Defaults on write
-- ---------------------------------------------------------------------------
create or replace function public.records_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.id := coalesce(nullif(new.id, ''), public.new_record_id());
    new.data := public.records_strip(new.data);
    new.created_date := coalesce(new.created_date, now());
    new.updated_date := coalesce(new.updated_date, new.created_date);
  else
    new.id := old.id; new.entity := old.entity;
    if coalesce(current_setting('wonders.importing', true), '') <> '1' then
      new.created_date := old.created_date; new.created_by := old.created_by; new.created_by_id := old.created_by_id;
      new.updated_date := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists records_before_write on public.records;
create trigger records_before_write before insert or update on public.records
for each row execute function public.records_before_write();

-- ---------------------------------------------------------------------------
-- Live updates (what Base44's entities.X.subscribe() did)
--
-- After every write, one message goes out on the public Realtime topic
-- "records:<Entity>". A single-row change carries the whole record, like
-- Base44's events. A multi-row change (bulkUpdate, ...) sends one message with
-- the ids instead; the app fetches those rows. Records too big for one message
-- (Realtime caps a message at 256 KB on the free plan) send {_refetch: true}
-- and the app fetches them.
-- ---------------------------------------------------------------------------
create or replace function public.records_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  op text := case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end;
  g record; d jsonb; ids jsonb; i int;
begin
  for g in
    select x.entity, count(*) as n, jsonb_agg(x.id order by x.id) as ids, (array_agg(public.record_json(x)))[1] as one
      from (select * from new_or_old_rows) x
     group by x.entity
  loop
    if g.n = 1 then
      d := g.one;
      if op = 'delete' then
        d := jsonb_build_object('id', d->>'id');
      elsif octet_length(d::text) > 200000 then
        -- Too big for one message. For an update, send just the fields that
        -- changed (a Game move usually touches one or two zones); if even that
        -- is too big, ask the app to fetch the record.
        if op = 'update' then
          select jsonb_object_agg(e.key, e.value) into d
            from jsonb_each(g.one) e
           where e.key in ('id', 'updated_date', 'last_update_client_id')
              or (select o.data -> e.key from old_rows o where o.id = g.one->>'id') is distinct from e.value;
          d := d || jsonb_build_object('_partial', true);
        end if;
        if op <> 'update' or octet_length(d::text) > 200000 then
          d := jsonb_build_object('id', g.one->>'id', '_refetch', true,
                                  'last_update_client_id', g.one->'last_update_client_id');
        end if;
      end if;
      perform realtime.send(
        jsonb_build_object('type', op, 'id', d->>'id', 'entity', g.entity, 'data', d, 'timestamp', now()),
        op, 'records:' || g.entity, false);
    else
      i := 0;
      while i < g.n loop
        select jsonb_agg(e) into ids from (select e from jsonb_array_elements(g.ids) with ordinality t(e, k) where k > i and k <= i + 2000) s;
        perform realtime.send(
          jsonb_build_object('type', 'bulk', 'op', op, 'entity', g.entity, 'ids', ids, 'timestamp', now()),
          'bulk', 'records:' || g.entity, false);
        i := i + 2000;
      end loop;
    end if;
  end loop;
  return null;
end $$;

-- One function body, three statement-level triggers; each trigger exposes its
-- changed rows under the same name (new_or_old_rows).
drop trigger if exists records_broadcast_ins on public.records;
drop trigger if exists records_broadcast_upd on public.records;
drop trigger if exists records_broadcast_del on public.records;
create trigger records_broadcast_ins after insert on public.records
  referencing new table as new_or_old_rows for each statement execute function public.records_broadcast();
create trigger records_broadcast_upd after update on public.records
  referencing old table as old_rows new table as new_or_old_rows for each statement execute function public.records_broadcast();
create trigger records_broadcast_del after delete on public.records
  referencing old table as new_or_old_rows for each statement execute function public.records_broadcast();

-- ---------------------------------------------------------------------------
-- Who can do what: same as the Base44 app. No logins; anyone with the site
-- can read and change game data and custom content. The site only goes
-- through the functions above.
-- ---------------------------------------------------------------------------
alter table public.records enable row level security;

drop policy if exists records_select on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;

create policy records_select on public.records for select to anon, authenticated using (true);
create policy records_insert on public.records for insert to anon, authenticated with check (true);
create policy records_update on public.records for update to anon, authenticated using (true) with check (true);
create policy records_delete on public.records for delete to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.records to anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'records_query(text,jsonb,text,integer,integer)', 'records_get(text,text)',
    'records_create(text,jsonb)', 'records_bulk_create(text,jsonb)',
    'records_update(text,text,jsonb)', 'records_bulk_update(text,jsonb)',
    'records_update_many(text,jsonb,jsonb)', 'records_delete(text,text)',
    'records_delete_many(text,jsonb)', 'records_list_edit(text,text,text[],jsonb,text[])',
    'records_create_unique(text,jsonb,jsonb)', 'records_incr(text,text,text[],numeric)'
  ] loop
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Clean-up: finished/abandoned games and their players older than 30 days are
-- deleted once a day (uses the pg_cron extension, turned on here if allowed;
-- harmless if not).
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_old_games() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.records p where p.entity = 'PlayerState' and exists (
    select 1 from public.records g where g.entity = 'Game' and g.id = p.data->>'game_id' and g.updated_date < now() - interval '30 days');
  delete from public.records where entity = 'Game' and updated_date < now() - interval '30 days';
end $$;
revoke execute on function public.cleanup_old_games() from public, anon, authenticated;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then null;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('wonders-cleanup', '17 4 * * *', 'select public.cleanup_old_games()');
  end if;
exception when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- File uploads (what Base44's Core.UploadFile did): a public "uploads" bucket.
-- Anyone can view a file by its URL and anyone using the site can upload
-- (card art, wonder boards), like on Base44.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit) values ('uploads', 'uploads', true, 10485760)
    on conflict (id) do update set public = true, file_size_limit = 10485760;
    execute 'drop policy if exists "wonders uploads read" on storage.objects';
    execute 'drop policy if exists "wonders uploads write" on storage.objects';
    execute $p$create policy "wonders uploads read" on storage.objects for select
             using (bucket_id = 'uploads')$p$;
    execute $p$create policy "wonders uploads write" on storage.objects for insert to anon, authenticated
             with check (bucket_id = 'uploads')$p$;
  end if;
end $$;
