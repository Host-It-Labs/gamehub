/**
 * Draw the mill town's materials at the resolution of the pixel that sees
 * them. Coordinates are in squares (25 m), never in a small baked atlas.
 * Derivative filtering averages joints and grain before they become smaller
 * than a pixel, so distant roofs and dense phone screens do not shimmer.
 * The same setts and flags dress the board, routes and surrounding streets.
 */
export const surfaceGLSL = /* glsl */ `
uniform float uSurfaceDetail;
// Capture gradients before any discard or per-pixel material choice. The
// explicit form stays filtered inside the ground's region branches; the
// vec2 overloads keep the same API for models and generated route meshes.
struct RotaSurface {
  vec2 p;
  vec2 dx;
  vec2 dy;
};
RotaSurface rotaSurface(vec2 p) {
  return RotaSurface(p, dFdx(p), dFdy(p));
}
RotaSurface rotaScale(RotaSurface s, vec2 scale) {
  return RotaSurface(s.p * scale, s.dx * scale, s.dy * scale);
}
float rotaHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float rotaNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 s = f * f * (3.0 - 2.0 * f);
  return mix(mix(rotaHash(i), rotaHash(i + vec2(1.0, 0.0)), s.x),
             mix(rotaHash(i + vec2(0.0, 1.0)), rotaHash(i + vec2(1.0, 1.0)), s.x), s.y);
}
float rotaVisibility(vec2 dx, vec2 dy) {
  float pixel = max(length(dx), length(dy));
  return 1.0 - smoothstep(0.35, 1.25, pixel);
}
float rotaVisibility(vec2 p) {
  return rotaVisibility(dFdx(p), dFdy(p));
}
float rotaGrain(RotaSurface s) {
  // The first octave remains visible at ordinary phone scale. Skip noise
  // that is completely below a pixel, and fine octaves on a slow client.
  float visible = rotaVisibility(s.dx * 60.0, s.dy * 60.0);
  float grain = 0.0;
  if (visible > 0.0)
    grain = (rotaNoise(s.p * 60.0) - 0.5) * visible;
  if (uSurfaceDetail > 0.45) {
    visible = rotaVisibility(s.dx * 240.0, s.dy * 240.0);
    if (visible > 0.0)
      grain += (rotaNoise(s.p * 240.0) - 0.5) * visible * 0.5;
  }
  if (uSurfaceDetail > 0.8) {
    visible = rotaVisibility(s.dx * 560.0, s.dy * 560.0);
    if (visible > 0.0)
      grain += (rotaNoise(s.p * 560.0) - 0.5) * visible * 0.25;
  }
  return grain;
}
float rotaGrain(vec2 p) {
  return rotaGrain(rotaSurface(p));
}
// Running-bond blocks with filtered recessed joints, worn rims and a stable
// colour per block. Return brightness relative to the material's own tint.
float rotaBlocks(RotaSurface s, vec2 size, vec2 joint, float recess, float variation) {
  float coverage = (1.0 - 2.0 * joint.x) * (1.0 - 2.0 * joint.y);
  float mean = mix(recess, 0.94, coverage);
  float visible = rotaVisibility(s.dx / size, s.dy / size);
  if (visible == 0.0) return mean;
  vec2 q = s.p / size;
  float row = floor(q.y);
  q.x += mod(row, 2.0) * 0.5;
  vec2 f = fract(q), edge = min(f, 1.0 - f);
  vec2 aa = clamp((abs(s.dx) + abs(s.dy)) / size, vec2(0.001), vec2(0.5));
  vec2 fill = smoothstep(joint - aa * 0.5, joint + aa * 0.5, edge);
  float solid = fill.x * fill.y;
  float tone = 0.94 + (rotaHash(vec2(floor(q.x), row)) - 0.5) * variation;
  vec2 bevel = smoothstep(joint, joint + aa + 0.1, edge);
  float relief = mix(0.83, 1.06, bevel.x * bevel.y);
  float value = mix(recess, tone * relief, solid);
  return mix(mean, value, visible);
}
float rotaBlocks(vec2 p, vec2 size, vec2 joint, float recess, float variation) {
  return rotaBlocks(rotaSurface(p), size, joint, recess, variation);
}
float rotaSetts(RotaSurface s) {
  return rotaBlocks(s, vec2(0.028, 0.021), vec2(0.065, 0.08), 0.46, 0.28)
    + rotaGrain(s) * 0.12;
}
float rotaSetts(vec2 p) {
  return rotaSetts(rotaSurface(p));
}
float rotaFlags(RotaSurface s) {
  return rotaBlocks(s, vec2(0.12, 0.09), vec2(0.018, 0.022), 0.65, 0.16)
    + rotaGrain(s) * 0.08;
}
float rotaFlags(vec2 p) {
  return rotaFlags(rotaSurface(p));
}
float rotaBrick(RotaSurface s) {
  return rotaBlocks(s, vec2(0.015, 0.007), vec2(0.035, 0.065), 1.24, 0.25)
    + rotaGrain(s) * 0.1;
}
float rotaBrick(vec2 p) {
  return rotaBrick(rotaSurface(p));
}
float rotaSlate(RotaSurface s) {
  return rotaBlocks(s, vec2(0.018, 0.014), vec2(0.022, 0.045), 0.48, 0.22)
    + rotaGrain(s) * 0.07;
}
float rotaSlate(vec2 p) {
  return rotaSlate(rotaSurface(p));
}
float rotaEarth(RotaSurface s) {
  // Cinder grains and little clods, with variation at several scales.
  return 0.96 + (rotaNoise(s.p * 23.0) - 0.5) * 0.16
    + rotaGrain(s) * 0.27;
}
float rotaEarth(vec2 p) {
  return rotaEarth(rotaSurface(p));
}
float rotaGrass(RotaSurface s) {
  return 0.97 + (rotaNoise(s.p * 32.0) - 0.5) * 0.13
    + rotaGrain(rotaScale(s, vec2(0.7, 1.6))) * 0.28;
}
float rotaGrass(vec2 p) {
  return rotaGrass(rotaSurface(p));
}
float rotaBallast(RotaSurface s) {
  return rotaBlocks(s, vec2(0.011, 0.009), vec2(0.06), 0.52, 0.5)
    + rotaGrain(s) * 0.2;
}
float rotaBallast(vec2 p) {
  return rotaBallast(rotaSurface(p));
}
float rotaWood(vec2 p) {
  float wav = rotaNoise(p * vec2(17.0, 4.0)) * 0.003;
  vec2 q = vec2((p.x + wav) * 350.0, p.y * 7.0);
  float grain = (rotaNoise(q) - 0.5) * rotaVisibility(q);
  return 0.96 + grain * 0.22 + rotaGrain(p) * 0.06;
}
// A subtle normal perturbation from the material relief in view space.
// It uses the surface's derivatives, including instanced and curved meshes.
vec3 rotaRelief(vec3 n, vec3 position, float height) {
  vec3 dx = dFdx(position), dy = dFdy(position);
  vec3 r1 = cross(dy, n), r2 = cross(n, dx);
  float det = dot(dx, r1);
  vec3 grad = sign(det) * (dFdx(height) * r1 + dFdy(height) * r2);
  return normalize(abs(det) * n - grad);
}
`;

/** Blender UVs are already in repeats at these physical material scales. */
export const uvMetres: Record<string, number> = {
  grass: 1.2,
  field: 0.9,
  asphalt: 0.6,
  ballast: 0.3,
  brick: 0.14,
  roof: 0.12,
  slate: 0.12,
  plaster: 0.25,
  wood: 0.12,
  stone: 0.2,
  rock: 0.6,
  foliage: 0.22,
  bark: 0.1,
  sand: 0.8,
  cobble: 0.2,
};

export const surfaceFunction: Record<string, string> = {
  brick: 'rotaBrick',
  roof: 'rotaSlate',
  slate: 'rotaSlate',
  stone: 'rotaFlags',
  cobble: 'rotaSetts',
  ballast: 'rotaBallast',
  grass: 'rotaGrass',
  foliage: 'rotaGrass',
  field: 'rotaEarth',
  sand: 'rotaEarth',
  asphalt: 'rotaEarth',
  rock: 'rotaEarth',
  plaster: 'rotaEarth',
  wood: 'rotaWood',
  bark: 'rotaWood',
};
