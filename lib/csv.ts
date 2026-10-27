export interface CsvRow {
  date: string;
  day: number;
  amount: number;
  label: string;
  category: string;
  type: string;
  fromSavings: boolean;
  estimate: boolean;
  payment?: string;
  event?: string;
  note?: string;
}

function cell(v: string | number | boolean): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCSV(rows: CsvRow[]): string {
  const head = ['Date', 'Day', 'Amount (INR)', 'Label', 'Category', 'Type', 'From savings', 'Estimate', 'Payment', 'Event', 'Note'];
  const lines = rows.map((r) =>
    [r.date, r.day, r.amount, r.label, r.category, r.type, r.fromSavings ? 'yes' : 'no', r.estimate ? 'yes' : 'no', r.payment ?? '', r.event ?? '', r.note ?? '']
      .map(cell)
      .join(','),
  );
  return [head.join(','), ...lines].join('\n') + '\n';
}
