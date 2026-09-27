import * as THREE from 'three';
import { troopCards, troopDeck } from '@/lib/games/arena/cards';
import type {
  ArenaEvent,
  Match,
  Projectile,
  Side,
  Unit,
} from '@/lib/games/arena/engine';
import {
  fitCamera,
  lensFor,
  mirrorCamera,
  toField,
  toWorld,
  troopScale,
  type Frame,
} from '@/lib/games/arena/layout';
import {
  DeployOverlay,
  GHOST_LAYER,
  Ghost,
  Particles,
  ProjectileViews,
  Scorches,
  SpellViews,
  ThreatRings,
} from './effects';
import type { Team } from './materials';
import type { Rung } from './pacer';
import {
  FLY_HEIGHT,
  TROOP_SCALE,
  TowerCrew,
  TroopRenderer,
  TroopView,
  XRAY_LAYER,
  type RingStyle,
} from './troops';
import { ArenaWorld, TOWER_SCALE, type Quality, type WorldAssets } from './world';

export type Bar = {
  id: number;
  kind: 'troop' | 'princess' | 'king';
  /** 0 for the viewer's team, 1 for the other. */
  team: Team;
  hp: number;
  max: number;
  x: number;
  y: number;
  visible: boolean;
  asleep?: boolean;
};

/**
 * Everything drawn for one match: the world, a view per troop, the tower
 * crews, projectiles and particles. The React table owns the loop and calls
 * `frame()`; this class turns engine state and events into pictures. It is
 * drawn for one player: their side sits nearest the camera, their team is
 * blue and their own troops wear the brightest ring.
 */
export class ArenaView {
  readonly world: ArenaWorld;
  private troopRenderer: TroopRenderer;
  private troops = new Map<number, TroopView>();
  private dying: TroopView[] = [];
  private crews = new Map<number, TowerCrew>();
  private particles: Particles;
  private projectiles: ProjectileViews;
  private spells: SpellViews;
  private scorches: Scorches;
  readonly overlay: DeployOverlay;
  readonly ghost: Ghost;
  /** The placement warning's rings (arena-game.tsx fills them). */
  readonly threats: ThreatRings;
  private shake = 0;
  private base = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmp = new THREE.Vector3();
  private size = { width: 1, height: 1 };
  private resolution = 1;
  scale = 20;
  /** The x-ray pass: first mark where troops are seen, then draw their
   *  hidden parts once each, flat and translucent, where something nearer
   *  covers them. */
  private xray = {
    mark: new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      depthFunc: THREE.LessEqualDepth,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
    }),
    troops: this.silhouette(0xffffff),
    ghost: this.silhouette(0x8fb6ff),
  };

  constructor(
    canvas: HTMLCanvasElement,
    assets: WorldAssets,
    quality: Quality,
    /** The viewer's side and seat. */
    readonly side: Side = 0,
    readonly you = 0,
  ) {
    this.world = new ArenaWorld(canvas, assets, quality, side);
    this.troopRenderer = new TroopRenderer(this.world);
    this.particles = new Particles(this.world);
    this.projectiles = new ProjectileViews(this.world, this.particles);
    this.spells = new SpellViews(this.world, this.particles);
    this.scorches = new Scorches(this.world);
    this.overlay = new DeployOverlay(this.world);
    this.ghost = new Ghost(this.world);
    this.ghost.side = side;
    this.threats = new ThreatRings(this.world);
  }

  /** A hidden part's look: the batch colour (the team's) over white, drawn
   *  only behind what is already there and only once per pixel. */
  private silhouette(color: number) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      depthFunc: THREE.GreaterDepth,
      // Grazing the ground or a tuft is not hiding.
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -40,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.NotEqualStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
      toneMapped: false,
    });
  }

  /** Draws the troops (and the ghost) where towers, bridges or scenery
   *  hide them, as soft team-coloured silhouettes. */
  private drawXray() {
    const { renderer, scene, camera } = this.world;
    const saved = {
      background: scene.background,
      fog: scene.fog,
      override: scene.overrideMaterial,
      mask: camera.layers.mask,
      autoClear: renderer.autoClear,
      shadows: renderer.shadowMap.autoUpdate,
    };
    scene.background = null;
    scene.fog = null;
    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false;
    camera.layers.set(XRAY_LAYER);
    this.troopRenderer.xray(true);
    scene.overrideMaterial = this.xray.mark;
    renderer.render(scene, camera);
    scene.overrideMaterial = this.xray.troops;
    renderer.render(scene, camera);
    this.troopRenderer.xray(false);
    if (this.ghost.group.visible) {
      camera.layers.set(GHOST_LAYER);
      scene.overrideMaterial = this.xray.ghost;
      renderer.render(scene, camera);
    }
    scene.background = saved.background;
    scene.fog = saved.fog;
    scene.overrideMaterial = saved.override;
    camera.layers.mask = saved.mask;
    renderer.autoClear = saved.autoClear;
    renderer.shadowMap.autoUpdate = saved.shadows;
  }

  /** Blue for the viewer's team, red for the other. */
  team(side: Side): Team {
    return side === this.side ? 0 : 1;
  }

  private ringOf(side: Side, owner: number): RingStyle {
    if (side !== this.side) return 1;
    return owner === this.you ? 0 : 2;
  }

  start(m: Match) {
    for (const v of this.troops.values()) v.dispose();
    this.troops.clear();
    for (const v of this.dying) v.dispose();
    this.dying = [];
    for (const c of this.crews.values()) c.dispose();
    this.crews.clear();
    this.world.clearTowers();
    this.world.placeTowers(m);
    for (const t of m.towers)
      this.crews.set(
        t.id,
        new TowerCrew(this.world, this.troopRenderer, t, this.team(t.side)),
      );
    // Build every shader now rather than when the first troop lands.
    this.world.renderer.compile(this.world.scene, this.world.camera);
  }

  /**
   * Builds every shader before the battle shows. three.js compiles a shader
   * the first time something is drawn with it, which stalls a frame; so one
   * of every troop, shot, particle, the rubble and the drop zone are drawn
   * once out of sight, then cleared away.
   */
  async warm(m: Match) {
    const { world } = this;
    const extras: TroopView[] = [];
    let id = -1;
    for (const card of troopDeck)
      for (const team of [0, 1] as Team[]) {
        const u: Unit = {
          id,
          side: 0,
          owner: 0,
          card,
          x: 9,
          y: 16,
          px: 9,
          py: 16,
          hp: 1,
          maxHp: 1,
          state: 'walking',
          deployLeft: 0,
          targetId: null,
          attackTimer: 1,
          facing: 0,
          sinceHit: 99,
          lane: 0,
          bridge: -1,
        };
        const view = new TroopView(this.troopRenderer, id--, card, team, team);
        view.update(u, 1, 0, 0);
        extras.push(view);
      }
    this.troopRenderer.flush();
    const towers = [...world.towers.values()];
    for (const t of towers) t.rubble.visible = true;
    this.overlay.mesh.visible = true;
    this.ghost.show(troopDeck[0], 9, 10, true);
    const shots: Projectile[] = (
      ['laser', 'bolt', 'arrow', 'cannon', 'fire', 'bomb'] as const
    ).map((kind, i) => ({
      id: -100 - i,
      side: 0,
      kind,
      sourceId: 0,
      targetId: 0,
      x: 9,
      y: 16,
      sx: 9,
      sy: 16,
      sz: 1,
      tx: 9,
      ty: 17,
      speed: 1,
      damage: 0,
      splash: 0,
      air: true,
      travelled: 0,
      distance: 1,
    }));
    this.projectiles.sync({ ...m, projectiles: shots }, 0, () => 1);
    this.spells.sync(
      {
        ...m,
        spells: [
          {
            id: -200,
            side: 0,
            owner: 0,
            card: 'meteor',
            x: 9,
            y: 16,
            left: 0.5,
            delay: 1,
            radius: 2.5,
            damage: 0,
            towerDamage: 0,
            knockback: 0,
            knockMass: 0,
          },
        ],
      },
      0,
      0,
    );
    this.scorches.add(0, 400, 1);
    // Particles below the ground and debris far off: drawn, never seen.
    this.particles.fire(0, -30, 0, 1);
    this.particles.smokePuff(0, -30, 0, 1);
    this.particles.collapse(0, 400, false);
    this.particles.update(0.016);
    await world.renderer.compileAsync(world.scene, world.camera);
    world.render();
    for (const view of extras) view.dispose();
    this.troopRenderer.flush();
    for (const t of towers) t.rubble.visible = t.destroyed;
    this.overlay.mesh.visible = false;
    this.ghost.show(null, 0, 0, false);
    this.projectiles.sync(m, 0, () => 1);
    this.spells.sync(m, 0, 0);
  }

  /** After a resync, show towers that fell while this device was behind. */
  reconcile(m: Match) {
    for (const t of m.towers) {
      const view = this.world.towers.get(t.id);
      if (!view || !t.destroyed || view.destroyed) continue;
      view.destroyed = true;
      view.root.visible = false;
      view.rubble.visible = true;
      this.crews.get(t.id)?.dispose();
      this.crews.delete(t.id);
    }
  }

  resize(frame: Frame) {
    this.size = { width: frame.width, height: frame.height };
    this.world.resize(frame.width, frame.height);
    const lens = lensFor(frame);
    const fit = fitCamera(frame, lens);
    const cam = this.side === 1 ? mirrorCamera(fit) : fit;
    // Figures, their rings, shots and bars grow on portrait phones.
    const figures = troopScale(lens, this.world.quality.tier === 'lite');
    this.troopRenderer.setScale(figures);
    this.ghost.setScale(figures);
    this.projectiles.setScale(figures / TROOP_SCALE);
    this.scale = cam.scale;
    this.base.position.set(...cam.position);
    this.base.target.set(...cam.target);
    this.world.setCamera(cam.position, cam.target, cam.fov);
    this.particles.setScale(
      cam.scale * this.world.quality.pixelRatio * this.resolution,
    );
  }

  /** Take one of the pacer's settings (pacer.ts). */
  setRung(rung: Rung) {
    this.world.shadowEvery = rung.shadowEvery;
    this.world.setShadowSize(rung.shadowSize);
    if (rung.resolution !== this.resolution) this.setResolution(rung.resolution);
  }

  /** Draw at a fraction of the device's pixel ratio. */
  setResolution(scale: number) {
    this.resolution = scale;
    const ratio = this.world.quality.pixelRatio * scale;
    this.world.renderer.setPixelRatio(ratio);
    this.world.resize(this.size.width, this.size.height);
    this.particles.setScale(this.scale * ratio);
  }

  /** Aim the camera by hand (the dev bench); resize() restores the fit. */
  setCamera(
    position: [number, number, number],
    target: [number, number, number],
    fov: number,
  ) {
    this.base.position.set(...position);
    this.base.target.set(...target);
    this.world.setCamera(position, target, fov);
  }

  /** Field coordinates under a point on the canvas, or null off the field. */
  pick(px: number, py: number): [number, number] | null {
    const ndc = new THREE.Vector2(
      (px / this.size.width) * 2 - 1,
      -(py / this.size.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.world.camera);
    const hit = this.raycaster.ray.intersectPlane(this.plane, this.tmp);
    if (!hit) return null;
    return toField(hit.x, hit.z);
  }

  /** Screen position of a world point, in canvas pixels. */
  project(v: THREE.Vector3) {
    const p = v.clone().project(this.world.camera);
    return {
      x: (p.x * 0.5 + 0.5) * this.size.width,
      y: (-p.y * 0.5 + 0.5) * this.size.height,
      behind: p.z > 1,
    };
  }

  private heightOf(m: Match, id: number) {
    const t = m.towers.find((x) => x.id === id);
    if (t) return (t.kind === 'king' ? 2.8 : 2.4) * TOWER_SCALE;
    const u = m.units.find((x) => x.id === id);
    if (!u) return 0.6;
    const s = troopCards[u.card].unit;
    return s.flying
      ? FLY_HEIGHT + 0.3
      : Math.max(0.5, s.radius * 1.4 * (this.troopRenderer.scale / 1.3));
  }

  /** Effects for what just happened. */
  handle(m: Match, events: ArenaEvent[]) {
    for (const e of events) {
      if (e.type === 'impact') {
        const [x, , z] = toWorld(e.x, e.y);
        if (e.kind === 'meteor') {
          this.particles.blast(x, z, e.splash);
          this.scorches.add(x, z, e.splash);
          this.shake = Math.max(this.shake, 0.8);
        } else if (e.kind === 'fire')
          this.particles.fire(x, 0.6, z, Math.max(0.6, e.splash));
        else if (e.kind === 'bomb') {
          this.particles.fire(x, 0.4, z, Math.max(0.6, e.splash));
          this.particles.dust(x, 0.1, z, 10, undefined, 1.3);
        } else if (e.kind === 'cannon') {
          this.particles.sparks(x, 0.8, z, 6);
          this.particles.dust(x, 0.2, z, 6);
        } else if (e.kind === 'arrow') {
          this.particles.sparks(x, 0.8, z, 3, [1, 0.92, 0.75]);
          this.particles.dust(x, 0.15, z, 3);
        } else if (e.kind === 'laser')
          this.particles.zap(x, 0.9, z, [0.85, 0.95, 1]);
        else this.particles.sparks(x, 0.8, z, 5, [1, 0.9, 0.6]);
      } else if (e.type === 'hit') {
        this.troops.get(e.id)?.hit();
      } else if (e.type === 'swing') {
        const u = m.units.find((x) => x.id === e.id);
        const target = u && m.units.find((x) => x.id === u.targetId);
        const tower = u && m.towers.find((x) => x.id === u.targetId);
        const at = target ?? tower;
        if (u && at) {
          const [x, , z] = toWorld((u.x + at.x) / 2, (u.y + at.y) / 2);
          this.particles.sparks(x, 0.7, z, u.card === 'ogre' ? 12 : 6);
          if (u.card === 'ogre' || u.card === 'duelist')
            this.particles.dust(x, 0.1, z, 8, undefined, 1.2);
        }
      } else if (e.type === 'death') {
        const view = this.troops.get(e.id);
        const [x, , z] = toWorld(e.x, e.y);
        const unit = troopCards[e.card].unit;
        // Knocked out: the figure topples and goes in a puff of dust.
        this.particles.smokePuff(
          x,
          unit.flying ? FLY_HEIGHT : 0.2,
          z,
          unit.radius * 1.4,
        );
        if (view) {
          view.dying = 0;
          this.troops.delete(e.id);
          this.dying.push(view);
        }
      } else if (e.type === 'tower') {
        const view = this.world.towers.get(e.id);
        if (view && !view.destroyed) {
          view.destroyed = true;
          view.root.visible = false;
          view.rubble.visible = true;
          const big = view.kind === 'king';
          this.particles.collapse(
            view.root.position.x,
            view.root.position.z,
            big,
          );
          this.shake = big ? 1 : 0.7;
          this.crews.get(e.id)?.dispose();
          this.crews.delete(e.id);
        }
      } else if (e.type === 'shot') {
        this.crews.get(e.id)?.shot();
      } else if (e.type === 'king-wakes') {
        const king = m.towers.find(
          (t) => t.side === e.side && t.kind === 'king',
        );
        if (king) {
          const [x, , z] = toWorld(king.x, king.y);
          this.particles.sparks(x, 4.5 * TOWER_SCALE, z, 24, [1, 0.85, 0.35]);
        }
      }
    }
  }

  frame(m: Match, alpha: number, dt: number, time: number) {
    const seen = new Set<number>();
    for (const u of m.units) {
      seen.add(u.id);
      let view = this.troops.get(u.id);
      if (!view) {
        view = new TroopView(
          this.troopRenderer,
          u.id,
          u.card,
          this.team(u.side),
          this.ringOf(u.side, u.owner),
        );
        this.troops.set(u.id, view);
      }
      const wasLanded = view.landed;
      view.update(u, alpha, dt, time);
      if (!wasLanded && view.landed && !view.flying) {
        const p = view.position;
        this.particles.dust(
          p.x,
          p.y,
          p.z,
          troopCards[u.card].unit.mass > 10 ? 22 : 10,
        );
        if (troopCards[u.card].unit.mass > 10)
          this.shake = Math.max(this.shake, 0.35);
      }
    }
    for (const [id, view] of this.troops)
      if (!seen.has(id)) {
        view.dispose();
        this.troops.delete(id);
      }
    this.dying = this.dying.filter((v) => {
      const done = v.fade(dt);
      if (done) v.dispose();
      return !done;
    });
    for (const t of m.towers) {
      const crew = this.crews.get(t.id);
      if (!crew) continue;
      const target = m.units.find((u) => u.id === t.targetId);
      const tv = target && this.troops.get(target.id);
      crew.update(t, tv ? tv.chest(this.tmp) : null, dt, time);
    }
    this.troopRenderer.flush();
    this.projectiles.sync(m, alpha, (id) => this.heightOf(m, id));
    this.spells.sync(m, alpha, time);
    this.scorches.update(dt);
    this.particles.update(dt);
    (this.world.water.material as THREE.ShaderMaterial).uniforms.uTime.value =
      time;
    this.overlay.show(this.overlayOn, time);
    this.threats.update(dt, time);
    // A short shake when towers fall or heavy troops land.
    const cam = this.world.camera;
    if (this.shake > 0.001) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      const k = this.shake * this.shake * 0.35;
      cam.position.set(
        this.base.position.x + Math.sin(time * 61) * k,
        this.base.position.y + Math.sin(time * 47) * k * 0.6,
        this.base.position.z + Math.cos(time * 53) * k,
      );
      cam.lookAt(this.base.target);
    } else if (!cam.position.equals(this.base.position)) {
      cam.position.copy(this.base.position);
      cam.lookAt(this.base.target);
    }
    // The frame's draw calls add up across the passes.
    const info = this.world.renderer.info;
    info.autoReset = false;
    info.reset();
    this.world.render();
    if (this.xrayOn) this.drawXray();
  }

  /** The x-ray pass can be switched off to measure it (dev bench). */
  xrayOn = true;

  overlayOn = false;

  /** How much larger than their footprint troops are drawn right now. */
  get figureScale() {
    return this.troopRenderer.scale;
  }

  /** Health bars for the HTML layer, in canvas pixels. */
  bars(m: Match): Bar[] {
    const out: Bar[] = [];
    for (const t of m.towers) {
      if (t.destroyed) continue;
      const view = this.world.towers.get(t.id);
      if (!view) continue;
      const p = this.project(view.top);
      out.push({
        id: t.id,
        kind: t.kind,
        team: this.team(t.side),
        hp: t.hp,
        max: t.maxHp,
        x: p.x,
        y: p.y,
        visible: true,
        asleep: t.kind === 'king' && !t.active,
      });
    }
    for (const u of m.units) {
      const view = this.troops.get(u.id);
      if (!view) continue;
      const s = troopCards[u.card].unit;
      const top = this.tmp.copy(view.position);
      top.y += view.flying
        ? FLY_HEIGHT + 1.3
        : (s.radius * 2.2 + 0.3) * this.troopRenderer.scale;
      const p = this.project(top);
      out.push({
        id: u.id,
        kind: 'troop',
        team: this.team(u.side),
        hp: u.hp,
        max: u.maxHp,
        x: p.x,
        y: p.y,
        visible: u.hp < u.maxHp && u.state !== 'deploying',
      });
    }
    return out;
  }

  dispose() {
    for (const v of this.troops.values()) v.dispose();
    for (const v of this.dying) v.dispose();
    for (const c of this.crews.values()) c.dispose();
    this.troopRenderer.dispose();
    this.particles.dispose();
    this.projectiles.dispose();
    this.spells.dispose();
    this.scorches.dispose();
    this.overlay.dispose();
    this.ghost.dispose();
    this.threats.dispose();
    for (const m of Object.values(this.xray)) m.dispose();
    this.world.dispose();
  }
}
