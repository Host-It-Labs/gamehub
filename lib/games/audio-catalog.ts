import assets from './audio-assets.json' with { type: 'json' };
import sharedAssets from './global-audio-assets.json' with { type: 'json' };

export type SoundGame = 'undertow' | 'wildgrove' | 'midnight' | 'orin' | 'miro' | 'folio' | 'relic';
export type AudioAsset = {
  id: string;
  game: SoundGame;
  kind: 'bed' | 'detail' | 'effect';
  category: string;
  label: string;
  src: string;
  duration: number;
  loop: boolean;
  gain: number;
};
export const audioAssets = assets as AudioAsset[];
export type SharedSoundCategory = 'pickup' | 'place' | 'turn' | 'scores';
export type GlobalAudioAsset = {
  id: string;
  category: SharedSoundCategory;
  label: string;
  src: string;
  duration: number;
  gain: number;
};
/** Shared gameplay cues; the per-game recordings above remain Sound Lab archives. */
export const sharedAudioAssets = sharedAssets as GlobalAudioAsset[];
export const soundGames: { id: SoundGame; name: string; material: string }[] = [
  { id: 'undertow', name: 'Nox', material: 'Timber, cards & brass' },
  { id: 'wildgrove', name: 'Mora', material: 'Paper, wood & woodland' },
  { id: 'midnight', name: 'Yata', material: 'Ceramic, bamboo & cooking' },
  { id: 'orin', name: 'Know Me', material: 'Warm studio buttons & cards' },
  { id: 'miro', name: 'Quiz', material: 'Measuring tools & enamel' },
  { id: 'folio', name: 'Folio', material: 'Pages, pencils & stamps' },
  { id: 'relic', name: 'Lucky', material: 'Foil, tickets & coins' },
];
export function soundGame(id: string): SoundGame | undefined {
  if (id === 'dial') return 'orin';
  if (id === 'size') return 'miro';
  return soundGames.find((game) => game.id === id)?.id;
}

export function effectFor(_id: string, kind: string, _variant = 0) {
  const category: SharedSoundCategory = ['tap', 'pickup', 'select'].includes(kind) ? 'pickup'
    : kind === 'turn' ? 'turn'
    : kind === 'scores' ? 'scores' : 'place';
  return sharedAudioAssets.find((asset) => asset.category === category);
}
