import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const figtree = localFont({
  src: [
    {
      path: './fonts/figtree-latin-ext-wght-normal.woff2',
      weight: '300 900',
      style: 'normal',
    },
    {
      path: './fonts/figtree-latin-wght-normal.woff2',
      weight: '300 900',
      style: 'normal',
    },
  ],
  variable: '--font-sans',
  weight: '300 900',
  display: 'swap',
});

const ORIGIN = 'https://urbana-five.vercel.app';
const DESC = 'Registre e acompanhe ocorrências urbanas em Braço do Norte.';

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: 'Urbana',
  description: DESC,
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Urbana',
    title: 'Urbana',
    description: DESC,
    url: `${ORIGIN}/`,
    images: [{ url: `${ORIGIN}/og-image.png`, width: 600, height: 600 }],
  },
  twitter: { card: 'summary' },
};

export const viewport: Viewport = { themeColor: '#F7F8FA' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${figtree.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
