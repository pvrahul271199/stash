import { AppShell } from '@/components/AppShell';
import { JsonLd } from '@/components/seo/JsonLd';

export default function Home() {
  return (
    <>
      <AppShell />
      <JsonLd />
      {/* The app draws itself on the client, so this puts the same words as the Welcome screen into the static HTML for search
          engines and screen readers. Visually hidden, never shown. */}
      <section className="sr-only">
        <h1>Chelav: know what you can spend today</h1>
        <p>
          Chelav is a calm expense tracker and daily spending limit. Tell it your monthly income, bills and savings once, and every
          day you get one number: what you can still spend. No bank linking, works offline.
        </p>
        <nav aria-label="More about Chelav">
          <a href="/about/">About Chelav and how it works</a> · <a href="/privacy/">Privacy policy</a> · <a href="/terms/">Terms of use</a>
        </nav>
      </section>
    </>
  );
}
