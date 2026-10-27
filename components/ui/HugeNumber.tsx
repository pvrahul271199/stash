'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { num } from '@/lib/format';

/** Bricolage number with a faint ₹. Shrinks to fit one line. */
export function HugeNumber({
  value,
  size = 72,
  className = '',
  color = 'text-ink',
}: {
  value: number;
  size?: number;
  className?: string;
  color?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  const text = num(value);

  useLayoutEffect(() => {
    if (!wrap.current || !inner.current) return;
    const avail = wrap.current.clientWidth;
    const need = inner.current.scrollWidth;
    setScale(need > avail && need > 0 ? avail / need : 1);
  }, [text, size]);

  return (
    <div ref={wrap} className={`overflow-hidden ${className}`} aria-label={`₹${text}`}>
      <span
        ref={inner}
        className={`num inline-block whitespace-nowrap ${color}`}
        style={{ fontSize: size * scale, lineHeight: 1.05 }}
      >
        <span className="text-faint" aria-hidden="true">₹</span>
        {text}
      </span>
    </div>
  );
}
