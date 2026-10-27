import { create } from 'zustand';

interface ToastState {
  message: string | null;
  tone: 'ink' | 'warm';
  show: (message: string, tone?: 'ink' | 'warm') => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: 'ink',
  show: (message, tone = 'ink') => {
    clearTimeout(timer);
    set({ message, tone });
    timer = setTimeout(() => set({ message: null }), 1500);
  },
  hide: () => set({ message: null }),
}));
