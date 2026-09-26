import optionA from './audio-option-a.json' with { type: 'json' };
import optionB from './audio-option-b.json' with { type: 'json' };
import optionC from './audio-option-c.json' with { type: 'json' };
import variants from './audio-round2-variants.json' with { type: 'json' };
import placements from './audio-round2-place.json' with { type: 'json' };
import finales from './audio-round2-scores.json' with { type: 'json' };
import { sharedAudioAssets, type GlobalAudioAsset, type SharedSoundCategory } from './audio-catalog.ts';

export type AudioOption = GlobalAudioAsset & {
  option: 'a' | 'b' | 'c' | 'd' | 'e' | 'f';
  preferred?: boolean;
};

/** Audition candidates only. Gameplay keeps using the selected shared catalog. */
const markSelected = (a: AudioOption): AudioOption => ({ ...a, preferred: sharedAudioAssets.some((selected) => selected.id === a.id) });
export const earlierAudioOptions = ([...optionA, ...optionB, ...optionC] as AudioOption[]).map(markSelected);
const references = earlierAudioOptions.filter((a) => (a.category === 'pickup' && a.option === 'b') || (a.category === 'turn' && a.option === 'c'));
export const audioOptions = ([...references, ...variants, ...placements, ...finales] as AudioOption[]).map(markSelected);
export const sharedSoundActions: { category: SharedSoundCategory; label: string }[] = [
  { category: 'pickup', label: 'Pick up' },
  { category: 'place', label: 'Place' },
  { category: 'turn', label: 'Your turn' },
  { category: 'scores', label: 'Final scores' },
];
