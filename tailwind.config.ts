import type { Config } from 'tailwindcss';
import { colors } from './theme/tokens';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { ...colors },
      fontFamily: {
        display: ['var(--font-bricolage)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-figtree)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { btn: '16px', key: '14px', note: '14px', phone: '40px' },
      fontSize: {
        huge: ['72px', { lineHeight: '1', letterSpacing: '-0.02em' }],
        big: ['44px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        question: ['26px', { lineHeight: '1.25' }],
        section: ['17px', { lineHeight: '1.3' }],
        body: ['15px', { lineHeight: '1.5' }],
      },
    },
  },
  plugins: [],
};

export default config;
