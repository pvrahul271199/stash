'use client';
import { useState } from 'react';
import { PrimaryButton, GhostButton } from '../ui/Button';
import { encodeUsernameToBase64, getStoredUsername, saveUsername } from '@/lib/sync';

export function Welcome({
  onStart,
  onSample,
}: {
  onStart: (username?: string) => void;
  onSample: () => void;
}) {
  const [username, setUsername] = useState(() => getStoredUsername());
  const trimmed = username.trim().toLowerCase();
  const b64Preview = trimmed ? encodeUsernameToBase64(trimmed) : null;

  function handleStart() {
    if (trimmed) saveUsername(trimmed);
    onStart(trimmed || undefined);
  }

  return (
    <main className="flex h-full flex-col justify-between px-6 pb-8 pt-14">
      <div>
        <p className="mb-6 text-[15px] font-semibold text-good">Stash</p>
        <h1 className="font-display text-[40px] font-semibold leading-[1.1] tracking-tight text-ink">
          Know what you can spend today.
        </h1>
        <p className="mt-4 text-body text-soft">
          Tell Stash what comes in and what goes out once. Every day you get one number: what you can
          still spend. No guilt, no points. Just clarity.
        </p>

        <div className="mt-6 rounded-note border border-line bg-tint/50 p-3.5">
          <label className="block">
            <span className="text-[13px] font-semibold text-ink">Your username</span>
            <span className="ml-1.5 text-[12px] text-soft">(encoded to Base64 in DB)</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              placeholder="e.g. rahul"
              aria-label="Username"
              maxLength={32}
              className="mt-1.5 h-11 w-full rounded-key border border-line bg-white px-3 text-[15px] text-ink placeholder:text-faint"
            />
          </label>
          {b64Preview && (
            <p className="mt-1.5 text-[12px] text-faint">
              DB ID (Base64): <code className="font-mono text-ink">{b64Preview}</code>
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <PrimaryButton onClick={handleStart}>Set up my month</PrimaryButton>
        <p className="mb-2 mt-2 text-center text-[14px] text-soft">Takes about a minute</p>
        <GhostButton onClick={onSample}>Or explore with sample data first</GhostButton>
      </div>
    </main>
  );
}
