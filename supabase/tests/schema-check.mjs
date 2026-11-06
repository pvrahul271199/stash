// Runs supabase/schema.sql (twice, to prove it is idempotent) and push_changes against an in-process
// Postgres (PGlite) with a stubbed auth schema. Not part of `npm test`; PGlite is not a dependency:
//   npm i --no-save @electric-sql/pglite@0.2.17 && node supabase/tests/schema-check.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const sql = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8').replace(/create extension[^;]*;/i, '');
const db = new PGlite();
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth;
 create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, raw_app_meta_data jsonb default '{}'::jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 grant usage on schema auth to authenticated, anon;
 insert into auth.users(id,email) values ('${A}','a@stash.app'),('${B}','b@stash.app');
`);
let ok = 0, bad = 0;
const check = (name, cond, extra='') => { (cond ? ok++ : bad++); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + extra)); };
const run = async (label) => { try { await db.exec(sql); console.log('applied schema', label); } catch (e) { console.log('SCHEMA ERROR', label, e.message); process.exit(1);} };
await run('1st'); await run('2nd (idempotent)');
await db.exec(`grant all on all tables in schema public to authenticated; grant usage on schema public to authenticated;`);
const as = async (uid, fn) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`); try { return await fn(); } finally { await db.exec('reset role'); } };
const push = (uid, mid, changes) => as(uid, async () => (await db.query('select public.push_changes($1,$2::jsonb) r', [mid, JSON.stringify(changes)])).rows[0].r);
const err = async (p) => { try { await p; return null; } catch (e) { return e.message; } };
const now = Date.now();
const txn = (id, over = {}) => ({ id, client_updated_at: now, deleted_at: null, txn_date: '2026-10-01', amount: 10, type: 'Food', category_id: 'food', subtype: null, label: 'x', event: null, event_id: null, payment: null, note: null, from_savings: false, adjusts_pool: true, is_estimate: false, hour: 0, created_at: now, ...over });
const T1='bbbbbbbb-0000-0000-0000-000000000001', T2='bbbbbbbb-0000-0000-0000-000000000002';
const plan0 = (id) => ({ id, client_updated_at: now, deleted_at: null, income: 1, bills: 0, savings: 0, month_length: 30, created_at: now, period_start_day: 1, effective_from: '2026-11-01', _base_version: null });
const M = (n) => `cccccccc-0000-0000-0000-${String(n).padStart(12, "0")}`;

// 1. insert
let r = await push(A, M(1), { transactions: [{ ...txn(T1), _base_version: null }] });
check('insert batch ok', r.status === 'ok' && r.versions.transactions[T1] === 1, JSON.stringify(r));
// 2. idempotent replay
r = await push(A, M(1), { transactions: [{ ...txn(T1, { note: 'replayed' }), _base_version: null }] });
check('replay returns stored result, writes nothing', r.status === 'ok' && (await db.query('select note from transactions where id=$1',[T1])).rows[0].note !== 'replayed');
// 3. update with correct base bumps version
r = await push(A, M(2), { transactions: [{ ...txn(T1, { note: 'hi', client_updated_at: now + 10 }), _base_version: 1 }] });
check('update with right base -> version 2', r.status === 'ok' && r.versions.transactions[T1] === 2, JSON.stringify(r));
// 4. stale base -> conflict, nothing written (incl. other rows in the batch)
r = await push(A, M(3), { plans: [plan0('dddddddd-0000-0000-0000-0000000000a1')], transactions: [{ ...txn(T1, { note: 'stale' }), _base_version: 1 }] });
check('stale base -> conflict with server row', r.status === 'conflict' && r.conflicts.transactions[0].note === 'hi', JSON.stringify(r));
check('conflict wrote nothing', (await db.query(`select 1 from plans where id='dddddddd-0000-0000-0000-0000000000a1'`)).rows.length === 0);
// 5. insert of existing id with null base is a conflict
r = await push(A, M(4), { transactions: [{ ...txn(T1), _base_version: null }] });
check('existing id with null base -> conflict', r.status === 'conflict');
// 6. clock clamp + cannot move client_updated_at backwards
r = await push(A, M(5), { transactions: [{ ...txn(T1, { client_updated_at: now + 10 * 86400000 }), _base_version: 2 }] });
let row = (await db.query('select client_updated_at, version from transactions where id=$1',[T1])).rows[0];
check('far-future client clock clamped to now+1min', Number(row.client_updated_at) <= Date.now() + 61000, String(row.client_updated_at));
r = await push(A, M(6), { transactions: [{ ...txn(T1, { client_updated_at: 5 }), _base_version: 3 }] });
row = (await db.query('select client_updated_at from transactions where id=$1',[T1])).rows[0];
check('client_updated_at never moves backwards', r.status === 'ok' && Number(row.client_updated_at) > 1000);
// 7. atomic: a constraint violation rolls the whole batch back
let e = await err(push(A, M(7), { transactions: [{ ...txn(T2), _base_version: null }], plans: [{ id: 'dddddddd-0000-0000-0000-000000000001', client_updated_at: now, deleted_at: null, income: -5, bills: 0, savings: 0, month_length: 30, created_at: now, _base_version: null }] }));
check('negative income rejected', e && /plans_nonneg_check/.test(e), e);
check('...and the txn in the same batch was rolled back', (await db.query('select 1 from transactions where id=$1',[T2])).rows.length === 0);
check('...and the mutation is not recorded', (await db.query('select 1 from push_mutations where id=$1',[M(7)])).rows.length === 0);
// 11. other user can't touch my rows through push_changes
e = await err(push(B, M(13), { transactions: [{ ...txn(T1, { note: 'hack' }), _base_version: 3 }] }));
check("B can't overwrite A's row by reusing its id", e && /transactions_pkey/.test(e), e);
check("...A's row is untouched", (await db.query('select note from transactions where id=$1',[T1])).rows[0].note !== 'hack');
// 12. jsonb shape
const plan = (id, over) => ({ id, client_updated_at: now, deleted_at: null, income: 1, bills: 1, savings: 1, month_length: 30, created_at: now, ...over, _base_version: null });
e = await err(push(A, M(14), { plans: [plan('dddddddd-0000-0000-0000-000000000002', { bill_items: [{ name: 'Rent', amount: 'lots' }] })] }));
check('bad bill_items rejected', e && /plans_items_shape_check/.test(e), e);
e = await err(push(A, M(15), { plans: [plan('dddddddd-0000-0000-0000-000000000003', { savings_items: { name: 'x' } })] }));
check('non-array savings_items rejected', e && /plans_items_shape_check/.test(e), e);
r = await push(A, M(16), { plans: [plan('dddddddd-0000-0000-0000-000000000004', { bill_items: [{ name: 'Rent', amount: 100 }], savings_items: [] })] });
check('valid items accepted', r.status === 'ok', JSON.stringify(r));
// 13. unique live names + dedupe path
const cat = (id, name) => ({ id, client_updated_at: now, deleted_at: null, name, sort_order: 0, is_system: false, subcategories: [], base_id: null, sub_added: [], sub_removed: [], _base_version: null });
await push(A, M(17), { categories: [cat('eeeeeeee-0000-0000-0000-000000000001', 'Pets')] });
e = await err(push(A, M(18), { categories: [cat('eeeeeeee-0000-0000-0000-000000000002', 'pets')] }));
check('duplicate live category name rejected (case-insensitive)', e && /uq_categories_user_name/.test(e), e);
r = await push(B, M(19), { categories: [cat('eeeeeeee-0000-0000-0000-000000000003', 'Pets')] });
check('same name for another user is fine', r.status === 'ok');
// 14. event FK
e = await err(push(A, M(20), { transactions: [{ ...txn('bbbbbbbb-0000-0000-0000-000000000010', { event_id: 'ffffffff-0000-0000-0000-000000000001' }), _base_version: null }] }));
check('unknown event_id rejected', e && /transactions_event_id_fkey/.test(e), e);
// 15. legacy direct write still bumps version / ignores client-set version
await db.exec(`reset role`);
await db.exec(`update transactions set note='direct', version=999 where id='${T1}'`);
const v = (await db.query('select version from transactions where id=$1',[T1])).rows[0].version;
check('direct write: trigger owns version', Number(v) < 999, String(v));
// 16. UUIDv7 ids are accepted by the uuid primary key
r = await push(A, M(21), { transactions: [{ ...txn('01930000-0000-7000-8000-000000000001'), _base_version: null }] });
check('uuidv7 transaction id accepted', r.status === 'ok', JSON.stringify(r));
// 17. L1: only the pull index (+ the tiny partial event index) remain on transactions
const idx = (await db.query(`select indexname from pg_indexes where schemaname='public' and tablename='transactions' order by 1`)).rows.map((x) => x.indexname);
check('transactions keeps one general index + the partial event index',
  idx.includes('idx_transactions_user_updated_id') && idx.includes('idx_transactions_event') &&
  !idx.some((n) => /user_date|user_cycle|user_category|user_event|user_updated$/.test(n)), idx.join(','));
// 18. H2: purge hard-deletes old tombstones only
await db.exec('reset role');
const OLD = `now() - interval '40 days'`, RECENT = `now() - interval '5 days'`;
await db.exec(`update transactions set deleted_at = ${OLD} where id='${T1}'`);
r = await push(A, M(22), { transactions: [{ ...txn('bbbbbbbb-0000-0000-0000-000000000020'), _base_version: null }] });
await db.exec(`update transactions set deleted_at = ${RECENT} where id='bbbbbbbb-0000-0000-0000-000000000020'`);
await db.exec(`update categories set deleted_at = ${OLD}, base_id = 'food' where id='eeeeeeee-0000-0000-0000-000000000001'`);
const purged = (await db.query('select public.purge_deleted_data() r')).rows[0].r;
check('old tombstone purged', (await db.query('select 1 from transactions where id=$1', [T1])).rows.length === 0 && purged.transactions === 1, JSON.stringify(purged));
check('recent tombstone kept', (await db.query(`select 1 from transactions where id='bbbbbbbb-0000-0000-0000-000000000020'`)).rows.length === 1);
check('"built-in category removed" marker kept even when old', (await db.query(`select 1 from categories where id='eeeeeeee-0000-0000-0000-000000000001'`)).rows.length === 1);
e = await err(as(A, () => db.query('select public.purge_deleted_data()')));
check('users cannot call the purge', e && /permission denied/i.test(e), e);
// derived months: no cycles table / cycle_id column any more, plans carry the start day
check('cycles table is gone', (await db.query(`select 1 from pg_tables where schemaname='public' and tablename='cycles'`)).rows.length === 0);
check('transactions.cycle_id is gone', (await db.query(`select 1 from information_schema.columns where table_name='transactions' and column_name='cycle_id'`)).rows.length === 0);
e = await err(push(A, M(30), { plans: [{ ...plan0('dddddddd-0000-0000-0000-0000000000a2'), period_start_day: 40 }] }));
check('period_start_day outside 1..31 rejected', e && /plans_period_start_day_check/.test(e), e);
r = await push(A, M(31), { plans: [plan0('dddddddd-0000-0000-0000-0000000000a3')] });
check('plan with start day + effective_from accepted', r.status === 'ok', JSON.stringify(r));
r = await push(A, M(32), { cycles: [{ id: 'aaaaaaaa-0000-0000-0000-000000000009', _base_version: null }] });
check('a stale client still sending "cycles" is ignored, not an error', r.status === 'ok', JSON.stringify(r));
// 19. H2: delete_my_account erases every row of the caller, and only the caller
const countFor = async (uid) => Number((await db.query(`select (select count(*) from transactions where user_id=$1) + (select count(*) from categories where user_id=$1) + (select count(*) from push_mutations where user_id=$1) + (select count(*) from profiles where id=$1) n`, [uid])).rows[0].n);
check('A has data before deletion', (await countFor(A)) > 0);
check('B has data before deletion', (await countFor(B)) > 0);
await db.exec(`select set_config('request.jwt.claim.sub','',false)`);
e = await err(db.query('select public.delete_my_account()')); // no auth.uid()
check('anonymous caller cannot delete', e && /not authenticated/.test(e), e);
await as(A, () => db.query('select public.delete_my_account()'));
check('A: every row gone', (await countFor(A)) === 0);
check('A: auth user gone', (await db.query('select 1 from auth.users where id=$1', [A])).rows.length === 0);
check('B: untouched', (await countFor(B)) > 0 && (await db.query('select 1 from auth.users where id=$1', [B])).rows.length === 1);
// 20. profiles: username / display name / email for every sign-in method
const G = '33333333-3333-3333-3333-333333333333', P = '44444444-4444-4444-4444-444444444444';
await db.exec(`reset role`);
await db.exec(`insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
  ('${G}','Rahul.PV@Gmail.com','{"full_name":"Rahul P V","avatar_url":"https://x/y.png"}','{"provider":"google"}'),
  ('${P}','pwuser@stash.app','{"username":"pwuser"}','{"provider":"email"}')`);
const prof = async (id) => (await db.query('select username, display_name, email, auth_provider, avatar_url from profiles where id=$1', [id])).rows[0];
let pr = await prof(G);
check('google: username = email (lower-case), display name = name', pr && pr.username === 'rahul.pv@gmail.com' && pr.display_name === 'Rahul P V' && pr.email === 'rahul.pv@gmail.com' && pr.auth_provider === 'google' && pr.avatar_url === 'https://x/y.png', JSON.stringify(pr));
pr = await prof(P);
check('password: username and display name = username, no email stored, provider email', pr && pr.username === 'pwuser' && pr.display_name === 'pwuser' && pr.email === null && pr.auth_provider === 'email', JSON.stringify(pr));
e = await err(db.exec(`update profiles set username = 'not valid' where id='${P}'`));
check('a malformed username is still rejected', e && /profiles_username_check/.test(e), e);
await db.exec(`insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values ('55555555-5555-5555-5555-555555555555','noname@gmail.com','{}','{"provider":"google"}')`);
pr = await prof('55555555-5555-5555-5555-555555555555');
check('google without a name falls back to the email name', pr && pr.display_name === 'noname', JSON.stringify(pr));
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
