import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TradePilot AI',
  description:
    'AI-powered research desk for US stocks and tokenized equities (rTokens)',
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
