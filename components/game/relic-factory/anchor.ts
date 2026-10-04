/** How pointers on the 3D floor map to floor cells and back, for the
 * named pointers and the Watch TV (`relic-presence.tsx`). The floor element
 * registers its projector here while its world is alive. */
export type FloorProjector = {
  /** A page point to a floor point, in cells. */
  toFloor: (
    clientX: number,
    clientY: number,
  ) => { x: number; y: number } | null;
  /** A floor point, in cells, to a page point. */
  toPage: (x: number, y: number) => { x: number; y: number };
};
export const floorProjectors = new WeakMap<Element, FloorProjector>();
