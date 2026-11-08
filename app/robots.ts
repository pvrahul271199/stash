import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://stash-azure-rho.vercel.app').replace(/\/+$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
