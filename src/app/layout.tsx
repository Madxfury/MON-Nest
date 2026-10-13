import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MON-Nest — Rent without the trust gap',
  description: 'Rent homes through Monad Testnet escrow that protects rent and deposits, or book one of twelve free 0 MON stays.',
  metadataBase: new URL('https://mon-nest.vercel.app'),
  openGraph: {
    title: 'MON-Nest',
    description: 'Escrow-protected testnet rentals and twelve free 0 MON stays with shared onchain availability.',
    images: ['/homes/hero-home.jpg'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
