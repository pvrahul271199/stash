import path from 'node:path';
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  viteFinal: async (cfg) => {
    // lib/* reads process.env (Next inlines it); Vite doesn't, so stub it for Storybook.
    cfg.define = { ...(cfg.define ?? {}), 'process.env': {} };
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.alias = { ...(cfg.resolve.alias as object), '@': path.resolve(import.meta.dirname, '..') };
    return cfg;
  },
};
export default config;
