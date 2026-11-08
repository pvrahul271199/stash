-- ============================================================================
-- Chelav — Supabase schema (auth-based, RLS, soft delete). Idempotent.
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

-- Who the account is, for every sign-in method:
--   username      password accounts: the chosen username.  Google accounts: the Google email (lower-case).
--   display_name  password accounts: the username.          Google accounts: the Google name.
--   email         the real email (Google only; the @stash.app address of a password account is internal, not stored here)
--   auth_provider 'email' (username + password) or 'google'
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists auth_provider text not null default 'email';
alter table public.profiles add column if not exists avatar_url text;
-- usernames are 3-20 chars of a-z0-9_, or (for Google accounts) an email address
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add constraint profiles_username_check
  check (username ~ '^[a-z0-9_]{3,20}$' or (username ~ '^[^@[:space:]]+@[^@[:space:]]+$' and length(username) <= 254));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_provider text := case when coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'google' then 'google' else 'email' end;
  v_email text := lower(nullif(trim(coalesce(new.email, v_meta ->> 'email', '')), ''));
  v_username text;
  v_name text;
begin
  if v_provider = 'google' then
    v_username := v_email;
    v_name := coalesce(nullif(trim(v_meta ->> 'full_name'), ''), nullif(trim(v_meta ->> 'name'), ''), split_part(v_email, '@', 1));
  else
    v_username := nullif(v_meta ->> 'username', '');
    v_name := v_username;
    v_email := null;
  end if;
  insert into public.profiles (id, username, display_name, email, auth_provider, avatar_url)
  values (new.id, v_username, v_name, v_email, v_provider, nullif(coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture'), ''))
  on conflict do nothing;
  return new;
end $$;

-- Fill in profiles created before these columns existed (idempotent).
update public.profiles set display_name = username where display_name is null and username is not null;
update public.profiles p set
  username = coalesce(p.username, lower(u.email)),
  display_name = coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), ''), split_part(lower(u.email), '@', 1)),
  email = lower(u.email),
  auth_provider = 'google',
  avatar_url = coalesce(p.avatar_url, nullif(coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture'), ''))
from auth.users u
where p.id = u.id and coalesce(u.raw_app_meta_data ->> 'provider', 'email') = 'google'
  and (p.email is null or p.username is null)
  and not exists (select 1 from public.profiles o where o.id <> p.id and o.username = lower(u.email));

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
-- Derived months (docs/ENHANCEMENTS.md E-4): the month starts on this day (1-31, clamped to short months) and a
-- plan applies from effective_from; the earliest one is when budgeting started. The client derives everything else.
alter table public.plans add column if not exists period_start_day int;
alter table public.plans add column if not exists effective_from date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plans_period_start_day_check') then
    alter table public.plans add constraint plans_period_start_day_check
      check (period_start_day is null or period_start_day between 1 and 31) not valid;
  end if;
end $$;
alter table public.plans add column if not exists version bigint not null default 1;
drop trigger if exists trg_plans_lww on public.plans;
create trigger trg_plans_lww before update on public.plans
  for each row execute function public.stash_lww_guard();
drop trigger if exists trg_plans_touch on public.plans;
create trigger trg_plans_touch before insert or update on public.plans
  for each row execute function public.stash_touch();

-- ---------- transactions ----------
create table if not exists public.transactions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
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
create index if not exists idx_transactions_user_updated_id on public.transactions (user_id, updated_at, id);
alter table public.transactions add column if not exists version bigint not null default 1;
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

-- ---------- leftover_savings ----------
-- A finished month's leftover that the user moved to savings (one row per user per month; a second device that moves the
-- same month simply adds a row and the client keeps the newest). month_id is the derived period id, e.g. p:2026-10-01:31.
create table if not exists public.leftover_savings (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  month_id text not null,
  amount bigint not null check (amount >= 0),
  created_at bigint not null
);
create index if not exists idx_leftover_savings_user_updated on public.leftover_savings (user_id, updated_at);
alter table public.leftover_savings add column if not exists version bigint not null default 1;
drop trigger if exists trg_leftover_savings_lww on public.leftover_savings;
create trigger trg_leftover_savings_lww before update on public.leftover_savings
  for each row execute function public.stash_lww_guard();
drop trigger if exists trg_leftover_savings_touch on public.leftover_savings;
create trigger trg_leftover_savings_touch before insert or update on public.leftover_savings
  for each row execute function public.stash_touch();
alter table public.leftover_savings enable row level security;
revoke all on public.leftover_savings from anon;
drop policy if exists leftover_savings_own on public.leftover_savings;
create policy leftover_savings_own on public.leftover_savings for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leftover_savings_size_check') then
    alter table public.leftover_savings add constraint leftover_savings_size_check check (length(month_id) <= 64) not valid;
  end if;
end $$;

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
  if not exists (select 1 from pg_constraint where conname = 'plans_nonneg_check') then
    alter table public.plans add constraint plans_nonneg_check check (income >= 0 and bills >= 0 and savings >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plans_items_shape_check') then
    alter table public.plans add constraint plans_items_shape_check
      check (public.stash_valid_items(bill_items) and public.stash_valid_items(savings_items)) not valid;
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
--   * otherwise parents are written first (plans, categories, events, transactions), updates before inserts;
--   * a retry with the same p_mutation_id returns the stored result and writes nothing.
-- Returns {"status":"ok","versions":{table:{id:version}}} or {"status":"conflict","conflicts":{table:[row]}}.
create or replace function public.push_changes(p_mutation_id uuid, p_changes jsonb)
returns jsonb language plpgsql as $$
declare
  v_uid uuid := auth.uid();
  v_tables constant text[] := array['plans', 'categories', 'events', 'transactions', 'leftover_savings'];
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
  -- The client sends at most 500 rows per call; refuse anything far bigger (a single request must not be able to write millions of rows).
  if (select coalesce(sum(jsonb_array_length(coalesce(p_changes -> k, '[]'::jsonb))), 0) from unnest(v_tables) k) > 1000 then
    raise exception 'batch too large' using errcode = '54000';
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

-- ---------- L1: indexes ----------
-- The server only ever reads transactions by (user_id, updated_at, id) (the pull's keyset order), so that is
-- the one general index. Every extra index is paid for on each write and in storage; drop the ones no query uses.
-- idx_transactions_event is kept (partial, so tiny) only because the events FK is "on delete set null": without
-- an index on event_id, hard-deleting an event would scan the whole transactions table.
create index if not exists idx_transactions_user_updated_id on public.transactions (user_id, updated_at, id);
create index if not exists idx_transactions_event on public.transactions (event_id) where event_id is not null;
drop index if exists public.idx_transactions_user_updated;
drop index if exists public.idx_transactions_user_date;
drop index if exists public.idx_transactions_user_category;
drop index if exists public.idx_transactions_user_event;

-- ---------- H2: real erasure ----------
-- Soft-deleted rows (tombstones) must reach other devices, then go. This hard-deletes them after 30 days
-- (the client keeps its own copies for the same period). A device that stays offline for longer than that and
-- then pushes an old copy would bring a deleted row back: accepted, it is the cost of not keeping tombstones forever.
--  * categories with base_id set are "the user removed a built-in category" markers, not deleted data: kept.
create or replace function public.purge_deleted_data(p_older_than interval default interval '30 days')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cut timestamptz := now() - p_older_than;
  v_tx bigint; v_ev bigint; v_cat bigint; v_pl bigint; v_mut bigint; v_lo bigint;
begin
  delete from public.transactions where deleted_at is not null and deleted_at < v_cut;
  get diagnostics v_tx = row_count;
  delete from public.events where deleted_at is not null and deleted_at < v_cut;
  get diagnostics v_ev = row_count;
  delete from public.categories where deleted_at is not null and deleted_at < v_cut and base_id is null;
  get diagnostics v_cat = row_count;
  delete from public.plans where deleted_at is not null and deleted_at < v_cut;
  get diagnostics v_pl = row_count;
  delete from public.leftover_savings where deleted_at is not null and deleted_at < v_cut;
  get diagnostics v_lo = row_count;
  delete from public.push_mutations where created_at < now() - interval '14 days';
  get diagnostics v_mut = row_count;
  return jsonb_build_object('leftover_savings', v_lo, 'transactions', v_tx, 'events', v_ev, 'categories', v_cat, 'plans', v_pl, 'push_mutations', v_mut);
end $$;
revoke all on function public.purge_deleted_data(interval) from public, anon, authenticated;

-- Daily at 21:30 UTC (03:00 IST). Needs the pg_cron extension (Dashboard -> Database -> Extensions); skipped with a notice otherwise.
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('stash-purge-deleted', '30 21 * * *', 'select public.purge_deleted_data()');
  else
    raise notice 'pg_cron is not available: schedule public.purge_deleted_data() daily some other way';
  end if;
exception when others then
  raise notice 'could not schedule stash-purge-deleted (%): enable pg_cron and re-run', sqlerrm;
end $$;

-- "Delete my account": removes the signed-in user's auth row; every table above references it with
-- "on delete cascade", so all of their data goes with it. SECURITY DEFINER because users cannot touch auth.users.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = v_uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Consent log (DPDP Act): proof that a user accepted a version of the privacy notice, and how.
-- No foreign key on purpose: the record must survive "Delete my account" (it holds only the user's random id,
-- the notice version/hash and a timestamp). Users can read their own rows; nobody can write except through
-- record_consent(), so the timestamp is the server's, not the phone's. One row per user per notice version.
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  notice_version int not null check (notice_version >= 1),
  notice_hash text,
  method text not null check (method in ('signup', 'login', 'google', 'gate')),
  accepted_at timestamptz not null default now(),
  unique (user_id, notice_version)
);
alter table public.consents enable row level security;
drop policy if exists consents_select_own on public.consents;
create policy consents_select_own on public.consents
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.consents from anon, authenticated;
grant select on public.consents to authenticated;

create or replace function public.record_consent(p_version int, p_hash text, p_method text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_version is null or p_version < 1 or p_version > 1000 then
    raise exception 'bad notice version' using errcode = '22023';
  end if;
  insert into public.consents (user_id, notice_version, notice_hash, method)
  values (v_uid, p_version, left(p_hash, 128), p_method)
  on conflict (user_id, notice_version) do nothing;
end $$;
revoke all on function public.record_consent(int, text, text) from public, anon;
grant execute on function public.record_consent(int, text, text) to authenticated;

-- ============================================================================
-- Security hardening (review of 2026-11-06). Idempotent.
-- ============================================================================

-- 1. profiles: the app only ever PATCHes `currency`. Everything else (username, email, auth_provider) is written by the
--    handle_new_user trigger. Without this, any user could rewrite their own username to someone else's Google email
--    (a valid username shape) and block that person's profile row from ever being created.
revoke insert, update, delete on public.profiles from authenticated;
grant update (currency) on public.profiles to authenticated;

-- 2. Password sign-ups: the username comes from client-supplied metadata, so enforce the plain username shape here too
--    (the table check also allows email-shaped values, which are meant for Google accounts only).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_provider text := case when coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'google' then 'google' else 'email' end;
  v_email text := lower(nullif(trim(coalesce(new.email, v_meta ->> 'email', '')), ''));
  v_username text;
  v_name text;
begin
  if v_provider = 'google' then
    v_username := v_email;
    v_name := coalesce(nullif(trim(v_meta ->> 'full_name'), ''), nullif(trim(v_meta ->> 'name'), ''), split_part(v_email, '@', 1));
  else
    v_username := nullif(v_meta ->> 'username', '');
    if v_username is null or v_username !~ '^[a-z0-9_]{3,20}$' then
      raise exception 'invalid username' using errcode = '22023';
    end if;
    v_name := v_username;
    v_email := null;
  end if;
  insert into public.profiles (id, username, display_name, email, auth_provider, avatar_url)
  values (new.id, v_username, v_name, v_email, v_provider, nullif(coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture'), ''))
  on conflict do nothing;
  return new;
end $$;

-- 3. username_available is callable without signing in, so it must not reveal whether an email address has a Google
--    account (Google profiles use the email as their username). Only password usernames are reported.
create or replace function public.username_available(u text)
returns boolean language sql security definer set search_path = public stable as $$
  select not exists (
    select 1 from public.profiles where auth_provider = 'email' and username = lower(trim(u))
  );
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- 4. Size limits, so one account cannot store unbounded text or JSON. Far above what the app writes (labels 32,
--    notes 60, names 32). NOT VALID: binds new writes without failing on rows that predate it.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_text_len_check') then
    alter table public.transactions add constraint transactions_text_len_check check (
      length(label) <= 200 and length(type) <= 100 and length(coalesce(subtype, '')) <= 100
      and length(coalesce(event, '')) <= 100 and length(coalesce(payment, '')) <= 100
      and length(coalesce(note, '')) <= 1000 and length(coalesce(category_id, '')) <= 64
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'categories_size_check') then
    alter table public.categories add constraint categories_size_check check (
      length(name) <= 100 and octet_length(subcategories::text) <= 20000
      and octet_length(sub_added::text) <= 20000 and octet_length(sub_removed::text) <= 20000
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_size_check') then
    alter table public.events add constraint events_size_check check (
      length(name) <= 100 and length(coalesce(note, '')) <= 1000 and octet_length(categories::text) <= 20000
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plans_size_check') then
    alter table public.plans add constraint plans_size_check check (
      octet_length(coalesce(bill_items::text, '')) <= 20000 and octet_length(coalesce(savings_items::text, '')) <= 20000
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'feature_data_size_check') then
    alter table public.feature_data add constraint feature_data_size_check check (
      length(feature_key) <= 100 and length(item_id) <= 100 and octet_length(data::text) <= 20000
    ) not valid;
  end if;
end $$;

-- ============================================================================
-- Derived months (docs/ENHANCEMENTS.md E-4): the app no longer stores or syncs cycles. A month is computed from the
-- plans (period_start_day, effective_from) and the transactions' dates. Run this AFTER the new app is deployed: devices
-- still on the old app ask for `cycles` on every sync and get an error until they update.
-- Irreversible: it deletes the old cycle rows and the transactions.cycle_id column (nothing reads either any more).
-- ============================================================================
alter table public.transactions drop constraint if exists transactions_user_cycle_fkey;
drop index if exists public.uq_cycles_one_active;
alter table public.transactions drop column if exists cycle_id;
drop table if exists public.cycles cascade;

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

-- ============================================================================
-- Feedback / bug reports (User tab -> "Send feedback or report a bug"). Idempotent.
-- Anyone (guests included) can submit through submit_feedback(); nobody can read or change rows from the app.
-- Read them in the Supabase dashboard (Table editor) or with the service role.
-- ============================================================================
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,                       -- auth.uid() when signed in, else null (no foreign key: survives account deletion)
  kind text not null check (kind in ('feedback', 'bug')),
  message text not null check (char_length(message) between 1 and 1000),
  contact text check (contact is null or char_length(contact) <= 200),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  status text not null default 'new' check (status in ('new', 'seen', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

create or replace function public.submit_feedback(p_kind text, p_message text, p_contact text default null, p_user_agent text default null, p_app_version text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if p_kind not in ('feedback', 'bug') then
    raise exception 'bad kind' using errcode = '22023';
  end if;
  if p_message is null or char_length(btrim(p_message)) = 0 or char_length(p_message) > 1000 then
    raise exception 'bad message' using errcode = '22023';
  end if;
  -- light abuse guard: 10 per user per hour, 200 per hour overall
  if v_uid is not null and (select count(*) from public.feedback where user_id = v_uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many submissions' using errcode = '54000';
  end if;
  if (select count(*) from public.feedback where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'too many submissions' using errcode = '54000';
  end if;
  insert into public.feedback (user_id, kind, message, contact, user_agent, app_version)
  values (v_uid, p_kind, btrim(p_message), nullif(btrim(left(p_contact, 200)), ''), left(p_user_agent, 300), left(p_app_version, 40));
end $$;
revoke all on function public.submit_feedback(text, text, text, text, text) from public;
grant execute on function public.submit_feedback(text, text, text, text, text) to anon, authenticated;
