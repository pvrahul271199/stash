import { create } from 'zustand';

/** 'plan' = settings sheet, 'dayClosed' = the day-closed screen is showing. */
export type Sheet = 'none' | 'plan' | 'dayClosed';

/** UI state only. Money data is always read from Dexie. */
interface UIState {
  sheet: Sheet;
  focusCategory: string | null;
  chartSelection: number | null;
  setSheet: (s: Sheet) => void;
  setFocusCategory: (name: string | null) => void;
  /** Tapping the same category again clears it. */
  toggleFocusCategory: (name: string) => void;
  setChartSelection: (day: number | null) => void;
}

export const useUI = create<UIState>((set) => ({
  sheet: 'none',
  focusCategory: null,
  chartSelection: null,
  setSheet: (sheet) => set({ sheet }),
  setFocusCategory: (focusCategory) => set({ focusCategory, chartSelection: null }),
  toggleFocusCategory: (name) =>
    set((st) => ({ focusCategory: st.focusCategory === name ? null : name, chartSelection: null })),
  setChartSelection: (chartSelection) => set({ chartSelection }),
}));
