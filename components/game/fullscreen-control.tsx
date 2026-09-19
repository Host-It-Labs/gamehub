'use client';
import { useEffect, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';

/** Fullscreen state and toggle, shared by the standalone button and menu entries. */
export function useFullscreen() {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const sync = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    const frame = requestAnimationFrame(() => {
      sync();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('fullscreenchange', sync);
    };
  }, []);
  async function toggle() {
    setMessage('');
    if (!document.fullscreenElement && !document.documentElement.requestFullscreen) {
      setMessage('This browser cannot enter fullscreen. Rotate your device for a wider view.');
      return;
    }
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        screen.orientation?.unlock?.();
      } else {
        await document.documentElement.requestFullscreen();
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (mode: string) => Promise<void>;
        };
        if (window.matchMedia('(pointer: coarse)').matches) {
          try {
            if (orientation?.lock) await orientation.lock('landscape');
          } catch {
            // Fullscreen still works if this device cannot lock orientation.
          }
        }
      }
    } catch {
      setMessage('Fullscreen is unavailable. You can continue playing here.');
    }
  }
  return { active, message, toggle };
}

export function FullscreenControl() {
  const { active, message, toggle } = useFullscreen();
  return (
    <>
      <button type="button" className="icon-button game-fullscreen" onClick={() => void toggle()}
        aria-label={active ? 'Exit fullscreen' : 'Play fullscreen'} title={active ? 'Exit fullscreen' : 'Play fullscreen'}>
        {active ? <Minimize size={18} /> : <Maximize size={18} />}
      </button>
      {message && <output className="fullscreen-message">{message}</output>}
    </>
  );
}
