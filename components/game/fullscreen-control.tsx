'use client';
import { useEffect, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { isPhone, lockPortrait, optOutOfFullscreen } from './mobile-viewport';

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
    if (
      !document.fullscreenElement &&
      !document.documentElement.requestFullscreen
    ) {
      setMessage('This browser cannot enter fullscreen.');
      return;
    }
    try {
      if (document.fullscreenElement) {
        optOutOfFullscreen();
        await document.exitFullscreen();
        screen.orientation?.unlock?.();
      } else {
        await document.documentElement.requestFullscreen();
        // Phones play upright; see mobile-viewport.tsx.
        if (isPhone()) await lockPortrait();
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
      <button
        type="button"
        data-fullscreen-toggle
        className="icon-button game-fullscreen"
        onClick={() => void toggle()}
        aria-label={active ? 'Exit fullscreen' : 'Play fullscreen'}
        title={active ? 'Exit fullscreen' : 'Play fullscreen'}
      >
        {active ? <Minimize size={18} /> : <Maximize size={18} />}
      </button>
      {message && <output className="fullscreen-message">{message}</output>}
    </>
  );
}
