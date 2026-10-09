import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COUNTER_Z, D, W } from '@/lib/games/diner/layout';
import type { PlaceId } from '@/lib/games/diner/road';

/**
 * Evening on the patio (9 October 2026, calmer than the 8 October night):
 * one soft warm flood over the whole deck, a cool moon from behind for rims,
 * a warm glow inside the kitchen hatch, and the place fading into a dusky
 * haze. Exposure and bloom are low so plates, outfits and bubbles stay the
 * brightest things on screen.
 */
type Mood = {
  /** Haze and empty sky. */
  fog: string;
  sky: string;
  ground: string;
  moon: string;
};
const MOODS: Record<PlaceId, Mood> = {
  truckstop: {
    fog: '#1f2131',
    sky: '#7a7fa8',
    ground: '#3a302c',
    moon: '#b9c4f0',
  },
  drivein: {
    fog: '#18203a',
    sky: '#6f84b0',
    ground: '#30302e',
    moon: '#aec3f0',
  },
  fairground: {
    fog: '#211c33',
    sky: '#8a7fa8',
    ground: '#2f3a2c',
    moon: '#c9bff0',
  },
  harbour: {
    fog: '#152634',
    sky: '#6c90a8',
    ground: '#2c2a28',
    moon: '#b0d8f0',
  },
  oldtown: {
    fog: '#211d29',
    sky: '#8a7f9a',
    ground: '#3a302c',
    moon: '#d6cbea',
  },
  moonmile: {
    fog: '#24183a',
    sky: '#9a82c0',
    ground: '#3a2c34',
    moon: '#e2d8ff',
  },
};

export type NightRig = {
  /** The flood over the deck; the view tunes its shadow map. */
  key: THREE.DirectionalLight | THREE.SpotLight;
  /** Brownouts dim the deck and the kitchen. */
  update(power: boolean, time: number): void;
  dispose(): void;
};

const KEY = 2.4;
const KITCHEN = 5;

export function nightRig(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  place: PlaceId,
): NightRig {
  const mood = MOODS[place];
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  scene.background = new THREE.Color(mood.fog);
  scene.fog = new THREE.Fog(mood.fog, 42, 110);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  scene.environment = env.texture;
  scene.environmentIntensity = 0.16;

  const hemi = new THREE.HemisphereLight(mood.sky, mood.ground, 0.42);
  const moon = new THREE.DirectionalLight(mood.moon, 0.45);
  moon.position.set(-20, 26, -30);
  moon.target.position.set(W / 2, 0, D / 2);
  // One soft warm flood from high in front: even across the whole deck,
  // casting the shadows that seat the furniture and people.
  const key = new THREE.DirectionalLight('#ffe1bb', KEY);
  key.position.set(W / 2 - 16, 19, D + 9);
  key.target.position.set(W / 2, 0, D / 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -W * 0.7;
  sc.right = W * 0.7;
  sc.top = 11;
  sc.bottom = -11;
  sc.near = 4;
  sc.far = 60;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 4;
  // Warm light inside the kitchen hatch, along the line of machines.
  const kitchen = [W * 0.2, W * 0.5, W * 0.8].map((x) => {
    const l = new THREE.PointLight('#ffc88a', KITCHEN, 6.5, 1.6);
    l.position.set(x, 2.3, COUNTER_Z - 0.6);
    return l;
  });
  scene.add(hemi, moon, moon.target, key, key.target, ...kitchen);
  let level = 1;
  return {
    key,
    update(power, time) {
      const goal = power
        ? 1
        : 0.4 + 0.08 * Math.sin(time * 23) * Math.sin(time * 7);
      level += (goal - level) * 0.2;
      key.intensity = KEY * (0.55 + 0.45 * level);
      for (const l of kitchen) l.intensity = KITCHEN * level;
    },
    dispose() {
      scene.remove(hemi, moon, moon.target, key, key.target, ...kitchen);
      key.shadow.dispose();
      env.dispose();
      scene.environment = null;
      scene.fog = null;
    },
  };
}
