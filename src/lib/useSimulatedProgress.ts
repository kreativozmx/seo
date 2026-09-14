"use client";

import { useRef, useState } from "react";

// Drives a 0-100 progress value that eases toward 90% while an async task
// runs (we don't get real progress events from these APIs), then snaps to
// 100% when `finish()` is called. Returns [percent, start, finish].
export function useSimulatedProgress() {
  const [percent, setPercent] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function start(initial = 8) {
    setPercent(initial);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setPercent((p) => (p < 90 ? p + (90 - p) * 0.15 : p));
    }, 400);
  }

  function finish() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setPercent(100);
  }

  return { percent, start, finish };
}
