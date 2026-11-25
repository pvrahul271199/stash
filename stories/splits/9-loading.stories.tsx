import { useEffect, useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Av, Bar, Btn, C, Phone } from './kit';

/**
 * Loading and error, five designs. Splits is online only, so the tab waits for Supabase ("Loading your groups…" today)
 * and can fail ("Try again"). Each story loops: loading for ~2s, then the error state, with Retry going back to loading.
 */
const meta: Meta = { title: 'Splits / 9. Loading and error', parameters: { layout: 'centered' } };
export default meta;

function useCycle() {
  const [st, setSt] = useState<'loading' | 'error'>('loading');
  useEffect(() => { if (st !== 'loading') return; const h = setTimeout(() => setSt('error'), 2200); return () => clearTimeout(h); }, [st]);
  return { loading: st === 'loading', retry: () => setSt('loading') };
}
const Title = () => <header className="px-5 pb-2 pt-6"><h1 className="font-display text-[26px] font-semibold text-ink">Splits</h1></header>;
const Err = ({ retry, className = '' }: { retry: () => void; className?: string }) => (
  <div className={`splits-fade text-center ${className}`} role="alert">
    <p className="text-[15px] font-medium text-ink">Could not reach your groups</p>
    <p className="mt-1 text-[13px] text-soft">Check the connection. Your own budget works offline.</p>
    <button onClick={retry} className="mt-3 min-h-[44px] text-[13px] font-semibold text-ink underline underline-offset-4">Try again</button>
  </div>
);

/* A. Skeleton of the real layout: hero card and rows shimmer in the exact places they will land. */
export const A_Skeleton = () => {
  const x = useCycle();
  return (
    <Phone>
      <Title />
      {x.loading ? (
        <div className="px-5" aria-busy="true" aria-label="Loading your groups">
          <div className="animate-pulse rounded-[26px] bg-ink/90 px-6 py-6"><span className="block h-3 w-24 rounded-full bg-white/20" /><span className="mt-3 block h-10 w-40 rounded-full bg-white/25" /><span className="mt-4 block h-1.5 rounded-full bg-white/15" /></div>
          {[0, 1, 2, 3].map((i) => <div key={i} className="flex items-center gap-3 border-b border-line py-4" style={{ opacity: 1 - i * 0.2 }}><Bar className="h-10 w-10 !rounded-[14px]" /><div className="flex-1 space-y-2"><Bar className="h-3 w-32" /><Bar className="h-2.5 w-20" /></div><Bar className="h-3 w-14" /></div>)}
        </div>) : <Err retry={x.retry} className="mt-24 px-8" />}
      <div className="mt-auto px-5 pb-5"><Btn disabled={x.loading}>New group</Btn></div>
    </Phone>
  );
};

/* B. The app's own loader (breathing circle and ripple) with a Splits-specific mark: two coins passing. */
export const B_BrandLoader = () => {
  const x = useCycle();
  return (
    <Phone>
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        {x.loading ? (
          <>
            <div className="relative flex h-[220px] w-[220px] items-center justify-center">
              <span className="stash-breathe absolute inset-4 rounded-full bg-tint" />
              <span className="stash-ripple absolute inset-4 rounded-full border border-good/40" />
              <span className="stash-ripple absolute inset-4 rounded-full border border-good/40" style={{ animationDelay: '1.2s' }} />
              <svg width="90" height="50" viewBox="0 0 90 50" aria-hidden="true" className="relative">
                <circle r="12" fill={C.ink}><animate attributeName="cx" values="18;72;18" dur="1.6s" repeatCount="indefinite" /><animate attributeName="cy" values="25;18;25" dur="1.6s" repeatCount="indefinite" /></circle>
                <circle r="12" fill="none" stroke={C.ink} strokeWidth="2.5"><animate attributeName="cx" values="72;18;72" dur="1.6s" repeatCount="indefinite" /><animate attributeName="cy" values="25;32;25" dur="1.6s" repeatCount="indefinite" /></circle>
              </svg>
            </div>
            <p className="font-display animate-pulse text-[15px] font-medium text-soft">Loading your groups…</p>
          </>) : <Err retry={x.retry} />}
      </div>
    </Phone>
  );
};

/* C. People gathering: avatars drift into a circle while groups load; on error they drift apart. */
export const C_Gathering = () => {
  const x = useCycle();
  const ids = ['u1', 'u2', 'u3', 'u4', 'u5'];
  return (
    <Phone>
      <Title />
      <div className="flex flex-1 flex-col items-center justify-center">
        <style>{`
          @keyframes gatherSpin { to { transform: rotate(360deg); } }
          @keyframes gatherUpright { to { transform: rotate(-360deg); } }
          @keyframes gatherCore { 0%, 100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.35; } 50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.9; } }
        `}</style>
        <div className="relative h-[200px] w-[200px]">
          {/* faint orbit track: fades in while loading, out on error */}
          <span
            aria-hidden="true"
            className="absolute left-[38px] top-[38px] h-[124px] w-[124px] rounded-full border border-dashed border-line transition-opacity duration-700"
            style={{ opacity: x.loading ? 1 : 0 }}
          />
          {/* the whole group turns slowly; each avatar counter-turns so faces stay upright */}
          <div className="absolute inset-0" style={{ animation: x.loading ? 'gatherSpin 9s linear infinite' : 'none' }}>
            {ids.map((id, i) => {
              const a = -Math.PI / 2 + (i * 2 * Math.PI) / ids.length, r = x.loading ? 62 : 92;
              return (
                <span
                  key={id}
                  className={`absolute transition-all duration-700 ease-out ${x.loading ? '' : 'opacity-40 grayscale'}`}
                  style={{ left: 100 + r * Math.cos(a) - 20, top: 100 + r * Math.sin(a) - 20 }}
                >
                  <span className="block" style={{ animation: x.loading ? 'gatherUpright 9s linear infinite' : 'none' }}>
                    <Av id={id} size={40} ring />
                  </span>
                </span>
              );
            })}
          </div>
          {/* a soft core that breathes while everyone is gathering */}
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 h-5 w-5 rounded-full bg-ink"
            style={{ animation: x.loading ? 'gatherCore 2.4s ease-in-out infinite' : 'none', opacity: x.loading ? undefined : 0, transition: 'opacity 700ms' }}
          />
        </div>
        {x.loading ? <p className="mt-8 text-[14px] text-soft">Getting everyone together…</p> : <Err retry={x.retry} className="mt-6 px-8" />}
      </div>
    </Phone>
  );
};

/* D. Inline and light: the tab stays usable; a thin progress line under the title and a calm one-liner. */
export const D_Inline = () => {
  const x = useCycle();
  return (
    <Phone>
      <Title />
      <div className="relative mx-5 h-0.5 overflow-hidden rounded-full bg-tint">
        {x.loading && <span className="absolute inset-y-0 w-1/3 rounded-full bg-ink" style={{ animation: 'loadbar 1.1s ease-in-out infinite' }} />}
      </div>
      <style>{'@keyframes loadbar { 0% { left: -33%; } 100% { left: 100%; } }'}</style>
      <div className="flex-1 px-5 pt-5">
        {x.loading ? <p className="text-[13px] text-faint">Loading your groups…</p> : (
          <div className="splits-fade flex items-center gap-3 rounded-[18px] px-4 py-3" style={{ background: C.warmBg }} role="alert">
            <span className="text-[13px] text-warm">Offline. Showing nothing yet.</span>
            <button onClick={x.retry} className="ml-auto h-8 min-h-0 rounded-full bg-white px-3 text-[12px] font-semibold text-ink">Retry</button>
          </div>)}
      </div>
      <div className="px-5 pb-5"><Btn disabled={x.loading}>New group</Btn></div>
    </Phone>
  );
};

/* E. Counting up: the overall balance ticks from zero while loading, so the wait feels like the number arriving. */
export const E_CountUp = () => {
  const x = useCycle();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!x.loading) return; setN(0);
    const h = setInterval(() => setN((v) => (v >= 98 ? 0 : v + 7)), 70);
    return () => clearInterval(h);
  }, [x.loading]);
  return (
    <Phone>
      <Title />
      <div className="mx-5 rounded-[26px] bg-ink px-6 py-7 text-white">
        <p className="text-[12px] text-white/60">Across all groups</p>
        {x.loading ? <p className="num mt-1 text-[46px] leading-none text-white/30">₹{String(n).padStart(2, '0')}<span className="text-white/15">,···</span></p>
          : <p className="num mt-1 text-[46px] leading-none text-white/30">—</p>}
        <p className="mt-2 text-[12px] text-white/50">{x.loading ? 'Adding up your groups…' : 'Not loaded'}</p>
      </div>
      <div className="flex-1 px-5 pt-6">{x.loading ? <div className="space-y-4">{[0, 1, 2].map((i) => <Bar key={i} className="h-12 w-full !rounded-[16px]" />)}</div> : <Err retry={x.retry} className="mt-10" />}</div>
    </Phone>
  );
};
