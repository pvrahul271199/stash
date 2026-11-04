'use client';
import { useEffect, useRef, useState } from 'react';

/** Touch-and-drag horizontal chip scroller with hidden scrollbar and soft edge fades. */
export function SwipeRow({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; scrollLeft: number; moved: boolean } | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  function updateEdges() {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }

  useEffect(() => {
    updateEdges();
    const el = ref.current;
    if (!el) return;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateEdges) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [children]);

  return (
    <div className={`relative -mx-6 ${className}`}>
      <div
        ref={ref}
        role="group"
        aria-label={label}
        onScroll={updateEdges}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') return;
          const el = ref.current;
          if (!el) return;
          drag.current = { startX: e.clientX, scrollLeft: el.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const el = ref.current;
          if (!d || !el) return;
          const dx = e.clientX - d.startX;
          if (Math.abs(dx) > 4) d.moved = true;
          if (d.moved) el.scrollLeft = d.scrollLeft - dx;
        }}
        onPointerUp={() => {
          if (drag.current?.moved) {
            const suppress = (ev: MouseEvent) => {
              ev.stopPropagation();
              ev.preventDefault();
            };
            window.addEventListener('click', suppress, { capture: true, once: true });
          }
          drag.current = null;
        }}
        onPointerLeave={() => {
          drag.current = null;
        }}
        className="no-scrollbar select-none overflow-x-auto px-6 touch-pan-x"
      >
        {children}
      </div>
      {edges.left && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-white to-transparent"
        />
      )}
      {edges.right && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white via-white/80 to-transparent"
        />
      )}
    </div>
  );
}
