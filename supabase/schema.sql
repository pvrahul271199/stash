-- ============================================================================
-- Stash — Scalable Supabase / PostgreSQL Schema (Normalized User-Centric Design)
-- Paste this entire file into your Supabase Dashboard -> SQL Editor -> Run
-- Safe to run multiple times (idempotent migrations + backfills included).
-- ============================================================================

-- 1. Enable UUID & Crypto extensions
create extension if not exists "pgcrypto";

-- 2. Reusable trigger function to auto-update `updated_at` on every change
create or replace function public.stash_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- TABLE 0: stash_users (Dedicated User Profile & Identity Table - 3NF)
-- Stores the Base64 `user_id`, normalized `username`, avatar theme, and metadata.
-- ============================================================================
create table if not exists public.stash_users (
  user_id text primary key,               -- Deterministic Base64 of username (e.g. 'cmFodWw=')
  username text not null unique,          -- Normalized lowercase username (e.g. 'rahul')
  display_name text not null,
  avatar_theme text not null default 'Indigo',
  created_at bigint not null,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_stash_users_username on public.stash_users (username);

drop trigger if exists trg_stash_users_updated_at on public.stash_users;
create trigger trg_stash_users_updated_at
before update on public.stash_users
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- TABLE 1: stash_plans (Monthly income, fixed bills, savings, cycle length)
-- ============================================================================
create table if not exists public.stash_plans (
  workspace_id text not null default 'default',
  id bigint not null,
  user_id text not null default 'default',
  income integer not null,
  bills integer not null,
  savings integer not null,
  month_length integer not null,
  currency text not null default 'INR',
  created_at bigint not null,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (workspace_id, id)
);

-- Upgrade existing table if `user_id` was previously created as `uuid`
alter table public.stash_plans drop constraint if exists stash_plans_user_id_fkey;
drop policy if exists "stash_plans_access" on public.stash_plans;
alter table public.stash_plans alter column user_id type text using coalesce(user_id::text, workspace_id, 'default');
update public.stash_plans set user_id = coalesce(nullif(workspace_id, ''), 'default') where user_id is null or user_id = '';
alter table public.stash_plans alter column user_id set default 'default';
alter table public.stash_plans alter column user_id set not null;

create index if not exists idx_stash_plans_user_id on public.stash_plans (user_id, id desc);
create index if not exists idx_stash_plans_workspace on public.stash_plans (workspace_id, id desc);

drop trigger if exists trg_stash_plans_updated_at on public.stash_plans;
create trigger trg_stash_plans_updated_at
before update on public.stash_plans
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- TABLE 2: stash_cycles (Payday-to-payday budget cycles & rolling pool state)
-- ============================================================================
create table if not exists public.stash_cycles (
  workspace_id text not null default 'default',
  id bigint not null,
  user_id text not null default 'default',
  start_date text not null,
  total_days integer not null,
  plan_amount numeric not null,
  current_day integer not null,
  pool numeric not null,
  from_savings_total numeric not null default 0,
  leftover_moved boolean not null default false,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (workspace_id, id)
);

alter table public.stash_cycles drop constraint if exists stash_cycles_user_id_fkey;
drop policy if exists "stash_cycles_access" on public.stash_cycles;
alter table public.stash_cycles alter column user_id type text using coalesce(user_id::text, workspace_id, 'default');
update public.stash_cycles set user_id = coalesce(nullif(workspace_id, ''), 'default') where user_id is null or user_id = '';
alter table public.stash_cycles alter column user_id set default 'default';
alter table public.stash_cycles alter column user_id set not null;

create index if not exists idx_stash_cycles_user_id on public.stash_cycles (user_id, id desc);
create index if not exists idx_stash_cycles_workspace on public.stash_cycles (workspace_id, id desc);
create index if not exists idx_stash_cycles_start_date on public.stash_cycles (user_id, start_date);

drop trigger if exists trg_stash_cycles_updated_at on public.stash_cycles;
create trigger trg_stash_cycles_updated_at
before update on public.stash_cycles
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- TABLE 3: stash_days (Closed / estimated daily snapshots within a cycle)
-- ============================================================================
create table if not exists public.stash_days (
  workspace_id text not null default 'default',
  cycle_id bigint not null,
  day integer not null,
  user_id text not null default 'default',
  allowance_at_start numeric not null,
  spent numeric not null,
  status text not null check (status in ('closed', 'estimated')),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (workspace_id, cycle_id, day)
);

alter table public.stash_days drop constraint if exists stash_days_user_id_fkey;
drop policy if exists "stash_days_access" on public.stash_days;
alter table public.stash_days alter column user_id type text using coalesce(user_id::text, workspace_id, 'default');
update public.stash_days set user_id = coalesce(nullif(workspace_id, ''), 'default') where user_id is null or user_id = '';
alter table public.stash_days alter column user_id set default 'default';
alter table public.stash_days alter column user_id set not null;

create index if not exists idx_stash_days_user_cycle on public.stash_days (user_id, cycle_id);
create index if not exists idx_stash_days_cycle on public.stash_days (workspace_id, cycle_id);

drop trigger if exists trg_stash_days_updated_at on public.stash_days;
create trigger trg_stash_days_updated_at
before update on public.stash_days
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- TABLE 4: stash_entries (Individual spend transactions — every row has `user_id`)
-- ============================================================================
create table if not exists public.stash_entries (
  workspace_id text not null default 'default',
  id text not null,
  user_id text not null default 'default',
  cycle_id bigint not null,
  day integer not null,
  amount integer not null,
  label text not null,
  category text not null,
  subcategory text,
  event text,
  from_savings boolean not null default false,
  is_estimate boolean not null default false,
  hour smallint not null check (hour >= 0 and hour <= 23),
  created_at bigint not null,
  payment_method text,             -- 'UPI' | 'Card' | 'Cash'
  notes text,                      -- optional spend note
  tags text[] not null default '{}',
  receipt_url text,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (workspace_id, id)
);

alter table public.stash_entries add column if not exists event text;
alter table public.stash_entries add column if not exists payment_method text;
alter table public.stash_entries add column if not exists notes text;
alter table public.stash_entries drop constraint if exists stash_entries_user_id_fkey;
drop policy if exists "stash_entries_access" on public.stash_entries;
alter table public.stash_entries alter column user_id type text using coalesce(user_id::text, workspace_id, 'default');
update public.stash_entries set user_id = coalesce(nullif(workspace_id, ''), 'default') where user_id is null or user_id = '';
alter table public.stash_entries alter column user_id set default 'default';
alter table public.stash_entries alter column user_id set not null;

create index if not exists idx_stash_entries_user_cycle_day on public.stash_entries (user_id, cycle_id, day);
create index if not exists idx_stash_entries_user_created on public.stash_entries (user_id, created_at desc);
create index if not exists idx_stash_entries_user_category on public.stash_entries (user_id, category);
create index if not exists idx_stash_entries_user_event on public.stash_entries (user_id, event);
create index if not exists idx_stash_entries_user_payment on public.stash_entries (user_id, payment_method);
create index if not exists idx_stash_entries_cycle_day on public.stash_entries (workspace_id, cycle_id, day);
create index if not exists idx_stash_entries_metadata on public.stash_entries using gin (metadata);

drop trigger if exists trg_stash_entries_updated_at on public.stash_entries;
create trigger trg_stash_entries_updated_at
before update on public.stash_entries
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- TABLE 5: stash_categories (User categories & subcategory types)
-- ============================================================================
create table if not exists public.stash_categories (
  workspace_id text not null default 'default',
  id bigint not null,
  user_id text not null default 'default',
  name text not null,
  sort_order integer not null,
  is_system boolean not null default false,
  subcategories text[] not null default '{}',
  icon text,
  color text,
  monthly_limit integer,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (workspace_id, id)
);

alter table public.stash_categories drop constraint if exists stash_categories_user_id_fkey;
drop policy if exists "stash_categories_access" on public.stash_categories;
alter table public.stash_categories alter column user_id type text using coalesce(user_id::text, workspace_id, 'default');
update public.stash_categories set user_id = coalesce(nullif(workspace_id, ''), 'default') where user_id is null or user_id = '';
alter table public.stash_categories alter column user_id set default 'default';
alter table public.stash_categories alter column user_id set not null;

create index if not exists idx_stash_categories_user_id on public.stash_categories (user_id, sort_order);
create index if not exists idx_stash_categories_workspace on public.stash_categories (workspace_id, sort_order);

drop trigger if exists trg_stash_categories_updated_at on public.stash_categories;
create trigger trg_stash_categories_updated_at
before update on public.stash_categories
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- TABLE 6: stash_events (Events with custom text & tagged categories)
-- ============================================================================
create table if not exists public.stash_events (
  workspace_id text not null default 'default',
  id bigint not null,
  user_id text not null default 'default',
  name text not null,
  note text,
  categories text[] not null default '{}',
  created_at bigint not null,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (workspace_id, id)
);

alter table public.stash_events drop constraint if exists stash_events_user_id_fkey;
drop policy if exists "stash_events_access" on public.stash_events;
alter table public.stash_events alter column user_id type text using coalesce(user_id::text, workspace_id, 'default');
update public.stash_events set user_id = coalesce(nullif(workspace_id, ''), 'default') where user_id is null or user_id = '';
alter table public.stash_events alter column user_id set default 'default';
alter table public.stash_events alter column user_id set not null;

create index if not exists idx_stash_events_user_id on public.stash_events (user_id, created_at desc);
create index if not exists idx_stash_events_workspace on public.stash_events (workspace_id, created_at desc);

drop trigger if exists trg_stash_events_updated_at on public.stash_events;
create trigger trg_stash_events_updated_at
before update on public.stash_events
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- TABLE 7: stash_feature_data (Extensible key-value / JSONB store for new features)
-- ============================================================================
create table if not exists public.stash_feature_data (
  workspace_id text not null default 'default',
  feature_key text not null,
  item_id text not null,
  user_id text not null default 'default',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, feature_key, item_id)
);

alter table public.stash_feature_data drop constraint if exists stash_feature_data_user_id_fkey;
drop policy if exists "stash_feature_data_access" on public.stash_feature_data;
alter table public.stash_feature_data alter column user_id type text using coalesce(user_id::text, workspace_id, 'default');
update public.stash_feature_data set user_id = coalesce(nullif(workspace_id, ''), 'default') where user_id is null or user_id = '';
alter table public.stash_feature_data alter column user_id set default 'default';
alter table public.stash_feature_data alter column user_id set not null;

create index if not exists idx_stash_feature_data_user_id on public.stash_feature_data (user_id, feature_key);
create index if not exists idx_stash_feature_data_lookup on public.stash_feature_data (workspace_id, feature_key);
create index if not exists idx_stash_feature_data_payload on public.stash_feature_data using gin (payload);

drop trigger if exists trg_stash_feature_data_updated_at on public.stash_feature_data;
create trigger trg_stash_feature_data_updated_at
before update on public.stash_feature_data
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.stash_users enable row level security;
alter table public.stash_plans enable row level security;
alter table public.stash_cycles enable row level security;
alter table public.stash_days enable row level security;
alter table public.stash_entries enable row level security;
alter table public.stash_categories enable row level security;
alter table public.stash_events enable row level security;
alter table public.stash_feature_data enable row level security;

drop policy if exists "stash_users_access" on public.stash_users;
create policy "stash_users_access" on public.stash_users for all using (true) with check (true);

create policy "stash_plans_access" on public.stash_plans for all using (true) with check (true);
create policy "stash_cycles_access" on public.stash_cycles for all using (true) with check (true);
create policy "stash_days_access" on public.stash_days for all using (true) with check (true);
create policy "stash_entries_access" on public.stash_entries for all using (true) with check (true);
create policy "stash_categories_access" on public.stash_categories for all using (true) with check (true);
create policy "stash_events_access" on public.stash_events for all using (true) with check (true);
create policy "stash_feature_data_access" on public.stash_feature_data for all using (true) with check (true);
