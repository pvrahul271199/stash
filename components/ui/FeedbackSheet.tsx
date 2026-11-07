'use client';
import { useEffect, useState } from 'react';
import { PrimaryButton, GhostButton } from './Button';
import { submitFeedback } from '@/lib/feedback';
import { track } from '@/lib/analytics';
import { useToast } from '@/store/toast';

const KINDS = ['Feedback', 'Bug report'] as const;
const MAX = 1000;

/** Minimal feedback / bug form. Saved to the `feedback` table in Supabase (supabase/schema.sql). Nothing from the user's budget is attached. */
export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const [kind, setKind] = useState<(typeof KINDS)[number]>('Feedback');
  const [text, setText] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function send() {
    setSending(true);
    const ok = await submitFeedback(kind === 'Bug report' ? 'bug' : 'feedback', text, contact);
    setSending(false);
    if (!ok) {
      toast('Could not send. Check your connection and try again.', 'warm');
      return;
    }
    track('feedback_sent', { kind: kind === 'Bug report' ? 'bug' : 'feedback' });
    toast('Thanks, we got it');
    onClose();
  }

  return (
    <div className="absolute inset-0 z-[55] flex items-end bg-ink/40 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fb-title"
        className="w-full rounded-[24px] bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="fb-title" className="text-section font-semibold text-ink">
          Feedback or report a bug
        </h2>
        <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Type">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-[40px] flex-1 rounded-btn border text-[14px] font-semibold ${
                kind === k ? 'border-ink bg-ink text-white' : 'border-line text-ink'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <textarea
          autoFocus
          value={text}
          maxLength={MAX}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          aria-label="Your message"
          placeholder={kind === 'Bug report' ? 'What happened, and what did you expect?' : 'What would make Chelav better?'}
          className="mt-3 w-full resize-none rounded-btn border border-line p-3 text-body text-ink outline-none focus:border-ink"
        />
        <input
          type="text"
          value={contact}
          maxLength={200}
          onChange={(e) => setContact(e.target.value)}
          aria-label="Email or phone (optional)"
          placeholder="Email (optional, if you want a reply)"
          className="mt-2 w-full rounded-btn border border-line p-3 text-body text-ink outline-none focus:border-ink"
        />
        <div className="mt-3 flex flex-col gap-1">
          <PrimaryButton onClick={send} disabled={!text.trim() || sending}>
            {sending ? 'Sending…' : 'Send'}
          </PrimaryButton>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
        </div>
      </div>
    </div>
  );
}
