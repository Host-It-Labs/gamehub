import assets from './audio-assets.json' with { type: 'json' };

/** The recorded ambience: Nox, Mora and Yata's background beds and the
 *  occasional details over them. Sound effects are synthesised instead
 *  (`lib/games/sound`). */
export type AudioAsset = {
  id: string;
  game: 'undertow' | 'wildgrove' | 'midnight';
  kind: 'bed' | 'detail';
  category: string;
  label: string;
  src: string;
  duration: number;
  loop: boolean;
  gain: number;
};
export const audioAssets = assets as AudioAsset[];
