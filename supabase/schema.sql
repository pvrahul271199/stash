-- ============================================================================
-- Stash — Scalable Supabase / PostgreSQL Schema
-- Paste this entire file into your Supabase Dashboard -> SQL Editor -> Run
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
-- TABLE 1: stash_plans (Monthly income, fixed bills, savings, cycle length)
-- Scalable for future features: currency, payday_day_of_month, metadata JSONB
-- ============================================================================
create table if not exists public.stash_plans (
  workspace_id text not null default 'default',
  id bigint not null,
  user_id uuid references auth.users(id) on delete cascade,
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

create index if not exists idx_stash_plans_workspace on public.stash_plans (workspace_id, id desc);
create index if not exists idx_stash_plans_user on public.stash_plans (user_id);

drop trigger if exists trg_stash_plans_updated_at on public.stash_plans;
create trigger trg_stash_plans_updated_at
before update on public.stash_plans
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- TABLE 2: stash_cycles (Payday-to-payday budget cycles & rolling pool state)
-- Scalable for future features: rollover rules, notes, metadata JSONB
-- ============================================================================
create table if not exists public.stash_cycles (
  workspace_id text not null default 'default',
  id bigint not null,
  user_id uuid references auth.users(id) on delete cascade,
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

create index if not exists idx_stash_cycles_workspace on public.stash_cycles (workspace_id, id desc);
create index if not exists idx_stash_cycles_start_date on public.stash_cycles (workspace_id, start_date);

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
  user_id uuid references auth.users(id) on delete cascade,
  allowance_at_start numeric not null,
  spent numeric not null,
  status text not null check (status in ('closed', 'estimated')),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (workspace_id, cycle_id, day)
);

create index if not exists idx_stash_days_cycle on public.stash_days (workspace_id, cycle_id);

drop trigger if exists trg_stash_days_updated_at on public.stash_days;
create trigger trg_stash_days_updated_at
before update on public.stash_days
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- TABLE 4: stash_entries (Individual spend transactions)
-- Scalable for future features: payment_method, notes, tags, receipt_url,
-- recurring_id, deleted_at (soft delete), metadata JSONB
-- ============================================================================
create table if not exists public.stash_entries (
  workspace_id text not null default 'default',
  id text not null,
  cycle_id bigint not null,
  day integer not null,
  user_id uuid references auth.users(id) on delete cascade,
  amount integer not null,
  label text not null,
  category text not null,
  subcategory text,
  event text,
  from_savings boolean not null default false,
  is_estimate boolean not null default false,
  hour smallint not null check (hour >= 0 and hour <= 23),
  created_at bigint not null,
  -- Future-ready columns (nullable with sensible defaults so existing code works seamlessly)
  payment_method text,             -- e.g. 'UPI', 'Card', 'Cash'
  notes text,                      -- free-form memo
  tags text[] not null default '{}',
  receipt_url text,                -- Supabase Storage path if receipts are added later
  deleted_at timestamptz,          -- for soft-deletes / audit history
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (workspace_id, id)
);

create index if not exists idx_stash_entries_cycle_day on public.stash_entries (workspace_id, cycle_id, day);
create index if not exists idx_stash_entries_cycle_created on public.stash_entries (workspace_id, cycle_id, created_at desc);
create index if not exists idx_stash_entries_category on public.stash_entries (workspace_id, category);
create index if not exists idx_stash_entries_event on public.stash_entries (workspace_id, event);
create index if not exists idx_stash_entries_payment on public.stash_entries (workspace_id, payment_method);
create index if not exists idx_stash_entries_created_at on public.stash_entries (workspace_id, created_at desc);
create index if not exists idx_stash_entries_metadata on public.stash_entries using gin (metadata);

alter table public.stash_entries add column if not exists event text;

drop trigger if exists trg_stash_entries_updated_at on public.stash_entries;
create trigger trg_stash_entries_updated_at
before update on public.stash_entries
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- TABLE 5: stash_categories (User categories & subcategory types)
-- Scalable for future features: icon, color, monthly_limit, metadata JSONB
-- ============================================================================
create table if not exists public.stash_categories (
  workspace_id text not null default 'default',
  id bigint not null,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null,
  is_system boolean not null default false,
  subcategories text[] not null default '{}',
  -- Future-ready columns
  icon text,
  color text,
  monthly_limit integer,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (workspace_id, id)
);

create index if not exists idx_stash_categories_workspace on public.stash_categories (workspace_id, sort_order);

drop trigger if exists trg_stash_categories_updated_at on public.stash_categories;
create trigger trg_stash_categories_updated_at
before update on public.stash_categories
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- TABLE 6: stash_events (Events with custom text & tagged categories as sub-items)
-- ============================================================================
create table if not exists public.stash_events (
  workspace_id text not null default 'default',
  id bigint not null,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  note text,
  categories text[] not null default '{}',
  created_at bigint not null,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (workspace_id, id)
);

create index if not exists idx_stash_events_workspace on public.stash_events (workspace_id, created_at desc);

drop trigger if exists trg_stash_events_updated_at on public.stash_events;
create trigger trg_stash_events_updated_at
before update on public.stash_events
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- TABLE 7: stash_feature_data (Extensible key-value / JSONB store for new features)
-- Use this table to ship new features (e.g. 'recurring_bills', 'savings_goals',
-- 'wallets', 'preferences') without needing a blocking schema migration first.
-- ============================================================================
create table if not exists public.stash_feature_data (
  workspace_id text not null default 'default',
  feature_key text not null,
  item_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, feature_key, item_id)
);

create index if not exists idx_stash_feature_data_lookup on public.stash_feature_data (workspace_id, feature_key);
create index if not exists idx_stash_feature_data_payload on public.stash_feature_data using gin (payload);

drop trigger if exists trg_stash_feature_data_updated_at on public.stash_feature_data;
create trigger trg_stash_feature_data_updated_at
before update on public.stash_feature_data
for each row execute function public.stash_set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Allows anon/authenticated access scoped by workspace_id (and user_id when Auth is enabled)
-- ============================================================================
alter table public.stash_plans enable row level security;
alter table public.stash_cycles enable row level security;
alter table public.stash_days enable row level security;
alter table public.stash_entries enable row level security;
alter table public.stash_categories enable row level security;
alter table public.stash_events enable row level security;
alter table public.stash_feature_data enable row level security;

drop policy if exists "stash_plans_access" on public.stash_plans;
create policy "stash_plans_access" on public.stash_plans
  for all using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "stash_cycles_access" on public.stash_cycles;
create policy "stash_cycles_access" on public.stash_cycles
  for all using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "stash_days_access" on public.stash_days;
create policy "stash_days_access" on public.stash_days
  for all using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "stash_entries_access" on public.stash_entries;
create policy "stash_entries_access" on public.stash_entries
  for all using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "stash_categories_access" on public.stash_categories;
create policy "stash_categories_access" on public.stash_categories
  for all using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "stash_events_access" on public.stash_events;
create policy "stash_events_access" on public.stash_events
  for all using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "stash_feature_data_access" on public.stash_feature_data;
create policy "stash_feature_data_access" on public.stash_feature_data
  for all using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());
