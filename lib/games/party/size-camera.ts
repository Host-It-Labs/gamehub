/** Fit both silhouettes, but never zoom closer than the initial comparison. */
export function sizeCameraZoom(
  base: number,
  available: { w: number; h: number },
  reference: { w: number; h: number },
  target: { w: number; h: number },
  left: number,
) {
  const fit = Math.min(
    available.h / Math.max(reference.h, target.h),
    available.w / Math.max(reference.w, left + target.w),
  );
  return Math.min(1, Math.max(1 / 40, fit / base));
}
