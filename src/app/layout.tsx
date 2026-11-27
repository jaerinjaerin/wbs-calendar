import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// One family for the whole app (Paperozi/Paperlogy), told apart by weight: 400 body, 500 labels, 600 titles.
// ponytail: each CSS weight is served one file lighter (400→Light, 500→Regular, 600→Medium) so the whole app
// reads thinner without touching every font-* class. To go back, point each weight at its same-named file.
// font-bold (700) falls back to the 600 slot.
const paperozi = localFont({
  src: [
    { path: './fonts/Paperlogy-3Light.woff2', weight: '400' },
    { path: './fonts/Paperlogy-4Regular.woff2', weight: '500' },
    { path: './fonts/Paperlogy-5Medium.woff2', weight: '600' },
  ],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'WBS 캘린더', template: '%s · WBS 캘린더' },
  description: '팀 프로젝트 WBS 캘린더',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={paperozi.variable}>
      <body>{children}</body>
    </html>
  );
}
