import { qtyLabel } from './eventPlan';

/**
 * The picture a plan is shared as ("Clean card"): drawn on a canvas, so it needs no library and looks the same on every
 * phone. Pure input -> PNG; the caller decides whether to share, save or copy it.
 */
export interface ShareRow { name: string; qty: string; price: number; bought: boolean }
export interface ShareData {
  title: string;
  /** e.g. "Sun, 29 Nov" */
  dateText: string;
  rows: ShareRow[];
  planned: number;
  spent: number;
  toGo: number;
  /** Formats an amount with the user's currency. */
  money: (n: number) => string;
}
export interface ShareOptions {
  /** Draw a line through the names of bought items (they are always ticked). */
  strike: boolean;
}

const INK = '#1E1B4B';
const SOFT = '#625F6A';
const FAINT = '#A5A29C';
const LINE = '#E7E5E1';
const FONT = 'Figtree, system-ui, -apple-system, "Segoe UI", sans-serif';

const W = 720;
const PAD = 48;
const ROW_H = 68;

/**
 * Plain-text version for "Copy as text". One item per line with a blank line between the sections, so it pastes
 * cleanly into WhatsApp, Notes or a message: title, date, items, totals, sign-off.
 */
export function planText(d: ShareData, o: ShareOptions): string {
  const rows = d.rows.map((r) => {
    const mark = r.bought ? '✅' : '⬜';
    const name = r.bought && o.strike ? `~${r.name}~` : r.name;
    const qty = r.qty ? `  ${qtyLabel(r.qty)}` : '';
    const price = r.price > 0 ? `  –  ${d.money(r.price)}` : '';
    return `${mark} ${name}${qty}${price}`;
  });
  const out = [`*${d.title}*`, d.dateText, '', ...rows];
  if (d.planned > 0 || d.spent > 0) {
    out.push('', `Planned: ${d.money(d.planned)}`, `Spent so far: ${d.money(d.spent)}`, `Still to buy: ${d.money(d.toGo)}`);
  }
  out.push('', '– Chelav');
  return out.join('\n');
}

const loadIcon = (): Promise<HTMLImageElement | null> =>
  new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = '/icons/icon-96.png';
  });

export async function renderPlanCanvas(d: ShareData, o: ShareOptions): Promise<HTMLCanvasElement> {
  const icon = await loadIcon();
  const showTotals = d.planned > 0 || d.spent > 0;
  const H = PAD + 120 + d.rows.length * ROW_H + (showTotals ? 210 : 40) + 70;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, W, H);
  g.textBaseline = 'alphabetic';

  const text = (s: string, x: number, y: number, size: number, color: string, weight = 400, align: CanvasTextAlign = 'left', maxW?: number) => {
    g.font = `${weight} ${size}px ${FONT}`;
    g.fillStyle = color;
    g.textAlign = align;
    let t = s;
    if (maxW) while (t.length > 1 && g.measureText(t).width > maxW) t = t.slice(0, -2) + '…';
    g.fillText(t, x, y);
    return g.measureText(t).width;
  };
  const rule = (y: number, dash = false) => {
    g.strokeStyle = LINE;
    g.lineWidth = dash ? 3 : 2;
    g.setLineDash(dash ? [10, 8] : []);
    g.beginPath();
    g.moveTo(PAD, y);
    g.lineTo(W - PAD, y);
    g.stroke();
    g.setLineDash([]);
  };

  const done = d.rows.filter((r) => r.bought).length;
  let y = PAD + 14;
  text(`SHOPPING LIST · ${d.dateText}`.toUpperCase(), PAD, y, 20, FAINT, 600);
  y += 52;
  text(d.title, PAD, y, 48, INK, 600, 'left', W - PAD * 2);
  y += 38;
  text(`${done} of ${d.rows.length} bought`, PAD, y, 24, SOFT);
  y += 26;
  rule(y);

  for (const r of d.rows) {
    const cy = y + ROW_H / 2;
    // tick
    g.beginPath();
    g.arc(PAD + 14, cy, 14, 0, Math.PI * 2);
    if (r.bought) {
      g.fillStyle = INK;
      g.fill();
      g.strokeStyle = '#FFFFFF';
      g.lineWidth = 3.5;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(PAD + 7, cy);
      g.lineTo(PAD + 12.5, cy + 6);
      g.lineTo(PAD + 22, cy - 6);
      g.stroke();
    } else {
      g.strokeStyle = FAINT;
      g.lineWidth = 3;
      g.stroke();
    }
    const fade = r.bought && o.strike;
    const nameW = text(r.name, PAD + 48, cy + 9, 30, fade ? FAINT : INK, 400, 'left', 300);
    if (fade) {
      g.strokeStyle = 'rgba(30,27,75,0.45)';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(PAD + 48, cy + 1);
      g.lineTo(PAD + 48 + nameW, cy + 1);
      g.stroke();
    }
    if (r.qty) text(qtyLabel(r.qty), W - PAD - 150, cy + 8, 26, r.bought ? FAINT : SOFT, 400, 'right');
    if (r.price > 0) {
      const pw = text(d.money(r.price), W - PAD, cy + 9, 30, fade ? FAINT : INK, 400, 'right');
      if (fade) {
        g.strokeStyle = 'rgba(30,27,75,0.45)';
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(W - PAD - pw, cy + 1);
        g.lineTo(W - PAD, cy + 1);
        g.stroke();
      }
    }
    y += ROW_H;
    rule(y);
  }

  if (showTotals) {
    y += 46;
    text('Planned', PAD, y, 26, SOFT);
    text(d.money(d.planned), W - PAD, y, 26, INK, 400, 'right');
    y += 42;
    text('Spent so far', PAD, y, 26, SOFT);
    text(d.money(d.spent), W - PAD, y, 26, INK, 400, 'right');
    y += 28;
    rule(y, true);
    y += 54;
    text('Still to buy', PAD, y, 28, INK, 600);
    text(d.money(d.toGo), W - PAD, y + 4, 48, INK, 600, 'right');
    y += 20;
  }
  if (icon) {
    const size = 44;
    const x = PAD;
    const top = H - PAD - size + 14;
    g.save();
    g.beginPath();
    g.roundRect(x, top, size, size, 11);
    g.clip();
    g.drawImage(icon, x, top, size, size);
    g.restore();
  }
  return c;
}

export const planBlob = async (d: ShareData, o: ShareOptions): Promise<Blob | null> => {
  const c = await renderPlanCanvas(d, o);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
};
