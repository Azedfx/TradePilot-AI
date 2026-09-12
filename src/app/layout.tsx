import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TradePilot AI',
  description: 'AI-powered crypto research and trade theses',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
