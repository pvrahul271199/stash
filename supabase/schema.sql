-- ============================================================================
-- Stash — Supabase schema (auth-based, RLS, soft delete). Idempotent.
-- Paste into Supabase Dashboard -> SQL Editor -> Run.
-- Dashboard settings (manual): Auth -> Providers -> Email: "Confirm email" OFF,
-- min password length 8, anonymous sign-ins OFF, rate limits ON.
-- ============================================================================
create extension if not exists "pgcrypto";

-- ---------- shared trigger functions ----------
-- Client clocks are untrusted: a phone set far ahead would win every conflict.
-- Clamp (not reject, so a skewed device's queued offline writes still land) to now() + 1 minute.
create or replace function public.stash_clamp_client_ts(ts bigint)
returns bigint language sql stable as $$
  select least(ts, (extract(epoch from now()) * 1000)::bigint + 60000)
$$;

-- last-write-wins: a stale update is a silent no-op.
-- Triggers fire alphabetically (trg_*_lww before trg_*_touch), so the guard clamps itself;
-- otherwise it would compare the unclamped, possibly far-future, client value.
create or replace function public.stash_lww_guard()
returns trigger language plpgsql as $$
begin
  new.client_updated_at := public.stash_clamp_client_ts(new.client_updated_at);
  if new.client_updated_at < old.client_updated_at then
    return old;
  end if;
  return new;
end $$;

-- Server-owned bookkeeping. `version` (bigint, +1 on every write) is the optimistic-concurrency
-- token; `updated_at` is the server timestamp used by pull cursors. Clients can't set either.
-- `client_updated_at` is only a tiebreaker / display value (clamped, see above).
create or replace function public.stash_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.version := case when tg_op = 'INSERT' then 1 else old.version + 1 end;
  new.client_updated_at := public.stash_clamp_client_ts(new.client_updated_at);
  return new;
end $$;

create or replace function public.stash_set_profile_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text,
  avatar_theme text,
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'username')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.username_available(u text)
returns boolean language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.profiles where username = lower(trim(u)));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before insert or update on public.profiles
  for each row execute function public.stash_set_profile_updated();

-- ---------- plans ----------
create table if not exists public.plans (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  income int not null,
  bills int not null,
  savings int not null,
  month_length int not null,
  currency text,
  bill_items jsonb,
  savings_items jsonb,
  created_at bigint not null
);
create index if not exists idx_plans_user_updated on public.plans (user_id, updated_at);
alter table public.plans add column if not exists version bigint not null default 1;
drop trigger if exists trg_plans_lww on public.plans;
create trigger trg_plans_lww before update on public.plans
  for each row execute function public.stash_lww_guard();
drop trigger if exists trg_plans_touch on public.plans;
create trigger trg_plans_touch before insert or update on public.plans
  for each row execute function public.stash_touch();

-- ---------- cycles ----------
create table if not exists public.cycles (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  start_date date not null,
  total_days int not null,
  plan_amount int not null,
  current_day int not null,
  leftover_moved boolean not null default false,
  estimated_days jsonb not null default '[]'::jsonb
);
create index if not exists idx_cycles_user_updated on public.cycles (user_id, updated_at);
alter table public.cycles add column if not exists version bigint not null default 1;
drop trigger if exists trg_cycles_lww on public.cycles;
create trigger trg_cycles_lww before update on public.cycles
  for each row execute function public.stash_lww_guard();
drop trigger if exists trg_cycles_touch on public.cycles;
create trigger trg_cycles_touch before insert or update on public.cycles
  for each row execute function public.stash_touch();

-- ---------- transactions ----------
create table if not exists public.transactions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  cycle_id uuid,
  txn_date date not null,
  amount int not null check (amount > 0),
  type text not null,
  subtype text,
  label text not null default '',
  event text,
  payment text,
  note text,
  from_savings boolean not null default false,
  adjusts_pool boolean not null default true,
  is_estimate boolean not null default false,
  hour int not null default 0,
  created_at bigint not null
);
create index if not exists idx_transactions_user_updated on public.transactions (user_id, updated_at);
alter table public.transactions add column if not exists version bigint not null default 1;
create index if not exists idx_transactions_user_date on public.transactions (user_id, txn_date);
create index if not exists idx_transactions_user_cycle on public.transactions (user_id, cycle_id);
drop trigger if exists trg_transactions_lww on public.transactions;
create trigger trg_transactions_lww before update on public.transactions
  for each row execute function public.stash_lww_guard();
drop trigger if exists trg_transactions_touch on public.transactions;
create trigger trg_transactions_touch before insert or update on public.transactions
  for each row execute function public.stash_touch();

-- ---------- categories ----------
create table if not exists public.categories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  name text not null,
  sort_order int not null default 0,
  is_system boolean not null default false,
  subcategories jsonb not null default '[]'::jsonb,
  base_id text,
  sub_added jsonb not null default '[]'::jsonb,
  sub_removed jsonb not null default '[]'::jsonb
);
alter table public.categories add column if not exists base_id text;
alter table public.categories add column if not exists sub_added jsonb not null default '[]'::jsonb;
alter table public.categories add column if not exists sub_removed jsonb not null default '[]'::jsonb;
create index if not exists idx_categories_user_updated on public.categories (user_id, updated_at);
alter table public.categories add column if not exists version bigint not null default 1;
drop trigger if exists trg_categories_lww on public.categories;
create trigger trg_categories_lww before update on public.categories
  for each row execute function public.stash_lww_guard();
drop trigger if exists trg_categories_touch on public.categories;
create trigger trg_categories_touch before insert or update on public.categories
  for each row execute function public.stash_touch();

-- ---------- events ----------
create table if not exists public.events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  name text not null,
  note text,
  categories jsonb not null default '[]'::jsonb,
  created_at bigint not null
);
create index if not exists idx_events_user_updated on public.events (user_id, updated_at);
alter table public.events add column if not exists version bigint not null default 1;
drop trigger if exists trg_events_lww on public.events;
create trigger trg_events_lww before update on public.events
  for each row execute function public.stash_lww_guard();
drop trigger if exists trg_events_touch on public.events;
create trigger trg_events_touch before insert or update on public.events
  for each row execute function public.stash_touch();

-- ---------- feature_data ----------
create table if not exists public.feature_data (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  feature_key text not null,
  item_id text not null,
  data jsonb not null default '{}'::jsonb
);
create index if not exists idx_feature_data_user_updated on public.feature_data (user_id, updated_at);
alter table public.feature_data add column if not exists version bigint not null default 1;
drop trigger if exists trg_feature_data_lww on public.feature_data;
create trigger trg_feature_data_lww before update on public.feature_data
  for each row execute function public.stash_lww_guard();
drop trigger if exists trg_feature_data_touch on public.feature_data;
create trigger trg_feature_data_touch before insert or update on public.feature_data
  for each row execute function public.stash_touch();

-- ---------- default_categories (shared by every user, stored once) ----------
-- public.categories holds only a user's own additions and their changes to these defaults
-- (base_id = default key; deleted_at = removed; sub_added / sub_removed = subcategory diffs).
create table if not exists public.default_categories (
  key text primary key,
  name text not null,
  sort_order int not null,
  is_system boolean not null default false,
  subcategories jsonb not null default '[]'::jsonb
);
insert into public.default_categories (key, name, sort_order, is_system, subcategories) values
  ('food', 'Food', 0, false, '["Chai & snacks","Breakfast","Lunch","Dinner","Delivery"]'),
  ('travel', 'Travel', 1, false, '["Auto","Metro","Cab","Fuel"]'),
  ('home', 'Home', 2, false, '["Groceries","Household"]'),
  ('bills', 'Bills', 3, false, '["Recharge","Subscriptions"]'),
  ('health', 'Health', 4, false, '["Medicine","Doctor"]'),
  ('shopping', 'Shopping', 5, false, '["Clothes","Gifts"]'),
  ('fun', 'Fun', 6, false, '["Movies","Outings"]'),
  ('other', 'Other', 7, true, '[]')
on conflict (key) do update set
  name = excluded.name, sort_order = excluded.sort_order,
  is_system = excluded.is_system, subcategories = excluded.subcategories;
alter table public.default_categories enable row level security;
revoke all on public.default_categories from anon;
revoke insert, update, delete on public.default_categories from authenticated;
grant select on public.default_categories to authenticated;
drop policy if exists default_categories_read on public.default_categories;
create policy default_categories_read on public.default_categories for select to authenticated using (true);

-- Old full per-user copies of the defaults are obsolete: tombstone any that match a default exactly.
update public.categories c set deleted_at = now(), client_updated_at = (extract(epoch from now()) * 1000)::bigint
 where c.base_id is null and c.deleted_at is null
   and exists (select 1 from public.default_categories d where lower(d.name) = lower(c.name) and d.subcategories = c.subcategories);

-- ---------- transactions -> category / event by id (not by name) ----------
-- transactions.type / .event stay as display snapshots; the links below are what joins use.
-- category_id is text with no FK: it holds either a default_categories.key or a categories.id (uuid
-- as text), and defaults are not rows of `categories`. event_id is a real FK (events are soft-deleted).
alter table public.transactions add column if not exists category_id text;
alter table public.transactions add column if not exists event_id uuid;

-- backfill legacy rows by name (case-insensitive); the oldest live row wins when names repeat
update public.transactions t set category_id = d.key
  from public.default_categories d
 where t.category_id is null and lower(d.name) = lower(t.type);
update public.transactions t set category_id = c.id::text
  from (select distinct on (user_id, lower(name)) id, user_id, name from public.categories
         where deleted_at is null and base_id is null order by user_id, lower(name), id) c
 where t.category_id is null and c.user_id = t.user_id and lower(c.name) = lower(t.type);
update public.transactions t set event_id = e.id
  from (select distinct on (user_id, lower(name)) id, user_id, name from public.events
         where deleted_at is null order by user_id, lower(name), created_at, id) e
 where t.event_id is null and t.event is not null and e.user_id = t.user_id and lower(e.name) = lower(t.event);

-- existing duplicates would block the unique indexes: rename the newer ones "Name (2)", "Name (3)"...
update public.categories c set name = c.name || ' (' || d.rn || ')'
  from (select id, row_number() over (partition by user_id, lower(name) order by id) rn
          from public.categories where deleted_at is null and base_id is null) d
 where c.id = d.id and d.rn > 1;
update public.events e set name = e.name || ' (' || d.rn || ')'
  from (select id, row_number() over (partition by user_id, lower(name) order by created_at, id) rn
          from public.events where deleted_at is null) d
 where e.id = d.id and d.rn > 1;

-- unique live names per user (override rows of defaults, base_id set, are excluded)
create unique index if not exists uq_categories_user_name
  on public.categories (user_id, lower(name)) where deleted_at is null and base_id is null;
create unique index if not exists uq_events_user_name
  on public.events (user_id, lower(name)) where deleted_at is null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_event_id_fkey') then
    alter table public.transactions
      add constraint transactions_event_id_fkey foreign key (event_id) references public.events(id) on delete set null;
  end if;
end $$;
create index if not exists idx_transactions_user_category on public.transactions (user_id, category_id);
create index if not exists idx_transactions_user_event on public.transactions (user_id, event_id);

-- ---------- integrity constraints ----------
-- Added NOT VALID: they bind every new write but don't fail on rows that predate them.
-- After cleaning old data: alter table ... validate constraint <name>;
create or replace function public.stash_valid_items(j jsonb)
returns boolean language sql immutable as $$
  select j is null or (
    jsonb_typeof(j) = 'array' and not exists (
      select 1 from jsonb_array_elements(j) e
       where jsonb_typeof(e) is distinct from 'object'
          or jsonb_typeof(e -> 'name') is distinct from 'string'
          or jsonb_typeof(e -> 'amount') is distinct from 'number'
          or case when jsonb_typeof(e -> 'amount') = 'number' then (e ->> 'amount')::numeric < 0 else true end
    )
  )
$$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cycles_total_days_check') then
    alter table public.cycles add constraint cycles_total_days_check check (total_days between 1 and 366) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cycles_current_day_check') then
    alter table public.cycles add constraint cycles_current_day_check check (current_day between 1 and total_days + 1) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plans_nonneg_check') then
    alter table public.plans add constraint plans_nonneg_check check (income >= 0 and bills >= 0 and savings >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plans_items_shape_check') then
    alter table public.plans add constraint plans_items_shape_check
      check (public.stash_valid_items(bill_items) and public.stash_valid_items(savings_items)) not valid;
  end if;
end $$;

-- A cycle is over once current_day passes total_days; derived so clients can't disagree with it.
alter table public.cycles add column if not exists status text
  generated always as (case when current_day > total_days then 'closed' else 'active' end) stored;

-- One unfinished cycle per user. Skipped (with a notice) while old data still has duplicates.
do $$ begin
  if exists (select 1 from public.cycles where status = 'active' and deleted_at is null group by user_id having count(*) > 1) then
    raise notice 'uq_cycles_one_active NOT created: some users have several active cycles; fix them and re-run';
  else
    create unique index if not exists uq_cycles_one_active on public.cycles (user_id) where status = 'active' and deleted_at is null;
  end if;
end $$;

-- A transaction can only point at a cycle of the same user. Deferred, so a batch (or an out-of-order
-- pull/push) may insert the transaction before its cycle as long as both exist at commit.
create unique index if not exists uq_cycles_user_id on public.cycles (user_id, id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_user_cycle_fkey') then
    alter table public.transactions add constraint transactions_user_cycle_fkey
      foreign key (user_id, cycle_id) references public.cycles (user_id, id)
      deferrable initially deferred not valid;
  end if;
end $$;

-- ---------- atomic, idempotent, version-checked push ----------
create table if not exists public.push_mutations (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists idx_push_mutations_created on public.push_mutations (created_at);
alter table public.push_mutations enable row level security;
revoke all on public.push_mutations from anon;
drop policy if exists push_mutations_own on public.push_mutations;
create policy push_mutations_own on public.push_mutations for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- p_changes = { "<table>": [ { ...row, "_base_version": <server version the client last saw | null> } ] }
-- Applies everything in ONE transaction (SECURITY INVOKER: RLS and the caller's grants apply).
--   * a row whose server version differs from _base_version (or that exists when _base_version is null)
--     is a conflict: nothing is written and the current server rows come back for the client to merge;
--   * otherwise parents are written first (plans, cycles, categories, events, transactions), updates
--     before inserts so a cycle can be closed before its successor is created;
--   * a retry with the same p_mutation_id returns the stored result and writes nothing.
-- Returns {"status":"ok","versions":{table:{id:version}}} or {"status":"conflict","conflicts":{table:[row]}}.
create or replace function public.push_changes(p_mutation_id uuid, p_changes jsonb)
returns jsonb language plpgsql as $$
declare
  v_uid uuid := auth.uid();
  v_tables constant text[] := array['plans', 'cycles', 'categories', 'events', 'transactions'];
  t text;
  r jsonb;
  v_cur jsonb;
  v_base bigint;
  v_conf jsonb := '{}'::jsonb;
  v_ver jsonb := '{}'::jsonb;
  v_prev jsonb;
  v_cols text;
  v_rcols text;
  v_new bigint;
  v_pass int;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select result into v_prev from public.push_mutations where user_id = v_uid and id = p_mutation_id;
  if found then
    return v_prev;
  end if;
  delete from public.push_mutations where user_id = v_uid and created_at < now() - interval '14 days';

  -- pass 1: lock the existing rows and look for version conflicts
  foreach t in array v_tables loop
    for r in select * from jsonb_array_elements(coalesce(p_changes -> t, '[]'::jsonb)) loop
      execute format('select to_jsonb(x) from public.%I x where x.id = $1 and x.user_id = $2 for update', t)
        into v_cur using (r ->> 'id')::uuid, v_uid;
      if v_cur is not null then
        v_base := nullif(r ->> '_base_version', '')::bigint;
        if v_base is null or v_base <> (v_cur ->> 'version')::bigint then
          v_conf := jsonb_set(v_conf, array[t], coalesce(v_conf -> t, '[]'::jsonb) || jsonb_build_array(v_cur), true);
        end if;
      end if;
    end loop;
  end loop;
  if v_conf <> '{}'::jsonb then
    return jsonb_build_object('status', 'conflict', 'conflicts', v_conf);
  end if;

  -- pass 2: apply
  foreach t in array v_tables loop
    select string_agg(quote_ident(attname), ', ' order by attnum), string_agg('r.' || quote_ident(attname), ', ' order by attnum)
      into v_cols, v_rcols
      from pg_attribute
     where attrelid = format('public.%I', t)::regclass and attnum > 0 and not attisdropped and attgenerated = ''
       and attname not in ('id', 'user_id', 'version', 'updated_at');
    for v_pass in 1..2 loop
      for r in select * from jsonb_array_elements(coalesce(p_changes -> t, '[]'::jsonb)) loop
        r := (r - '_base_version') || jsonb_build_object('user_id', v_uid);
        execute format('select to_jsonb(x) from public.%I x where x.id = $1 and x.user_id = $2', t)
          into v_cur using (r ->> 'id')::uuid, v_uid;
        if v_pass = 1 and v_cur is not null then
          -- never let a skewed client clock move client_updated_at backwards
          r := r || jsonb_build_object('client_updated_at',
                 greatest((r ->> 'client_updated_at')::bigint, (v_cur ->> 'client_updated_at')::bigint));
          execute format(
            'update public.%1$I t set (%2$s) = (select %3$s from jsonb_populate_record(null::public.%1$I, $1) r) '
            'where t.id = $2 and t.user_id = $3 returning t.version', t, v_cols, v_rcols)
            into v_new using r, (r ->> 'id')::uuid, v_uid;
        elsif v_pass = 2 and v_cur is null then
          execute format(
            'insert into public.%1$I (id, user_id, %2$s) select r.id, r.user_id, %3$s '
            'from jsonb_populate_record(null::public.%1$I, $1) r returning version', t, v_cols, v_rcols)
            into v_new using r;
        else
          continue;
        end if;
        v_ver := jsonb_set(v_ver, array[t], coalesce(v_ver -> t, '{}'::jsonb) || jsonb_build_object(r ->> 'id', v_new), true);
      end loop;
    end loop;
  end loop;

  v_result := jsonb_build_object('status', 'ok', 'versions', v_ver);
  insert into public.push_mutations (user_id, id, result) values (v_uid, p_mutation_id, v_result);
  return v_result;
end $$;
revoke all on function public.push_changes(uuid, jsonb) from public, anon;
grant execute on function public.push_changes(uuid, jsonb) to authenticated;

-- ---------- row level security ----------
-- Policies use (select auth.uid()): Postgres evaluates it once per statement (an InitPlan) instead of once per row.
alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for all
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter table public.plans enable row level security;
revoke all on public.plans from anon;
drop policy if exists plans_own on public.plans;
create policy plans_own on public.plans for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.cycles enable row level security;
revoke all on public.cycles from anon;
drop policy if exists cycles_own on public.cycles;
create policy cycles_own on public.cycles for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.transactions enable row level security;
revoke all on public.transactions from anon;
drop policy if exists transactions_own on public.transactions;
create policy transactions_own on public.transactions for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.categories enable row level security;
revoke all on public.categories from anon;
drop policy if exists categories_own on public.categories;
create policy categories_own on public.categories for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.events enable row level security;
revoke all on public.events from anon;
drop policy if exists events_own on public.events;
create policy events_own on public.events for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.feature_data enable row level security;
revoke all on public.feature_data from anon;
drop policy if exists feature_data_own on public.feature_data;
create policy feature_data_own on public.feature_data for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ============================================================================
-- CUTOVER (run once): the old username-keyed tables and their data are dropped.
-- ============================================================================
drop table if exists
  public.stash_users, public.stash_plans, public.stash_cycles, public.stash_days,
  public.stash_entries, public.stash_categories, public.stash_events, public.stash_feature_data,
  public.legacy_stash_users, public.legacy_stash_plans, public.legacy_stash_cycles, public.legacy_stash_days,
  public.legacy_stash_entries, public.legacy_stash_categories, public.legacy_stash_events,
  public.legacy_stash_feature_data
cascade;
drop function if exists public.stash_set_updated_at() cascade;
