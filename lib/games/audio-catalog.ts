import assets from './audio-assets.json' with { type: 'json' };
import candidates from './audio-candidates.json' with { type: 'json' };
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
/** Universal turn and scores; legacy actions remain available as fallbacks. */
export const sharedAudioAssets = sharedAssets as GlobalAudioAsset[];
export const soundGames: { id: SoundGame; name: string; material: string }[] = [
  { id: 'undertow', name: 'Nox', material: 'Timber, cards & brass' },
  { id: 'wildgrove', name: 'Mora', material: 'Paper, wood & woodland' },
  { id: 'midnight', name: 'Yata', material: 'Ceramic, bamboo & cooking' },
  { id: 'orin', name: 'Know Me', material: 'Warm studio buttons & cards' },
  { id: 'miro', name: 'Trivia', material: 'Measuring tools & enamel' },
  { id: 'folio', name: 'Puzzles', material: 'Pages, pencils & stamps' },
  { id: 'relic', name: 'Lucky', material: 'Foil, tickets & coins' },
];
export function soundGame(id: string): SoundGame | undefined {
  if (id === 'dial' || id === 'coins' || id === 'impostor') return 'orin';
  if (id === 'size' || id === 'year' || id === 'order') return 'miro';
  return soundGames.find((game) => game.id === id)?.id;
}

export type SoundCandidate = GlobalAudioAsset & { game: SoundGame | 'party' | 'global'; option: string };
export const soundCandidates = candidates as SoundCandidate[];

export function effectFor(id: string, kind: string, _variant = 0) {
  if (id === 'folio' && ['tap', 'pickup', 'select', 'move'].includes(kind)) return undefined;
  const category: SharedSoundCategory = ['tap', 'pickup', 'select'].includes(kind) ? 'pickup'
    : kind === 'turn' ? 'turn'
    : kind === 'scores' ? 'scores' : 'place';
  const game = soundGame(id);
  const family = game === 'orin' || game === 'miro' || game === 'folio' ? 'party' : game;
  return soundCandidates.find((asset) => asset.game === family && asset.category === category && asset.option === 'a')
    ?? sharedAudioAssets.find((asset) => asset.category === category);
}
