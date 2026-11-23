'use client';
import { useEffect, useRef, useState } from 'react';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { friendlyError, joinGroup, previewInvite, type InvitePreview } from '@/lib/groups';
import { avatarHue, initials } from '@/lib/split';
import { FlowBg } from './parts';

/** The inviter plus a few placeholder circles for the others (the preview only knows how many people are in). */
function Faces({ creator, count }: { creator: string; count: number }) {
  const shown = Math.min(Math.max(count, 1), 4);
  return (
    <div className="flex" aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className="stash-rise flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-semibold text-white ring-[3px] ring-white"
          style={{ marginLeft: i ? -14 : 0, background: avatarHue(i), animationDelay: `${i * 110}ms` }}>
          {i === 0 ? initials(creator) : ''}
        </span>))}
      {count > shown && <span className="num ml-2 self-center text-[13px] text-soft">+{count - shown}</span>}
    </div>
  );
}

/**
 * What an invite link opens (the /join page hands the code to the app). Full-screen flowing gradient (palette follows the
 * group's name, so it matches the group everywhere), the inviter's face and the group name on top, and a white panel at the
 * bottom with the action: "Join the group" signs a guest in with Google first, then joins. A closed, expired or missing invite
 * says so.
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
  const creator = preview?.creator || 'A friend';

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-white" role="dialog" aria-label="Group invitation">
      <FlowBg seed={preview?.name ?? code} />
      <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
        {!preview && !error && (
          <div role="status" className="flex flex-col items-center">
            <span aria-hidden="true" className="stash-breathe h-24 w-24 rounded-full bg-white/70" />
            <p className="mt-5 text-[13px] text-soft">Opening your invitation{'…'}</p>
          </div>)}
        {preview && !dead && (
          <div className="splits-fade flex flex-col items-center">
            <Faces creator={creator} count={preview.members ?? 1} />
            <p className="mt-6 text-[14px] text-soft">{creator} invited you to</p>
            <h1 className="font-display mt-1 text-[36px] font-semibold leading-tight text-ink">{preview.name}</h1>
            <p className="mt-2 text-[13px] text-soft">{preview.members} {preview.members === 1 ? 'person' : 'people'} so far</p>
          </div>)}
        {dead && (
          <div className="splits-fade">
            <h1 className="font-display text-[26px] font-semibold text-ink">{preview.status === 'missing' ? 'This invite is not valid' : preview.status === 'closed' ? 'This group is closed' : 'This link has expired'}</h1>
            <p className="mt-2 text-[14px] text-soft">{preview.status === 'missing' ? 'The link may be mistyped or the group was deleted.' : `Ask ${preview.creator || 'the creator'} to ${preview.status === 'closed' ? 'reopen invites' : 'send a new link'} for ${preview.name}.`}</p>
          </div>)}
        {error && !preview && <p role="alert" className="text-[14px] text-warm">{error}</p>}
      </div>
      <div className="relative rounded-t-[30px] bg-white px-6 pb-7 pt-6 shadow-[0_-10px_40px_rgba(30,27,75,0.08)]">
        {preview && !dead ? (
          <>
            <PrimaryButton disabled={busy} onClick={tap}>{busy ? 'Joining…' : 'Join the group'}</PrimaryButton>
            {error && <p role="alert" className="mt-3 text-center text-[13px] text-warm">{error}</p>}
            <p className="mt-3 text-center text-[12px] text-faint">{auth.status === 'signedIn' ? 'Your own budget stays private.' : 'You will sign in with Google first. Your own budget stays private.'}</p>
            <button onClick={onClose} className="mt-1 min-h-[44px] w-full text-[14px] font-medium text-soft">Not now</button>
          </>
        ) : (
          <SecondaryButton onClick={onClose}>{dead || error ? 'Go to Chelav' : 'Not now'}</SecondaryButton>
        )}
      </div>
    </div>
  );
}
