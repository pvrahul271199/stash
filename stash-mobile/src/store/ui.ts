import { create } from 'zustand';

export type Sheet = 'none' | 'plan' | 'dayClosed';

interface UIState {
  sheet: Sheet;
  focusCategory: string | null;
  chartSelection: number | null;
  setSheet: (s: Sheet) => void;
  setFocusCategory: (name: string | null) => void;
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
