import type { Metadata } from 'next';
import { JoinRedirect } from '@/components/splits/JoinRedirect';

export const metadata: Metadata = {
  title: 'Join a group on Chelav',
  robots: { index: false, follow: false },
};

export default function JoinPage() {
  return <JoinRedirect />;
}
