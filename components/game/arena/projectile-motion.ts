import {
  isGroundProjectile,
  projectileWall,
  towerGap,
  towerNormal,
  TICK,
  type Match,
  type Projectile,
} from '@/lib/games/arena/engine';

/** Visual prediction may reach the next facade, but never enter it before
 * the next authoritative tick resolves the impact. */
export function projectileAhead(m: Match, p: Projectile, alpha: number) {
  const dx = p.tx - p.x;
  const dy = p.ty - p.y;
  const distance = Math.hypot(dx, dy);
  const ahead = Math.min(
    distance,
    p.speed * TICK * Math.max(0, Math.min(1, alpha)),
  );
  if (!distance || !ahead) return 0;
  const wall = projectileWall(
    m,
    p,
    (dx / distance) * ahead,
    (dy / distance) * ahead,
  );
  return ahead * (wall?.at ?? 1);
}

/** Apply muzzle offsets before testing the final drawing. A conservative
 * mesh radius keeps the bolt's tip and sheath outside the same facade. */
export function projectileOrigin(
  m: Match,
  p: Projectile,
  x: number,
  y: number,
  radius: number,
): [number, number] {
  if (!isGroundProjectile(p)) return [x, y];
  const dx = x - p.x;
  const dy = y - p.y;
  const wall = projectileWall(m, p, dx, dy);
  if (wall) {
    x = p.x + dx * wall.at;
    y = p.y + dy * wall.at;
  }
  // A centre already close to a wall can start inside its expanded mesh
  // clearance. Recover it after the sweep, without moving the simulation.
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const t of m.towers) {
      if (t.destroyed) continue;
      const gap = towerGap(t, x, y);
      if (gap >= radius) continue;
      const [nx, ny] = towerNormal(t, x, y);
      const by = radius - gap + 1e-6;
      x += nx * by;
      y += ny * by;
      moved = true;
    }
    if (!moved) break;
  }
  return [x, y];
}
