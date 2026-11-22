'use client';
import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** A real, scannable QR code drawn as one SVG path (crisp at any size). */
export function QR({ text, size = 148 }: { text: string; size?: number }) {
  const { d, n } = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const count = q.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (q.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return { d: path, n: count };
  }, [text]);
  return (
    <svg role="img" aria-label="QR code for the invite link" width={size} height={size} viewBox={`-2 -2 ${n + 4} ${n + 4}`} shapeRendering="crispEdges">
      <path d={d} fill="#1E1B4B" />
    </svg>
  );
}
