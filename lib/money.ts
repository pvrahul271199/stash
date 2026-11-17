/**
 * Money helpers. Amounts are plain JS numbers with at most 2 decimals (whole units still work).
 * Round at every boundary (write, sum, divide) so float drift (0.1 + 0.2) never reaches storage or the screen.
 */

function roundTo(n: number, places: number): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** places;
  // toPrecision(15) strips binary noise first: 1.005 * 100 = 100.49999999999999 -> 100.5 -> 101.
  const r = Math.round(Number((Math.abs(n) * f).toPrecision(15))) / f;
  return n < 0 && r !== 0 ? -r : r;
}

/** Stored / logged precision: 2 decimal places. */
export const roundMoney = (n: number): number => roundTo(n, 2);

/** Display precision for calendar cells and Insights: 1 decimal place. */
export const roundMoney1 = (n: number): number => roundTo(n, 1);

/** Sum a list of amounts without drift. */
export const sumMoney = (xs: Iterable<number>): number => {
  let t = 0;
  for (const x of xs) t += x;
  return roundMoney(t);
};

/** Locale-formatted number: whole when whole, otherwise exactly `places` decimals (4.5 -> "4.50"). */
export function formatNumber(n: number, locale: string, places: 1 | 2 = 2): string {
  const r = roundTo(n, places);
  const whole = Number.isInteger(r);
  return Math.abs(r).toLocaleString(locale, {
    minimumFractionDigits: whole ? 0 : places,
    maximumFractionDigits: whole ? 0 : places,
  });
}

/** Clean a typed amount string: digits and one ".", at most `maxInt` whole digits and 2 decimals ("0,5" typed as "0.5"). */
export function cleanAmountInput(v: string, maxInt = 7): string {
  const t = v.replace(',', '.').replace(/[^\d.]/g, '');
  const dot = t.indexOf('.');
  if (dot < 0) return t.replace(/^0+(?=\d)/, '').slice(0, maxInt);
  const int = t.slice(0, dot).replace(/^0+(?=\d)/, '').slice(0, maxInt) || '0';
  return `${int}.${t.slice(dot + 1).replace(/\./g, '').slice(0, 2)}`;
}
