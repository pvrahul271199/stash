'use client';
import { useEffect, useRef, useState } from 'react';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { friendlyError, joinGroup, previewInvite, type InvitePreview } from '@/lib/groups';
import { Eyebrow } from './parts';

/**
 * What an invite link opens (the /join page hands the code to the app). Shows the group, and "Join the group" does the rest:
 * a guest is sent through the Google sign-in sheet first, then joined automatically. A closed or expired invite says so.
 */
export function JoinGroupSheet({
  code, onSignIn, onJoined, onClose,
}: { code: string; onSignIn: () => void; onJoined: (groupId: string) => void; onClose: () => void }) {
  const auth = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wantJoin = useRef(false);

  useEffect(() => {
    let live = true;
    previewInvite(code).then((p) => live && setPreview(p)).catch((e) => live && setError(friendlyError(e)));
    return () => { live = false; };
  }, [code]);

  async function join() {
    setBusy(true);
    setError(null);
    try { onJoined(await joinGroup(code)); } catch (e) { setError(friendlyError(e)); setBusy(false); }
  }
  // the person tapped Join as a guest: once Google signs them in, finish the join
  useEffect(() => {
    if (wantJoin.current && auth.status === 'signedIn' && !busy) { wantJoin.current = false; void join(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status]);

  const tap = () => {
    if (auth.status === 'signedIn') void join();
    else { wantJoin.current = true; onSignIn(); }
  };
  const dead = preview && preview.status !== 'open';

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white px-6" role="dialog" aria-label="Group invitation">
      <div className="w-full rounded-[28px] border border-line bg-white p-7 text-center shadow-[0_10px_30px_rgba(30,27,75,0.06)]">
        {!preview && !error && <p className="py-10 text-[13px] text-faint">Opening your invitation{'…'}</p>}
        {preview && !dead && (
          <>
            <Eyebrow>Invitation</Eyebrow>
            <h1 className="font-display mt-2 text-[30px] font-semibold leading-tight text-ink">{preview.name}</h1>
            <p className="mt-1 text-[13px] text-soft">Created by {preview.creator || 'a friend'} {'·'} {preview.members} {preview.members === 1 ? 'person' : 'people'}</p>
            <div className="mt-7"><PrimaryButton disabled={busy} onClick={tap}>{busy ? 'Joining…' : 'Join the group'}</PrimaryButton></div>
            <p className="mt-3 text-[12px] text-faint">{auth.status === 'signedIn' ? 'Your own budget stays private.' : 'You will sign in with Google first. Your own budget stays private.'}</p>
          </>)}
        {dead && (
          <>
            <h1 className="font-display text-[26px] font-semibold text-ink">{preview.status === 'missing' ? 'This invite is not valid' : preview.status === 'closed' ? 'This group is closed' : 'This link has expired'}</h1>
            <p className="mt-2 text-[14px] text-soft">{preview.status === 'missing' ? 'The link may be mistyped or the group was deleted.' : `Ask ${preview.creator || 'the creator'} to ${preview.status === 'closed' ? 'reopen invites' : 'send a new link'} for ${preview.name}.`}</p>
          </>)}
        {error && <p role="alert" className="mt-3 text-[13px] text-warm">{error}</p>}
        <div className="mt-4"><SecondaryButton className="!h-11 !text-[14px]" onClick={onClose}>{dead || error ? 'Go to Chelav' : 'Not now'}</SecondaryButton></div>
      </div>
    </div>
  );
}
