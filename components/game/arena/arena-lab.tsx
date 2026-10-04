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
import { ArenaView } from './view';
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
 * `?figures=/3d/arena/dev/<name>.glb` swaps in a figures GLB built for a
 * look before it ships (public/3d/arena/dev is not tracked).
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
    lineup.forEach((card, i) => {
      for (const side of [0, 1] as const) {
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
        };
        m.units.push(u);
      }
    });
    const resize = () => {
      const r = canvas.current!.getBoundingClientRect();
      view.resize({ width: r.width, height: r.height, top: 0, bottom: 0 });
      if (params.has('far')) return;
      view.setCamera([0, 6.5, 13], [0, 0.55, 3.7], 38);
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
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;
      if (mode === 'battle') {
        accumulated += dt;
        while (accumulated >= TICK) {
          step(m);
          accumulated -= TICK;
        }
        view.handle(m, m.events);
        m.events.length = 0;
        view.frame(m, accumulated / TICK, dt, t);
        return;
      }
      const pulse = Math.floor(t / 1.6);
      const attack = mode ? mode === 'attack' : Math.floor(t / 4) % 2 === 1;
      for (const [i, u] of m.units.entries()) {
        const s = troopCards[u.card].unit;
        u.px = u.x;
        u.py = u.y;
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
                from: m.units[1].id,
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
        if (attack) {
          u.state = 'attacking';
          u.attackTimer -= dt;
          u.sinceHit += dt;
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
