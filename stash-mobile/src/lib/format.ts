/** Indian grouping, no paise: 125000 -> "₹1,25,000". */
export function inr(n: number): string {
  const r = Math.round(n);
  const sign = r < 0 ? '-' : '';
  return `${sign}₹${Math.abs(r).toLocaleString('en-IN')}`;
}

/** Number only, Indian grouping. */
export function num(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}
