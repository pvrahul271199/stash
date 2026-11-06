import type { Meta } from '@storybook/react-vite';
import { DESIGNS, D1QuietPill, D2Sheet, D3TrustCard, D4HeroSplit, D5Steps, D6Dock, D7Ink, D8DoDont, D9Chip, D10Connector } from './designs';

/**
 * Ten proposals for Google-only sign-in (no username, no password). The message in every one: Google is the easiest way in,
 * and we only take your name and email. Open "Gallery" to compare them side by side, or any single story for full size.
 */
const meta: Meta = { title: 'Auth/Google only', parameters: { layout: 'fullscreen' } };
export default meta;

export const Gallery = () => (
  <div className="min-h-screen bg-[#EFEDEA] p-8">
    <h1 className="font-display text-[28px] font-semibold text-ink">Google-only sign-in: 10 designs</h1>
    <p className="mt-1 max-w-[640px] text-[14px] text-soft">The easiest way in is Google. We only take name and email. Each screen is shown at half size; open the numbered story for full size.</p>
    <div className="mt-8 grid gap-x-8 gap-y-12" style={{ gridTemplateColumns: 'repeat(auto-fill, 210px)' }}>
      {DESIGNS.map(({ id, name, note, Component }) => (
        <figure key={id} className="m-0 w-[210px]">
          <div style={{ width: 195, height: 390 }}>
            <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 390, height: 780 }}>
              <Component />
            </div>
          </div>
          <figcaption className="mt-3">
            <p className="text-[13px] font-semibold text-ink"><span className="text-faint">{id}.</span> {name}</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-soft">{note}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  </div>
);
Gallery.parameters = { layout: 'fullscreen' };

const centered = { parameters: { layout: 'centered' } };
export const D01_QuietPill = Object.assign(() => <D1QuietPill />, centered);
export const D02_OneTapSheet = Object.assign(() => <D2Sheet />, centered);
export const D03_TrustCard = Object.assign(() => <D3TrustCard />, centered);
export const D04_HeroSplit = Object.assign(() => <D4HeroSplit />, centered);
export const D05_ThreeTinySteps = Object.assign(() => <D5Steps />, centered);
export const D06_FloatingDock = Object.assign(() => <D6Dock />, centered);
export const D07_InkFullBleed = Object.assign(() => <D7Ink />, centered);
export const D08_WeTakeNeverTake = Object.assign(() => <D8DoDont />, centered);
export const D09_AccountChip = Object.assign(() => <D9Chip />, centered);
export const D10_Connector = Object.assign(() => <D10Connector />, centered);
