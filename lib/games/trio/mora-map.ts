import { paperWorldFor } from '../mora-world.ts';

/** Percent coordinates on the sanctuary illustration. Keep tokens on painted nests. */
export type MoraHabitatArt = {
  zone: number;
  bounds: [number, number, number, number];
  label: [number, number];
  slots: [number, number][];
  tokenWidth: number;
  summary: string;
};
/** Scene, pad targets and labels are measured on each independently authored source. */
export function observatoryMap(portrait = false, overview = false) {
  const art = paperWorldFor(portrait);
  const crop = overview ? art.overview : art.crop;
  const point = ([x, y]: number[]): [number, number] => [
    (x - crop.left) / crop.width * 100, (y - crop.top) / crop.height * 100,
  ];
  return {
    image: overview ? art.overviewImage : art.boardImage,
    habitats: art.habitats.map((h): MoraHabitatArt => ({
      ...h, bounds: [...point(h.bounds), h.bounds[2] / crop.width * 100, h.bounds[3] / crop.height * 100],
      label: point(h.label), slots: h.slots.map(point), tokenWidth: h.tokenWidth / crop.width * 100,
    })),
  };
}
export const moraMap = observatoryMap();
export const coastalMap = {
  image: '/art/optimized/floodline-paper-v1.webp',
  habitats: [
    {
      zone: 0,
      bounds: [13, 6, 31, 29],
      label: [28, 32],
      slots: [
        [20, 12],
        [32, 13],
        [21, 23],
        [33, 23],
      ],
      tokenWidth: 8.8,
      summary: '9 per exact pair · other groups 0',
    },
    {
      zone: 1,
      bounds: [56, 9, 32, 30],
      label: [72, 36],
      slots: [
        [65, 15],
        [78, 16],
        [66, 27],
        [79, 28],
      ],
      tokenWidth: 8.8,
      summary: '2 per species · four +7',
    },
    {
      zone: 2,
      bounds: [15, 39, 28, 19],
      label: [29, 55],
      slots: [
        [22, 46],
        [35, 46],
      ],
      tokenWidth: 8.8,
      summary: 'Different pair 9 · alike 3',
    },
    {
      zone: 3,
      bounds: [57, 38, 40, 24],
      label: [79, 59],
      slots: [
        [64, 44],
        [76, 50],
        [91, 52],
      ],
      tokenWidth: 8.8,
      summary: '2 each · A–B–A +8',
    },
    {
      zone: 4,
      bounds: [16, 64, 38, 30],
      label: [35, 92],
      slots: [
        [23, 71],
        [34, 78],
        [46, 83],
      ],
      tokenWidth: 8.8,
      summary: '5 per species living only here',
    },
    {
      zone: 6,
      bounds: [70, 69, 23, 22],
      label: [82, 88],
      slots: [[81, 78]],
      tokenWidth: 9.7,
      summary: 'Other occupied homes without this species ×3',
    },
  ] satisfies MoraHabitatArt[],
};
export const moraMapFor = (set?: 'beginner' | 'intermediate', portrait = false) =>
  set === 'intermediate' ? coastalMap : portrait ? observatoryMap(true) : moraMap;

/** Printed scoring relationships sit between spaces, never beside habitat names. */
export function habitatRelationships(
  art: MoraHabitatArt,
  set?: 'beginner' | 'intermediate',
) {
  const coastal = set === 'intermediate';
  const marks: { at: [number, number]; symbol: string }[] = [];
  const between = (a: number, b: number, symbol: string) => {
    const first = art.slots[a],
      second = art.slots[b];
    marks.push({
      at: [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2],
      symbol,
    });
  };
  if (art.zone === 0 || art.zone === 1) {
    between(0, 1, art.zone === 0 ? '=' : '≠');
    between(2, 3, art.zone === 0 ? '=' : '≠');
    if (art.zone === 1) between(0, 3, '≠');
  } else if (art.zone === 2) {
    between(0, 1, coastal ? '≠' : '=');
  } else if (art.zone === 3) {
    between(0, 1, '≠');
    between(1, 2, '≠');
    if (coastal)
      marks.push({
        at: [art.slots[1][0], art.slots[1][1] - 6],
        symbol: 'A–B–A',
      });
  } else {
    const first = art.slots[0];
    marks.push({
      at: [first[0] - art.tokenWidth * 0.8, first[1]],
      symbol: art.zone === 4 ? (coastal ? '×5' : '×4') : coastal ? '×3' : '×2',
    });
  }
  return marks;
}
