import { useState, useEffect, useRef } from 'react';

export function useTimer(timerEndMs) {
  const [remainingMs, setRemainingMs] = useState(0);
  const [fraction, setFraction] = useState(1);
  const totalRef = useRef(0);

  useEffect(() => {
    if (!timerEndMs) {
      setRemainingMs(0);
      setFraction(1);
      return;
    }

    const now = Date.now();
    if (totalRef.current === 0) {
      totalRef.current = timerEndMs - now;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, timerEndMs - Date.now());
      setRemainingMs(remaining);
      setFraction(totalRef.current > 0 ? remaining / totalRef.current : 0);

      if (remaining <= 0) clearInterval(interval);
    }, 100);

    return () => {
      clearInterval(interval);
      totalRef.current = 0;
    };
  }, [timerEndMs]);

  const seconds = Math.ceil(remainingMs / 1000);
  const isLow = seconds <= 10 && seconds > 0;

  return { remainingMs, seconds, fraction, isLow };
}
