import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Self-hosted with only the weights the app uses. S-Core Dream numbers its files one step heavier
// than usual: its "6Bold" file is what renders font-semibold (600). font-bold (700) falls back to it too.
const sans = localFont({
  src: [
    { path: './fonts/S-CoreDream-4Regular.woff', weight: '400' },
    { path: './fonts/S-CoreDream-5Medium.woff', weight: '500' },
    { path: './fonts/S-CoreDream-6Bold.woff', weight: '600' },
  ],
  variable: '--font-sans',
  display: 'swap',
});

// titles and emphasis only (font-display), which are all 600
const display = localFont({
  src: './fonts/Paperlogy-6SemiBold.woff2',
  weight: '600',
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'WBS 캘린더', template: '%s · WBS 캘린더' },
  description: '팀 프로젝트 WBS 캘린더',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
