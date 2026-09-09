/** Pure gesture arbitration shared by touch, pen and mouse. */
export const HOLD_MS = 450,
  DRAG_PX = 8;
export type Gesture = {
  pointer: number;
  x: number;
  y: number;
  started: number;
  mode: 'pending' | 'drag' | 'inspect' | 'cancelled';
  draggable: boolean;
};
export function begin(
  pointer: number,
  x: number,
  y: number,
  time: number,
  draggable: boolean,
): Gesture {
  return { pointer, x, y, started: time, mode: 'pending', draggable };
}
export function travel(g: Gesture, x: number, y: number): Gesture {
  if (g.mode !== 'pending') return g;
  if (Math.hypot(x - g.x, y - g.y) > DRAG_PX)
    return { ...g, mode: g.draggable ? 'drag' : 'cancelled' };
  return g;
}
export function hold(g: Gesture, time: number): Gesture {
  return g.mode === 'pending' && time - g.started >= HOLD_MS
    ? { ...g, mode: 'inspect' }
    : g;
}
export function release(g: Gesture) {
  return g.mode === 'pending' ? 'tap' : g.mode === 'drag' ? 'drop' : 'none';
}
