import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './bento.css';
import './restored-ui.css';

const brandFont = localFont({ src: './fonts/SpaceGrotesk-Bold.ttf', weight: '700', style: 'normal', display: 'swap', variable: '--font-brand' });

export const metadata: Metadata = {
  title: 'MON-Nest',
  description: 'Rent homes through Monad Testnet escrow that protects rent and deposits, or book one of twelve free 0 MON stays.',
  metadataBase: new URL('https://mon-nest.vercel.app'),
  icons: {
    icon: { url: '/brand/mon-nest-logo.png', type: 'image/png', sizes: '2000x2000' },
    apple: { url: '/brand/mon-nest-logo.png', type: 'image/png', sizes: '2000x2000' },
  },
  openGraph: {
    title: 'MON-Nest',
    description: 'Escrow-protected testnet rentals and twelve free 0 MON stays with shared onchain availability.',
    images: ['/homes/hero-home.jpg'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={brandFont.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
