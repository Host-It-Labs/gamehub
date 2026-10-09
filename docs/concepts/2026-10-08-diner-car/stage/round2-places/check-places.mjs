import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(`${process.cwd()}/`).href;
register(`data:text/javascript,${encodeURIComponent(`
import {existsSync} from 'node:fs'; import {fileURLToPath,pathToFileURL} from 'node:url';
const root=${JSON.stringify(root)};
export async function resolve(s,c,next){let b=null;if(s.startsWith('@/')) b=fileURLToPath(root+s.slice(2));else if(/^\\.\\.?\\//.test(s)&&c.parentURL?.startsWith('file:')&&!/\\.[cm]?[jt]sx?$/.test(s)) b=fileURLToPath(new URL(s,c.parentURL));if(b)for(const ext of ['.ts','.tsx'])if(existsSync(b+ext))return next(pathToFileURL(b+ext).href,c);return next(s,c);}
`)}`);
const T=await import('three');
const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
const {makeMaterials}=await import(root+'components/game/diner/kit.ts');
const {disposeSurfaceMaterials}=await import(root+'components/game/diner/materials.ts');
const {buildDinerCar,buildTruck}=await import(root+'components/game/diner/diner-car.ts');
const {buildPlace,buildMapStop}=await import(root+'components/game/diner/places.ts');
const {buildStage}=await import(root+'components/game/diner/stage.ts');
const layout=await import(root+'lib/games/diner/layout.ts');
const {STAGE}=await import(root+'components/game/diner/stage-contract.ts');
const mats=makeMaterials(), borrowedMats=new Set(Object.values(mats)), borrowedTex=new Set(Object.values(mats).flatMap(m=>Object.values(m).filter(v=>v?.isTexture))), records=[];
let borrowedDisposed=0;for(const m of borrowedMats)m.addEventListener('dispose',()=>borrowedDisposed++);
const digest=group=>{const h=createHash('sha256');group.updateMatrixWorld(true);group.traverse(o=>{h.update(JSON.stringify(o.matrix.elements));if(o.isMesh){for(const a of Object.values(o.geometry.attributes))h.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));if(o.isInstancedMesh)h.update(Buffer.from(o.instanceMatrix.array.buffer));}});return h.digest('hex');};
for(const place of ['truckstop','drivein','fairground','harbour','oldtown','moonmile'])for(const detail of ['stage','map'])for(const quality of ['high','low']){
 const m=buildPlace(mats,place,{detail,quality}), resources=new Set(), counts=new Map();
 m.group.traverse(o=>{if(!o.isMesh)return;resources.add(o.geometry);if(o.isInstancedMesh)resources.add(o);for(const mat of Array.isArray(o.material)?o.material:[o.material]){if(!borrowedMats.has(mat))resources.add(mat);for(const value of Object.values(mat))if(value?.isTexture&&!borrowedTex.has(value)){resources.add(value);assert.ok(value.image.width<=1024&&value.image.height<=1024);}}for(const a of Object.values(o.geometry.attributes))assert.ok(a.array.every(Number.isFinite));});
 for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)??0)+1));
 const reduced={time:0,dt:0,reduced:true,power:true,rush:false,gate:0,jukebox:false};m.update(reduced);const a=digest(m.group);m.update({...reduced,time:90});assert.equal(a,digest(m.group),`${place}/${detail}/${quality} reduced pose/vertex/instance freeze`);
 m.dispose();m.dispose();assert.ok([...resources].every(r=>counts.get(r)===1),`${place}/${detail}/${quality} exact owned cleanup`);assert.equal(borrowedDisposed,0);
 records.push(`${place}/${detail}/${quality}: finite geometry, textures, reduced freeze and owned cleanup pass`);
}
const moving={time:0,dt:0,reduced:false,power:true,rush:false,gate:0,jukebox:false};
for(const quality of ['high','low']){
 const moon=buildPlace(mats,'moonmile',{detail:'stage',quality});let cars,headlamps;moon.group.traverse(o=>{if(o.name==='moving-night-highway-cars')cars=o;if(o.name==='moving-highway-headlights')headlamps=o;});
 const a=new T.Matrix4(),b=new T.Matrix4(),p=new T.Vector3(),q=new T.Vector3();
 // The previously reviewed opposing pair overlapped at t≈3.5. Test that case
 // and neighbouring frames; the lamps must follow each body's exact transform.
 cars.geometry.computeBoundingBox();const carA=new T.Box3(),carB=new T.Box3(),period=75/2.8;
 const sampleTimes=[...Array.from({length:161},(_,i)=>i*period/160),3,3.25,3.5,3.75,4,57,60,150,300];
 for(const time of sampleTimes){moon.update({...moving,time});for(let i=0;i<cars.count;i++){cars.getMatrixAt(i,a);headlamps.getMatrixAt(i,b);assert.deepEqual(a.elements,b.elements);}if(time>=3&&time<=4){cars.getMatrixAt(0,a);cars.getMatrixAt(1,b);p.setFromMatrixPosition(a);q.setFromMatrixPosition(b);assert.ok(p.distanceTo(q)>=1.5,`opposite traffic overlaps at ${time}`);}cars.getMatrixAt(0,a);cars.getMatrixAt(2,b);carA.copy(cars.geometry.boundingBox).applyMatrix4(a);carB.copy(cars.geometry.boundingBox).applyMatrix4(b);assert.ok(!carA.intersectsBox(carB),`same-direction traffic collides at ${time}`);}
 moon.dispose();records.push(`moonmile/${quality}: complete curved loop and t60 have separated traffic/matching headlights`);
 const town=buildPlace(mats,'oldtown',{detail:'stage',quality});let walkers;town.group.traverse(o=>{if(o.name==='strolling-background-neighbours')walkers=o;});
 const bounds=new T.Box3();walkers.geometry.computeBoundingBox();
 for(let step=0;step<=126;step++){town.update({...moving,time:step*.5});for(let i=0;i<2;i++){walkers.getMatrixAt(i,a);bounds.copy(walkers.geometry.boundingBox).applyMatrix4(a);assert.ok(bounds.min.z>.15&&bounds.max.z<5.65,`side walker reaches truck cutout or z6.5 bench at ${step*.5}`);assert.ok(bounds.min.z> -15.65,`side walker reaches z-16.5 bench`);}}
 town.dispose();records.push(`oldtown/${quality}: full sidewalk loop avoids parking bay and benches`);
 const harbour=buildPlace(mats,'harbour',{detail:'stage',quality}),tint=new T.Color('#343a46');harbour.group.updateMatrixWorld(true);
 for(const x of [-7.3,17.4]){let bottom=Infinity,count=0;harbour.group.traverse(o=>{if(!o.isMesh)return;const position=o.geometry.attributes.position,col=o.geometry.attributes.color;if(!col)return;for(let i=0;i<position.count;i++){if(Math.abs(col.getX(i)-tint.r)>1e-4||Math.abs(col.getY(i)-tint.g)>1e-4||Math.abs(col.getZ(i)-tint.b)>1e-4)continue;p.fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld);if(Math.abs(p.x-x)<.26&&Math.abs(p.z+7.8)<.26){bottom=Math.min(bottom,p.y);count++;}}});assert.ok(count>0);assert.ok(Math.abs(bottom+.045)<1e-5,`rear lamp at ${x} misses pier top`);}
 harbour.dispose();records.push(`harbour/${quality}: rear lamp plinths touch side-pier tops`);
}
for(const colour of ['#d4a46a','#d2a368','#82bdcc']){const c=new T.Color(colour),scale=colour==='#82bdcc'?2.5:3;records.push(`${colour} x ${scale}: luminance ${((c.r*.2126+c.g*.7152+c.b*.0722)*scale).toFixed(3)}`);}
console.log(records.join('\n'));disposeSurfaceMaterials(mats);
