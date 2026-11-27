'use client';

import { useEffect, useState } from 'react';

// Whether the device has a touchscreen, regardless of screen width (iPad Safari reports itself as a Mac,
// but still reports its touch points). false on the server and first client render, then fixed for the session.
export function useHasTouch(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(navigator.maxTouchPoints > 0), []);
  return touch;
}
