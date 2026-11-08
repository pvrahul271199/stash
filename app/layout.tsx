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
  title: 'Chelav - What can I spend today?',
  description: 'A calm expense tracker built around one question: how much can I spend today?',
  appleWebApp: { capable: true, title: 'Chelav', statusBarStyle: 'default' },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.chelav.app'),
  alternates: { canonical: '/' },
  icons: {
    // Stable, un-hashed URLs; sizes are multiples of 48px so Google Search accepts them.
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
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
