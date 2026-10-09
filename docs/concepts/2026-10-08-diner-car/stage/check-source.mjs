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
globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(x=>{this.result=x;this.onloadend?.();}); } };
const T=await import('three');
const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
const {makeMaterials}=await import(root+'components/game/diner/kit.ts');
const {disposeSurfaceMaterials}=await import(root+'components/game/diner/materials.ts');
const {buildDinerCar,buildTruck}=await import(root+'components/game/diner/diner-car.ts');
const {buildPlace,buildMapStop}=await import(root+'components/game/diner/places.ts');
const {buildStage}=await import(root+'components/game/diner/stage.ts');
const layout=await import(root+'lib/games/diner/layout.ts');
const {STAGE}=await import(root+'components/game/diner/stage-contract.ts');
const out=new URL(process.env.DINER_REVIEW_ROUND3 ? './review/round3-fixes/' : process.env.DINER_REVIEW_ROUND2 ? './review/round2/' : './review/',import.meta.url); mkdirSync(out,{recursive:true});
const sources=new URL(process.env.DINER_REVIEW_ROUND3 ? './sources/round3/' : process.env.DINER_REVIEW_ROUND2 ? './sources/round2/' : './sources/',import.meta.url); mkdirSync(sources,{recursive:true});
const mats=makeMaterials(), records=[];
const borrowedDisposals = new Map();
for (const material of Object.values(mats)) material.addEventListener('dispose', () => borrowedDisposals.set(material, (borrowedDisposals.get(material) ?? 0) + 1));
const cues={time:3,dt:1/60,reduced:false,power:true,rush:false,gate:0,jukebox:true};
const allUpgrades={spareTires:2,biggerPatio:true,neonSign:true,jukebox:true,heatLampPass:true,coffeeUrn:true,twinGrill:true,rollerSkates:true,chromeTray:true,gasCan:true,luckyDice:true,roadAtlas:true};
const hitchCar=buildDinerCar(mats,{detail:'stage',quality:'low'}),hitchTruck=buildTruck(mats,{detail:'stage',quality:'low'});
const carHitch=hitchCar.hitch.clone(),truckHitch=hitchTruck.hitch.clone();hitchCar.dispose();hitchTruck.dispose();
function audit(model,name,stage=false){
  model.group.updateMatrixWorld(true); let draws=0,triangles=0,shadowDraws=0,shadowTriangles=0,lights=0,maxTexture=0,vertexBytes=0;
  const hash=createHash('sha256'),geometry=new Set(),materials=new Set(),textures=new Set(),instanceBuffers=new Set(),clearances=[];
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  model.group.traverse(o=>{
    if(o.isLight){lights++;assert.equal(o.castShadow,false);}
    if(!o.isMesh)return;
    if(o.isInstancedMesh){instanceBuffers.add(o);assert.ok(o.instanceMatrix.array.every(Number.isFinite),name+' finite instances');hash.update(Buffer.from(o.instanceMatrix.array.buffer,o.instanceMatrix.array.byteOffset,o.instanceMatrix.array.byteLength));if(o.instanceColor){assert.ok(o.instanceColor.array.every(Number.isFinite),name+' finite instance colours');hash.update(Buffer.from(o.instanceColor.array.buffer,o.instanceColor.array.byteOffset,o.instanceColor.array.byteLength));}}
    const instances=o.isInstancedMesh?o.count:1,n=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
    const mm=Array.isArray(o.material)?o.material:[o.material];
    const passes=mm.some(m=>m.transparent&&m.side===T.DoubleSide&&!m.forceSinglePass)?2:1;
    draws+=passes;triangles+=n*instances*passes;if(o.castShadow){shadowDraws++;shadowTriangles+=n*instances;}
    geometry.add(o.geometry);for(const m of mm){materials.add(m);for(const value of Object.values(m))if(value?.isTexture){textures.add(value);maxTexture=Math.max(maxTexture,value.image?.width??0,value.image?.height??0);}}
    for(const data of Object.values(o.geometry.attributes)){assert.ok(data.array.every(Number.isFinite),name+' finite attributes');vertexBytes+=data.array.byteLength;hash.update(Buffer.from(data.array.buffer,data.array.byteOffset,data.array.byteLength));}
    if(stage&&!o.isInstancedMesh){
      const pos=o.geometry.attributes.position,idx=o.geometry.index;
      for(let i=0;i<(idx?.count??pos.count);i+=3){
        a.fromBufferAttribute(pos,idx?idx.getX(i):i).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(pos,idx?idx.getX(i+1):i+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(pos,idx?idx.getX(i+2):i+2).applyMatrix4(o.matrixWorld);
        const minY=Math.min(a.y,b.y,c.y),maxY=Math.max(a.y,b.y,c.y),minZ=Math.min(a.z,b.z,c.z),maxZ=Math.max(a.z,b.z,c.z);
        if(maxY<=STAGE.counterTop+0.000001||minY>=STAGE.machineCeiling||maxZ<=STAGE.counterBack||minZ>=layout.COUNTER_Z)continue;
        const minX=Math.min(a.x,b.x,c.x),maxX=Math.max(a.x,b.x,c.x);
        for(const [id,x]of Object.entries(layout.COUNTER_X))if(maxX>x-layout.SPOT_HALF&&minX<x+layout.SPOT_HALF)clearances.push(id);
      }
    }
  });
  assert.equal(clearances.length,0,name+' clear machine volumes: '+[...new Set(clearances)]);
  assert.ok(lights<=4);assert.ok(maxTexture<=1024);
  const disposal=new Map(); const ownMats=[...materials].filter(x=>!Object.values(mats).includes(x));
  const borrowedTextures=new Set(Object.values(mats).flatMap(m=>Object.values(m).filter(v=>v?.isTexture)));
  const resources=[...geometry,...instanceBuffers,...ownMats,...[...textures].filter(t=>!borrowedTextures.has(t))];
  for(const item of resources)item.addEventListener('dispose',()=>disposal.set(item,(disposal.get(item)??0)+1));
  return {draws,triangles,shadowDraws,shadowTriangles,lights,maxTexture,vertexBytes,hash:hash.digest('hex'),resources,disposal};
}
async function exportModel(model,name){
  const originals=[];
  model.group.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(originals.some(([original])=>original===m))continue; const maps={};for(const key of ['map','normalMap','roughnessMap','bumpMap']){maps[key]=m[key];m[key]=null;}originals.push([m,maps]);
  }});
  const data=await new GLTFExporter().parseAsync(model.group,{binary:true}); writeFileSync(new URL(name+'.glb',sources),Buffer.from(data));
  for(const[m,maps]of originals)Object.assign(m,maps);
}
function finish(model,record){
  model.dispose();model.dispose();
  assert.ok(record.resources.every(r=>record.disposal.get(r)===1),'exactly once owned resource cleanup');
  assert.equal(borrowedDisposals.size, 0, 'borrowed caller materials survive model disposal');
  const {resources,disposal,...r}=record;return {...r,resourceCleanup:'exactly once, borrowed materials retained'};
}
for(const detail of ['stage','map'])for(const [name,build]of [['car',buildDinerCar],['truck',buildTruck]]){
  const model=build(mats,{detail});const r=audit(model,name);await exportModel(model,`${name}-${detail}`);records.push({name,detail,...finish(model,r)});
}
for(const place of ['truckstop','drivein','fairground','harbour','oldtown','moonmile'])for(const quality of ['high','low']){
  const model=buildStage(mats,{place,quality,tables:[0,1,2,3,4],upgrades:{}});model.update(cues);
  const r=audit(model,`${place}/${quality}`,true);
  const car=model.group.getObjectByName('diner-car-stage'),truck=model.group.getObjectByName('cab-over-stage');
  assert.ok(car&&truck,'stage contains both vehicle transforms');
  assert.ok(car.localToWorld(carHitch.clone()).distanceTo(truck.localToWorld(truckHitch.clone()))<1e-7,'truck and trailer hitch points coincide');
  const lampPools=model.group.getObjectByName('patio-lamp-pools'),poolMatrix=new T.Matrix4();
  for(let i=0;i<lampPools.count;i++){lampPools.getMatrixAt(i,poolMatrix);assert.ok(poolMatrix.elements[13]>(place==='harbour'?-.045:-.24),'patio light pools sit above terrain');}
  assert.ok(r.draws<= (quality==='high'?140:70));assert.ok(r.triangles<= (quality==='high'?450000:180000));
  assert.ok(r.draws+r.shadowDraws<= (quality==='high'?140:70), 'one shadow pass draw-call budget');
  assert.ok(r.triangles+r.shadowTriangles<= (quality==='high'?450000:180000), 'one shadow pass triangle budget');
  const reduced={...cues,reduced:true};model.update(reduced);model.group.updateMatrixWorld(true);
  const before=[],animatedGeometry=new Map();model.group.traverse(o=>{before.push({matrix:[...o.matrix.elements],instances:o.isInstancedMesh?[...o.instanceMatrix.array]:null});if(o.isMesh&&!animatedGeometry.has(o.geometry))animatedGeometry.set(o.geometry,[...o.geometry.attributes.position.array]);});model.update({...reduced,time:50});model.group.updateMatrixWorld(true);let index=0;model.group.traverse(o=>{const prior=before[index++];assert.deepEqual(o.matrix.elements,prior.matrix,'reduced motion freezes rigs');if(o.isInstancedMesh)assert.deepEqual([...o.instanceMatrix.array],prior.instances,'reduced motion freezes instances');});for(const[geo,positions]of animatedGeometry)assert.deepEqual([...geo.attributes.position.array],positions,'reduced motion freezes deformed geometry');
  model.update(cues);
  if(quality==='high')await exportModel(model,place+'-stage');
  records.push({place,quality,...finish(model,r)});
  const again=buildStage(mats,{place,quality,tables:[0,1,2,3,4],upgrades:{}});again.update(cues);const r2=audit(again,place,true);assert.equal(r.hash,r2.hash,'deterministic geometry');finish(again,r2);
  const map=buildPlace(mats,place,{detail:'map'});const mr=audit(map,place+'-map');await exportModel(map,place+'-map');records.push({place,detail:'map',...finish(map,mr)});
}
for(const kind of ['garage','motel']){const model=buildMapStop(mats,kind);const r=audit(model,kind);await exportModel(model,kind+'-map');records.push({kind,...finish(model,r)});}
for (const place of ['truckstop','drivein','fairground','harbour','oldtown','moonmile']) for (const quality of ['high', 'low']) {
 const upgraded=buildStage(mats,{place,quality,tables:[0,1,2,3,4],upgrades:allUpgrades});const ur=audit(upgraded,'upgraded '+place,true);
 assert.ok(ur.draws+ur.shadowDraws <= (quality==='high'?140:70));assert.ok(ur.triangles+ur.shadowTriangles <= (quality==='high'?450000:180000));
 records.push({place,quality,upgrades:'all',...finish(upgraded,ur)});
}
disposeSurfaceMaterials(mats);
writeFileSync(new URL('source-budget.json',out),JSON.stringify(records,null,2));console.log(JSON.stringify(records,null,2));
