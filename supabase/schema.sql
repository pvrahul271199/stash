-- ============================================================================
-- Stash — Supabase schema (auth-based, RLS, soft delete). Idempotent.
-- Paste into Supabase Dashboard -> SQL Editor -> Run.
-- Dashboard settings (manual): Auth -> Providers -> Email: "Confirm email" OFF,
-- min password length 8, anonymous sign-ins OFF, rate limits ON.
-- ============================================================================
create extension if not exists "pgcrypto";

-- ---------- shared trigger functions ----------
create or replace function public.stash_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  -- reject client clocks more than 24h ahead (they would win every conflict)
  if new.client_updated_at > (extract(epoch from now()) * 1000)::bigint + 86400000 then
    raise exception 'client_updated_at is too far in the future';
  end if;
  return new;
end $$;

-- last-write-wins: a stale update is a silent no-op
create or replace function public.stash_lww_guard()
returns trigger language plpgsql as $$
begin
  if new.client_updated_at < old.client_updated_at then
    return old;
  end if;
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
  subcategories jsonb not null default '[]'::jsonb
);
create index if not exists idx_categories_user_updated on public.categories (user_id, updated_at);
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
drop trigger if exists trg_feature_data_lww on public.feature_data;
create trigger trg_feature_data_lww before update on public.feature_data
  for each row execute function public.stash_lww_guard();
drop trigger if exists trg_feature_data_touch on public.feature_data;
create trigger trg_feature_data_touch before insert or update on public.feature_data
  for each row execute function public.stash_touch();

-- ---------- row level security ----------
alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
alter table public.plans enable row level security;
revoke all on public.plans from anon;
drop policy if exists plans_own on public.plans;
create policy plans_own on public.plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.cycles enable row level security;
revoke all on public.cycles from anon;
drop policy if exists cycles_own on public.cycles;
create policy cycles_own on public.cycles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.transactions enable row level security;
revoke all on public.transactions from anon;
drop policy if exists transactions_own on public.transactions;
create policy transactions_own on public.transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.categories enable row level security;
revoke all on public.categories from anon;
drop policy if exists categories_own on public.categories;
create policy categories_own on public.categories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.events enable row level security;
revoke all on public.events from anon;
drop policy if exists events_own on public.events;
create policy events_own on public.events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.feature_data enable row level security;
revoke all on public.feature_data from anon;
drop policy if exists feature_data_own on public.feature_data;
create policy feature_data_own on public.feature_data for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
