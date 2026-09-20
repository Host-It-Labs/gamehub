import { paperWorldFor, paperWorldIdFor, type PaperWorldId } from '../mora-world.ts';

/** Percent coordinates on a paper world's gameplay crop. Keep tokens on painted pads. */
export type MoraHabitatArt = {
  zone: number;
  bounds: [number, number, number, number];
  label: [number, number];
  slots: [number, number][];
  tokenWidth: number;
  summary: string;
};
/** Scene, pad targets and labels are measured on each independently authored source. */
export function paperWorldMap(world: PaperWorldId, portrait = false, overview = false) {
  const art = paperWorldFor(portrait, undefined, world);
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
export const observatoryMap = (portrait = false, overview = false) => paperWorldMap('observatory', portrait, overview);
export const floodlineMap = (portrait = false, overview = false) => paperWorldMap('floodline', portrait, overview);
export const moraMap = observatoryMap();
export const moraMapFor = (set?: 'beginner' | 'intermediate', portrait = false, overview = false) =>
  paperWorldMap(paperWorldIdFor(set), portrait, overview);

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
  const beside = (symbol: string) => {
    const first = art.slots[0];
    marks.push({ at: [first[0] - art.tokenWidth * 0.8, first[1]], symbol });
  };
  switch (art.zone) {
    case 0:
      // Courtyard herds and Rock pool pairs both want alike neighbours.
      between(0, 1, '=');
      between(2, 3, '=');
      break;
    case 1:
      // Roof garden pairs; the Nesting beach wants every species different.
      between(0, 1, coastal ? '≠' : '=');
      between(2, 3, coastal ? '≠' : '=');
      if (coastal) between(0, 3, '≠');
      break;
    case 2:
      between(0, 1, '=');
      break;
    case 3:
      // Glasshouse pair and guest, or the Pier's ordered A–B–A echo.
      between(0, 1, coastal ? '≠' : '=');
      between(1, 2, '≠');
      if (coastal)
        marks.push({
          at: [art.slots[1][0], art.slots[1][1] - 6],
          symbol: 'A–B–A',
        });
      break;
    case 4:
      // Dry channel variety, or the Sea cave's exclusive species.
      if (coastal) between(0, 1, '≠');
      else {
        between(0, 1, '≠');
        between(1, 2, '≠');
      }
      break;
    default:
      beside(coastal ? '5' : '×2');
  }
  return marks;
}
