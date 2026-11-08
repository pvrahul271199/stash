import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.chelav.app').replace(/\/+$/, '');

// Bump when the page content changes; the legal pages carry their own "last updated" date.
const PAGES: { path: string; lastModified: string }[] = [
  { path: '/', lastModified: '2026-11-08' },
  { path: '/about/', lastModified: '2026-11-08' },
  { path: '/privacy/', lastModified: '2026-11-06' },
  { path: '/terms/', lastModified: '2026-11-06' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, lastModified }) => ({ url: `${SITE}${path}`, lastModified }));
}
