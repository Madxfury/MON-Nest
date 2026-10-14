import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './bento.css';
import './site.css';

const brandFont = localFont({ src: './fonts/SpaceGrotesk-Bold.ttf', weight: '700', style: 'normal', display: 'swap', variable: '--font-brand' });

export const metadata: Metadata = {
  title: 'MON-Nest',
  description: 'Explore 68 illustrative homes and make verifiable 0 MON testnet bookings with shared availability on Monad.',
  metadataBase: new URL('https://mon-nest.vercel.app'),
  icons: {
    icon: { url: '/brand/mon-nest-logo.png', type: 'image/png', sizes: '2000x2000' },
    apple: { url: '/brand/mon-nest-logo.png', type: 'image/png', sizes: '2000x2000' },
  },
  openGraph: {
    title: 'MON-Nest',
    description: '68 illustrative 0 MON testnet booking homes with shared onchain availability.',
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
