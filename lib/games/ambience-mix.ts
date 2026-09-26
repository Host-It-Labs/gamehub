import { audioAssets } from './audio-catalog.ts';
import type { Ambience } from './ambience.ts';

export type AmbienceMix = { bed?: string; levels: Record<string, number>; spacing: number };
const KEY = 'gamehub.ambience-mixes.v1';
export const defaultMix = (): AmbienceMix => ({ levels: {}, spacing: 1 });

/** Ignore stale paths and malformed storage rather than silencing a world. */
export function cleanMix(ambience: Ambience, value: unknown): AmbienceMix {
  if (!value || typeof value !== 'object') return defaultMix();
  const input = value as Partial<AmbienceMix>, result = defaultMix();
  const alternatives = audioAssets.filter((a) => a.game === ambience.id && a.kind === 'bed');
  if (typeof input.bed === 'string' && alternatives.some((a) => a.src === input.bed)) result.bed = input.bed;
  const sources = [...ambience.beds, ...ambience.events, ...alternatives];
  if (input.levels && typeof input.levels === 'object') for (const { src } of sources) {
    const level = input.levels[src];
    if (typeof level === 'number' && Number.isFinite(level)) result.levels[src] = Math.max(0, Math.min(1, level));
  }
  if (typeof input.spacing === 'number' && Number.isFinite(input.spacing)) result.spacing = Math.max(0.75, Math.min(2.5, input.spacing));
  return result;
}
export function readAmbienceMix(ambience: Ambience) {
  try { return cleanMix(ambience, JSON.parse(localStorage.getItem(KEY) ?? '{}')[ambience.world]); }
  catch { return defaultMix(); }
}
export function saveAmbienceMix(ambience: Ambience, mix: AmbienceMix) {
  try {
    let saved: Record<string, unknown> = {};
    try {
      const previous: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      if (previous && typeof previous === 'object' && !Array.isArray(previous)) saved = previous as Record<string, unknown>;
    } catch { /* Replace only malformed preference storage. */ }
    saved[ambience.world] = cleanMix(ambience, mix);
    localStorage.setItem(KEY, JSON.stringify(saved));
    return true;
  } catch { return false; }
}
export function mixedAmbience(ambience: Ambience, raw: AmbienceMix): Ambience {
  const mix = cleanMix(ambience, raw);
  const alternative = audioAssets.find((a) => a.src === mix.bed);
  const beds = alternative ? [{ src: alternative.src, gain: 0.85, label: alternative.label }] : ambience.beds;
  return {
    ...ambience,
    beds: beds.map((b) => ({ ...b, gain: b.gain * (mix.levels[b.src] ?? 1) })).filter((b) => b.gain > 0),
    events: ambience.events.map((e) => ({ ...e, gain: e.gain * (mix.levels[e.src] ?? 1) })).filter((e) => e.gain > 0),
    gap: [ambience.gap[0] * mix.spacing, ambience.gap[1] * mix.spacing],
  };
}
