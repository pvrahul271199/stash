import { FAQ } from './AboutChelav';

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.chelav.app').replace(/\/+$/, '');

function Script({ data }: { data: unknown }) {
  // "<" is escaped so the JSON can never close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

/** Homepage structured data: the app and the organisation behind it. */
export function JsonLd() {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Chelav',
      url: `${SITE}/`,
      description: 'A calm expense tracker built around one question: how much can I spend today?',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Any (web, installable on iOS and Android)',
      browserRequirements: 'Requires JavaScript',
      image: `${SITE}/og.png`,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Chelav',
      url: `${SITE}/`,
      logo: `${SITE}/icons/icon-512.png`,
    }
  ];
  return <Script data={data} />;
}

/** /about/ structured data: the FAQ that page shows. */
export function FaqJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  return <Script data={data} />;
}
