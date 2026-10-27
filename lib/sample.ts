import { weekdayOfDay } from './dates';

export interface SampleSpend {
  day: number;
  amount: number;
  label: string;
  category: string;
  subcategory: string | null;
  hour: number;
  fromSavings: boolean;
}

export const DEFAULT_SAMPLE_PLAN = { income: 50000, bills: 18000, savings: 10000, monthLength: 30 };
export const SAMPLE_DAYS = 18;

/** Small seeded PRNG so the sample month is identical every time. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSampleSpends(startDate: string, days = SAMPLE_DAYS, seed = 20261027): SampleSpend[] {
  const rnd = mulberry32(seed);
  const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const round10 = (n: number) => Math.round(n / 10) * 10;
  const out: SampleSpend[] = [];
  const add = (
    day: number,
    amount: number,
    label: string,
    category: string,
    subcategory: string | null,
    hour: number,
    fromSavings = false,
  ) => out.push({ day, amount, label, category, subcategory, hour, fromSavings });

  for (let day = 1; day <= days; day++) {
    const wd = weekdayOfDay(startDate, day);
    const weekend = wd === 0 || wd === 6;

    // 1-2 chai daily
    add(day, 20, 'Chai', 'Food', 'Chai & snacks', 8);
    if (rnd() < 0.6) add(day, 20, 'Chai', 'Food', 'Chai & snacks', 17);

    if (!weekend) {
      add(day, round10(between(60, 120)), 'Auto', 'Travel', 'Auto', 9);
      if (rnd() < 0.7) add(day, round10(between(150, 240)), 'Lunch', 'Food', 'Lunch', 13);
      else add(day, 40, 'Metro', 'Travel', 'Metro', 18);
    } else if (rnd() < 0.8) {
      if (rnd() < 0.5) add(day, round10(between(350, 700)), 'Movie', 'Fun', 'Movies', 19);
      else add(day, round10(between(350, 700)), 'Outing', 'Fun', 'Outings', 16);
    }

    if (rnd() < 0.3) add(day, round10(between(280, 450)), 'Delivery', 'Food', 'Delivery', 21);
    if (day % 4 === 0) add(day, round10(between(600, 1300)), 'Groceries', 'Home', 'Groceries', 18);

    if (day === 3) add(day, 299, 'Recharge', 'Bills', 'Recharge', 10);
    if (day === 9) add(day, 360, 'Medicine', 'Health', 'Medicine', 20);
    if (day === 12) add(day, 2400, 'Clothes', 'Shopping', 'Clothes', 15, true);
    if (day === 15) add(day, round10(between(180, 350)), 'Cab', 'Travel', 'Cab', 22);
  }
  return out;
}
