# Privacy notice versions and consent proof

Why: under India's DPDP Act the company must be able to **show** that a user agreed, and to what. Consent is
recorded on the server, not just on the phone.

## How consent is captured

| Where | What the user does | `method` |
|---|---|---|
| Sign-up / log-in form (`AuthScreen`) | Taps **Create account** / **Log in**, with the line "By continuing you agree to your plan and spends being backed up to your account." and an "i" (full notice) directly above. | `signup` / `login` |
| Google sign-in | Taps Google's own button, under the same line (we cannot relabel Google's button). | `google` |

There is no separate consent screen any more (removed 2026-11-06). A signed-in user whose device has no consent record
(for example a session from before consent existed) has cloud backup paused until they next log in, which records it.
The `gate` method is no longer written by the app but stays valid in the database.

1. `acceptSyncConsent(method)` (`lib/consent.ts`) sets the local flag. `syncNow` refuses to upload without it.
2. `flushConsentRecord()` calls the database function `record_consent(version, hash, method)`. It writes one row to
   `public.consents` with the **server's** timestamp. If the phone is offline the local record stays "pending" and
   is retried whenever the signed-in app starts or syncs.
3. One row per user per notice version (`unique (user_id, notice_version)`); later acceptances of the same version are ignored.
4. `consents` has no foreign key on purpose, so the row survives "Delete my account" (it holds only the random user
   id, version, hash, method and time). Confirm this retention period with your lawyer.
5. Users can `select` their own rows; nobody can insert/update/delete except through `record_consent()`.

## Looking up proof

```sql
select user_id, notice_version, method, accepted_at, notice_hash
from public.consents where user_id = '<uuid>';
```
Match `notice_hash` against the table below to know exactly which words the user accepted.

## Changing the notice

Edit `lib/privacyNotice.ts` → bump `CONSENT_VERSION` in `lib/consent.ts` (everyone is asked again) → add the new
text and hash here → update `V1_HASH`-style constant in `tests/consent.test.ts`. The test fails if the text changes
without this.

The hash is SHA-256 (hex) of the sections joined as `"<title> <body>"` with `\n` (see `noticeText()`); the optional
contact line (`NEXT_PUBLIC_PRIVACY_CONTACT`) is not part of the hash.

## Version 2 (hash `6f3edf89a31e4c618615c6ce00ea5779693794edbca0e565409f73c5d07c695b`) — current

Added 2026-11-08: PostHog usage analytics (screens opened, actions taken, never amounts/notes/categories), linked to the
account when signed in via `posthog.identify`. Everyone is asked again (`CONSENT_VERSION` = 2).

**What we store.** Your username (or, with Google, your Google email, name and picture), your plan (income, bills, savings), every spend you log (amount, date, category, label, note, payment type) and your categories, events and currency.

**Why.** Only to back up your month and show it on your other devices, and to understand how the app is used. We do not sell it or show ads, and we share it with no one except the providers named here.

**Usage analytics.** We record which screens you open and which actions you take (for example “logged a spend”, never the amount, category or note) to fix and improve the app. This is sent to our analytics provider (PostHog). When you are signed in it is linked to your account (your Google email and name); without an account it is tied only to a random id.

**Where.** In your account on our cloud database provider (Supabase). Without an account, everything stays on this phone.

**Your choices.** Export a CSV any time. Log out to stop syncing. “Delete my account” in Settings permanently erases your account and everything in it from the cloud. Items you delete are removed from the cloud within 30 days.

## Version 1 (superseded; hash `654bcdc4d7cf124645017ba8a14e0ea45fb34031bad40d5ad2afe30c13e2b79f`)

**What we store.** Your username (or, with Google, your Google email, name and picture), your plan (income, bills, savings), every spend you log (amount, date, category, label, note, payment type) and your categories, events and currency.

**Why.** Only to back up your month and show it on your other devices. We do not sell it, show ads, or share it with anyone else.

**Where.** In your account on our cloud database provider (Supabase). Without an account, everything stays on this phone.

**Your choices.** Export a CSV any time. Log out to stop syncing. “Delete my account” in Settings permanently erases your account and everything in it from the cloud. Items you delete are removed from the cloud within 30 days.
