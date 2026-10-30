'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { num } from '@/lib/format';
import { useCurrency } from '@/lib/currency';

/** Bricolage number with a faint currency symbol. Shrinks to fit one line. */
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
  const { currency } = useCurrency();
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  const text = num(value);
  const space = currency.symbol.length > 1 ? ' ' : '';

  useLayoutEffect(() => {
    if (!wrap.current || !inner.current) return;
    const avail = wrap.current.clientWidth;
    const need = inner.current.scrollWidth;
    setScale(need > avail && need > 0 ? avail / need : 1);
  }, [text, size, currency.symbol]);

  return (
    <div
      ref={wrap}
      className={`overflow-hidden ${className}`}
      aria-label={`${currency.symbol}${space}${text}`}
    >
      <span
        ref={inner}
        className={`num inline-block whitespace-nowrap ${color}`}
        style={{ fontSize: size * scale, lineHeight: 1.05 }}
      >
        <span className="text-faint" aria-hidden="true">
          {currency.symbol}
          {space}
        </span>
        {text}
      </span>
    </div>
  );
}
