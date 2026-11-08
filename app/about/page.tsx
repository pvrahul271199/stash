import type { Metadata } from 'next';
import { AboutChelav } from '@/components/seo/AboutChelav';
import { FaqJsonLd } from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'About Chelav: how the daily spending limit works',
  description:
    'How Chelav turns your income, bills and savings into one daily spending limit, what you can do with it, and answers to common questions.',
  alternates: { canonical: '/about/' },
};

export default function AboutPage() {
  return (
    <>
      <FaqJsonLd />
      <AboutChelav />
    </>
  );
}
