import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Compensation Planning Tool',
  description:
    'Əməkhaqqı büdcəsinin planlaşdırılması, net→gross→supergross hesablaması və çoxpilləli HR review workflow.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}
