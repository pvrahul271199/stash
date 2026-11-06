// Tests supabase/admin/move_account_data.sql against an in-process Postgres (PGlite). Not part of `npm test`:
//   npm i --no-save @electric-sql/pglite@0.2.17 && node supabase/tests/move-account-check.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const read = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8').replace(/create extension[^;]*;/i, '');
const db = new PGlite();
const P = '11111111-1111-1111-1111-111111111111'; // "rahul", username + password
const G = '22222222-2222-2222-2222-222222222222'; // Google account
const X = '33333333-3333-3333-3333-333333333333'; // another password account (must stay untouched)
await db.exec(`
 create role anon; create role authenticated; create role service_role; create schema auth;
 create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, raw_app_meta_data jsonb default '{}'::jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 grant usage on schema auth to authenticated, anon;
`);
await db.exec(read('../schema.sql'));
// accounts are created after the schema is in place, so the profile trigger runs exactly as in production
await db.exec(`
 insert into auth.users(id,email,raw_user_meta_data) values ('${P}','rahul@stash.app','{"username":"rahul"}'), ('${X}','other@stash.app','{"username":"other"}');
 insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values ('${G}','Me@Gmail.com','{"full_name":"Rahul P V","avatar_url":"http://a/b.png"}','{"provider":"google"}');
`);
await db.exec(read('../admin/move_account_data.sql'));
await db.exec(read('../admin/move_account_data.sql')); // idempotent
let ok = 0, bad = 0;
const check = (name, cond, extra = '') => { (cond ? ok++ : bad++); console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + extra)); };
const err = async (p) => { try { await p; return null; } catch (e) { return e.message; } };
const now = Date.now();
const seed = async (uid, tag) => {
  await db.exec(`
   insert into plans (id,user_id,client_updated_at,income,bills,savings,month_length,created_at,period_start_day,effective_from)
     values ('${tag}-0000-4000-8000-00000000000a','${uid}',${now},60000,20000,0,30,${now},1,'2026-10-30');
   insert into categories (id,user_id,client_updated_at,name,is_system) values ('${tag}-0000-4000-8000-00000000000b','${uid}',${now},'Pets',false);
   insert into events (id,user_id,client_updated_at,name,created_at) values ('${tag}-0000-4000-8000-00000000000c','${uid}',${now},'Goa',${now});
   insert into transactions (id,user_id,client_updated_at,txn_date,amount,type,label,created_at,event_id)
     values ('${tag}-0000-4000-8000-00000000000d','${uid}',${now},'2026-11-03',2555,'Other','Sort later',${now},'${tag}-0000-4000-8000-00000000000c'),
            ('${tag}-0000-4000-8000-00000000000e','${uid}',${now},'2026-11-04',50000,'Other','deleted one',${now},null);
   update transactions set deleted_at = now() where id = '${tag}-0000-4000-8000-00000000000e';
   insert into feature_data (id,user_id,client_updated_at,feature_key,item_id) values ('${tag}-0000-4000-8000-00000000000f','${uid}',${now},'k','i');
  `);
};
await seed(P, 'aaaaaaaa'); await seed(X, 'cccccccc');
const count = async (uid) => Number((await db.query(`select (select count(*) from plans where user_id=$1)+(select count(*) from categories where user_id=$1)+(select count(*) from events where user_id=$1)+(select count(*) from transactions where user_id=$1)+(select count(*) from feature_data where user_id=$1) n`, [uid])).rows[0].n);

const g = (await db.query(`select username, email, auth_provider, display_name, avatar_url from profiles where id=$1`, [G])).rows[0];
check('Google profile stores the lower-cased email, name and avatar', g.email === 'me@gmail.com' && g.username === 'me@gmail.com' && g.auth_provider === 'google' && g.display_name === 'Rahul P V' && !!g.avatar_url, JSON.stringify(g));
const p = (await db.query(`select email from profiles where id=$1`, [P])).rows[0];
check('a username + password profile stores no email', p.email === null);

let e = await err(db.query(`select public.move_account_data('nobody', 'me@gmail.com')`));
check('unknown source username is refused', e && /No username \+ password account/.test(e), e);
e = await err(db.query(`select public.move_account_data('rahul', 'nobody@gmail.com')`));
check('unknown Google email is refused with a helpful hint', e && /Sign in with Google once first/.test(e), e);
e = await err(db.query(`select public.move_account_data('rahul', 'other@stash.app')`));
check('a password account cannot be the target', e && /No Google account/.test(e), e);

const before = await count(P);
const dry = (await db.query(`select public.move_account_data('rahul', 'ME@gmail.com', false, true) r`)).rows[0].r;
check('a dry run reports what would move and changes nothing', dry.dry_run === true && dry.would_move.transactions === 2 && dry.would_move.plans === 1 && (await count(P)) === before && (await count(G)) === 0, JSON.stringify(dry));
const r = (await db.query(`select public.move_account_data('rahul', 'ME@gmail.com') r`)).rows[0].r;
check('everything moved, counts reported', r.plans === 1 && r.categories === 1 && r.events === 1 && r.transactions === 2 && r.feature_data === 1, JSON.stringify(r));
check('the old account is empty, the Google account has it all', (await count(P)) === 0 && (await count(G)) === before);
check('tombstones moved too (the deleted spend stays deleted)', (await db.query(`select 1 from transactions where user_id=$1 and deleted_at is not null`, [G])).rows.length === 1);
check('the spend still points at its event', (await db.query(`select 1 from transactions t join events e on e.id=t.event_id and e.user_id=t.user_id where t.user_id=$1`, [G])).rows.length === 1);
check('another account is untouched', (await count(X)) === before);
check('moved rows got a new server version / updated_at (so devices pull them)', Number((await db.query(`select min(version) v from transactions where user_id=$1`, [G])).rows[0].v) >= 2);

await seed(P, 'dddddddd'); // old account gets new data again; the Google account is now non-empty
e = await err(db.query(`select public.move_account_data('rahul', 'me@gmail.com')`));
check('a target that already has data is refused, and nothing moved', e && /already has \d+ live rows/.test(e) && (await count(P)) === before, e);
const r2 = (await db.query(`select public.move_account_data('rahul', 'me@gmail.com', true) r`)).rows[0].r;
check('with the explicit flag it replaces the target', r2.transactions === 2 && (await count(P)) === 0 && (await count(G)) === before);

await db.exec(`grant all on all tables in schema public to authenticated; grant usage on schema public to authenticated;`);
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${G}',false);`);
e = await err(db.query(`select public.move_account_data('rahul','me@gmail.com')`));
await db.exec('reset role');
check('a logged-in user cannot run it', e && /permission denied/i.test(e), e);
await db.exec(`set role anon;`);
e = await err(db.query(`select public.move_account_data('rahul','me@gmail.com')`));
await db.exec('reset role');
check('the public (anon) cannot run it', e && /permission denied/i.test(e), e);

console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
