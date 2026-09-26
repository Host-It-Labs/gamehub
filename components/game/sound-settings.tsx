'use client';
import { useId } from 'react';
import { Trees, Volume2, type LucideIcon } from 'lucide-react';
import { Switch } from '../ui/switch';
import { DEFAULT_AMBIENCE } from './use-ambience';

export const DEFAULT_VOLUME = 0.5;

/** The sound panel: effects and the world around the table, each on or off.
 *  Turning both off is muting. */
export function SoundSettings({
  volume,
  ambience,
  onVolume,
  onAmbience,
}: {
  volume: number;
  ambience: number;
  onVolume: (level: number) => void;
  onAmbience: (level: number) => void;
}) {
  return (
    <div className="sound-settings">
      <SoundToggle
        Icon={Volume2}
        label="Sound effects"
        on={volume > 0}
        onChange={(on) => onVolume(on ? DEFAULT_VOLUME : 0)}
      />
      <SoundToggle
        Icon={Trees}
        label="Ambient sound"
        on={ambience > 0}
        onChange={(on) => onAmbience(on ? DEFAULT_AMBIENCE : 0)}
      />
      <a className="sound-lab-link" href="/sound-lab">Sound Lab <span aria-hidden="true">↗</span></a>
    </div>
  );
}

/** One labelled on/off row; the theme switch shares it. */
export function SoundToggle({
  Icon,
  label,
  on,
  onChange,
}: {
  Icon: LucideIcon;
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <label className="sound-toggle" htmlFor={id}>
      <Icon aria-hidden="true" />
      <span className="sound-toggle-label">{label}</span>
      <Switch id={id} checked={on} onCheckedChange={onChange} />
    </label>
  );
}
