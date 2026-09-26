'use client';
import { Moon, Sun } from 'lucide-react';
import { setTheme, useTheme } from '@/lib/theme';
import { SoundToggle } from './sound-settings';

/** The library bar's light/dark button on wide screens. */
export function ThemeButton({ className = '' }: { className?: string }) {
  const theme = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={className}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label="Dark mode"
      aria-pressed={dark}
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}

/** The same choice as a row in a menu, beside the sound switches. */
export function ThemeSwitch() {
  const dark = useTheme() === 'dark';
  return (
    <SoundToggle
      Icon={Moon}
      label="Dark mode"
      on={dark}
      onChange={(on) => setTheme(on ? 'dark' : 'light')}
    />
  );
}
