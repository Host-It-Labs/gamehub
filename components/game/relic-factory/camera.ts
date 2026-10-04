import * as THREE from 'three';
import { MIN_ZOOM, MAX_ZOOM } from './limits.ts';
const FOV = 30;
export type ScreenPoint = { x: number; y: number };

/** The factory keeps its viewing angle while you inspect a closer area.
 * Floor points, picking and other players' pointers all use this camera. */
export class FactoryCamera {
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  turned = false;
  private floor = { width: 0, height: 0 };
  private size = { w: 1, h: 1 };
  private base = {
    d: 20,
    target: new THREE.Vector3(),
    dir: new THREE.Vector3(0, 1, 1).normalize(),
  };
  private offset = new THREE.Vector3();
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  get zoom() {
    return this.camera.zoom;
  }

  /** Resize/refit the overview without discarding the inspected area. */
  fit(width: number, height: number, w: number, h: number) {
    if (Math.min(width, height, w, h) <= 0) return;
    const zoom = this.zoom;
    const focus =
      this.floor.width && zoom > MIN_ZOOM
        ? this.floorPoint({ x: 0, y: 0 })
        : null;
    this.floor = { width, height };
    this.size = { w, h };
    this.camera.zoom = MIN_ZOOM;
    this.camera.aspect = w / h;
    const flat = this.best(false),
      upright = this.best(true);
    this.turned = upright.d * 1.12 < flat.d;
    this.base = this.turned ? upright : flat;
    if (focus) this.offset.copy(focus).sub(this.base.target);
    this.camera.zoom = zoom;
    this.place();
  }

  reset() {
    this.camera.zoom = MIN_ZOOM;
    this.offset.set(0, 0, 0);
    this.place();
  }

  /** Normalised screen coordinates; keep the floor under the gesture still. */
  zoomTo(value: number, anchor: ScreenPoint = { x: 0, y: 0 }) {
    if (!Number.isFinite(value)) return this.zoom;
    const next = THREE.MathUtils.clamp(value, MIN_ZOOM, MAX_ZOOM);
    if (next === this.zoom) return next;
    const before = this.floorPoint(anchor);
    this.camera.zoom = next;
    this.camera.updateProjectionMatrix();
    const after = this.floorPoint(anchor);
    if (before && after) this.offset.add(before.sub(after));
    this.place();
    return this.zoom;
  }

  pan(from: ScreenPoint, to: ScreenPoint) {
    const a = this.floorPoint(from),
      b = this.floorPoint(to);
    if (a && b) {
      this.offset.add(a.sub(b));
      this.place();
    }
  }

  floorPoint(point: ScreenPoint) {
    this.ray.setFromCamera(new THREE.Vector2(point.x, point.y), this.camera);
    return this.ray.ray.intersectPlane(this.plane, new THREE.Vector3());
  }

  private place() {
    // Keep the floor within reach, including after repeated edge gestures.
    if (this.zoom === MIN_ZOOM) this.offset.set(0, 0, 0);
    else {
      // The overview target is perspective-biased. Bound the actual focus
      // to the floor, not an orthographic fraction of its centre: every
      // edge machine and its roof must remain reachable when inspected.
      this.offset.x =
        THREE.MathUtils.clamp(
          this.base.target.x + this.offset.x,
          0,
          this.floor.width,
        ) - this.base.target.x;
      this.offset.z =
        THREE.MathUtils.clamp(
          this.base.target.z + this.offset.z,
          0,
          this.floor.height,
        ) - this.base.target.z;
    }
    const target = this.base.target.clone().add(this.offset);
    this.camera.position
      .copy(target)
      .addScaledVector(this.base.dir, this.base.d);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
    this.camera.near = Math.max(0.1, this.base.d * 0.2);
    this.camera.far = this.base.d * 3;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  private best(turned: boolean) {
    const low = this.fitFor(turned, 46),
      high = this.fitFor(turned, 58);
    return high.d * (turned ? 0.9 : 1.1) < low.d ? high : low;
  }

  private fitFor(turned: boolean, degrees: number) {
    const { width, height } = this.floor,
      { w, h } = this.size;
    const cam = this.camera,
      pitch = THREE.MathUtils.degToRad(degrees);
    const dir = turned
      ? new THREE.Vector3(Math.cos(pitch), Math.sin(pitch), 0)
      : new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
    const margin = 0.4,
      points: THREE.Vector3[] = [];
    for (const x of [-margin, width + margin])
      for (const z of [-margin, height + margin])
        for (const y of [-0.35, 0.9]) points.push(new THREE.Vector3(x, y, z));
    const target = new THREE.Vector3(width / 2, 0, height / 2);
    const limX = Math.max(0.1, 1 - 16 / w),
      limY = Math.max(0.1, 1 - 16 / h);
    const v = new THREE.Vector3();
    let distance = 20;
    const place = (d: number) => {
      cam.position.copy(target).addScaledVector(dir, d);
      cam.up.set(0, 1, 0);
      cam.lookAt(target);
      cam.near = 0.1;
      cam.far = d * 4;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
    };
    const bounds = () => {
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      for (const point of points) {
        v.copy(point).project(cam);
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
      return { x0, x1, y0, y1 };
    };
    // Re-centre, then fit once more: the last recenter must not crop a roof.
    for (let iter = 0; iter < 4; iter++) {
      let lo = 1,
        hi = 300;
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2;
        place(mid);
        const b = bounds();
        if (Math.max(-b.x0, b.x1) <= limX && Math.max(-b.y0, b.y1) <= limY)
          hi = mid;
        else lo = mid;
      }
      distance = hi;
      if (iter === 3) break;
      place(distance);
      const b = bounds(),
        halfH = distance * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      target.addScaledVector(right, ((b.x0 + b.x1) / 2) * halfH * (w / h));
      target.addScaledVector(up, ((b.y0 + b.y1) / 2) * halfH * 0.9);
      target.y = 0;
    }
    return { d: distance, target, dir };
  }
}
