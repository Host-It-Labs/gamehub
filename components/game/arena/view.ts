import * as THREE from 'three';
import { troopCards, troopDeck } from '@/lib/games/arena/cards';
import { plainShot, plainUnit } from '@/lib/games/arena/engine';
import type {
  ArenaEvent,
  Match,
  Projectile,
  Side,
  Unit,
  Threat,
} from '@/lib/games/arena/engine';
import {
  fitCamera,
  lensFor,
  mirrorCamera,
  toField,
  toWorld,
  towerScale,
  troopScale,
  type Frame,
} from '@/lib/games/arena/layout';
import {
  AbilityEffects,
  DeployOverlay,
  GHOST_LAYER,
  Ghost,
  Particles,
  ProjectileViews,
  Scorches,
  SpellViews,
  ThreatMarkers,
} from './effects';
import type { Team } from './materials';
import type { Rung } from './pacer';
import { addDrape } from './wind';
import {
  FLY_HEIGHT,
  TROOP_SCALE,
  TowerCrew,
  TroopRenderer,
  TroopView,
  XRAY_LAYER,
  type RingStyle,
} from './troops';
import { ArenaWorld, type Quality, type WorldAssets } from './world';

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
  /** Share of a troop's shield still standing (0 without one). */
  shield?: number;
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
  /** The match last started or drawn, to place the towers again. */
  private match?: Match;
  private particles: Particles;
  /** The 1 October troops' ability visuals (effects.ts). */
  private abilities: AbilityEffects;
  private projectiles: ProjectileViews;
  private spells: SpellViews;
  private scorches: Scorches;
  readonly overlay: DeployOverlay;
  readonly ghost: Ghost;
  /** The placement warning's rings (arena-game.tsx fills them). */
  readonly threats: ThreatMarkers;
  private shake = 0;
  private base = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmp = new THREE.Vector3();
  private right = new THREE.Vector3();
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
      // This program's depths differ by a hair from the troop's own shader:
      // without a nudge forward, patches of a visible troop miss the mark
      // and its hidden parts flicker through it.
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
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
    // The x-ray pass moves troops' cloth as their own shader does.
    addDrape(this.xray.mark, this.world.wind);
    addDrape(this.xray.troops, this.world.wind);
    this.troopRenderer = new TroopRenderer(this.world);
    this.particles = new Particles(this.world);
    this.abilities = new AbilityEffects(this.world, this.particles);
    this.projectiles = new ProjectileViews(this.world, this.particles);
    this.spells = new SpellViews(this.world, this.particles);
    this.scorches = new Scorches(this.world);
    this.overlay = new DeployOverlay(this.world);
    this.ghost = new Ghost(this.world);
    this.ghost.side = side;
    this.threats = new ThreatMarkers(this.world);
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

  /** The towers (and their crews) for a match at the screen's tower size;
   *  again when the screen changes size class mid-match. */
  private placeTowers(m: Match) {
    this.match = m;
    for (const c of this.crews.values()) c.dispose();
    this.crews.clear();
    this.world.clearTowers();
    this.world.placeTowers(m);
    for (const t of m.towers)
      if (!t.destroyed)
        this.crews.set(
          t.id,
          new TowerCrew(this.world, this.troopRenderer, t, this.team(t.side)),
        );
  }

  start(m: Match) {
    for (const v of this.troops.values()) v.dispose();
    this.troops.clear();
    for (const v of this.dying) v.dispose();
    this.dying = [];
    this.placeTowers(m);
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
          ...plainUnit,
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
      [
        'laser',
        'bolt',
        'arrow',
        'cannon',
        'fire',
        'bomb',
        'zap',
        'shell',
        'drop',
      ] as const
    ).map((kind, i) => ({
      ...plainShot,
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
    const figures = troopScale(lens, frame.width <= 600);
    // Towers stand taller than the troops, larger still on portrait
    // screens; a new size rebuilds them.
    const towers = towerScale(lens);
    if (towers !== this.world.towerScale) {
      this.world.towerScale = towers;
      if (this.match) this.placeTowers(this.match);
    }
    this.troopRenderer.setScale(figures);
    this.ghost.setScale(figures);
    this.projectiles.setScale(figures / TROOP_SCALE);
    this.abilities.size = figures;
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
    if (rung.resolution !== this.resolution)
      this.setResolution(rung.resolution);
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
    if (t) return (t.kind === 'king' ? 2.8 : 2.4) * this.world.towerScale;
    const u = m.units.find((x) => x.id === id);
    if (!u) return 0.6;
    const s = troopCards[u.card].unit;
    return s.flying
      ? FLY_HEIGHT + 0.3
      : Math.max(0.5, s.radius * 1.4 * (this.troopRenderer.scale / 1.3));
  }

  private spot = new THREE.Vector3();

  /** The 1 October troops' abilities: the Drummer's beat, the Sumo's
   *  stomp, the water jet, armour sparks, tackles, knock-backs and the
   *  bees' release (AbilityEffects in effects.ts). */
  private ability(m: Match, e: ArenaEvent) {
    const sideOf = (id: number) =>
      m.units.find((u) => u.id === id)?.side ?? this.side;
    if (e.type === 'beat') {
      const [x, , z] = toWorld(e.x, e.y);
      this.abilities.beat(x, z, e.radius, this.team(sideOf(e.id)));
    } else if (e.type === 'taunt') {
      const [x, , z] = toWorld(e.x, e.y);
      this.abilities.stomp(x, z, e.radius, this.team(sideOf(e.id)));
      this.shake = Math.max(this.shake, 0.45);
    } else if (e.type === 'spray') {
      const [ax, , az] = toWorld(e.x, e.y);
      const [bx, , bz] = toWorld(e.tx, e.ty);
      this.abilities.spray(e.id, ax, az, bx, bz, e.cos);
    } else if (e.type === 'hit' && e.armour) {
      const view = this.troops.get(e.id);
      if (view) {
        const c = view.chest(this.spot);
        this.abilities.armour(c.x, c.y, c.z, e.armour);
      }
    } else if (e.type === 'tackle') {
      const [x, , z] = toWorld(e.x, e.y);
      this.abilities.tackle(x, z);
      this.shake = Math.max(this.shake, 0.18);
    } else if (e.type === 'push') {
      const [x, , z] = toWorld(e.x, e.y);
      const u = m.units.find((u) => u.id === e.id);
      const [fx, , fz] = toWorld(e.fx ?? u?.px ?? e.x, e.fy ?? u?.py ?? e.y);
      this.troops.get(e.id)?.knockback(fx, fz, x, z);
      this.abilities.push(x, z, fx, fz);
    } else if (e.type === 'spawn') {
      const [x, , z] = toWorld(e.x, e.y);
      this.abilities.release(x, z);
    }
  }

  /** Effects for what just happened. */
  handle(m: Match, events: ArenaEvent[]) {
    for (const e of events) {
      this.ability(m, e);
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
        else if (e.kind === 'zap') {
          if (e.fx !== undefined && e.fy !== undefined) {
            const [ax, , az] = toWorld(e.fx, e.fy);
            this.particles.bolt(ax, 0.9, az, x, 0.9, z);
          } else this.particles.zap(x, 0.9, z, [0.6, 0.85, 1]);
        } else if (e.kind === 'shell') {
          this.particles.fire(x, 0.4, z, Math.max(0.7, e.splash));
          this.particles.dust(x, 0.1, z, 14, undefined, 1.5);
          this.shake = Math.max(this.shake, 0.25);
        } else if (e.kind === 'drop') {
          this.particles.fire(x, 0.5, z, Math.max(0.8, e.splash));
          this.particles.dust(x, 0.1, z, 14, undefined, 1.4);
          this.shake = Math.max(this.shake, 0.3);
        } else if (e.kind === 'crash') {
          this.particles.blast(x, z, e.splash * 0.75);
          this.scorches.add(x, z, e.splash * 0.7);
          this.shake = Math.max(this.shake, 0.5);
        } else this.particles.sparks(x, 0.8, z, 5, [1, 0.9, 0.6]);
      } else if (e.type === 'heal') {
        const [x, , z] = toWorld(e.x, e.y);
        this.particles.heal(x, z, e.radius);
        this.abilities.heal(e.ids ?? []);
      } else if (e.type === 'leap' || e.type === 'emerge') {
        const u = m.units.find((x) => x.id === e.id);
        if (u) {
          const [x, , z] = toWorld(u.x, u.y);
          if (e.type === 'emerge') {
            this.particles.dust(x, 0.1, z, 26, [0.55, 0.4, 0.26], 1.6);
            this.shake = Math.max(this.shake, 0.2);
          } else this.particles.dust(x, 0.1, z, 8);
        }
      } else if (e.type === 'shield') {
        const [x, , z] = toWorld(e.x, e.y);
        this.particles.sparks(x, 0.9, z, 14, [1, 0.8, 0.35]);
        this.particles.dust(x, 0.5, z, 8, [0.6, 0.4, 0.25], 1.2);
      } else if (e.type === 'stun') {
        const [x, , z] = toWorld(e.x, e.y);
        this.particles.sparks(x, 1.6, z, 6, [1, 0.95, 0.4]);
      } else if (e.type === 'rage') {
        const u = m.units.find((x) => x.id === e.id);
        if (u) {
          const [x, , z] = toWorld(u.x, u.y);
          this.particles.sparks(x, 1.4, z, 16, [1, 0.35, 0.2]);
        }
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
          this.particles.sparks(
            x,
            4.5 * this.world.towerScale,
            z,
            24,
            [1, 0.85, 0.35],
          );
          // The cannon bursts up out of its deck.
          this.particles.dust(x, 3.3 * this.world.towerScale, z, 10);
        }
      }
    }
  }

  frame(m: Match, alpha: number, dt: number, time: number) {
    this.match = m;
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
      view.frost(u.slow > 0);
      // A Miner tunnelling throws up dirt where he will come out.
      if (
        u.state === 'deploying' &&
        troopCards[u.card].unit.burrow &&
        Math.random() < dt * 8
      ) {
        const p = view.position;
        this.particles.dust(p.x, 0.05, p.z, 2, [0.55, 0.4, 0.26], 0.8);
      }
      if (
        !wasLanded &&
        view.landed &&
        !view.flying &&
        !troopCards[u.card].unit.burrow
      ) {
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
    this.projectiles.sync(
      m,
      alpha,
      (id) => this.heightOf(m, id),
      (id) => this.crews.get(id)?.bow() ?? null,
    );
    this.spells.sync(m, alpha, time);
    this.scorches.update(dt);
    this.abilities.update(dt, m, (id) => {
      const view = this.troops.get(id);
      return view
        ? {
            at: view.position,
            chest: view.chest(this.spot),
            head: view.statusAnchor,
          }
        : null;
    });
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

  /** The troop drawn under a canvas point, for the hover card: of the
   *  troops whose figure (feet to head, as wide as its body on screen)
   *  covers the point, the one nearest its middle line. */
  troopAt(m: Match, px: number, py: number): Unit | null {
    let best: Unit | null = null;
    let bestScore = Infinity;
    const scale = this.troopRenderer.scale;
    for (const u of m.units) {
      const view = this.troops.get(u.id);
      if (!view || u.hp <= 0) continue;
      const s = troopCards[u.card].unit;
      const at = this.tmp.copy(view.position);
      at.y += view.flying ? FLY_HEIGHT - 0.6 : 0;
      const foot = this.project(at);
      at.y += view.flying ? 1.9 : (s.radius * 2.2 + 0.3) * scale;
      const head = this.project(at);
      // Out to the figure's side as the camera sees it (across the field
      // on wide screens).
      at.addScaledVector(
        this.right.setFromMatrixColumn(this.world.camera.matrixWorld, 0),
        s.radius * scale,
      );
      const side = this.project(at);
      if (foot.behind) continue;
      const half = Math.max(10, Math.abs(side.x - head.x) * 1.1);
      // Distance from the point to the feet-to-head segment.
      const dx = head.x - foot.x;
      const dy = head.y - foot.y;
      const len = dx * dx + dy * dy || 1;
      const t = Math.max(
        0,
        Math.min(1, ((px - foot.x) * dx + (py - foot.y) * dy) / len),
      );
      const d = Math.sqrt(
        (px - foot.x - t * dx) ** 2 + (py - foot.y - t * dy) ** 2,
      );
      if (d > half) continue;
      const score = d / half;
      if (score < bestScore) {
        bestScore = score;
        best = u;
      }
    }
    return best;
  }

  /** The rightmost point of the field's side walls on screen above
   *  `maxY`, in canvas pixels: the forest beyond it is free for the hover
   *  card. */
  fieldRight(maxY = Infinity) {
    let right = 0;
    for (const x of [-10.6, 10.6])
      for (let i = 0; i <= 24; i++) {
        const z = -17.5 + (33 * i) / 24;
        for (const y of [0, 1.2]) {
          const p = this.project(this.tmp.set(x, y, z));
          if (p.y <= maxY) right = Math.max(right, p.x);
        }
      }
    return right;
  }

  /** The lowest point of the field's side walls on screen right of
   *  `minX`, in canvas pixels: looking across the field, the meadow below
   *  it, beside the hand, is free for the hover card. */
  fieldBottom(minX = 0) {
    let bottom = 0;
    for (const x of [-10.6, 10.6])
      for (let i = 0; i <= 24; i++) {
        const z = -17.5 + (35 * i) / 24;
        for (const y of [0, 1.2]) {
          const p = this.project(this.tmp.set(x, y, z));
          if (p.x >= minX) bottom = Math.max(bottom, p.y);
        }
      }
    return bottom;
  }

  /** Health bars for the HTML layer, in canvas pixels. */
  bars(m: Match): Bar[] {
    // A shield's full strength scales with the troop's hit points.
    const full = (u: Match['units'][number]) =>
      Math.max(
        1,
        (troopCards[u.card].unit.shield ?? 0) *
          (u.maxHp / troopCards[u.card].unit.hp),
      );
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
        visible:
          (u.hp < u.maxHp || (!!s.shield && u.shield < full(u))) &&
          u.state !== 'deploying',
        shield: s.shield ? u.shield / full(u) : 0,
      });
    }
    return out;
  }

  showThreats(m: Match, threats: Threat[]) {
    this.threats.show(
      threats.map((threat) => {
        const tower = m.towers.find((t) => t.id === threat.id);
        const unit = m.units.find((u) => u.id === threat.id);
        const stats = unit ? troopCards[unit.card].unit : null;
        const height = tower
          ? (this.world.towers.get(tower.id)?.top.y ?? 4) + 0.7
          : stats?.flying
            ? FLY_HEIGHT + 1.8
            : ((stats?.radius ?? 0.5) * 2.2 + 0.55) * this.troopRenderer.scale;
        return { ...threat, height };
      }),
    );
  }

  dispose() {
    for (const v of this.troops.values()) v.dispose();
    for (const v of this.dying) v.dispose();
    for (const c of this.crews.values()) c.dispose();
    this.troopRenderer.dispose();
    this.particles.dispose();
    this.abilities.dispose();
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
