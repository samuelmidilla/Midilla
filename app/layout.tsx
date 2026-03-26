import type { Metadata } from 'next';
import { Syne, Lora, Inconsolata } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
  display: 'swap',
});

const inconsolata = Inconsolata({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MIDILLA',
  description:
    'The content production system for professional service operators who need expert-grade written outputs without managing the production infrastructure.',
  openGraph: {
    title: 'MIDILLA',
    description: 'Expert-grade content. Delivered.',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: 'MIDILLA',
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${lora.variable} ${inconsolata.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
