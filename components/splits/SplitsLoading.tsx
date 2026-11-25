'use client';
import { avatarHue } from '@/lib/split';

/**
 * Splits loading screen (design C, "people gathering"): five avatars turn slowly on a faint orbit, each one counter-turning so
 * it stays upright, with a small core breathing in the middle. Motion stops for people who prefer reduced motion (CSS below).
 */
const SEATS = 5;
const RADIUS = 62;
/** Initials on the placeholder avatars, so the loader reads like the people in a group. */
const LETTERS = ['R', 'M', 'A', 'S', 'P'];

export function SplitsLoading({ message = 'Getting everyone together…' }: { message?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label={message} className="flex h-full flex-col items-center justify-center">
      <style>{`
        @keyframes splitsOrbit { to { transform: rotate(360deg); } }
        @keyframes splitsUpright { to { transform: rotate(-360deg); } }
        @keyframes splitsCore {
          0%, 100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.35; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.9; }
        }
        @media (prefers-reduced-motion: reduce) {
          .splits-orbit, .splits-upright, .splits-core { animation: none !important; }
        }
      `}</style>
      <div className="relative h-[200px] w-[200px]">
        <span aria-hidden="true" className="absolute left-[38px] top-[38px] h-[124px] w-[124px] rounded-full border border-dashed border-line" />
        <div className="splits-orbit absolute inset-0" style={{ animation: 'splitsOrbit 9s linear infinite' }}>
          {Array.from({ length: SEATS }, (_, i) => {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / SEATS;
            return (
              <span key={i} className="absolute" style={{ left: 100 + RADIUS * Math.cos(a) - 20, top: 100 + RADIUS * Math.sin(a) - 20 }}>
                <span className="splits-upright block" style={{ animation: 'splitsUpright 9s linear infinite' }}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-semibold text-white ring-2 ring-white" style={{ background: avatarHue(i) }}>
                    {LETTERS[i]}
                  </span>
                </span>
              </span>
            );
          })}
        </div>
        <span
          aria-hidden="true"
          className="splits-core absolute left-1/2 top-1/2 h-5 w-5 rounded-full bg-ink"
          style={{ animation: 'splitsCore 2.4s ease-in-out infinite' }}
        />
      </div>
      <p className="mt-8 text-[14px] text-soft">{message}</p>
    </div>
  );
}
