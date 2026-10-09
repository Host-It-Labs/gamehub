/**
 * How every game canvas fits its drawing to the screen and the device.
 *
 * The aim is the screen's own density: a 4K monitor gets every one of its
 * pixels, a 3× phone its full 3×. A quick look at the device (graphics chip,
 * cores, memory) gives its `Power`, which says where an animated scene starts
 * on the frame pacer's ladder (`render-pacer.ts`): a powerful device at
 * native, a weaker one lower. The pacer then climbs to native whenever frames
 * have room and steps down when they slip. Still drawings (backdrops, scratch
 * cards, sketches) are drawn once per resize, at native up to the power's
 * pixel budget.
 *
 * Append `?power=low` (or `mid`, `high`) to any page to try a class.
 */
export type Power = 'high' | 'mid' | 'low';

/** The largest drawing buffer any canvas allocates: a 6K display at full
 *  density. Beyond it a frame costs memory nobody can see. */
export const MAX_PIXELS = 6144 * 3456;

/** Pixels an animated scene starts with, by power. The pacer may climb to
 *  native from there. */
const START_PIXELS: Record<Power, number> = {
  high: MAX_PIXELS,
  mid: 3840 * 2160,
  low: 1_500_000,
};

/** Pixels a still drawing may use, by power. */
const STILL_PIXELS: Record<Power, number> = {
  high: MAX_PIXELS,
  mid: 12_000_000,
  low: 6_000_000,
};

export type Device = {
  /** The WebGL renderer string, '' when the browser does not say. */
  gpu: string;
  /** `navigator.hardwareConcurrency`; Safari on iOS under-reports it. */
  cores: number;
  /** `navigator.deviceMemory` in GB; only Chromium reports it. */
  memory?: number;
  /** False when the browser has no WebGL at all. */
  webgl: boolean;
};

/** Sort a device into a power class. Pure, so it can be tested. */
export function classify({ gpu, cores, memory, webgl }: Device): Power {
  const g = gpu.toLowerCase();
  if (!webgl || /swiftshader|llvmpipe|softpipe|software|basic render/.test(g))
    return 'low';
  // Every Apple chip that runs WebGL 2 handles these scenes, and Safari on
  // iOS reports few cores, so cores and memory say nothing there.
  if (/\bapple\b/.test(g) && !/intel|amd|radeon|nvidia/.test(g)) return 'high';
  if ((memory ?? 8) <= 2 || cores <= 2) return 'low';
  let chip: Power;
  if (
    /nvidia|geforce|quadro|\brtx\b|radeon\s*(\(tm\)\s*)?(rx|pro|vii)|arc\s*(\(tm\)\s*)?a\d|immortalis|adreno\D{0,12}[78]\d\d|mali-?g(71[5-9]|72\d|9\d\d)/.test(
      g,
    )
  )
    chip = 'high';
  else if (
    /mali-?(t|g[3-5]\d\b)|adreno\D{0,12}[2-5]\d\d\b|powervr|intel.*\b(u?hd)\s*graphics|\bgma\b|vivante|videocore/.test(
      g,
    )
  )
    chip = 'low';
  else if (g) chip = 'mid';
  else chip = cores >= 8 ? 'high' : 'mid';
  if (chip === 'high' && ((memory ?? 8) <= 4 || cores <= 4)) chip = 'mid';
  return chip;
}

function probe(): Device {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const device: Device = {
    gpu: '',
    cores: nav.hardwareConcurrency || 4,
    memory: nav.deviceMemory,
    webgl: false,
  };
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ??
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      device.webgl = true;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      device.gpu = String(
        gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ??
          '',
      );
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    /* No WebGL: the device counts as low. */
  }
  return device;
}

let power: Power | null = null;

/** This device's power class, looked up once per page. */
export function devicePower(): Power {
  if (power) return power;
  if (typeof window === 'undefined') return 'mid';
  const asked = new URLSearchParams(window.location.search).get('power');
  power =
    asked === 'high' || asked === 'mid' || asked === 'low'
      ? asked
      : classify(probe());
  return power;
}

/** Device pixels per CSS pixel, as the screen and browser zoom report it. */
export function nativeRatio() {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio;
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}

/** The ratio that spends at most `pixels` on a `width`×`height` CSS canvas,
 *  never above `native` and never below one pixel per CSS pixel (or native,
 *  when a zoomed-out page reports less than one). */
function fit(pixels: number, native: number, width: number, height: number) {
  const area = Math.max(1, width * height);
  const budget = Math.sqrt(Math.min(pixels, MAX_PIXELS) / area);
  return Math.max(Math.min(native, 1), Math.min(native, budget));
}

/** Pixel ratio for a still drawing (redrawn on resize, not every frame). */
export function stillRatio(
  width: number,
  height: number,
  native = nativeRatio(),
  p = devicePower(),
) {
  return fit(STILL_PIXELS[p], native, width, height);
}

/** Pixel ratio an animated scene starts at, before the pacer settles. */
export function startRatio(
  width: number,
  height: number,
  native = nativeRatio(),
  p = devicePower(),
) {
  return fit(START_PIXELS[p], native, width, height);
}

/** The first rung of a pacer ladder (fractions of `native`) that fits this
 *  device's starting budget. */
export function startLevel(
  rungs: readonly { resolution: number }[],
  width: number,
  height: number,
  native = nativeRatio(),
  p = devicePower(),
) {
  const want = startRatio(width, height, native, p) / native;
  const i = rungs.findIndex((r) => r.resolution <= want + 0.001);
  return i < 0 ? rungs.length - 1 : i;
}

/** Ladder floor (a fraction of `native`) that never draws under `ratio`
 *  pixels per CSS pixel. */
export function floorAt(ratio: number, native = nativeRatio()) {
  return Math.min(1, ratio / Math.max(native, 0.01));
}
