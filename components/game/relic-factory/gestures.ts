export type PointerPoint = { x: number; y: number };
export type CameraGesture = {
  factor: number;
  from: PointerPoint;
  to: PointerPoint;
};

/** A pinch consumes every pointer in that gesture, even when one finger
 * lifts first. None of those pointer-ups may commit a factory edit. */
export class FactoryGestures {
  private points = new Map<number, PointerPoint>();
  private consumed = false;

  get cameraActive() {
    return this.consumed;
  }

  has(id: number) {
    return this.points.has(id);
  }

  begin(id: number, point: PointerPoint, pan: boolean) {
    this.points.set(id, point);
    this.consumed ||= pan || this.points.size > 1;
    return this.consumed;
  }

  consume() {
    if (this.points.size) this.consumed = true;
  }

  move(id: number, point: PointerPoint): CameraGesture | null {
    const old = this.points.get(id);
    if (!old) return null;
    const before = [...this.points.values()];
    this.points.set(id, point);
    if (!this.consumed) return null;
    const after = [...this.points.values()];
    if (before.length < 2) return { factor: 1, from: old, to: point };
    const centre = (p: PointerPoint[]) => ({
      x: (p[0].x + p[1].x) / 2,
      y: (p[0].y + p[1].y) / 2,
    });
    const distance = (p: PointerPoint[]) =>
      Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    const d = distance(before),
      next = distance(after);
    return {
      factor: d > 2 && next > 2 ? next / d : 1,
      from: centre(before),
      to: centre(after),
    };
  }

  end(id: number) {
    const consumed = this.consumed;
    this.points.delete(id);
    if (!this.points.size) this.consumed = false;
    return consumed;
  }

  cancel() {
    this.points.clear();
    this.consumed = false;
  }
}
