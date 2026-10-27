'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Chip({
  dashed,
  className = '',
  children,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { dashed?: boolean; children: ReactNode }) {
  return (
    <button
      {...p}
      className={`inline-flex min-h-[44px] items-center rounded-full border bg-white px-4 text-[14px] font-medium text-ink ${
        dashed ? 'border-dashed border-faint text-soft' : 'border-line'
      } ${className}`}
    >
      {children}
    </button>
  );
}

const noteTone = {
  good: 'bg-goodBg text-good',
  adjust: 'bg-warmBg text-warm',
  neutral: 'bg-tint text-ink',
} as const;

export function Note({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: keyof typeof noteTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-note px-[14px] py-3 text-[14px] leading-snug ${noteTone[tone]} ${className}`}>
      {children}
    </div>
  );
}
