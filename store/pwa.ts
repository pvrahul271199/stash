import { create } from 'zustand';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
  installEvent: BeforeInstallPromptEvent | null;
  /** A new service worker is installed and waiting. */
  waiting: ServiceWorker | null;
  set: (p: Partial<PWAState>) => void;
}

export const usePWA = create<PWAState>((set) => ({
  installEvent: null,
  waiting: null,
  set: (p) => set(p),
}));
