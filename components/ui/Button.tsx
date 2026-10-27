'use client';
import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement>;

const base =
  'w-full rounded-btn font-sans transition-opacity active:opacity-80 disabled:opacity-40 focus-visible:outline-good';

export function PrimaryButton({ className = '', ...p }: Props) {
  return (
    <button
      {...p}
      className={`${base} h-[54px] bg-ink text-[16px] font-semibold text-white ${className}`}
    />
  );
}

export function SecondaryButton({ className = '', ...p }: Props) {
  return (
    <button
      {...p}
      className={`${base} h-[50px] border border-line bg-white text-[16px] font-semibold text-ink ${className}`}
    />
  );
}

export function GhostButton({ className = '', ...p }: Props) {
  return (
    <button {...p} className={`min-h-[44px] w-full text-[15px] font-medium text-soft ${className}`} />
  );
}

export function IconButton({
  label,
  children,
  className = '',
  ...p
}: Props & { label: string }) {
  return (
    <button
      {...p}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full text-ink ${className}`}
    >
      {children}
    </button>
  );
}

export const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const DeleteIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5h11a1 1 0 011 1v12a1 1 0 01-1 1H9l-6-7 6-7z" />
    <path d="M13 10l4 4M17 10l-4 4" />
  </svg>
);
