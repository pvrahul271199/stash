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
 create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
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
const cyc = (id, over = {}) => ({ id, client_updated_at: now, deleted_at: null, start_date: '2026-10-01', total_days: 30, plan_amount: 30000, current_day: 1, leftover_moved: false, estimated_days: [], ...over });
const txn = (id, cycle_id, over = {}) => ({ id, client_updated_at: now, deleted_at: null, cycle_id, txn_date: '2026-10-01', amount: 10, type: 'Food', category_id: 'food', subtype: null, label: 'x', event: null, event_id: null, payment: null, note: null, from_savings: false, adjusts_pool: true, is_estimate: false, hour: 0, created_at: now, ...over });
const C1='aaaaaaaa-0000-0000-0000-000000000001', C2='aaaaaaaa-0000-0000-0000-000000000002', T1='bbbbbbbb-0000-0000-0000-000000000001', T2='bbbbbbbb-0000-0000-0000-000000000002';
const M = (n) => `cccccccc-0000-0000-0000-${String(n).padStart(12, "0")}`;

// 1. txn listed BEFORE its cycle in the batch still works (deferred FK + parents-first)
let r = await push(A, M(1), { cycles: [{ ...cyc(C1), _base_version: null }], transactions: [{ ...txn(T1, C1), _base_version: null }] });
check('insert batch ok', r.status === 'ok' && r.versions.cycles[C1] === 1 && r.versions.transactions[T1] === 1, JSON.stringify(r));
// 2. idempotent replay
r = await push(A, M(1), { cycles: [{ ...cyc(C1, { total_days: 99 }), _base_version: null }] });
check('replay returns stored result, writes nothing', r.status === 'ok' && (await db.query('select total_days from cycles where id=$1',[C1])).rows[0].total_days === 30);
// 3. update with correct base bumps version
r = await push(A, M(2), { transactions: [{ ...txn(T1, C1, { note: 'hi', client_updated_at: now + 10 }), _base_version: 1 }] });
check('update with right base -> version 2', r.status === 'ok' && r.versions.transactions[T1] === 2, JSON.stringify(r));
// 4. stale base -> conflict, nothing written (incl. other rows in the batch)
r = await push(A, M(3), { cycles: [{ ...cyc(C1, { current_day: 5 }), _base_version: 1 }], transactions: [{ ...txn(T1, C1, { note: 'stale' }), _base_version: 1 }] });
check('stale base -> conflict with server row', r.status === 'conflict' && r.conflicts.transactions[0].note === 'hi' && !r.conflicts.cycles, JSON.stringify(r));
check('conflict wrote nothing', (await db.query('select current_day from cycles where id=$1',[C1])).rows[0].current_day === 1);
// 5. insert of existing id with null base is a conflict
r = await push(A, M(4), { transactions: [{ ...txn(T1, C1), _base_version: null }] });
check('existing id with null base -> conflict', r.status === 'conflict');
// 6. clock clamp + cannot move client_updated_at backwards
r = await push(A, M(5), { transactions: [{ ...txn(T1, C1, { client_updated_at: now + 10 * 86400000 }), _base_version: 2 }] });
let row = (await db.query('select client_updated_at, version from transactions where id=$1',[T1])).rows[0];
check('far-future client clock clamped to now+1min', Number(row.client_updated_at) <= Date.now() + 61000, String(row.client_updated_at));
r = await push(A, M(6), { transactions: [{ ...txn(T1, C1, { client_updated_at: 5 }), _base_version: 3 }] });
row = (await db.query('select client_updated_at from transactions where id=$1',[T1])).rows[0];
check('client_updated_at never moves backwards', r.status === 'ok' && Number(row.client_updated_at) > 1000);
// 7. atomic: a constraint violation rolls the whole batch back
let e = await err(push(A, M(7), { transactions: [{ ...txn(T2, C1), _base_version: null }], plans: [{ id: 'dddddddd-0000-0000-0000-000000000001', client_updated_at: now, deleted_at: null, income: -5, bills: 0, savings: 0, month_length: 30, created_at: now, _base_version: null }] }));
check('negative income rejected', e && /plans_nonneg_check/.test(e), e);
check('...and the txn in the same batch was rolled back', (await db.query('select 1 from transactions where id=$1',[T2])).rows.length === 0);
check('...and the mutation is not recorded', (await db.query('select 1 from push_mutations where id=$1',[M(7)])).rows.length === 0);
// 8. cycle constraints
e = await err(push(A, M(8), { cycles: [{ ...cyc(C2, { current_day: 40 }), _base_version: null }] }));
check('current_day > total_days+1 rejected', e && /cycles_current_day_check/.test(e), e);
e = await err(push(A, M(9), { cycles: [{ ...cyc(C2, { total_days: 400, current_day: 1 }), _base_version: null }] }));
check('total_days > 366 rejected', e && /cycles_total_days_check/.test(e), e);
// 9. one active cycle per user
e = await err(push(A, M(10), { cycles: [{ ...cyc(C2), _base_version: null }] }));
check('second active cycle rejected', e && /uq_cycles_one_active/.test(e), e);
r = await push(A, M(11), { cycles: [{ ...cyc(C1, { current_day: 31, client_updated_at: now + 20 }), _base_version: 1 }, { ...cyc(C2), _base_version: null }] });
check('closing old + starting new in one batch works (updates before inserts)', r.status === 'ok', JSON.stringify(r));
check('status is derived', (await db.query("select status from cycles where id=$1",[C1])).rows[0].status === 'closed');
// 10. composite FK: other user's cycle
e = await err(push(B, M(12), { transactions: [{ ...txn('bbbbbbbb-0000-0000-0000-000000000009', C1), _base_version: null }] }));
check("transaction can't point at another user's cycle", e && /transactions_user_cycle_fkey/.test(e), e);
// 11. other user can't touch my rows through push_changes
e = await err(push(B, M(13), { transactions: [{ ...txn(T1, C1, { note: 'hack' }), _base_version: 3 }] }));
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
e = await err(push(A, M(20), { transactions: [{ ...txn('bbbbbbbb-0000-0000-0000-000000000010', C2, { event_id: 'ffffffff-0000-0000-0000-000000000001' }), _base_version: null }] }));
check('unknown event_id rejected', e && /transactions_event_id_fkey/.test(e), e);
// 15. legacy direct write still bumps version / ignores client-set version
await db.exec(`reset role`);
await db.exec(`update transactions set note='direct', version=999 where id='${T1}'`);
const v = (await db.query('select version from transactions where id=$1',[T1])).rows[0].version;
check('direct write: trigger owns version', Number(v) < 999, String(v));
// 16. UUIDv7 ids are accepted by the uuid primary key
r = await push(A, M(21), { transactions: [{ ...txn('01930000-0000-7000-8000-000000000001', C2), _base_version: null }] });
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
r = await push(A, M(22), { transactions: [{ ...txn('bbbbbbbb-0000-0000-0000-000000000020', C1), _base_version: null }] });
await db.exec(`update transactions set deleted_at = ${RECENT} where id='bbbbbbbb-0000-0000-0000-000000000020'`);
await db.exec(`update categories set deleted_at = ${OLD}, base_id = 'food' where id='eeeeeeee-0000-0000-0000-000000000001'`);
const purged = (await db.query('select public.purge_deleted_data() r')).rows[0].r;
check('old tombstone purged', (await db.query('select 1 from transactions where id=$1', [T1])).rows.length === 0 && purged.transactions === 1, JSON.stringify(purged));
check('recent tombstone kept', (await db.query(`select 1 from transactions where id='bbbbbbbb-0000-0000-0000-000000000020'`)).rows.length === 1);
check('"built-in category removed" marker kept even when old', (await db.query(`select 1 from categories where id='eeeeeeee-0000-0000-0000-000000000001'`)).rows.length === 1);
e = await err(as(A, () => db.query('select public.purge_deleted_data()')));
check('users cannot call the purge', e && /permission denied/i.test(e), e);
// cycle with live children is never purged
await db.exec(`update cycles set deleted_at = ${OLD} where id='${C1}'`);
await db.query('select public.purge_deleted_data()');
check('cycle still referenced by a transaction is kept', (await db.query('select 1 from cycles where id=$1', [C1])).rows.length === 1);
// 19. H2: delete_my_account erases every row of the caller, and only the caller
const countFor = async (uid) => Number((await db.query(`select (select count(*) from transactions where user_id=$1) + (select count(*) from cycles where user_id=$1) + (select count(*) from categories where user_id=$1) + (select count(*) from push_mutations where user_id=$1) + (select count(*) from profiles where id=$1) n`, [uid])).rows[0].n);
check('A has data before deletion', (await countFor(A)) > 0);
check('B has data before deletion', (await countFor(B)) > 0);
await db.exec(`select set_config('request.jwt.claim.sub','',false)`);
e = await err(db.query('select public.delete_my_account()')); // no auth.uid()
check('anonymous caller cannot delete', e && /not authenticated/.test(e), e);
await as(A, () => db.query('select public.delete_my_account()'));
check('A: every row gone', (await countFor(A)) === 0);
check('A: auth user gone', (await db.query('select 1 from auth.users where id=$1', [A])).rows.length === 0);
check('B: untouched', (await countFor(B)) > 0 && (await db.query('select 1 from auth.users where id=$1', [B])).rows.length === 1);
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
