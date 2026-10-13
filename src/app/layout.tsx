import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MON-Nest — Rent without the trust gap',
  description: 'Explore homes and make verifiable 0 MON testnet bookings with shared availability on Monad.',
  metadataBase: new URL('https://mon-nest.vercel.app'),
  openGraph: {
    title: 'MON-Nest',
    description: '48 illustrative 0 MON testnet booking homes with shared onchain availability.',
    images: ['/homes/hero-home.jpg'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
