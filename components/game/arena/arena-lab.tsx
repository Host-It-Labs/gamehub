'use client';
import { useEffect, useRef, useState } from 'react';
import { troopCards, troopDeck } from '@/lib/games/arena/cards';
import {
  createMatch,
  plainUnit,
  step,
  TICK,
  type Unit,
} from '@/lib/games/arena/engine';
import { pickQuality, prepare, type Prepared } from './load';
import { TROOP_SCALE } from './troops';
import { ArenaView } from './view';

/** What the lab's close camera reads off a troop (private on TroopView). */
type TroopProbe = {
  statusAnchor: { x: number; y: number; z: number };
  kit?: { top?: number };
};
import './arena.css';

/**
 * Dev bench at /arena/lab: every troop of both sides lined up on the field
 * under the game's light, alternating walking and attacking, with a close
 * camera (spells have no troop, so the Meteor is left out).
 * `?mode=walk|attack|idle` holds one state; `?far` uses the game's own
 * framing. `?mode=battle` runs the real engine; `?mode=deploy` repeats
 * arrivals. `?status=stun|slow|haste|taunt|rage|heal|push|mixed` applies
 * effects to the near row, leaving the far row for comparison.
 * `?only=pirate,viking` lines up just those troops (`all` for the roster); and
 * `?single` shows only the near side, useful for inspecting detailed sources;
 * `?figures=/3d/arena/dev/<name>.glb` swaps in a figures GLB built for a
 * look before it ships (public/3d/arena/dev is not tracked).
 * `?cam=front|side|back|three|game|gameback` follows the first troop with a
 * close camera framed on its height (`zoom` > 1 closer, `turn` adds degrees
 * round it); `?mode=march` walks it straight ahead and `?mode=circle` round
 * a circle. `window.arenaLabReady` turns true once the camera has framed it
 * (scripts/arena-troop-review.mjs waits for it).
 */
export default function ArenaLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [status, setStatus] = useState('Loading');
  useEffect(() => {
    const override = new URLSearchParams(window.location.search).get('figures');
    void prepare(pickQuality().tier, (p) =>
      setStatus(`${((p.loaded / p.total) * 100).toFixed(0)}%`),
    )
      .then(async (p) => {
        if (!override?.startsWith('/3d/arena/dev/')) return p;
        const data = await (await fetch(override)).arrayBuffer();
        const { GLTFLoader } =
          await import('three/addons/loaders/GLTFLoader.js');
        return { ...p, figures: await new GLTFLoader().parseAsync(data, '') };
      })
      .then(setPrepared);
  }, []);
  useEffect(() => {
    if (!prepared || !canvas.current) return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const status = params.get('status');
    const view = new ArenaView(canvas.current, prepared, pickQuality());
    const m = createMatch(1);
    m.phase = 'battle';
    view.start(m);
    (window as unknown as { arenaLab: unknown }).arenaLab = { view, m };
    let id = 1000;
    const only = params.get('only')?.split(',');
    const lineup = only?.includes('all')
      ? troopDeck
      : only
        ? troopDeck.filter((c) => only.includes(c))
        : troopDeck.slice(0, 7);
    // Spread whatever is lined up across the field.
    const gap = Math.min(2.2, 15.4 / Math.max(1, lineup.length - 1));
    const sides = params.has('single') ? ([0] as const) : ([0, 1] as const);
    lineup.forEach((card, i) => {
      for (const side of sides) {
        const x = 9 - ((lineup.length - 1) * gap) / 2 + i * gap;
        const y = side === 0 ? 11 : 13.6;
        const u: Unit = {
          id: id++,
          side,
          owner: side,
          card,
          x,
          y,
          px: x,
          py: y,
          hp: troopCards[card].unit.hp,
          maxHp: troopCards[card].unit.hp,
          state: 'walking',
          deployLeft: 0,
          targetId: null,
          attackTimer: troopCards[card].unit.hitSpeed,
          facing: side === 0 ? 0 : Math.PI,
          sinceHit: 99,
          lane: 0,
          bridge: -1,
          ...plainUnit,
          shield: troopCards[card].unit.shield ?? 0,
          maxShield: troopCards[card].unit.shield ?? 0,
        };
        m.units.push(u);
      }
    });
    const cam = params.get('cam');
    const zoom = Number(params.get('zoom') ?? 1) || 1;
    const turn = ((Number(params.get('turn') ?? 0) || 0) * Math.PI) / 180;
    // The close camera's direction round the troop, fixed when framed so a
    // troop that turns round shows its other side rather than spinning the
    // view. Side 0 faces down the field, away from the usual camera.
    const around: Record<string, [number, number]> = {
      front: [0, 6],
      back: [180, 6],
      side: [90, 4],
      three: [35, 10],
      game: [0, 55],
      gameback: [180, 55],
    };
    const follow = () => {
      if (!cam || !around[cam]) return;
      const u = m.units[0];
      const probe = view as unknown as {
        troops: Map<number, TroopProbe>;
        troopRenderer: { scale: number };
      };
      const troop = u && probe.troops.get(u.id);
      if (!troop) return;
      const scale = probe.troopRenderer.scale / TROOP_SCALE;
      const height = (troop.kit?.top ?? TROOP_SCALE * 1.4) * scale;
      const centre = [
        troop.statusAnchor.x,
        troop.statusAnchor.y - height * 0.5,
        troop.statusAnchor.z,
      ];
      const [yawDeg, pitchDeg] = around[cam];
      const yaw = (yawDeg * Math.PI) / 180 + turn;
      const pitch = (pitchDeg * Math.PI) / 180;
      const fov = 30;
      // Frame about 1.5 figure heights so props and attack reach stay in.
      const distance =
        (height * 1.5) / 2 / Math.tan(((fov / 2) * Math.PI) / 180) / zoom;
      // Facing 0 walks towards +y on the field, which is -z in the world.
      const fx = Math.sin(yaw) * Math.cos(pitch);
      const fz = -Math.cos(yaw) * Math.cos(pitch);
      view.setCamera(
        [
          centre[0] + fx * distance,
          centre[1] + Math.sin(pitch) * distance,
          centre[2] + fz * distance,
        ],
        [centre[0], centre[1], centre[2]],
        fov,
      );
      (window as unknown as { arenaLabReady: boolean }).arenaLabReady = true;
    };
    const resize = () => {
      const r = canvas.current!.getBoundingClientRect();
      view.resize({ width: r.width, height: r.height, top: 0, bottom: 0 });
      if (params.has('far')) return;
      if (cam) {
        follow();
      } else view.setCamera([0, 6.5, 13], [0, 0.55, 3.7], 38);
      // Your towers would stand between the camera and the line-up (placed
      // again whenever the screen changes size class).
      for (const t of view.world.towers.values())
        if (t.side === 0) t.root.visible = false;
    };
    resize();
    window.addEventListener('resize', resize);
    let raf = 0;
    let last = performance.now();
    const t0 = last;
    let accumulated = 0;
    let lastPulse = -1;
    const angles = new Map<number, number>();
    // `?manual` stops the clock: `window.arenaLabAdvance(seconds)` steps it
    // at 60 Hz and draws, so review sheets get even frames however busy the
    // machine is.
    const manual = params.has('manual');
    let clock = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      if (manual) {
        if (!(window as unknown as { arenaLabReady?: boolean }).arenaLabReady)
          tick(1 / 60, clock);
        return;
      }
      tick(dt, Math.max(0, (now - t0) / 1000));
    };
    (
      window as unknown as { arenaLabAdvance: (seconds: number) => number }
    ).arenaLabAdvance = (seconds: number) => {
      const steps = Math.max(1, Math.round(seconds * 60));
      for (let i = 0; i < steps; i++) {
        clock += 1 / 60;
        tick(1 / 60, clock);
      }
      return clock;
    };
    const tick = (dt: number, t: number) => {
      if (mode === 'battle') {
        accumulated += dt;
        while (accumulated >= TICK) {
          step(m);
          accumulated -= TICK;
        }
        view.handle(m, m.events);
        m.events.length = 0;
        view.frame(m, accumulated / TICK, dt, t);
        follow();
        return;
      }
      const pulse = Math.floor(t / 1.6);
      const attack = mode ? mode === 'attack' : Math.floor(t / 4) % 2 === 1;
      for (const [i, u] of m.units.entries()) {
        const s = troopCards[u.card].unit;
        u.px = u.x;
        u.py = u.y;
        // Recovery follows the engine clock after a strike ends too.
        u.sinceHit += dt;
        const effect =
          u.side === 0
            ? status === 'mixed'
              ? ['stun', 'slow', 'haste', 'taunt', 'heal', 'push'][
                  Math.floor(i / 2) % 6
                ]
              : status
            : null;
        u.stun = effect === 'stun' ? 0.5 : 0;
        u.slow = effect === 'slow' ? 1.5 : 0;
        u.slowFactor = effect === 'slow' ? 0.6 : 1;
        u.beat = effect === 'haste' ? 1.3 : 1;
        u.taunt = effect === 'taunt' ? 3 : 0;
        u.tauntId =
          effect === 'taunt'
            ? (m.units.find((v) => v.side !== u.side)?.id ?? null)
            : null;
        if (effect === 'rage') u.hp = u.maxHp * 0.4;
        if (pulse !== lastPulse) {
          if (effect === 'heal')
            view.handle(m, [
              {
                type: 'heal',
                id: u.id,
                ids: [u.id],
                x: u.x,
                y: u.y,
                radius: 0.6,
              },
            ]);
          if (effect === 'push') {
            const fx = u.x;
            u.x += pulse % 2 ? -0.8 : 0.8;
            view.handle(m, [
              {
                type: 'push',
                id: u.id,
                from: m.units.find((v) => v.side !== u.side)?.id ?? u.id,
                fx,
                fy: u.y,
                x: u.x,
                y: u.y,
              },
            ]);
          }
        }
        const deployed = t % 3;
        if (mode === 'deploy' && deployed < (s.burrow ?? 1)) {
          u.state = 'deploying';
          u.deployLeft = (s.burrow ?? 1) - deployed;
          continue;
        }
        if (u.stun > 0) continue;
        if (mode === 'idle') {
          u.state = 'walking';
          continue;
        }
        if (mode === 'march') {
          // Straight ahead at the troop's own pace, back to the start well
          // before the far towers.
          u.state = 'walking';
          u.facing = 0;
          u.y += s.speed * u.beat * u.slowFactor * dt;
          if (u.y > 22) u.y = u.py = 6;
          continue;
        }
        if (mode === 'circle') {
          u.state = 'walking';
          const radius = 1.6;
          const w = (s.speed * u.beat * u.slowFactor) / radius;
          const a = (angles.get(u.id) ?? 0) + w * dt;
          angles.set(u.id, a);
          u.x = 9 + radius * Math.cos(a) - radius;
          u.y = 11 + radius * Math.sin(a);
          u.facing = Math.atan2(-Math.sin(a), Math.cos(a));
          continue;
        }
        if (attack) {
          u.state = 'attacking';
          u.attackTimer -= dt;
          if (u.attackTimer <= 0) {
            u.attackTimer += s.hitSpeed;
            u.sinceHit = 0;
          }
        } else {
          u.state = 'walking';
          // March on the spot at the troop's own pace: a little forward
          // and back.
          const dir = Math.sin(t * 1.6 + u.id) > 0 ? 1 : -1;
          u.y += dir * s.speed * u.beat * u.slowFactor * dt;
          u.facing = dir > 0 ? 0 : Math.PI;
        }
      }
      lastPulse = pulse;
      view.frame(m, 1, dt, t);
      follow();
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      view.dispose();
    };
  }, [prepared]);
  return (
    <main className="arena-game" style={{ position: 'fixed', inset: 0 }}>
      <canvas ref={canvas} className="arena-canvas" />
      {!prepared && (
        <output
          style={{ position: 'absolute', top: 12, left: 12, color: '#fff' }}
        >
          {status}
        </output>
      )}
    </main>
  );
}
