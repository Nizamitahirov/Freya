import type { Metadata } from 'next';
import { Montserrat, Geist_Mono } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Databyte · Compensation Planning',
  description:
    'Əməkhaqqı büdcəsinin planlaşdırılması, net→gross→supergross hesablaması və çoxpilləli HR review workflow.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az" className={`${montserrat.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
