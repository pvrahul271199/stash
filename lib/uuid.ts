let lastMs = 0;
let seq = 0;

/**
 * RFC 9562 UUIDv7: 48-bit millisecond timestamp first, so new ids sort after old ones and inserts
 * land at the right edge of Postgres' primary-key btree instead of at random pages (UUIDv4 splits
 * pages and bloats the index on big tables). The 12-bit counter keeps ids from one device strictly
 * increasing within the same millisecond.
 */
export function uuidv7(now: number = Date.now()): string {
  if (now > lastMs) {
    lastMs = now;
    seq = crypto.getRandomValues(new Uint16Array(1))[0] & 0x1ff;
  } else if (++seq > 0xfff) {
    lastMs++;
    seq = 0;
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  const ms = lastMs;
  b[0] = Math.floor(ms / 2 ** 40) & 0xff;
  b[1] = Math.floor(ms / 2 ** 32) & 0xff;
  b[2] = (ms >>> 24) & 0xff;
  b[3] = (ms >>> 16) & 0xff;
  b[4] = (ms >>> 8) & 0xff;
  b[5] = ms & 0xff;
  b[6] = 0x70 | (seq >>> 8);
  b[7] = seq & 0xff;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
