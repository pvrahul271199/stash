import { useEffect, useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { avatarHue } from '@/lib/split';
import { Btn, C, Eyebrow, Phone, Toast, useToast } from './kit';

/**
 * Two proposals for the Splits tab, five designs in all. Nothing here is wired into the app yet.
 * 1. Loader: the people-gathering loader from 9. C, with initials on the avatars (the change already applied to
 *    components/splits/SplitsLoading.tsx). A and B show it as-is; C and D show two variants with a caption.
 * 2. Couples: Splits is for two people as much as for a group (a flat, a trip, a dinner). The copy and the first
 *    screen should say so. A to D are four ways to do that, from copy only to a first-class preset.
 */
const meta: Meta = { title: 'Splits / 16. Loader letters and couples', parameters: { layout: 'centered' } };
export default meta;

const LETTERS = ['R', 'M', 'A', 'S', 'P'];
const hueAt = (i: number) => avatarHue(i);

/* ---------- 1. Loader ---------- */

function useCycle() {
  const [st, setSt] = useState<'loading' | 'error'>('loading');
  useEffect(() => { if (st !== 'loading') return; const h = setTimeout(() => setSt('error'), 2600); return () => clearTimeout(h); }, [st]);
  return { loading: st === 'loading', retry: () => setSt('loading') };
}

/** The five-seat orbit, avatars carry initials. `size` scales the whole mark; `captions` adds a name under each avatar. */
function Gather({ loading, size = 40, captions = false }: { loading: boolean; size?: number; captions?: boolean }) {
  const r = loading ? 62 : 92;
  return (
    <div className="relative h-[200px] w-[200px]">
      <style>{`
        @keyframes lGather { to { transform: rotate(360deg); } }
        @keyframes lUpright { to { transform: rotate(-360deg); } }
        @keyframes lCore { 0%, 100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.35; } 50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.9; } }
      `}</style>
      <span aria-hidden="true" className="absolute left-[38px] top-[38px] h-[124px] w-[124px] rounded-full border border-dashed border-line transition-opacity duration-700" style={{ opacity: loading ? 1 : 0 }} />
      <div className="absolute inset-0" style={{ animation: loading ? 'lGather 9s linear infinite' : 'none' }}>
        {LETTERS.map((l, i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / LETTERS.length;
          return (
            <span key={l} className={`absolute transition-all duration-700 ease-out ${loading ? '' : 'opacity-40 grayscale'}`}
              style={{ left: 100 + r * Math.cos(a) - size / 2, top: 100 + r * Math.sin(a) - size / 2 }}>
              <span className="block" style={{ animation: loading ? 'lUpright 9s linear infinite' : 'none' }}>
                <span className="flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white"
                  style={{ width: size, height: size, background: hueAt(i), fontSize: size * 0.38 }}>{l}</span>
                {captions && <span className="num mt-1 block w-[60px] -translate-x-[10px] text-center text-[10px] text-faint">{['You', 'Mira', 'Arun', 'Sam', 'Pari'][i]}</span>}
              </span>
            </span>
          );
        })}
      </div>
      <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-5 w-5 rounded-full bg-ink"
        style={{ animation: loading ? 'lCore 2.4s ease-in-out infinite' : 'none', opacity: loading ? undefined : 0, transition: 'opacity 700ms' }} />
    </div>
  );
}

const Title = () => <header className="px-5 pb-2 pt-6"><h1 className="font-display text-[26px] font-semibold text-ink">Splits</h1></header>;
const Err = ({ retry }: { retry: () => void }) => (
  <div className="text-center" role="alert">
    <p className="text-[15px] font-medium text-ink">Could not reach your groups</p>
    <button onClick={retry} className="mt-3 min-h-[44px] text-[13px] font-semibold text-ink underline underline-offset-4">Try again</button>
  </div>
);

/* A. As built: initials on the orbit, same message as today. */
export const A_LettersAsBuilt = () => {
  const x = useCycle();
  return (
    <Phone>
      <Title />
      <div className="flex flex-1 flex-col items-center justify-center" role="status" aria-busy={x.loading}>
        <Gather loading={x.loading} />
        {x.loading ? <p className="mt-8 text-[14px] text-soft">Getting everyone together…</p> : <div className="mt-6"><Err retry={x.retry} /></div>}
      </div>
    </Phone>
  );
};

/* B. Initials plus a first-name caption, so the loader shows who is coming (useful for a couple: "You" and their partner). */
export const B_LettersWithNames = () => {
  const x = useCycle();
  return (
    <Phone>
      <Title />
      <div className="flex flex-1 flex-col items-center justify-center">
        <Gather loading={x.loading} captions />
        {x.loading ? <p className="mt-8 text-[14px] text-soft">Getting everyone together…</p> : <div className="mt-6"><Err retry={x.retry} /></div>}
      </div>
    </Phone>
  );
};

/* C. Two people only, for a couple: the same loader with two seats and the message "Getting you two together…". */
export const C_CoupleLoader = () => {
  const x = useCycle();
  const seats = [{ l: 'R', name: 'You' }, { l: 'P', name: 'Partner' }];
  return (
    <Phone>
      <Title />
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative h-[200px] w-[200px]">
          <style>{`@keyframes cGather { to { transform: rotate(360deg); } } @keyframes cUpright { to { transform: rotate(-360deg); } }`}</style>
          <div className="absolute inset-0" style={{ animation: x.loading ? 'cGather 6s linear infinite' : 'none' }}>
            {seats.map((s, i) => {
              const a = -Math.PI / 2 + i * Math.PI, r = x.loading ? 52 : 92;
              return (
                <span key={s.l} className="absolute transition-all duration-700 ease-out" style={{ left: 100 + r * Math.cos(a) - 24, top: 100 + r * Math.sin(a) - 24 }}>
                  <span className="block" style={{ animation: x.loading ? 'cUpright 6s linear infinite' : 'none' }}>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full text-[17px] font-semibold text-white ring-2 ring-white" style={{ background: hueAt(i) }}>{s.l}</span>
                  </span>
                </span>
              );
            })}
          </div>
          <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-4 w-4 rounded-full bg-ink" style={{ transform: 'translate(-50%, -50%)', opacity: x.loading ? 0.8 : 0 }} />
        </div>
        {x.loading
          ? <p className="mt-8 text-[14px] text-soft">Getting you two together…</p>
          : <div className="mt-6"><Err retry={x.retry} /></div>}
      </div>
    </Phone>
  );
};

/* ---------- 2. Couples ---------- */

const Bill = () => (
  <svg viewBox="0 0 260 168" role="img" aria-label="A bill split between two people" className="w-[236px]">
    <ellipse cx="130" cy="84" rx="124" ry="80" fill="#EFEAFB" />
    <rect x="95" y="14" width="70" height="62" rx="10" fill="#fff" stroke={C.line} />
    <rect x="107" y="27" width="30" height="5" rx="2.5" fill={C.ink} />
    <rect x="107" y="39" width="46" height="4" rx="2" fill={C.line} />
    <rect x="107" y="49" width="38" height="4" rx="2" fill={C.line} />
    <rect x="107" y="61" width="22" height="5" rx="2.5" fill={C.ink} />
    {[92, 168].map((x) => <path key={x} d={`M130 76 C130 100 ${x} 96 ${x} 120`} fill="none" stroke={C.ink} strokeOpacity="0.35" strokeWidth="1.4" strokeDasharray="3 3" />)}
    {[[92, 'R', 0], [168, 'P', 1]].map(([x, l, i]) => (
      <g key={l as string}>
        <circle cx={x as number} cy="134" r="20" fill={hueAt(i as number)} stroke="#fff" strokeWidth="3" />
        <text x={x as number} y="139" textAnchor="middle" fontSize="14" fontWeight="600" fill="#fff">{l as string}</text>
      </g>
    ))}
  </svg>
);

const Steps = ({ items }: { items: [string, string][] }) => (
  <ol className="mt-6 w-full space-y-4 text-left">
    {items.map(([t, d], i) => (
      <li key={t} className="flex items-start gap-3">
        <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink text-[12px] font-semibold text-ink">{i + 1}</span>
        <span><span className="block text-[14px] font-semibold text-ink">{t}</span><span className="block text-[12px] leading-snug text-soft">{d}</span></span>
      </li>
    ))}
  </ol>
);

/* A. Copy only: the empty state names a couple first. No new art, no new screens. */
export const A_CouplesCopy = () => (
  <Phone>
    <Title />
    <div className="flex flex-1 flex-col items-center px-6 pt-4 text-center">
      <Bill />
      <h2 className="font-display mt-3 text-[24px] font-semibold leading-tight text-ink">Split costs as a couple or with friends</h2>
      <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-soft">Rent, groceries, a trip or dinner out. Everyone’s share is worked out, so nobody keeps score.</p>
      <Steps items={[['Start a group for two', 'Just you and your partner, or the flat.'], ['Share the link', 'Your partner opens it and is in.'], ['Add what each of you paid', 'Chelav works out who owes whom.']]} />
    </div>
    <div className="px-5 pb-5"><Btn>New group</Btn><p className="mt-2 text-center text-[11px] text-faint">Your own budget is never shared.</p></div>
  </Phone>
);

/* B. Couple-first art: the illustration shows two people and a 50/50 split, with the couple example as the first step. */
export const B_CoupleArt = () => (
  <Phone>
    <Title />
    <div className="flex flex-1 flex-col items-center px-6 pt-2 text-center">
      <div className="mt-2 flex w-full items-center justify-around rounded-[22px] border border-line bg-white px-4 py-4">
        {[['R', 'You', 0], ['P', 'Partner', 1]].map(([l, n, i]) => (
          <div key={l as string} className="flex flex-col items-center gap-1">
            <span className="flex h-14 w-14 items-center justify-center rounded-full text-[20px] font-semibold text-white" style={{ background: hueAt(i as number) }}>{l as string}</span>
            <span className="text-[12px] text-soft">{n as string}</span>
          </div>
        ))}
        <div className="flex flex-col items-center">
          <span className="num text-[22px] font-semibold text-ink">₹1,200</span>
          <span className="text-[11px] text-faint">split 50 / 50</span>
        </div>
      </div>
      <h2 className="font-display mt-6 text-[24px] font-semibold leading-tight text-ink">Split it with your partner</h2>
      <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-soft">Rent, groceries, a trip, a dinner. Two of you or a whole flat, it works the same.</p>
      <Steps items={[['Make a group for you two', 'Add what you pay, as you pay it.'], ['Send your partner the link', 'One tap and they are in.'], ['See who owes whom', 'Settle in one payment, not ten.']]} />
    </div>
    <div className="px-5 pb-5"><Btn>New group</Btn></div>
  </Phone>
);

/* C. New group sheet with presets: "Couple" is one of four, so it is a first-class choice, not a hint in the copy. */
const PRESETS = [
  { k: 'Couple', hint: 'Two of you, 50 / 50 by default', name: 'Us' },
  { k: 'Flat', hint: 'Rent, bills, groceries', name: 'The flat' },
  { k: 'Trip', hint: 'A trip with friends', name: 'Trip' },
  { k: 'Dinner', hint: 'One bill, split later', name: 'Dinner' },
] as const;

export const C_PresetChips = () => {
  const [sel, setSel] = useState<(typeof PRESETS)[number]['k']>('Couple');
  const [name, setName] = useState('Us');
  const [t, say] = useToast();
  const pick = (k: (typeof PRESETS)[number]['k']) => { setSel(k); setName(PRESETS.find((p) => p.k === k)!.name); };
  return (
    <Phone>
      <div className="flex flex-col px-6 pt-6">
        <div className="flex items-center justify-between"><span className="font-display text-[20px] font-semibold text-ink">New group</span><span className="text-[13px] text-soft">Cancel</span></div>
        <Eyebrow className="mt-6">What is it for?</Eyebrow>
        <div role="radiogroup" aria-label="Group type" className="mt-2 grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button key={p.k} role="radio" aria-checked={sel === p.k} onClick={() => pick(p.k)}
              className={`rounded-[16px] border p-3 text-left ${sel === p.k ? 'border-ink bg-tint' : 'border-line bg-white'}`}>
              <span className="block text-[14px] font-semibold text-ink">{p.k}</span>
              <span className="block text-[11px] leading-snug text-soft">{p.hint}</span>
            </button>
          ))}
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Group name"
          className="mt-5 h-12 w-full border-b border-line bg-transparent text-[17px] text-ink outline-none focus:border-ink" />
        {sel === 'Couple' && <p className="mt-3 text-[12px] text-soft">Add your partner from the invite link after you save.</p>}
      </div>
      <div className="mt-auto px-5 pb-5"><Btn onClick={() => say(`Created “${name || 'group'}”`)}>Create group</Btn></div>
      <Toast msg={t} />
    </Phone>
  );
};

/* D. Sign-in card framed for couples, shown before the user has signed in. */
export const D_CoupleSignIn = () => (
  <Phone>
    <main className="flex flex-1 flex-col justify-center px-7">
      <div className="rounded-[28px] border border-line bg-white p-7 text-center">
        <div className="mx-auto mb-4 flex w-fit -space-x-2">
          {['R', 'P'].map((l, i) => <span key={l} className="flex h-11 w-11 items-center justify-center rounded-full text-[15px] font-semibold text-white ring-2 ring-white" style={{ background: hueAt(i) }}>{l}</span>)}
        </div>
        <h2 className="font-display text-[24px] font-semibold text-ink">Split costs with your partner</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-soft">Or with friends. Make a group, share a link, and see who owes whom. Sign in with Google to start.</p>
        <div className="mt-6"><Btn>Sign in with Google</Btn></div>
        <p className="mt-3 text-[12px] text-faint">Your own budget is never shared.</p>
      </div>
    </main>
  </Phone>
);
