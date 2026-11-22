'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { num } from '@/lib/format';
import { useCurrency } from '@/lib/currency';

/**
 * Bricolage number with a faint currency symbol. Shrinks to fit one line.
 * `text` replaces the formatted number (the log screen shows typed digits and a calculator state); `prefix` is a faint
 * sign in front of the symbol (the log screen's "+" for income).
 */
export function HugeNumber({
  value,
  size = 72,
  className = '',
  color = 'text-ink',
  text: textOverride,
  prefix = '',
}: {
  value: number;
  size?: number;
  className?: string;
  color?: string;
  text?: string;
  prefix?: string;
}) {
  const { currency } = useCurrency();
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  const text = (textOverride ?? num(value)).replace('-', '−'); // a real minus sign for negatives
  const space = currency.symbol.length > 1 ? ' ' : '';

  // Long symbols (OMR, AED...) would otherwise dwarf the amount: the longer the symbol, the smaller it is drawn.
  const symbolSize = currency.symbol.length >= 3 ? '0.42em' : currency.symbol.length === 2 ? '0.62em' : '0.80em';

  useLayoutEffect(() => {
    if (!wrap.current || !inner.current) return;
    const avail = wrap.current.clientWidth;
    const need = inner.current.scrollWidth;
    setScale(need > avail && need > 0 ? avail / need : 1);
  }, [text, size, currency.symbol, prefix]);

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
        {/* the symbol is a label, not the number: keep it small so the amount leads */}
        <span className="mr-[0.08em] align-baseline text-faint" style={{ fontSize: symbolSize }} aria-hidden="true">
          {prefix}
          {currency.symbol}
          {space}
        </span>
        {text}
      </span>
    </div>
  );
}
