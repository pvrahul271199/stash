-- ============================================================================
-- Move everything one account owns to another account (admin only).
--
-- Typical use: a username + password account ("rahul") whose data should now live under a Google account.
-- Run this file ONCE in Supabase Dashboard -> SQL Editor to create the function, then call it (see "How to use").
-- It is deliberately NOT part of supabase/schema.sql: it is an admin tool, not something the app may ever call.
--
-- What moves (rows are re-pointed, nothing is copied or lost): plans, transactions, categories, events, feature_data,
-- including their soft-delete tombstones. What does not: the login itself (auth.users), the profile row, the consent log.
--
-- Safety:
--  * both accounts are looked up by name, never by raw id typed by hand: the source must be a username + password account,
--    the target must be a Google account (so "sign in with Google once" has to happen first: that creates its profile);
--  * if the target already holds live data the function REFUSES, unless you pass p_wipe_target => true;
--  * it all happens in one transaction: any error undoes everything;
--  * it is not callable by the app or by logged-in users (execute is revoked below).
--
-- How to use:
--   1. Sign in with the Google account once (on the phone or the web). Don't log any spends with it yet.
--   2. Find the two names (optional check):
--        select username, email, auth_provider, id from public.profiles order by created_at;
--   3. Preview first (changes nothing, shows what WOULD move):
--        select public.move_account_data('rahul', 'you@gmail.com', false, true);
--   4. Move:
--        select public.move_account_data('rahul', 'you@gmail.com');
--      It returns how many rows of each kind moved. To replace a Google account that already has data: add  , true  as a third argument.
--   5. On the Google account's device: Log out (this removes the local copy), then Sign in with Google again. Everything appears.
--   6. Optional, once you have checked it: remove the now-empty old login:
--        delete from auth.users where id = (select id from public.profiles where username = 'rahul' and auth_provider = 'email');
-- ============================================================================
-- (the older 3-argument version, if you created it earlier, is replaced by this 4-argument one)
drop function if exists public.move_account_data(text, text, boolean);
create or replace function public.move_account_data(p_from_username text, p_to_email text, p_wipe_target boolean default false, p_dry_run boolean default false)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_from uuid;
  v_to uuid;
  v_live bigint;
  v_out jsonb := '{}'::jsonb;
  n bigint;
begin
  select id into v_from from public.profiles
   where username = lower(trim(p_from_username)) and auth_provider = 'email';
  if v_from is null then
    raise exception 'No username + password account named "%"', p_from_username using errcode = 'P0002';
  end if;

  select id into v_to from public.profiles
   where lower(email) = lower(trim(p_to_email)) and auth_provider = 'google';
  if v_to is null then
    raise exception 'No Google account with email "%". Sign in with Google once first, then run this again.', p_to_email using errcode = 'P0002';
  end if;
  if v_from = v_to then
    raise exception 'Source and target are the same account' using errcode = '22023';
  end if;

  select (select count(*) from public.plans        where user_id = v_to and deleted_at is null)
       + (select count(*) from public.transactions where user_id = v_to and deleted_at is null)
       + (select count(*) from public.events       where user_id = v_to and deleted_at is null)
       + (select count(*) from public.categories   where user_id = v_to and deleted_at is null)
    into v_live;
  if v_live > 0 and not p_wipe_target then
    raise exception 'The Google account already has % live rows. Nothing was moved. Pass true as the third argument to replace them.', v_live
      using errcode = '23505';
  end if;
  if p_dry_run then
    -- the same checks as a real run passed; only report what would move
    return jsonb_build_object(
      'dry_run', true,
      'would_move', jsonb_build_object(
        'plans',        (select count(*) from public.plans        where user_id = v_from),
        'categories',   (select count(*) from public.categories   where user_id = v_from),
        'events',       (select count(*) from public.events       where user_id = v_from),
        'transactions', (select count(*) from public.transactions where user_id = v_from),
        'feature_data', (select count(*) from public.feature_data where user_id = v_from)),
      'target_live_rows_replaced', case when p_wipe_target then v_live else 0 end,
      'from', v_from, 'to', v_to);
  end if;
  if p_wipe_target then
    -- children first (transactions reference events)
    delete from public.transactions where user_id = v_to;
    delete from public.events       where user_id = v_to;
    delete from public.categories   where user_id = v_to;
    delete from public.plans        where user_id = v_to;
    delete from public.feature_data where user_id = v_to;
  end if;

  update public.plans        set user_id = v_to where user_id = v_from; get diagnostics n = row_count; v_out := v_out || jsonb_build_object('plans', n);
  update public.categories   set user_id = v_to where user_id = v_from; get diagnostics n = row_count; v_out := v_out || jsonb_build_object('categories', n);
  update public.events       set user_id = v_to where user_id = v_from; get diagnostics n = row_count; v_out := v_out || jsonb_build_object('events', n);
  update public.transactions set user_id = v_to where user_id = v_from; get diagnostics n = row_count; v_out := v_out || jsonb_build_object('transactions', n);
  update public.feature_data set user_id = v_to where user_id = v_from; get diagnostics n = row_count; v_out := v_out || jsonb_build_object('feature_data', n);
  -- the old account's idempotency log means nothing for the new owner
  delete from public.push_mutations where user_id = v_from;

  return v_out || jsonb_build_object('from', v_from, 'to', v_to);
end $$;

-- Supabase grants execute on new public functions to the app's roles by default: take that away. Only the SQL editor (postgres) can run it.
revoke all on function public.move_account_data(text, text, boolean, boolean) from public, anon, authenticated;
