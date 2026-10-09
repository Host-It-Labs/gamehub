import * as THREE from 'three';
import { SHIRTS, SKINS, type Look } from '@/lib/games/diner/content';
import { type Kit, type Materials } from './kit';
import { cached, shared } from './model-cache';
import {
  HUMAN,
  sculptForearm,
  sculptHand,
  sculptHead,
  sculptLids,
  sculptLeg,
  sculptMouth,
  sculptShoe,
  sculptTorso,
  sculptUpperArm,
  withPeopleDetail,
  type Expression,
  type PeopleDetail,
} from './people-geometry';
import { SEAT_COLOURS } from './seats';

export type { Expression } from './people-geometry';
export type { PeopleDetail } from './people-geometry';
type Pair = [THREE.Object3D, THREE.Object3D];
export type FigureJoints = {
  hips: Pair;
  knees: Pair;
  ankles: Pair;
  shoulders: Pair;
  elbows: Pair;
  wrists: Pair;
};
export type Figure = {
  root: THREE.Group;
  body: THREE.Group;
  /** The compatibility arrays name hip and shoulder pivots, never whole limbs. */
  legs: [THREE.Object3D, THREE.Object3D];
  arms?: [THREE.Object3D, THREE.Object3D];
  joints?: FigureJoints;
  head?: THREE.Group;
  face?: { lids: THREE.Group; mouths: Record<Expression, THREE.Group> };
  hold?: THREE.Group;
};

const source = 'diner-person-v9';
const cream = '#fff7e8';
const trousers = ['#414054', '#584b43', '#333842', '#615951'];

function peopleCached(
  detail: PeopleDetail,
  key: string,
  build: (kit: Kit) => void,
) {
  return cached(`${source}:${detail}:${key}`, (kit) =>
    withPeopleDetail(detail, () => build(kit)),
  );
}

function head(
  materials: Materials,
  look: Look,
  uniform: string | null,
  detail: PeopleDetail,
) {
  const group = new THREE.Group();
  group.name = 'sculpted-head';
  group.position.y = HUMAN.head;
  const key = `${look.skin}:${look.hair}:${look.hat}:${+look.glasses}:${uniform}`;
  group.add(
    shared(
      peopleCached(detail, `head:${key}`, (kit) =>
        sculptHead(kit, look, uniform),
      ),
      materials,
    ),
  );
  const lids = shared(
    peopleCached(detail, `lids:${look.skin}`, (kit) =>
      sculptLids(kit, SKINS[look.skin]),
    ),
    materials,
    false,
  );
  lids.name = 'soft-eyelids';
  lids.position.y = 0.036;
  for (const mesh of lids.children) mesh.position.y = -0.036;
  lids.visible = false;
  group.add(lids);
  const mouths = Object.fromEntries(
    (['rest', 'smile', 'frown', 'eat'] as Expression[]).map((mood) => {
      const mouth = shared(
        peopleCached(detail, `mouth:${look.skin}:${mood}`, (kit) =>
          sculptMouth(kit, SKINS[look.skin], mood),
        ),
        materials,
        false,
      );
      mouth.name = `expression-${mood}`;
      mouth.visible = mood === 'rest';
      group.add(mouth);
      return [mood, mouth];
    }),
  ) as Record<Expression, THREE.Group>;
  return { group, face: { lids, mouths } };
}

function limbs(
  materials: Materials,
  shirt: string,
  skin: string,
  pants: string,
  stripes: boolean,
  waiter: boolean,
  detail: PeopleDetail,
) {
  const hips = [new THREE.Bone(), new THREE.Bone()] as const;
  const knees = [new THREE.Bone(), new THREE.Bone()] as const;
  const ankles = [new THREE.Bone(), new THREE.Bone()] as const;
  const shoulders = [new THREE.Bone(), new THREE.Bone()] as const;
  const elbows = [new THREE.Bone(), new THREE.Bone()] as const;
  const wrists: Pair = [new THREE.Group(), new THREE.Group()];
  const pelvis = new THREE.Bone();
  pelvis.name = 'tailored-pelvis';
  const skinnedLimbs: THREE.SkinnedMesh[] = [];
  const shoe = peopleCached(detail, `shoe:${+waiter}`, (kit) =>
    sculptShoe(kit, waiter),
  );
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    hips[i].name = `${i ? 'right' : 'left'}-hip`;
    hips[i].position.set(side * 0.083, HUMAN.hip, 0);
    hips[i].add(knees[i]);
    knees[i].name = `${i ? 'right' : 'left'}-knee`;
    knees[i].position.y = -HUMAN.thigh;
    knees[i].add(ankles[i]);
    ankles[i].name = `${i ? 'right' : 'left'}-ankle`;
    ankles[i].position.y = -HUMAN.shin;
    ankles[i].add(shared(shoe, materials));

    const parts = peopleCached(
      detail,
      `continuous-leg:${pants}:${side}`,
      (kit) => sculptLeg(kit, pants, side),
    );
    const geometry = parts.cloth!;
    if (!geometry.getAttribute('skinIndex')) {
      const position = geometry.getAttribute('position');
      const indices = new Uint16Array(position.count * 4);
      const weights = new Float32Array(position.count * 4);
      for (let v = 0; v < position.count; v++) {
        const y = position.getY(v) - HUMAN.hip;
        const blend = THREE.MathUtils.smoothstep(
          -y,
          HUMAN.thigh - 0.053,
          HUMAN.thigh + 0.053,
        );
        const hip = THREE.MathUtils.smoothstep(-y, 0.01, 0.12);
        indices.set([0, 1, 2, 3], v * 4);
        weights.set([1 - hip, hip * (1 - blend), hip * blend, 0], v * 4);
      }
      geometry.setAttribute(
        'skinIndex',
        new THREE.Uint16BufferAttribute(indices, 4),
      );
      geometry.setAttribute(
        'skinWeight',
        new THREE.Float32BufferAttribute(weights, 4),
      );
    }
    // Transfer the existing shared-cache reference to the skinned cloth mesh.
    const holder = shared(parts, materials);
    const original = holder.children[0] as THREE.Mesh;
    const cloth = new THREE.SkinnedMesh(original.geometry, original.material);
    cloth.name = `continuous-${i ? 'right' : 'left'}-trouser-leg`;
    cloth.userData.dinerShared = true;
    original.userData.dinerShared = false;
    cloth.castShadow = true;
    cloth.receiveShadow = false;
    hips[i].updateMatrixWorld(true);
    cloth.bind(new THREE.Skeleton([pelvis, hips[i], knees[i], ankles[i]]));
    skinnedLimbs.push(cloth);
    shoulders[i].name = `${i ? 'right' : 'left'}-shoulder`;
    shoulders[i].position.set(side * 0.204, HUMAN.shoulder, 0);
    shoulders[i].add(
      shared(
        peopleCached(detail, `sleeve:${shirt}:${+stripes}:${side}`, (kit) =>
          sculptUpperArm(kit, shirt, stripes, side),
        ),
        materials,
      ),
      elbows[i],
    );
    elbows[i].name = `${i ? 'right' : 'left'}-elbow`;
    elbows[i].position.y = -HUMAN.upperArm;
    elbows[i].add(wrists[i]);
    const skinParts = peopleCached(
      detail,
      `continuous-arm:${skin}:${side}`,
      (kit) => {
        sculptForearm(kit, skin, side);
        for (const geometry of kit.parts.skin ?? [])
          geometry.translate(side * 0.204, HUMAN.shoulder - HUMAN.upperArm, 0);
      },
    );
    const skinGeometry = skinParts.skin!;
    if (!skinGeometry.getAttribute('skinIndex')) {
      const position = skinGeometry.getAttribute('position');
      const indices = new Uint16Array(position.count * 4);
      const weights = new Float32Array(position.count * 4);
      for (let v = 0; v < position.count; v++) {
        const y = position.getY(v) - HUMAN.shoulder;
        const blend = THREE.MathUtils.smoothstep(
          -y,
          HUMAN.upperArm - 0.047,
          HUMAN.upperArm + 0.047,
        );
        indices.set([0, 1, 0, 0], v * 4);
        weights.set([1 - blend, blend, 0, 0], v * 4);
      }
      skinGeometry.setAttribute(
        'skinIndex',
        new THREE.Uint16BufferAttribute(indices, 4),
      );
      skinGeometry.setAttribute(
        'skinWeight',
        new THREE.Float32BufferAttribute(weights, 4),
      );
    }
    const skinHolder = shared(skinParts, materials);
    const skinOriginal = skinHolder.children[0] as THREE.Mesh;
    const armSkin = new THREE.SkinnedMesh(
      skinOriginal.geometry,
      skinOriginal.material,
    );
    armSkin.name = `continuous-${i ? 'right' : 'left'}-elbow-skin`;
    armSkin.userData.dinerShared = true;
    skinOriginal.userData.dinerShared = false;
    armSkin.castShadow = true;
    shoulders[i].updateMatrixWorld(true);
    armSkin.bind(new THREE.Skeleton([shoulders[i], elbows[i]]));
    skinnedLimbs.push(armSkin);
    wrists[i].name = `${i ? 'right' : 'left'}-wrist`;
    wrists[i].position.y = -HUMAN.forearm;
    wrists[i].add(
      shared(
        peopleCached(detail, `hand:${skin}:${side}`, (kit) =>
          sculptHand(kit, skin, side),
        ),
        materials,
      ),
    );
  }
  return {
    joints: {
      hips: [...hips],
      knees: [...knees],
      ankles: [...ankles],
      shoulders: [...shoulders],
      elbows: [...elbows],
      wrists,
    } satisfies FigureJoints,
    skinnedLimbs,
    pelvis,
  };
}

function figure(
  materials: Materials,
  look: Look,
  uniform: string | null,
  detail: PeopleDetail,
): Figure {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.name = uniform ? 'soda-fountain-waiter' : 'diner-guest';
  body.name = 'weighted-body';
  root.add(body);
  const skin = SKINS[look.skin],
    shirt = uniform ? cream : SHIRTS[look.shirt];
  const pants = uniform
    ? '#303744'
    : trousers[(look.skin + look.hair) % trousers.length];
  body.add(
    shared(
      peopleCached(
        detail,
        `shirt:${shirt}:${skin}:${pants}:${+look.stripes}:${uniform}`,
        (kit) => sculptTorso(kit, shirt, skin, pants, look.stripes, uniform),
      ),
      materials,
    ),
  );
  const rig = limbs(
    materials,
    shirt,
    skin,
    pants,
    look.stripes,
    !!uniform,
    detail,
  );
  const joints = rig.joints;
  const face = head(materials, look, uniform, detail);
  body.add(
    rig.pelvis,
    ...joints.hips,
    ...rig.skinnedLimbs,
    ...joints.shoulders,
    face.group,
  );
  root.addEventListener('removed', () => {
    for (const limb of rig.skinnedLimbs) limb.skeleton.dispose();
  });
  return {
    root,
    body,
    legs: joints.hips,
    arms: joints.shoulders,
    joints,
    head: face.group,
    face: face.face,
  };
}

export function guestFigure(
  materials: Materials,
  look: Look,
  detail: PeopleDetail = 'runtime',
): Figure {
  return figure(materials, look, null, detail);
}

/** Four authored staff with cream collars, paper caps and their serving colour. */
export function waiterFigure(
  materials: Materials,
  seat: number,
  detail: PeopleDetail = 'runtime',
): Figure {
  const n = ((seat % 4) + 4) % 4;
  const colour = SEAT_COLOURS[n];
  const look: Look = {
    skin: [1, 3, 0, 2][n],
    hair: [0, 2, 1, 3][n],
    hat: 'none',
    shirt: 0,
    stripes: false,
    glasses: false,
  };
  const waiter = figure(materials, look, colour, detail);
  const hold = new THREE.Group();
  hold.name = 'serving-tray-attachment';
  hold.position.set(0, 0.746, 0.329);
  waiter.body.add(hold);
  waiter.hold = hold;
  waiter.root.scale.setScalar(1.32);
  return waiter;
}

/** Expressions use only public actions and patience; a mimic gets no tell. */
export function expression(
  figure: Figure,
  mood: Expression,
  time: number,
  seed: number,
  calm: boolean,
) {
  const face = figure.face;
  if (!face) return;
  for (const [name, mouth] of Object.entries(face.mouths))
    mouth.visible = name === mood;
  const cycle = (((time + seed * 0.717) % 4.7) + 4.7) % 4.7;
  const blink = calm || cycle > 0.16 ? 0 : Math.sin((cycle / 0.16) * Math.PI);
  face.lids.visible = blink > 0.05;
  face.lids.scale.y = Math.max(0.01, blink);
}
