/** Placeholder for later cloud sync / accounts. Version 1 ships the no-op. */
export interface SyncService {
  push(): Promise<void>;
  pull(): Promise<void>;
  isEnabled(): boolean;
}

export const noopSync: SyncService = {
  async push() {},
  async pull() {},
  isEnabled: () => false,
};
