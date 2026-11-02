// Generates PWA icons into public/icons. Run: npm run icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const INK = '#1E1B4B';

import { readFileSync } from 'node:fs';
const WORDMARK = readFileSync('components/ui/logoPath.ts', 'utf8').match(/'([^']+)'/)[1];
const glyph = `
  <path d="${WORDMARK}" fill="#fff"/>`;

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
