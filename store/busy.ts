import { create } from 'zustand';

/** UI state only: a full-screen loader for slow transitions (switching user, wiping data, loading a sample). */
interface BusyState {
  message: string | null;
  set: (message: string | null) => void;
}

export const useBusy = create<BusyState>((set) => ({ message: null, set: (message) => set({ message }) }));

/** Shows the loader while `fn` runs; always hides it afterwards, even if `fn` throws. */
export async function withLoading<T>(message: string, fn: () => Promise<T>): Promise<T> {
  useBusy.getState().set(message);
  try {
    return await fn();
  } finally {
    useBusy.getState().set(null);
  }
}
