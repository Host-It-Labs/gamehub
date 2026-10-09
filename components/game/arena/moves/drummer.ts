/** B2 private draft; switch only with the reviewed sculpt. All vectors are native Three axes. */
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { blend, reach, type ArmGoal, type HandRest } from './reach.ts';
import type { Moves } from '@/components/game/arena/moves/types';

const limit = (n: number, k: number) => Math.max(-k, Math.min(k, n));
const ease = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t*t*(3-2*t); };
const pulse = (t: number, a: number, b: number, end: number) => ease((t-a)/(b-a))*(1-ease((t-b)/(end-b)));
const v = (x: number, y: number, z: number) => new Vector3(x,y,z);
const tuple = (p: Vector3) => [p.x,p.y,p.z] as const;
const DOWN = v(-.008,-.219,-.053).normalize();
const PALM = v(1,0,0).addScaledVector(DOWN,-DOWN.x).normalize();
const STICK = v(-.56,-.80,-.22).normalize();
const GRIP = DOWN.clone().multiplyScalar(.046);
const TIP = .162;
// 'fingers' supplies the closed grip's stick axis to the shared two-axis
// hand solver. It is not the hooked fingertip direction of this hand.
const HAND: HandRest = { palm: tuple(PALM), fingers: tuple(STICK) };
const REST: ArmGoal = { hand: [-.028,-.445,-.059], pole: [-.24,-1,.26], palm: tuple(PALM), fingers: tuple(STICK) };
const HOOK = v(-.105,.725,-.124);
const AXIS = v(.08,1,-.17).normalize();
const HEAD = v(-.055,.658,-.235).addScaledVector(AXIS,.169*.48);
const U = v(1,0,0).addScaledVector(AXIS,-AXIS.x).normalize();

function frame(axis: Vector3, palm: Vector3) {
  const x=axis.clone().normalize();
  const y=palm.clone().addScaledVector(x,-palm.dot(x)).normalize();
  return new Matrix4().makeBasis(x,y,new Vector3().crossVectors(x,y));
}
const REST_FRAME = frame(STICK,PALM).transpose();
function orientation(axis: Vector3, palm: Vector3) {
  return new Quaternion().setFromRotationMatrix(frame(axis,palm).multiply(REST_FRAME));
}
// Match the authored 24-sided tip and its dome, including the bead's
// radius. Centre-line contact alone would bury its surface in the head.
const bead = (() => {
  const u=v(0,0,-1).addScaledVector(STICK,STICK.z).normalize();
  const across=new Vector3().crossVectors(STICK,u);
  const points: Vector3[]=[];
  for(const [t,r] of [[.145,.0023],[.154,.0035],[.162,.0024],[.162+.0024*.55,.0024*.6]])
    for(let i=0;i<24;i++)points.push(STICK.clone().multiplyScalar(t-TIP).addScaledVector(u,r*Math.cos(i/24*Math.PI*2)).addScaledVector(across,r*Math.sin(i/24*Math.PI*2)));
  points.push(STICK.clone().multiplyScalar(.0024*.8));
  return points;
})();
function stroke(phase: number) {
  const x=((phase%1)+1)%1;
  // Preparation high, a 60ms downstroke, crisp contact, rebound, recovery.
  if(x<.12) return 1-ease(x/.12);
  if(x<.21) return .55*ease((x-.12)/.09);
  return .55+.45*ease((x-.21)/.39);
}

/** The goal makes the actual wooden bead meet the actual batter plane.
 * Drum and both clavicles have their own frame; solve in the arm parent's
 * frame after moving its shoulder, rather than letting shrug spoil contact. */
function beatGoal(side: 'L'|'R', height: number, drum: Quaternion, clav: Quaternion): ArmGoal {
  const sign=side==='L'?-1:1;
  const normal=AXIS.clone().applyQuaternion(drum);
  const point=HEAD.clone().addScaledVector(U,sign*.054).sub(HOOK).applyQuaternion(drum).add(HOOK);
  point.addScaledVector(normal,.094*height);
  const axis=v(sign*.12,-.55+.71*height,-.825-.14*height).normalize();
  const palm=v(-sign,.04,.10);
  // Compute in LEFT then reflect to keep the two-axis handedness correct.
  const leftAxis=axis.clone();leftAxis.x*=side==='L'?1:-1;
  const leftPalm=palm.clone();leftPalm.x*=side==='L'?1:-1;
  const handOrientation=orientation(leftAxis,leftPalm);
  const leftNormal=normal.clone();leftNormal.x*=side==='L'?1:-1;
  const clearance=Math.max(0,...bead.map(p=>-p.clone().applyQuaternion(handOrientation).dot(leftNormal)));
  point.addScaledVector(normal,clearance);
  const grip=GRIP.clone().applyQuaternion(handOrientation);
  grip.x*=side==='L'?1:-1;
  const wrist=point.addScaledVector(axis,-TIP).sub(grip);
  const clavPivot=v(sign*.032,1.006,.004);
  const shoulder=v(sign*.190,1.003,.005).sub(clavPivot).applyQuaternion(clav).add(clavPivot);
  const inverse=clav.clone().invert();
  wrist.sub(shoulder).applyQuaternion(inverse);
  axis.applyQuaternion(inverse);palm.applyQuaternion(inverse);
  const mirror=side==='L'?1:-1;
  wrist.x*=mirror;axis.x*=mirror;palm.x*=mirror;
  return { hand: tuple(wrist), pole: [-.65,-.70,.40], palm: tuple(palm), fingers: tuple(axis), forearmRoll: .7 };
}

export const drummer: Moves = {
  style: { gait: { like: 'march', stride: .60, cadence: 2.4, arms: .04, twist: .06, lift: .085, bounce: .014 }, attack: 'custom', windup: .20, lunge: 0, snap: 48 },
  carriage: { twist: .06, hips: .05, chestRoll: .22, nod: .014, armOut: 0, bounce: 0, weaponArm: 0 },
  stiff: { foreL: 1.15, foreR: 1.15, handL: 1.25, handR: 1.25, clavL: 1.1, clavR: 1.1, extra: 1.0, hat: .42, antenna: .28, skirtL: .42, skirtR: .42 },
  damping: { foreL: .95, foreR: .95, handL: .96, handR: .96, extra: .95, hat: .50, antenna: .36, skirtL: .45, skirtR: .45 },
  pose(c,p) {
    const cosmetic=c.reduced?0:1;
    const active=c.reduced?1-ease((c.since-.12)/.18):ease(c.deploy/.30);
    const accent=Math.max(0,1-c.since/.14);
    const step=Math.cos((c.cycle-.15)*Math.PI*4)*c.walk*cosmetic;
    const drift=limit(-c.accel*.012,.065)*cosmetic;
    const turn=limit(-c.turn*.045,.085)*cosmetic;
    const drumAngles=[step*.018+drift-accent*.012,turn,limit(-c.lateral*.013,.06)*cosmetic] as const;
    const drum=new Quaternion().setFromEuler(new Euler(...drumAngles));
    c.want('extra',...drumAngles);
    for(const side of ['L','R'] as const) {
      const sign=side==='L'?-1:1;
      const height=stroke(c.since/.5+(side==='L'?.5:0));
      const clavAngles=[0,sign*(.035+.030*height)*active,sign*.045*active] as const;
      const clav=new Quaternion().setFromEuler(new Euler(...clavAngles));
      c.want(side==='L'?'clavL':'clavR',...clavAngles);
      reach(c,side,blend(REST,beatGoal(side,height,drum,clav),active),HAND);
    }
    // No extra stick swing: every bead stays fixed in its five-finger grip.
    c.want('weapon',0,0,0);c.want('offhand',0,0,0);
    const fidget=c.idleFor>1.8?(c.idleFor+c.unit.id*.29)%8.7:-1;
    const listen=pulse(fidget,2.0,2.7,4.1)*c.idle*cosmetic;
    const breath=Math.sin(c.t*1.65)*c.idle*cosmetic;
    const land=c.deploy<1?pulse(c.deploy,.29,.37,.66):0;
    p.headY+=listen*.33;
    p.headX-=accent*.035+land*.055;
    p.torsoX+=breath*.009+accent*.016+land*.05;
    p.torsoZ+=c.flinch*.075;
    p.torsoY-=c.flinch*.11;
    p.lift-=c.size*land*.042;
    p.squash*=1+breath*.0025;
    c.want('hat',step*.014+limit(-c.accel*.009,.055)*cosmetic+c.flinch*.055,turn*.25,limit(-c.lateral*.010,.05)*cosmetic);
    c.want('antenna',step*.05+limit(-c.accel*.026+c.vertical*.016,.20)*cosmetic+accent*.075+c.flinch*.17,turn,limit(-c.lateral*.026,.20)*cosmetic);
    c.want('skirtL',c.hipL*(c.hipL>0?.45:.52)+drift,turn,-.012*c.walk);
    c.want('skirtR',c.hipR*(c.hipR>0?.45:.52)+drift,turn,.012*c.walk);
  },
  arrive(d) {
    return { drop:(1-ease(d/.29)**2)*2.2,squash:1-pulse(d,.29,.37,.61)*.035,twirl:0 };
  },
};
