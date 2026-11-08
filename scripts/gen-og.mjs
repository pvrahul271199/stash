// Generates public/og.png (1200x630 share image for link previews). Run: npm run og
import sharp from 'sharp';

const W = 1200;
const H = 630;
const mark = 'M74 22 V70 H24 M32 54 C30 40 40 33 50 36 C62 40 62 58 50 70';
const F = 'Helvetica, Arial, sans-serif';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B3790"/><stop offset="1" stop-color="#17143D"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#E9E7FB"/><stop offset="1" stop-color="#E9E7FB" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <!-- soft violet glow and ripple rings, the app's calm "ripple" motif -->
  <circle cx="1050" cy="315" r="330" fill="url(#glow)"/>
  <circle cx="1050" cy="315" r="95" fill="#F1F0FC"/>
  <circle cx="1050" cy="315" r="170" fill="none" stroke="#C9C6F5" stroke-width="2" stroke-opacity="0.8"/>
  <circle cx="1050" cy="315" r="245" fill="none" stroke="#C9C6F5" stroke-width="2" stroke-opacity="0.45"/>
  <circle cx="1050" cy="315" r="320" fill="none" stroke="#C9C6F5" stroke-width="2" stroke-opacity="0.2"/>
  <g transform="translate(1050 315) scale(1.9) translate(-49 -46)"><path d="${mark}" fill="none" stroke="#3B3790" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></g>
  <!-- small icon + name -->
  <rect x="90" y="84" width="64" height="64" rx="15" fill="url(#tile)"/>
  <g transform="translate(122 116) scale(0.5) translate(-49 -46)"><path d="${mark}" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></g>
  <text x="172" y="128" font-family="${F}" font-size="36" font-weight="700" fill="#1E1B4B" letter-spacing="-0.5">Chelav</text>
  <!-- headline -->
  <text x="90" y="345" font-family="${F}" font-size="86" font-weight="700" fill="#3B3790" letter-spacing="-2">Know what you can</text>
  <text x="90" y="440" font-family="${F}" font-size="86" font-weight="700" fill="#3B3790" letter-spacing="-2">spend today.</text>
  <text x="90" y="520" font-family="${F}" font-size="32" fill="#6B6894">A calm daily spending limit and expense tracker</text>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile('public/og.png');
console.log('wrote public/og.png');
