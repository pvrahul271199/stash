/**
 * Google sign-in configuration. Everything here is PUBLIC (it ships to the browser), so only the
 * OAuth *client ID* belongs here. Never put the client secret in this repo or any NEXT_PUBLIC_ variable:
 * the secret lives only in the Supabase dashboard (and is optional for this ID-token flow).
 *
 * Set these in Vercel (Project -> Settings -> Environment Variables) and in .env.local for local dev.
 */
export const GOOGLE_CLIENT_ID = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '').trim();

/** The deployed site, e.g. https://chelav.vercel.app. Must be listed under "Authorized JavaScript origins" in Google Cloud. */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '');

/** The Google button is only shown when a client ID is configured, so the app still works without it. */
export const googleEnabled = (): boolean => GOOGLE_CLIENT_ID.length > 0;

export const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
