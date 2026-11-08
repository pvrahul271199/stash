import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-bricolage',
  display: 'swap',
});
const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-figtree',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Chelav: Daily Spending Limit & Expense Tracker',
  description:
    'Know how much you can spend today. Chelav turns your income, bills and savings into one daily spending limit, and adjusts it as you spend. Free, private, works offline.',
  applicationName: 'Chelav',
  keywords: ['daily spending limit', 'expense tracker', 'daily budget app', 'how much can I spend today', 'budget tracker'],
  openGraph: {
    type: 'website',
    siteName: 'Chelav',
    url: '/',
    title: 'Chelav: know what you can spend today',
    description: 'One calm number a day: what you can still spend. No bank linking, works offline.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Chelav: know what you can spend today' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chelav: know what you can spend today',
    description: 'One calm number a day: what you can still spend. No bank linking, works offline.',
    images: ['/og.png'],
  },
  appleWebApp: { capable: true, title: 'Chelav', statusBarStyle: 'default' },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.chelav.app'),
  alternates: { canonical: '/' },
  icons: {
    // Stable, un-hashed URLs; sizes are multiples of 48px so Google Search accepts them.
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icons/icon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFFFFF',
  colorScheme: 'light', // the page is light only: stops a dark-mode phone painting the canvas dark before our CSS loads
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${figtree.variable}`} style={{ background: '#ffffff' }}>
      <body suppressHydrationWarning>
        <div className="app-frame">
          <div className="app-root">{children}</div>
        </div>
      </body>
    </html>
  );
}
