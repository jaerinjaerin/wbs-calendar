import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WBS Calendar',
  description: '프로젝트 WBS 관리 캘린더',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
