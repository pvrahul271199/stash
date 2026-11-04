# Google sign-in: setup

How it works: the browser shows Google's official button (Google Identity Services). When the user picks an account, Google
returns an **ID token** to the page; the app hands it to Supabase (`signInWithIdToken`), which verifies it and returns a normal
session. No redirect back to Supabase, no client secret in the app. Supabase is still needed: it is what makes the user's
cloud data private (row-level security uses the Supabase session).

Code: `config/google.ts` (client ID), `lib/googleSignIn.ts` (button), `signInWithGoogleToken` in `lib/auth.ts`,
`components/screens/AuthScreen.tsx`. Headers/CSP for Vercel are in `vercel.json` (kept in step with `public/_headers`).

## 1. Google Cloud
1. https://console.cloud.google.com -> new project "Chelav".
2. **APIs & Services -> OAuth consent screen**: External, app name, support email. Scopes: defaults only. Add yourself as a
   test user; **Publish app** before real users (no Google review for basic scopes).
3. **Credentials -> Create credentials -> OAuth client ID -> Web application**.
   - **Authorized JavaScript origins**: your Vercel URL (e.g. `https://chelav.vercel.app`) and `http://localhost:3000`.
   - Authorized redirect URIs: not used by this flow. Leave empty (or keep the one you made, it does no harm).
4. Copy the **Client ID**. You do not need the client secret in the app.

## 2. Config (the "config file")
Set the client ID where the app reads it (`config/google.ts` reads these):
- **Vercel** -> Project -> Settings -> Environment Variables (Production + Preview):
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = your client ID, `NEXT_PUBLIC_APP_URL` = your Vercel URL. Then redeploy: these are baked in at build time.
- **Local**: add the same two lines to `.env.local` (template in `.env.example`).
Without a client ID the Google button simply does not appear.

## 3. Supabase
**Authentication -> Providers -> Google**: enable it, put the same Client ID in **Client IDs**. The client secret is only needed
for the redirect flow; leave it empty, or paste it if the form insists (it stays inside Supabase). If it complains about the
nonce, leave "Skip nonce check" OFF: the app sends a proper nonce.
Also set **Authentication -> URL Configuration -> Site URL** to your Vercel URL.
Re-run `supabase/schema.sql` if you have not (it holds `delete_my_account()` and the purge job).

## 4. What is stored (`profiles` table, filled by the trigger in `supabase/schema.sql`)
| | username + password | Google |
|---|---|---|
| `username` | the chosen username | the Google email (lower-case) |
| `display_name` | the username | the Google name (email name if none) |
| `email` | empty (the @stash.app address is internal) | the Google email |
| `auth_provider` | `email` | `google` |
| `avatar_url` | empty | Google picture URL |
Re-run `supabase/schema.sql`: it also back-fills profiles that already exist (including Google users created before this change).

## 5. Behaviour
- **New Google account** with guest data on the phone: guest data moves into the account and uploads.
- **Existing account** (login / another device): guest data is not merged; cloud data is pulled.
- Delete my account asks Google users to type DELETE (no password).
- Username/password accounts keep working; the same person using both gets two accounts (Supabase does not link them).

## Troubleshooting
- No button: client ID missing at build time (redeploy after setting it), or the browser blocks `accounts.google.com`.
- "Error 400: origin_mismatch" from Google: the page's origin is not in Authorized JavaScript origins (step 1.3).
- "Unacceptable audience / invalid client" from Supabase: the Client ID in Supabase differs from the one in the app.
- Nonce errors: make sure "Skip nonce check" is off and you deployed this version of the code.
