import type { MapId } from './maps.ts';

/** Districts surround the cleared site; the first terrace ring stays intact.
 * Integer coordinates are block centres, half-integers are the old streets. */
export function greenBlock(id: MapId, x: number, z: number, n: number) {
  const away = Math.max(-x, -z, x - n, z - n);
  if (away < 2) return false;
  const stripe = (((x + z * 2) % 4) + 4) % 4;
  return id === 'meadow'
    ? stripe < 2
    : id === 'ridge'
      ? stripe === 0 || away > 4
      : false;
}

export const landscapes = {
  meadow: {
    town: 4.6,
    landmarks: 4,
    storeys: 2,
    moor: '#8b9d63',
    heather: '#aaab72',
    yard: '#9b927c',
    yardLight: '#afa38b',
    cinder: '#a39a7c',
    grass: '#9fab75',
    flags: '#d2c2a0',
    setts: '#827e70',
  },
  harbour: {
    town: 6.2,
    landmarks: 8,
    storeys: 3,
    moor: '#7c8e72',
    heather: '#929781',
    yard: '#95968c',
    yardLight: '#b2afa0',
    cinder: '#a0a293',
    grass: '#8d9a84',
    flags: '#c7c7b0',
    setts: '#6e7e7d',
  },
  ridge: {
    town: 4.8,
    landmarks: 5,
    storeys: 2,
    moor: '#858b65',
    heather: '#9d8493',
    yard: '#9a9387',
    yardLight: '#aaa496',
    cinder: '#a19c8c',
    grass: '#929c7b',
    flags: '#d3cabb',
    setts: '#7f7d7b',
  },
  // Kept solely for old saved matches.
  capital: {
    town: 8,
    landmarks: 9,
    storeys: 3,
    moor: '#7f8a4f',
    heather: '#8d7280',
    yard: '#8f8676',
    yardLight: '#9b927f',
    cinder: '#8a8172',
    grass: '#8f9866',
    flags: '#c4b494',
    setts: '#77716a',
  },
} as const;
