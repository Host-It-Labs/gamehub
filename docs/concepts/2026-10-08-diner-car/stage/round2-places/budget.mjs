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
const mats=makeMaterials();
const records=[];
for(const place of ['truckstop','drivein','fairground','harbour','oldtown','moonmile'])for(const quality of ['high','low']){
 const s=buildStage(mats,{place,quality,tables:[0,1,2,3,4],upgrades:{}});
 s.update({time:3,dt:0,reduced:false,power:true,rush:false,gate:0,jukebox:true});
 let calls=0,tris=0,shadowCalls=0,shadowTris=0;
 s.group.traverse(o=>{if(!o.isMesh)return;const count=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);calls++;tris+=count;if(o.castShadow){shadowCalls++;shadowTris+=count;}});
 records.push({place,quality,calls,tris,withShadowCalls:calls+shadowCalls,withShadowTris:tris+shadowTris});s.dispose();
}
console.log(JSON.stringify(records,null,2));
writeFileSync(new URL('./budget.json',import.meta.url),JSON.stringify(records,null,2));
disposeSurfaceMaterials(mats);
