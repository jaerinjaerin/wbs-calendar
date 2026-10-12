import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WBS 캘린더',
  description: '팀 프로젝트 WBS 캘린더',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
