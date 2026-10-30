import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SUPPORTED_CURRENCIES,
  formatWithCurrency,
  getStoredCurrencyCode,
  getStoredCurrencyInfo,
  setStoredCurrency,
  useCurrencyStore,
} from '@/lib/currency';
import { inr, num } from '@/lib/format';
import { compactINR } from '@/lib/history';

describe('Multi-currency engine', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
      },
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    setStoredCurrency('INR');
  });

  it('supports major world currencies with correct symbols', () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
    expect(codes).toContain('INR');
    expect(codes).toContain('USD');
    expect(codes).toContain('EUR');
    expect(codes).toContain('GBP');
    expect(codes).toContain('AED');
  });

  it('defaults to INR when no currency is stored', () => {
    expect(getStoredCurrencyCode()).toBe('INR');
    const info = getStoredCurrencyInfo();
    expect(info.code).toBe('INR');
    expect(info.symbol).toBe('₹');
  });

  it('persists selected currency in localStorage and dispatches change event', () => {
    const updated = setStoredCurrency('USD');
    expect(updated.code).toBe('USD');
    expect(updated.symbol).toBe('$');
    expect(getStoredCurrencyCode()).toBe('USD');
    expect(window.dispatchEvent).toHaveBeenCalled();
  });

  it('formats amounts according to active currency locale', () => {
    const inrInfo = SUPPORTED_CURRENCIES.find((c) => c.code === 'INR')!;
    const usdInfo = SUPPORTED_CURRENCIES.find((c) => c.code === 'USD')!;
    const aedInfo = SUPPORTED_CURRENCIES.find((c) => c.code === 'AED')!;

    expect(formatWithCurrency(1500, inrInfo)).toBe('₹1,500');
    expect(formatWithCurrency(1500, usdInfo)).toBe('$1,500');
    // Multi-letter symbols get a clean space separator
    expect(formatWithCurrency(1500, aedInfo)).toBe('AED 1,500');
  });

  it('handles negative amounts cleanly', () => {
    const inrInfo = SUPPORTED_CURRENCIES.find((c) => c.code === 'INR')!;
    const usdInfo = SUPPORTED_CURRENCIES.find((c) => c.code === 'USD')!;

    expect(formatWithCurrency(-450, inrInfo)).toBe('-₹450');
    expect(formatWithCurrency(-450, usdInfo)).toBe('-$450');
  });

  it('inr() helper reflects the active stored currency and single source of truth', () => {
    setStoredCurrency('INR');
    expect(inr(2500)).toBe('₹2,500');

    setStoredCurrency('EUR');
    expect(inr(2500)).toContain('€');
    expect(useCurrencyStore.getState().currency.code).toBe('EUR');

    setStoredCurrency('USD');
    expect(inr(2500)).toBe('$2,500');
    expect(num(2500)).toBe('2,500');
  });

  it('compactINR() uses Lakhs for INR and Millions for other currencies', () => {
    setStoredCurrency('INR');
    expect(compactINR(150000)).toBe('₹1.5L');
    expect(compactINR(3000)).toBe('₹3k');

    setStoredCurrency('USD');
    expect(compactINR(1500000)).toBe('$1.5M');
    expect(compactINR(3000)).toBe('$3k');
  });
});
