import { getAccessToken } from './auth';
import { supabaseEnv } from './supabaseClient';

/** Shown in the feedback table so reports can be matched to a release. Bump on each release. */
export const APP_VERSION = 'v9';

export type FeedbackKind = 'feedback' | 'bug';

/** Stores one feedback / bug report in `public.feedback` through the `submit_feedback` RPC (guests allowed). Returns true on success. */
export async function submitFeedback(kind: FeedbackKind, message: string, contact?: string): Promise<boolean> {
  const env = supabaseEnv();
  if (!env) return false;
  const token = (await getAccessToken()) ?? env.anonKey;
  try {
    const res = await fetch(`${env.url}/rest/v1/rpc/submit_feedback`, {
      method: 'POST',
      headers: { apikey: env.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_kind: kind,
        p_message: message.trim().slice(0, 1000),
        p_contact: contact?.trim() || null,
        p_user_agent: navigator.userAgent.slice(0, 300),
        p_app_version: process.env.NEXT_PUBLIC_APP_VERSION || APP_VERSION,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
