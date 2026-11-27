import localFont from 'next/font/local';

// Sidebar and calendar-grid text (느좋체). ~800KB per file, so it's defined here and used only by
// ProjectCalendar: the files preload on the calendar page, not on home or settings.
// Weights: up to 500 (body, font-medium) render with R; 600+ (font-semibold/bold) with B.
export const neujoh = localFont({
  src: [
    { path: './Neujoh-R.woff2', weight: '400' },
    { path: './Neujoh-B.woff2', weight: '700' },
  ],
  variable: '--font-neujoh',
  display: 'swap',
});
