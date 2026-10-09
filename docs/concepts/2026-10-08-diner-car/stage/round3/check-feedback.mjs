import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

const root = pathToFileURL(`${process.cwd()}/`).href;
register(`data:text/javascript,${encodeURIComponent(`
import {existsSync} from 'node:fs'; import {fileURLToPath,pathToFileURL} from 'node:url';
const root=${JSON.stringify(root)};
export async function resolve(s,c,next){let b=null;if(s.startsWith('@/'))b=fileURLToPath(root+s.slice(2));else if(/^\\.\\.?\\//.test(s)&&c.parentURL?.startsWith('file:')&&!/\\.[cm]?[jt]sx?$/.test(s))b=fileURLToPath(new URL(s,c.parentURL));if(b)for(const ext of ['.ts','.tsx'])if(existsSync(b+ext))return next(pathToFileURL(b+ext).href,c);return next(s,c);}
`)}`);
const T = await import('three');
const {makeMaterials} = await import(root+'components/game/diner/kit.ts');
const {disposeSurfaceMaterials} = await import(root+'components/game/diner/materials.ts');
const {buildPlace} = await import(root+'components/game/diner/places.ts');
const {buildStage} = await import(root+'components/game/diner/stage.ts');
const {STAGE} = await import(root+'components/game/diner/stage-contract.ts');
const mats = makeMaterials();
const cues = {time:0,dt:0,reduced:false,power:true,rush:false,gate:0,jukebox:false};
const report = {glows:[],beam:[],moon:[],counter:[],fuel:[]};
for (const quality of ['high','low']) {
  for (const place of ['truckstop','drivein','fairground','harbour','oldtown','moonmile']) {
    const model = buildPlace(mats,place,{detail:'stage',quality});
    const surfaces = new Set();
    let screen;
    model.group.traverse(o => {
      if(o.material?.name==='bounded-large-place-glows')surfaces.add(o.material);
      if(o.name==='blue-cinema-screen')screen=o;
    });
    assert.ok(surfaces.size>0, `${place} has separately powered large glows`);
    let peak = 0;
    for(let sample=0;sample<96;sample++)for(const power of [true,false])for(const reduced of [true,false]) {
      model.update({...cues,time:sample*.37,rush:true,power,reduced});
      for(const mat of [...surfaces,...(screen?[screen.material]:[])]) {
        const gain = Math.max(mat.color.r,mat.color.g,mat.color.b);
        peak=Math.max(peak,gain);
        assert.ok(gain<=1.12+1e-10, `${place} broad emission remains bounded during rush/brownout`);
      }
    }
    report.glows.push({place,quality,peak});
    if(place==='harbour') {
      const beam=model.group.getObjectByName('sea-facing-lighthouse-beam');
      assert.equal(beam.material.forceSinglePass,true);
      assert.equal(beam.material.alphaMap.image.width,64);
      const fade=beam.material.alphaMap.image.data;
      assert.equal(fade[1],0,'broad far end is invisible');
      assert.equal(fade[fade.length-3],255,'near lamp remains visible');
      const pos=beam.geometry.getAttribute('position'),p=new T.Vector3();
      let front=-Infinity;
      for(let sample=0;sample<=720;sample++) {
        model.update({...cues,time:sample*.2});model.group.updateMatrixWorld(true);
        for(let i=0;i<pos.count;i++) {
          p.fromBufferAttribute(pos,i).applyMatrix4(beam.matrixWorld);
          front=Math.max(front,p.z);
          assert.ok(p.z<-4.3, 'the whole beam stays seaward of the tower and clear of the pier/car/truck/deck');
        }
      }
      report.beam.push({quality,samples:721,frontmostZ:front,length:beam.geometry.parameters.height,forceSinglePass:true});
    }
    if(place==='moonmile') {
      const moon=model.group.getObjectByName('moon'),pos=moon.geometry.getAttribute('position');
      let bowl=0,rim=0;
      for(let i=0;i<pos.count;i++)if(pos.getZ(i)>0) {
        const baseline=Math.sqrt(Math.max(0,2.05**2-pos.getX(i)**2-pos.getY(i)**2))*.085;
        bowl=Math.min(bowl,pos.getZ(i)-baseline);rim=Math.max(rim,pos.getZ(i)-baseline);
      }
      assert.ok(bowl<-.07, 'lunar bowls are recessed, not raised blobs');
      assert.ok(rim>.02, 'lunar rims have actual relief');
      const before=JSON.stringify(moon.material.toJSON());
      model.update({...cues,time:17,power:false,rush:true});
      assert.equal(JSON.stringify(moon.material.toJSON()),before,'celestial material is independent of power');
      assert.equal(moon.material.isMeshStandardMaterial,true);
      report.moon.push({quality,bowlDepth:bowl,rimHeight:rim,emissiveIntensity:moon.material.emissiveIntensity});
    }
    if(place==='truckstop') {
      const tint=new T.Color('#a9623f'),p=new T.Vector3();let minX=Infinity,vertices=0;
      model.group.updateMatrixWorld(true);
      model.group.traverse(o=>{
        if(!o.isMesh)return;const c=o.geometry.getAttribute('color'),pos=o.geometry.getAttribute('position');if(!c)return;
        for(let i=0;i<c.count;i++)if(Math.abs(c.getX(i)-tint.r)<1e-6&&Math.abs(c.getY(i)-tint.g)<1e-6&&Math.abs(c.getZ(i)-tint.b)<1e-6){p.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);minX=Math.min(minX,p.x);vertices++;}
      });
      assert.ok(vertices>0&&minX>12.4,'FUEL board is wholly to the right of the car');
      assert.deepEqual(model.landmarks[0].toArray(),[3.3,3.65+.8,-3.25],'original phone framing envelope is retained');
      report.fuel.push({quality,minX,vertices});
    }
    model.dispose();
  }
  const stage=buildStage(mats,{place:'truckstop',quality,tables:[0,1,2,3,4],upgrades:{}});
  stage.group.updateMatrixWorld(true);let maxY=-Infinity,found=0;
  stage.group.traverse(o=>{
    if(o.material?.name!=='warm-speckled-counter-laminate')return;
    found++;const pos=o.geometry.getAttribute('position'),p=new T.Vector3();
    for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);maxY=Math.max(maxY,p.y);}
    assert.equal(o.material.map.image.width,256);assert.equal(o.material.metalness,0);
  });
  assert.equal(found,1);assert.ok(Math.abs(maxY-STAGE.counterTop)<1e-6,'laminate keeps machine support height');
  report.counter.push({quality,maxY,texture:256});stage.dispose();
}
disposeSurfaceMaterials(mats);
writeFileSync(new URL('./feedback-check.json',import.meta.url),JSON.stringify(report,null,2));
console.log('PASS: broad emission bounds; 721 beam poses at both qualities; genuine crater relief; celestial power independence; FUEL separation and original framing; exact laminate height.');
