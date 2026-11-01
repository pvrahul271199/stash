import { decodeBase64Username, encodeUsernameToBase64 } from './user';
import { supabaseEnv } from './supabaseClient';

export { decodeBase64Username, encodeUsernameToBase64 };

export interface SyncService {
  push(): Promise<void>;
  pull(): Promise<boolean>;
  isEnabled(): boolean;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  return supabaseEnv();
}

export function getLastSyncedAt(): number | null {
  return null;
}

/** Interim (replaced by the sync engine): the only call queries make after a write. */
export function requestSync(): void {}

export const supabaseSync: SyncService = {
  isEnabled: () => false,
  async push() {},
  async pull() {
    return false;
  },
};
