import localFont from 'next/font/local';

// Sidebar and calendar-grid text (Pretendard 1.3.9). Uses the KS X 1001 subset (2,350 common Hangul
// syllables + Latin, ~270KB per weight); rarer syllables fall back to Paperozi via the font stack.
// Used only by ProjectCalendar, so the files preload on the calendar page, not on home or settings.
export const pretendard = localFont({
  src: [
    { path: './Pretendard-Regular.subset.woff2', weight: '400' },
    { path: './Pretendard-Medium.subset.woff2', weight: '500' },
    { path: './Pretendard-SemiBold.subset.woff2', weight: '600' },
  ],
  variable: '--font-pretendard',
  display: 'swap',
});
