// Generates PWA icons into public/icons. Run: npm run icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const INK = '#1E1B4B';
const TEAL = '#5EEAD4';

// White rupee drawn from strokes in a 100x100 box, plus the short teal bar underneath.
const glyph = `
  <g transform="translate(0 -6)">
    <path d="M30 28H72M30 43H72M32 28H48C68 28 68 55 48 55H32L64 82"
      fill="none" stroke="#fff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="38" y="88" width="24" height="5" rx="2.5" fill="${TEAL}"/>
  </g>`;

function svg({ rounded, inset }) {
  const bg = rounded
    ? `<rect width="100" height="100" rx="22" fill="${INK}"/>`
    : `<rect width="100" height="100" fill="${INK}"/>`;
  const s = inset; // 1 = normal, <1 keeps content inside the maskable safe zone
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    ${bg}
    <g transform="translate(50 50) scale(${s}) translate(-50 -50)">${glyph}</g>
  </svg>`;
}

mkdirSync('public/icons', { recursive: true });
const jobs = [
  ['icon-192.png', 192, { rounded: true, inset: 1 }],
  ['icon-512.png', 512, { rounded: true, inset: 1 }],
  ['icon-maskable-512.png', 512, { rounded: false, inset: 0.72 }],
  ['apple-touch-icon.png', 180, { rounded: false, inset: 0.9 }],
];
for (const [name, size, opts] of jobs) {
  await sharp(Buffer.from(svg(opts)), { density: 384 }).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log('wrote', name);
}
