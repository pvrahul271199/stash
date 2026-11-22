'use client';
import { avatarHue } from '@/lib/split';

/** A receipt split three ways: drawn, not photographed, in the app's own colours. */
function Illustration() {
  const people: [number, string][] = [[52, 'R'], [130, 'M'], [208, 'A']];
  return (
    <svg viewBox="0 0 260 168" role="img" aria-label="A bill split between three people" className="w-[236px]">
      <defs>
        <linearGradient id="eg-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EFEAFB" />
          <stop offset="1" stopColor="#FBF1E6" />
        </linearGradient>
      </defs>
      <ellipse cx="130" cy="84" rx="124" ry="80" fill="url(#eg-bg)" />
      {/* the bill */}
      <g>
        <rect x="95" y="14" width="70" height="62" rx="10" fill="#fff" stroke="#E7E5E1" />
        <rect x="107" y="27" width="30" height="5" rx="2.5" fill="#1E1B4B" />
        <rect x="107" y="39" width="46" height="4" rx="2" fill="#E7E5E1" />
        <rect x="107" y="49" width="38" height="4" rx="2" fill="#E7E5E1" />
        <rect x="107" y="61" width="22" height="5" rx="2.5" fill="#1E1B4B" />
      </g>
      {/* shares running to each person */}
      {people.map(([x]) => (
        <path key={x} d={`M130 76 C130 100 ${x} 96 ${x} 120`} fill="none" stroke="#1E1B4B" strokeOpacity="0.35" strokeWidth="1.4" strokeDasharray="3 3" />
      ))}
      {people.map(([x, l], i) => (
        <g key={l}>
          <circle cx={x} cy="134" r="18" fill={avatarHue(i + 1)} stroke="#fff" strokeWidth="3" />
          <text x={x} y="139" textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff">{l}</text>
        </g>
      ))}
    </svg>
  );
}

const STEPS = [
  ['Create a group', 'Name it after the trip, the flat or the dinner.'],
  ['Invite with a link', 'Share the link or QR. Anyone who opens it joins.'],
  ['Add what each person paid', 'Chelav works out who owes whom, in the fewest payments.'],
];

/** The Splits tab before any group exists. The "New group" button stays at the bottom of the tab. */
export function EmptyGroups() {
  return (
    <div className="mt-2 flex flex-col items-center text-center">
      <Illustration />
      <h2 className="font-display mt-3 text-[24px] font-semibold leading-tight text-ink">Split costs with your people</h2>
      <p className="mt-2 max-w-[290px] text-[14px] leading-relaxed text-soft">Make a group for a trip, a flat or a dinner. Everyone{'’'}s share is worked out for you.</p>
      <ol className="mt-6 w-full space-y-4 text-left">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="flex items-start gap-3">
            <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink text-[12px] font-semibold text-ink">{i + 1}</span>
            <span><span className="block text-[14px] font-semibold text-ink">{t}</span><span className="block text-[12px] leading-snug text-soft">{d}</span></span>
          </li>))}
      </ol>
      <p className="mt-6 text-[12px] text-faint">Got an invite link? Just open it and you land in the group. Your own budget is never shared.</p>
    </div>
  );
}
