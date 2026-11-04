import type { Preview } from '@storybook/react-vite';
import '../app/globals.css';

// Mirror next/font variables from app/layout.tsx (fonts are loaded in preview-head.html).
document.documentElement.style.setProperty('--font-bricolage', "'Bricolage Grotesque'");
document.documentElement.style.setProperty('--font-figtree', "'Figtree'");

const preview: Preview = {
  parameters: { layout: 'centered', backgrounds: { default: 'frame', values: [{ name: 'frame', value: '#EFEDEA' }, { name: 'white', value: '#FFFFFF' }] } },
};
export default preview;
