/** How a spend is worded in every list: category first, then type and note, then the amount (shown by the caller). */
export interface DisplayableEntry {
  label: string;
  category: string;
  subcategory?: string | null;
  note?: string | null;
  payment?: string | null;
  event?: string | null;
}

export function entryLines(e: DisplayableEntry): { title: string; detail: string; meta: string } {
  const type = e.subcategory?.trim() || '';
  const label = e.label?.trim() || '';
  // `label` defaults to the type or category; only show it when someone typed something different.
  const custom = label && label !== type && label !== e.category ? label : '';
  const detail = [type, custom, e.note?.trim()].filter(Boolean).join(' · ');
  const meta = [e.payment, e.event].filter(Boolean).join(' · ');
  return { title: e.category, detail, meta };
}
