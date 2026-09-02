import type { Metadata } from 'next';
import { Geist_Mono, Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-montserrat',
});

// SRS §15.2: rəqəmlər/mono üçün Geist Mono.
const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Compensation Planning Tool',
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
