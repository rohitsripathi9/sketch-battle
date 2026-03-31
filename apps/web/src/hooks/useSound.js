import { useRef, useCallback } from 'react';

const SOUNDS = {
  correctGuess: { frequency: 880, duration: 150, type: 'sine' },
  wrongGuess: { frequency: 220, duration: 100, type: 'square' },
  roundStart: { frequency: 660, duration: 200, type: 'sine' },
  roundEnd: { frequency: 440, duration: 300, type: 'triangle' },
  timerLow: { frequency: 550, duration: 80, type: 'square' },
  wordReveal: { frequency: 1046, duration: 250, type: 'sine' },
  gameOver: { frequency: 523, duration: 500, type: 'triangle' },
};

export function useSound() {
  const ctxRef = useRef(null);

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      try {
        ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch { return null; }
    }
    return ctxRef.current;
  }, []);

  const play = useCallback((soundName) => {
    const ctx = getContext();
    if (!ctx) return;

    const sound = SOUNDS[soundName];
    if (!sound) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = sound.type;
      osc.frequency.value = sound.frequency;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + sound.duration / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + sound.duration / 1000);
    } catch { /* audio not available */ }
  }, [getContext]);

  return { play };
}
