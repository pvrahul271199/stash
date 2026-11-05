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
    // long messages stay long enough to read
    timer = setTimeout(() => set({ message: null }), Math.max(1400, message.length * 55));
  },
  hide: () => set({ message: null }),
}));
