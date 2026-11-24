/**
 * Share a group's status (Splits only). Pure: picks the facts for ONE payment (the person who owes -> who is owed) and
 * turns them, together with the user's "show / hide" options, into the lines the card and the plain-text message use.
 * Never includes item notes, categories or the invite code: only names, amounts and totals the group already sees.
 */
import { roundMoney } from './money';
import { groupTotals, type Debt, type GroupItem, type GroupMember, type Settlement } from './split';

export interface ShareOpts {
  /** the amount owed (off = a gentle reminder with no number) */
  amount: boolean;
  groupName: boolean;
  /** what the debtor paid vs their share */
  breakdown: boolean;
  /** what the debtor has already paid back in this group */
  paidBack: boolean;
  /** short free-text line from the sender, '' = none */
  note: string;
}

export const DEFAULT_SHARE_OPTS: ShareOpts = { amount: true, groupName: true, breakdown: false, paidBack: false, note: '' };
export const NOTE_MAX = 60;

/** Merge saved options over the defaults, ignoring anything of the wrong type (storage can hold anything). */
export function readShareOpts(raw: unknown): ShareOpts {
  const o = { ...DEFAULT_SHARE_OPTS };
  if (!raw || typeof raw !== 'object') return o;
  const r = raw as Record<string, unknown>;
  for (const k of ['amount', 'groupName', 'breakdown', 'paidBack'] as const) if (typeof r[k] === 'boolean') o[k] = r[k];
  if (typeof r.note === 'string') o.note = r.note.slice(0, NOTE_MAX);
  return o;
}

export interface ShareFacts {
  from: string; to: string;
  fromName: string; toName: string;
  amount: number;
  paid: number; share: number;
  paidBack: number;
}

const name = (members: GroupMember[], id: string) => members.find((m) => m.id === id)?.name ?? 'Former member';

export function shareFacts(members: GroupMember[], items: GroupItem[], settlements: Settlement[], d: Debt): ShareFacts {
  const t = groupTotals(items, members.map((m) => m.id));
  const mine = t.byMember[d.from] ?? { paid: 0, share: 0, net: 0 };
  const paidBack = roundMoney(settlements.filter((s) => s.from === d.from).reduce((a, s) => a + s.amount, 0));
  return { from: d.from, to: d.to, fromName: name(members, d.from), toName: name(members, d.to), amount: d.amount, paid: mine.paid, share: mine.share, paidBack };
}

export interface ShareLines {
  headline: string;
  amount: string | null;
  to: string;
  details: { label: string; value: string }[];
  note: string;
}

/** What the card shows, after the user's options. `money` formats in the group's currency. */
export function shareLines(f: ShareFacts, groupName: string, o: ShareOpts, money: (n: number) => string): ShareLines {
  const details: { label: string; value: string }[] = [];
  if (o.breakdown) { details.push({ label: `${f.fromName} paid`, value: money(f.paid) }); details.push({ label: 'Their share', value: money(f.share) }); }
  if (o.paidBack && f.paidBack > 0) details.push({ label: 'Already paid back', value: money(f.paidBack) });
  return {
    headline: `${f.fromName}, a small reminder`,
    amount: o.amount ? money(f.amount) : null,
    to: `to ${f.toName}${o.groupName ? ` for ${groupName}` : ''}`,
    details,
    note: o.note.trim().slice(0, NOTE_MAX),
  };
}

/** The same message as plain text, sent with (or instead of) the picture. */
export function shareText(f: ShareFacts, groupName: string, o: ShareOpts, money: (n: number) => string): string {
  const l = shareLines(f, groupName, o, money);
  const what = l.amount ? `${l.amount} ` : '';
  const head = `${f.fromName}, a small reminder: ${what}${l.to}.`;
  return [head, l.note, ...l.details.map((d) => `${d.label}: ${d.value}`)].filter(Boolean).join('\n');
}

/** Message for a group with nothing left to pay. */
export const settledText = (groupName: string, showName: boolean) => `${showName ? groupName : 'The group'} is all settled up 🎉`;
