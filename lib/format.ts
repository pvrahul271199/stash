import { formatWithCurrency, useCurrencyStore } from './currency';

/** Formats currency according to active setting (defaults to INR ₹). */
export function inr(n: number): string {
  return formatWithCurrency(n, useCurrencyStore.getState().currency);
}

/** Number only, formatted according to active currency locale. */
export function num(n: number): string {
  const info = useCurrencyStore.getState().currency;
  return Math.round(n).toLocaleString(info.locale);
}
