import { create } from 'zustand';

/** 'plan' = settings sheet, 'dayClosed' = the day-closed screen is showing. */
export type Sheet = 'none' | 'plan' | 'dayClosed';

/** UI state only. Money data is always read from Dexie. */
interface UIState {
  sheet: Sheet;
  focusCategory: string | null;
  chartSelection: number | null;
  /** A one-shot request for AppShell to switch tab (set by flows that end on another screen); AppShell clears it. */
  tabRequest: 'insights' | null;
  /** The Insights section to open on (read once by InsightsTab, then cleared). */
  insightsSec: string | null;
  /** A new occasion lands the user on Insights > Events. */
  goToInsightsEvents: () => void;
  clearTabRequest: () => void;
  clearInsightsSec: () => void;
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
  tabRequest: null,
  insightsSec: null,
  goToInsightsEvents: () => set({ tabRequest: 'insights', insightsSec: 'Events' }),
  clearTabRequest: () => set({ tabRequest: null }),
  clearInsightsSec: () => set({ insightsSec: null }),
  setSheet: (sheet) => set({ sheet }),
  setFocusCategory: (focusCategory) => set({ focusCategory, chartSelection: null }),
  toggleFocusCategory: (name) =>
    set((st) => ({ focusCategory: st.focusCategory === name ? null : name, chartSelection: null })),
  setChartSelection: (chartSelection) => set({ chartSelection }),
}));
