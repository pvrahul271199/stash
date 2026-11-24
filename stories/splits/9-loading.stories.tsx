import { useEffect, useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Av, Bar, Btn, C, Phone, WASH } from './kit';

/**
 * Loading and error, the picked design. Splits is online only, so the tab waits for Supabase ("Loading your groups…" today)
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
