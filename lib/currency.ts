'use client';
import { create } from 'zustand';

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  shortName: string;
  locale: string;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', shortName: 'Rupee', locale: 'en-IN' },
  { code: 'USD', symbol: '$', name: 'US Dollar', shortName: 'Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', shortName: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', shortName: 'Pound', locale: 'en-GB' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', shortName: 'Dirham', locale: 'en-AE' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', shortName: 'Dollar', locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', shortName: 'Dollar', locale: 'en-AU' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', shortName: 'Dollar', locale: 'en-SG' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', shortName: 'Yen', locale: 'ja-JP' },
];

export const CURRENCY_STORAGE_KEY = 'stash:currency-code';
export const DEFAULT_CURRENCY = 'INR';

export function getStoredCurrencyCode(): string {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY;
  try {
    return window.localStorage?.getItem(CURRENCY_STORAGE_KEY)?.trim() || DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export function getStoredCurrencyInfo(): CurrencyInfo {
  const code = getStoredCurrencyCode();
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code.toUpperCase() === code.toUpperCase()) ??
    SUPPORTED_CURRENCIES[0]
  );
}

interface CurrencyStore {
  currency: CurrencyInfo;
  setCurrency: (code: string) => CurrencyInfo;
}

/**
 * Single source of truth for the application's active currency.
 * Powered by Zustand: updating this store instantly re-renders any component
 * across the entire app that subscribes to it.
 */
export const useCurrencyStore = create<CurrencyStore>((set) => ({
  currency: getStoredCurrencyInfo(),
  setCurrency: (code: string) => {
    const info =
      SUPPORTED_CURRENCIES.find((c) => c.code.toUpperCase() === code.toUpperCase()) ??
      SUPPORTED_CURRENCIES[0];
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(CURRENCY_STORAGE_KEY, info.code);
        window.dispatchEvent(new CustomEvent('stash:currency-change', { detail: info }));
      } catch {
        /* ignore storage access restrictions */
      }
    }
    set({ currency: info });
    return info;
  },
}));

// Listen to multi-tab storage events or external changes
if (typeof window !== 'undefined') {
  const syncFromStorage = () => {
    const fresh = getStoredCurrencyInfo();
    if (useCurrencyStore.getState().currency.code !== fresh.code) {
      useCurrencyStore.setState({ currency: fresh });
    }
  };
  window.addEventListener('storage', syncFromStorage);
  window.addEventListener('stash:currency-change', (e: Event) => {
    const detail = (e as CustomEvent<CurrencyInfo>).detail;
    if (detail && useCurrencyStore.getState().currency.code !== detail.code) {
      useCurrencyStore.setState({ currency: detail });
    }
  });
}

export function setStoredCurrency(code: string): CurrencyInfo {
  return useCurrencyStore.getState().setCurrency(code);
}

export function formatWithCurrency(
  amount: number,
  currency: CurrencyInfo = useCurrencyStore.getState().currency,
): string {
  const r = Math.round(amount);
  const sign = r < 0 ? '-' : '';
  const formatted = Math.abs(r).toLocaleString(currency.locale);
  const space = currency.symbol.length > 1 ? ' ' : '';
  return `${sign}${currency.symbol}${space}${formatted}`;
}

/**
 * Primary React hook for consuming and updating the single source of truth currency.
 * Any component using this hook will re-render automatically when currency changes.
 */
export function useCurrency(): {
  currency: CurrencyInfo;
  setCurrency: (code: string) => void;
  currencies: CurrencyInfo[];
  format: (amount: number) => string;
} {
  const currency = useCurrencyStore((s) => s.currency);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);

  return {
    currency,
    setCurrency,
    currencies: SUPPORTED_CURRENCIES,
    format: (amount: number) => formatWithCurrency(amount, currency),
  };
}
