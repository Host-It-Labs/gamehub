/** Percent coordinates on the sanctuary illustration. Keep tokens on painted nests. */
export type MoraHabitatArt = {
  zone: number;
  bounds: [number, number, number, number];
  label: [number, number];
  slots: [number, number][];
  tokenWidth: number;
  summary: string;
};
export const moraMap = {
  image: '/art/mora-sanctuary-v10.webp',
  habitats: [
    { zone: 0, bounds: [4, 12, 29, 29], label: [19, 37.5], slots: [[11.4, 18.4], [24.4, 18.2], [11.3, 29], [24.8, 29]], tokenWidth: 8.8, summary: 'Alike: 2 / 6 / 11 / 17 pts' },
    { zone: 1, bounds: [38, 10, 29, 36], label: [52, 42], slots: [[52, 17.2], [44.4, 24.5], [59.4, 24.9], [52.3, 34.2]], tokenWidth: 8.8, summary: '3 per species · all four +2' },
    { zone: 2, bounds: [73, 20, 24, 24], label: [85, 39], slots: [[79, 28.2], [89, 28.3]], tokenWidth: 8.8, summary: 'Matching pair 8 · single 1' },
    { zone: 3, bounds: [2, 45, 34, 39], label: [24, 80], slots: [[10, 51.9], [15.9, 65], [28.6, 69.6]], tokenWidth: 9.7, summary: 'Each 2 · different adjacent +3' },
    { zone: 4, bounds: [39, 53, 28, 37], label: [52, 85], slots: [[45.6, 63.9], [58.6, 64.7], [51.8, 76.2]], tokenWidth: 8.8, summary: 'Species also elsewhere ×4' },
    { zone: 6, bounds: [74, 54, 22, 33], label: [84, 82], slots: [[84.2, 67.4]], tokenWidth: 12.3, summary: 'Other habitats with this species ×2' },
  ] satisfies MoraHabitatArt[],
};
