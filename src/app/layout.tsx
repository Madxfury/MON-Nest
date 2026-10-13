import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MON-Nest — Rent without the trust gap',
  description: 'Verified rentals, protected payments, and community resolution on Monad.',
  metadataBase: new URL('https://mon-nest.vercel.app'),
  openGraph: {
    title: 'MON-Nest',
    description: 'Verified rentals. Protected payments. Fair outcomes.',
    images: ['/homes/hero-home.jpg'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
