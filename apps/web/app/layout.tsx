import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Xmarket — Trade Everything',
  description: 'Perpetual sentiment exchange where price reflects collective belief.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
