import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const SFX_MAP = {
  click: '/audio/JDSherbert - Wooden UI SFX Pack - Select - 1.mp3',
  confirm: '/audio/JDSherbert - Wooden UI SFX Pack - Confirm - 1.mp3',
  cancel: '/audio/JDSherbert - Wooden UI SFX Pack - Cancel - 1.mp3',
  error: '/audio/JDSherbert - Wooden UI SFX Pack - Error - 1.mp3',
  success: '/audio/JDSherbert - Wooden UI SFX Pack - Confirm - 1.mp3',
  victory: '/audio/victory.mpeg',
  defeat: '/audio/defeat.mpeg',
};

const SFXContext = createContext({
  isMuted: false,
  toggleMute: () => {},
  playSFX: () => {},
});

export function SFXProvider({ children }) {
  const [isMuted, setIsMuted] = useState(false);
  const audioCache = useRef({});

  useEffect(() => {
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
      const clone = audio.cloneNode();
      clone.volume = 0.5;
      clone.play().catch(e => console.warn('SFX skipped', e));
    }
  }, [isMuted]);

  return (
    <SFXContext.Provider value={{ isMuted, toggleMute, playSFX }}>
      {children}
    </SFXContext.Provider>
  );
}

export function useSFX() {
  return useContext(SFXContext);
}
