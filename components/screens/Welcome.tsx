'use client';
import { useRef, useState } from 'react';
import { PrimaryButton, GhostButton } from '../ui/Button';
import { encodeUsernameToBase64, getStoredUsername, saveUsername, supabaseSync } from '@/lib/sync';

const AVATAR_THEMES = [
  { bg: '#EEF2FF', ring: '#1E1B4B', accent: '#4F46E5', cheek: '#C7D2FE' },
  { bg: '#ECFDF5', ring: '#0F766E', accent: '#10B981', cheek: '#A7F3D0' },
  { bg: '#FFFBEB', ring: '#B45309', accent: '#F59E0B', cheek: '#FDE68A' },
  { bg: '#FFF1F2', ring: '#BE123C', accent: '#F43F5E', cheek: '#FECDD3' },
  { bg: '#F5F3FF', ring: '#6D28D9', accent: '#8B5CF6', cheek: '#DDD6FE' },
] as const;

export function Welcome({
  onStart,
  onSample,
}: {
  onStart: (username?: string) => void;
  onSample: () => void;
}) {
  const [username, setUsername] = useState(() => getStoredUsername());
  const [savedUser, setSavedUser] = useState(() => getStoredUsername());
  const [focused, setFocused] = useState(false);
  const [themeIdx, setThemeIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = username.trim().toLowerCase();
  const b64Preview = trimmed ? encodeUsernameToBase64(trimmed) : null;
  const isCreated = Boolean(trimmed && savedUser === trimmed);

  // Pick theme from user taps + username characters so it feels alive as you type
  const charSum = trimmed.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const theme = AVATAR_THEMES[(themeIdx + charSum) % AVATAR_THEMES.length];
  const progress = Math.min(trimmed.length / 6, 1);
  const circumference = 2 * Math.PI * 31;
  const dashOffset = circumference * (1 - (trimmed ? Math.max(progress, 0.2) : 0));

  function handleCreateUser() {
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    saveUsername(trimmed);
    setSavedUser(trimmed);
    if (supabaseSync.isEnabled()) {
      void supabaseSync.push().catch(() => {});
    }
  }

  function handleStart() {
    if (trimmed) {
      saveUsername(trimmed);
      setSavedUser(trimmed);
    }
    onStart(trimmed || undefined);
  }

  function handleSampleClick() {
    if (trimmed) {
      saveUsername(trimmed);
      setSavedUser(trimmed);
    }
    onSample();
  }

  return (
    <main className="flex h-full flex-col justify-between px-6 pb-8 pt-10">
      <div>
        <p className="mb-4 text-[15px] font-semibold text-good">Stash</p>
        <h1 className="font-display text-[36px] font-semibold leading-[1.1] tracking-tight text-ink">
          Know what you can spend today.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-soft">
          Tell Stash what comes in and what goes out once. Every day you get one number: what you can
          still spend. No guilt, no points. Just clarity.
        </p>

        {/* Interactive SVG User Creator Card */}
        <div className="mt-6 rounded-[20px] border border-line bg-tint/50 p-4">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => {
                setThemeIdx((i) => i + 1);
                if (!trimmed) inputRef.current?.focus();
              }}
              aria-label="Tap to customize user avatar"
              title="Tap to change style"
              className="group relative flex h-[72px] w-[72px] min-h-0 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
            >
              <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" className="overflow-visible">
                {/* Soft background circle */}
                <circle cx="36" cy="36" r="31" fill={theme.bg} stroke="#E4E3EE" strokeWidth="2" />

                {/* Animated progress ring as username is typed */}
                <circle
                  cx="36"
                  cy="36"
                  r="31"
                  fill="none"
                  stroke={isCreated ? '#0F766E' : theme.ring}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 36 36)"
                  style={{ transition: 'stroke-dashoffset 0.25s ease, stroke 0.25s ease' }}
                />

                {/* Orbiting sparkles when typing or created */}
                {(focused || trimmed) && (
                  <g fill={theme.accent} style={{ transition: 'opacity 0.2s' }}>
                    <path d="M12 14l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" />
                    <circle cx="60" cy="16" r="2.2" />
                    <circle cx="10" cy="54" r="1.8" />
                  </g>
                )}

                {/* Expressive character face + shoulders */}
                <path
                  d="M20 58c2.5-7 8.5-11 16-11s13.5 4 16 11"
                  fill="none"
                  stroke={theme.ring}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="36" cy="31" r="12.5" fill="#FFFFFF" stroke={theme.ring} strokeWidth="2.2" />

                {/* Rosy cheeks */}
                <circle cx="29.5" cy="33" r="2" fill={theme.cheek} />
                <circle cx="42.5" cy="33" r="2" fill={theme.cheek} />

                {/* Eyes — look toward the input when focused or typing */}
                <circle
                  cx={focused || trimmed ? 33.2 : 32}
                  cy={focused ? 29.5 : 30}
                  r="1.6"
                  fill={theme.ring}
                  style={{ transition: 'all 0.18s ease' }}
                />
                <circle
                  cx={focused || trimmed ? 41.2 : 40}
                  cy={focused ? 29.5 : 30}
                  r="1.6"
                  fill={theme.ring}
                  style={{ transition: 'all 0.18s ease' }}
                />

                {/* Smile — grows happier when username is entered */}
                <path
                  d={
                    trimmed
                      ? 'M31.5 34.2c1.4 2.4 3.1 3.2 4.5 3.2s3.1-.8 4.5-3.2'
                      : 'M33 35c1 1.2 2 1.6 3 1.6s2-.4 3-1.6'
                  }
                  fill="none"
                  stroke={theme.ring}
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Corner badge: '+' when empty, initial letter when typing, '✓' when created */}
                <circle
                  cx="55"
                  cy="54"
                  r="10"
                  fill={isCreated ? '#0F766E' : theme.ring}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                {isCreated ? (
                  <path
                    d="M51.2 54.2l2.4 2.4 5-5"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : trimmed ? (
                  <text
                    x="55"
                    y="58"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="system-ui, sans-serif"
                  >
                    {trimmed[0].toUpperCase()}
                  </text>
                ) : (
                  <path
                    d="M55 50v8M51 54h8"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">
                  {isCreated ? `Welcome, ${trimmed}` : 'Create your user'}
                </span>
                <span className="text-[11px] text-soft">Tap avatar for style</span>
              </div>

              <div className="mt-1.5 flex items-center gap-1.5">
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
                      handleCreateUser();
                    }
                  }}
                  placeholder="Enter username (e.g. rahul)"
                  aria-label="Username"
                  maxLength={32}
                  className="h-9 min-h-0 min-w-0 flex-1 rounded-full border border-line bg-white px-3 text-[13px] text-ink placeholder:text-faint"
                />
                <button
                  type="button"
                  onClick={handleCreateUser}
                  className={`h-9 min-h-0 shrink-0 rounded-full px-3 text-[12px] font-semibold text-white transition-colors ${
                    isCreated ? 'bg-good' : 'bg-ink'
                  }`}
                >
                  {isCreated ? 'Saved ✓' : 'Create'}
                </button>
              </div>

              <p className="mt-1.5 truncate text-[11px] text-faint">
                {b64Preview ? (
                  <>
                    Base64 DB ID: <code className="font-mono font-medium text-ink">{b64Preview}</code>
                  </>
                ) : (
                  'Your username is stored as Base64 in the database'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <PrimaryButton onClick={handleStart}>Set up my month</PrimaryButton>
        <p className="mb-1.5 mt-1.5 text-center text-[13px] text-soft">Takes about a minute</p>
        <GhostButton onClick={handleSampleClick}>Or explore with sample data first</GhostButton>
      </div>
    </main>
  );
}
