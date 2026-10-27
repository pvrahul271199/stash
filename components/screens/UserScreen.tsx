'use client';
import { useRef, useState } from 'react';
import { BackIcon, GhostButton, IconButton, PrimaryButton } from '../ui/Button';
import { encodeUsernameToBase64, getStoredUsername, saveUsername } from '@/lib/sync';

const AVATAR_THEMES = [
  { name: 'Indigo', bg: '#EEF2FF', ring: '#1E1B4B', accent: '#4F46E5', cheek: '#C7D2FE' },
  { name: 'Emerald', bg: '#ECFDF5', ring: '#0F766E', accent: '#10B981', cheek: '#A7F3D0' },
  { name: 'Amber', bg: '#FFFBEB', ring: '#B45309', accent: '#F59E0B', cheek: '#FDE68A' },
  { name: 'Coral', bg: '#FFF1F2', ring: '#BE123C', accent: '#F43F5E', cheek: '#FECDD3' },
  { name: 'Violet', bg: '#F5F3FF', ring: '#6D28D9', accent: '#8B5CF6', cheek: '#DDD6FE' },
] as const;

export function UserScreen({
  busy = false,
  onBack,
  onContinue,
}: {
  busy?: boolean;
  onBack: () => void;
  onContinue: (username?: string) => void;
}) {
  const [username, setUsername] = useState(() => getStoredUsername());
  const [focused, setFocused] = useState(false);
  const [themeIdx, setThemeIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = username.trim().toLowerCase();
  const b64Preview = trimmed ? encodeUsernameToBase64(trimmed) : null;

  const charSum = trimmed.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const activeIdx = (themeIdx + charSum) % AVATAR_THEMES.length;
  const theme = AVATAR_THEMES[activeIdx];
  const progress = Math.min(trimmed.length / 6, 1);
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - (trimmed ? Math.max(progress, 0.22) : 0));

  function submit(nameToUse?: string) {
    const clean = (nameToUse ?? trimmed).trim().toLowerCase();
    saveUsername(clean);
    onContinue(clean || undefined);
  }

  return (
    <main className="flex h-full flex-col justify-between px-6 pb-8 pt-6">
      <div>
        <div className="flex items-center justify-between">
          <IconButton label="Back" onClick={onBack} className="-ml-3">
            <BackIcon />
          </IconButton>
          <span className="text-[13px] text-faint">Profile setup</span>
        </div>

        <h1 className="mt-2 text-question font-semibold text-ink">
          {trimmed ? `Welcome, ${trimmed}` : 'Who’s using Stash?'}
        </h1>
        <p className="mt-1.5 text-[14px] text-soft">
          Pick a username. We convert it to Base64 to keep your workspace synced across devices.
        </p>

        {/* Interactive SVG Avatar Stage */}
        <div className="mt-6 flex flex-col items-center">
          <button
            type="button"
            onClick={() => {
              setThemeIdx((i) => i + 1);
              if (!trimmed) inputRef.current?.focus();
            }}
            aria-label="Tap to customize user avatar style"
            className="group relative flex h-[116px] w-[116px] min-h-0 items-center justify-center rounded-full transition-transform active:scale-95"
          >
            <svg width="116" height="116" viewBox="0 0 116 116" aria-hidden="true" className="overflow-visible">
              {/* Outer soft halo */}
              <circle cx="58" cy="58" r={radius} fill={theme.bg} stroke="#E4E3EE" strokeWidth="2.5" />

              {/* Animated progress ring as username is typed */}
              <circle
                cx="58"
                cy="58"
                r={radius}
                fill="none"
                stroke={theme.ring}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 58 58)"
                style={{ transition: 'stroke-dashoffset 0.25s ease, stroke 0.25s ease' }}
              />

              {/* Orbiting sparkles when focused or typed */}
              {(focused || trimmed) && (
                <g fill={theme.accent} style={{ transition: 'opacity 0.2s' }}>
                  <path d="M16 20l2.2 4.5 4.5 2.2-4.5 2.2-2.2 4.5-2.2-4.5-4.5-2.2 4.5-2.2z" />
                  <path d="M98 22l1.6 3.2 3.2 1.6-3.2 1.6-1.6 3.2-1.6-3.2-3.2-1.6 3.2-1.6z" />
                  <circle cx="14" cy="84" r="2.8" />
                  <circle cx="102" cy="80" r="2.2" />
                </g>
              )}

              {/* Shoulders / body */}
              <path
                d="M32 92c4-11 13.5-17 26-17s22 6 26 17"
                fill="none"
                stroke={theme.ring}
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Head */}
              <circle cx="58" cy="50" r="20" fill="#FFFFFF" stroke={theme.ring} strokeWidth="2.8" />

              {/* Rosy cheeks */}
              <circle cx="47.5" cy="53.5" r="3.2" fill={theme.cheek} />
              <circle cx="68.5" cy="53.5" r="3.2" fill={theme.cheek} />

              {/* Eyes — glance down toward the input when focused */}
              <circle
                cx="51.5"
                cy={focused ? 49.5 : 48}
                r="2.3"
                fill={theme.ring}
                style={{ transition: 'all 0.18s ease' }}
              />
              <circle
                cx="64.5"
                cy={focused ? 49.5 : 48}
                r="2.3"
                fill={theme.ring}
                style={{ transition: 'all 0.18s ease' }}
              />

              {/* Smile — grows happier as you type */}
              <path
                d={
                  trimmed
                    ? 'M50.5 55.5c2.2 3.8 5 5 7.5 5s5.3-1.2 7.5-5'
                    : 'M53 56.5c1.5 1.8 3.2 2.5 5 2.5s3.5-.7 5-2.5'
                }
                fill="none"
                stroke={theme.ring}
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Corner badge: '+' when empty, initial letter when typed */}
              <circle
                cx="89"
                cy="87"
                r="14"
                fill={trimmed ? '#0F766E' : theme.ring}
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
              {trimmed ? (
                <text
                  x="89"
                  y="92"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="14"
                  fontWeight="700"
                  fontFamily="system-ui, sans-serif"
                >
                  {trimmed[0].toUpperCase()}
                </text>
              ) : (
                <path
                  d="M89 81.5v11M83.5 87h11"
                  stroke="#FFFFFF"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>

          {/* Interactive theme dots */}
          <div className="mt-2.5 flex items-center gap-2" role="group" aria-label="Avatar color theme">
            {AVATAR_THEMES.map((t, idx) => {
              const isSel = idx === activeIdx;
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setThemeIdx(idx - (charSum % AVATAR_THEMES.length) + AVATAR_THEMES.length)}
                  aria-label={`${t.name} theme`}
                  aria-pressed={isSel}
                  className={`h-5 w-5 min-h-0 rounded-full border transition-transform ${
                    isSel ? 'scale-125 border-ink' : 'border-line opacity-75'
                  }`}
                  style={{ background: t.accent }}
                />
              );
            })}
          </div>
        </div>

        {/* Username input + Base64 preview */}
        <div className="mt-6">
          <input
            ref={inputRef}
            type="text"
            value={username}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Enter username (e.g. rahul)"
            aria-label="Username"
            autoFocus
            maxLength={32}
            className="h-12 w-full rounded-key border border-line bg-tint/40 px-4 text-center text-[17px] font-medium text-ink placeholder:font-normal placeholder:text-faint"
          />

          <div className="mt-2.5 flex min-h-[28px] items-center justify-center">
            {b64Preview ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1 text-[12px] text-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-good" />
                DB Key (Base64): <code className="font-mono font-semibold text-ink">{b64Preview}</code>
              </span>
            ) : (
              <span className="text-[12px] text-faint">Tap the avatar above to customize your style</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <PrimaryButton disabled={busy} onClick={() => submit()}>
          {busy ? 'Checking workspace…' : trimmed ? `Continue as ${trimmed}` : 'Continue'}
        </PrimaryButton>
        {trimmed && (
          <GhostButton disabled={busy} onClick={() => submit('')}>
            Skip username for now
          </GhostButton>
        )}
      </div>
    </main>
  );
}
