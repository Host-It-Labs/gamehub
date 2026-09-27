'use client';
import { useEffect, useRef, useState } from 'react';
import { troopCards, troopDeck } from '@/lib/games/arena/cards';
import { createMatch, type Unit } from '@/lib/games/arena/engine';
import { pickQuality, prepare, type Prepared } from './load';
import { ArenaView } from './view';
import './arena.css';

/**
 * Dev bench at /arena/lab: every troop of both sides lined up on the field
 * under the game's light, alternating walking and attacking, with a close
 * camera (spells have no troop, so the Meteor is left out).
 * `?mode=walk|attack|idle` holds one state; `?far` uses the game's own
 * framing.
 */
export default function ArenaLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [status, setStatus] = useState('Loading');
  useEffect(() => {
    void prepare(pickQuality().tier, (p) =>
      setStatus(`${((p.loaded / p.total) * 100).toFixed(0)}%`),
    ).then(setPrepared);
  }, []);
  useEffect(() => {
    if (!prepared || !canvas.current) return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const view = new ArenaView(canvas.current, prepared, pickQuality());
    const m = createMatch(1);
    m.phase = 'battle';
    view.start(m);
    (window as unknown as { arenaLab: unknown }).arenaLab = { view, m };
    // Your towers would stand between the camera and the line-up.
    if (!params.has('far'))
      for (const t of view.world.towers.values())
        if (t.side === 0) t.root.visible = false;
    let id = 1000;
    troopDeck.forEach((card, i) => {
      for (const side of [0, 1] as const) {
        const x = 1.3 + i * 2.2;
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
        };
        m.units.push(u);
      }
    });
    const resize = () => {
      const r = canvas.current!.getBoundingClientRect();
      view.resize({ width: r.width, height: r.height, top: 0, bottom: 0 });
      if (!params.has('far')) view.setCamera([0, 6.5, 13], [0, 0.55, 3.7], 38);
    };
    resize();
    window.addEventListener('resize', resize);
    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;
      const attack = mode ? mode === 'attack' : Math.floor(t / 4) % 2 === 1;
      for (const u of m.units) {
        const s = troopCards[u.card].unit;
        u.px = u.x;
        u.py = u.y;
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
          // March on the spot: a little forward and back.
          const dir = Math.sin(t * 0.8 + u.id) > 0 ? 1 : -1;
          u.y += dir * s.speed * dt * 0.5;
          u.facing = dir > 0 ? 0 : Math.PI;
        }
      }
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
