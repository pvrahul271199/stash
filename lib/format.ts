import { formatWithCurrency, useCurrencyStore } from './currency';
import { formatNumber } from './money';

/** Formats currency according to active setting (defaults to INR ₹). 2 decimals when not whole (logs, allowance). */
export function inr(n: number): string {
  return formatWithCurrency(n, useCurrencyStore.getState().currency, 2);
}

/** Same, rounded to 1 decimal: Insights and calendar. */
export function inr1(n: number): string {
  return formatWithCurrency(n, useCurrencyStore.getState().currency, 1);
}

/** Number only, formatted according to active currency locale (2 decimals when not whole). */
export function num(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + formatNumber(n, useCurrencyStore.getState().currency.locale, 2);
}

/** Number only, 1 decimal. */
export function num1(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + formatNumber(n, useCurrencyStore.getState().currency.locale, 1);
}
