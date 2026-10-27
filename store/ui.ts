import { create } from 'zustand';

export type Sheet = 'none' | 'log' | 'categoryPicker' | 'bigSpend' | 'closeDay' | 'dayClosed' | 'welcomeBack' | 'plan';

/** UI state only. Money data is always read from Dexie. */
interface UIState {
  sheet: Sheet;
  focusCategory: string | null;
  chartSelection: number | null;
  setSheet: (s: Sheet) => void;
  /** Tapping the same category again clears it. */
  toggleFocusCategory: (name: string) => void;
  setChartSelection: (day: number | null) => void;
}

export const useUI = create<UIState>((set) => ({
  sheet: 'none',
  focusCategory: null,
  chartSelection: null,
  setSheet: (sheet) => set({ sheet }),
  toggleFocusCategory: (name) => set((st) => ({ focusCategory: st.focusCategory === name ? null : name })),
  setChartSelection: (chartSelection) => set({ chartSelection }),
}));
