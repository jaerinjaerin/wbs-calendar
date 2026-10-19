'use client';

import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)'; // Tailwind md breakpoint

// false on the server and first client render, then follows the media query
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}
