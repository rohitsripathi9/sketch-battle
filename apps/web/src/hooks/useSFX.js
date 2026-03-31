import { useCallback, useEffect, useRef, useState } from 'react';

// Maps action names to audio file paths
const SFX_MAP = {
  click: '/audio/JDSherbert - Wooden UI SFX Pack - Select - 1.mp3',
  confirm: '/audio/JDSherbert - Wooden UI SFX Pack - Confirm - 1.mp3',
  cancel: '/audio/JDSherbert - Wooden UI SFX Pack - Cancel - 1.mp3',
  error: '/audio/JDSherbert - Wooden UI SFX Pack - Error - 1.mp3',
  success: '/audio/JDSherbert - Wooden UI SFX Pack - Confirm - 1.mp3',
  victory: '/audio/victory.mpeg',
  defeat: '/audio/defeat.mpeg',
};

export function useSFX() {
  const [isMuted, setIsMuted] = useState(false);
  const audioCache = useRef({});

  // Initialize and preload audio objects
  useEffect(() => {
    // Load mute preference from storage
    const saved = localStorage.getItem('sfx_muted');
    if (saved === 'true') setIsMuted(true);

    // Preload audio objects
    Object.entries(SFX_MAP).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audioCache.current[key] = audio;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newVal = !prev;
      localStorage.setItem('sfx_muted', String(newVal));
      return newVal;
    });
  }, []);

  const playSFX = useCallback((action) => {
    if (isMuted) return;
    const audio = audioCache.current[action];
    if (audio) {
      // Clone the node to allow overlapping identical sounds (e.g. rapid clicking)
      const clone = audio.cloneNode();
      clone.volume = 0.5; // default volume
      clone.play().catch(err => {
        // Ignore playback errors (e.g., user hasn't interacted with document yet)
        console.warn('SFX playback failed:', err);
      });
    }
  }, [isMuted]);

  return { playSFX, isMuted, toggleMute };
}
