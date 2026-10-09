/** CPU source review fallback. Uses the live TypeScript models and camera;
 * approximates PBR light/reflections and omits WebGL bloom/shadows/normal maps.
 * This is deliberately labelled source evidence, never browser/GPU acceptance.
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import * as T from 'three';
const root=pathToFileURL(`${process.cwd()}/`).href;
register(`data:text/javascript,${encodeURIComponent(`import {existsSync}from'node:fs';import{fileURLToPath,pathToFileURL}from'node:url';const root=${JSON.stringify(root)};export async function resolve(s,c,n){let b=null;if(s.startsWith('@/'))b=fileURLToPath(root+s.slice(2));else if(/^\\.\\.?\\//.test(s)&&c.parentURL?.startsWith('file:')&&!/\\.[cm]?[jt]sx?$/.test(s))b=fileURLToPath(new URL(s,c.parentURL));if(b)for(const e of ['.ts','.tsx'])if(existsSync(b+e))return n(pathToFileURL(b+e).href,c);return n(s,c);}`)}`);
const {makeMaterials}=await import(root+'components/game/diner/kit.ts');
const {disposeSurfaceMaterials}=await import(root+'components/game/diner/materials.ts');
const {buildDinerCar,buildTruck}=await import(root+'components/game/diner/diner-car.ts');
const {buildStage}=await import(root+'components/game/diner/stage.ts');
const {buildPlace,buildMapStop}=await import(root+'components/game/diner/places.ts');
const {fitDinerCamera,DINER_LANDMARKS}=await import(root+'components/game/diner/framing.ts');
const out=new URL(process.env.DINER_REVIEW_ROUND3 ? './review/round3-fixes/' : process.env.DINER_REVIEW_ROUND2 ? './review/round2/' : './review/',import.meta.url);mkdirSync(out,{recursive:true});
const mats=makeMaterials(), key=new T.Vector3(-0.4,1,0.7).normalize();
const srgb=v=>Math.round(Math.min(1,Math.max(0,v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055))*255);
const aces=v=>Math.min(1,Math.max(0,(v*(2.51*v+.03))/(v*(2.43*v+.59)+.14)));

async function render(object,camera,width,height,name,clay=false,studio=false){
  object.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const projection=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const rgba=new Uint8Array(width*height*4),depth=new Float32Array(width*height).fill(Infinity);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;rgba.set(studio?[217-Math.floor(y/height*28),222-Math.floor(y/height*26),224-Math.floor(y/height*21),255]:[13+Math.floor(y/height*9),16+Math.floor(y/height*8),36+Math.floor(y/height*10),255],i);}
  const view=camera.getWorldDirection(new T.Vector3()).negate();
  const half=key.clone().add(view).normalize(), draws=[];
  object.traverseVisible(mesh=>{if(!mesh.isMesh)return;if(mesh.isInstancedMesh){for(let i=0;i<mesh.count;i++){const im=new T.Matrix4(),instanceColour=new T.Color(1,1,1);mesh.getMatrixAt(i,im);if(mesh.instanceColor)mesh.getColorAt(i,instanceColour);draws.push({mesh,matrix:mesh.matrixWorld.clone().multiply(im),instanceColour});}}else draws.push({mesh,matrix:mesh.matrixWorld,instanceColour:new T.Color(1,1,1)});});
  draws.sort((a,b)=>Number(a.mesh.material.transparent)-Number(b.mesh.material.transparent));
  const pv=new T.Vector3(), nv=new T.Vector3();
  for(const{mesh,matrix:world,instanceColour}of draws){
    const geo=mesh.geometry,pos=geo.attributes.position,norm=geo.attributes.normal,colour=geo.attributes.color,uv=geo.attributes.uv,idx=geo.index;
    const mat=mesh.material,matrix=new T.Matrix4().multiplyMatrices(projection,world),nm=new T.Matrix3().getNormalMatrix(world);
    const n=pos.count,stride=11,v=new Float32Array(n*stride);
    for(let i=0;i<n;i++){pv.fromBufferAttribute(pos,i).applyMatrix4(matrix);nv.fromBufferAttribute(norm,i).applyNormalMatrix(nm);const at=i*stride;v.set([(pv.x+1)*width/2,(1-pv.y)*height/2,pv.z,nv.x,nv.y,nv.z,colour?colour.getX(i):1,colour?colour.getY(i):1,colour?colour.getZ(i):1,uv?uv.getX(i):0,uv?uv.getY(i):0],at);}
    for(let i=0;i<(idx?.count??n);i+=3){
      const a=(idx?idx.getX(i):i)*stride,b=(idx?idx.getX(i+1):i+1)*stride,c=(idx?idx.getX(i+2):i+2)*stride;
      const ax=v[a],ay=v[a+1],bx=v[b],by=v[b+1],cx=v[c],cy=v[c+1];
      const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
      if(Math.abs(area)<1e-8||(area>0&&mat.side===T.FrontSide))continue;
      const minx=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxx=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx))),miny=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxy=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
      const metal=clay?0:mat.metalness??0,rough=clay?.86:mat.roughness??.5;
      const rgb=clay?[.49,.51,.53]:[mat.color.r*instanceColour.r,mat.color.g*instanceColour.g,mat.color.b*instanceColour.b];
      const basic=!clay&&mat.isMeshBasicMaterial;
      // Very faint beams are not solids and do not write depth.
      for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){
        const px=x+.5,py=y+.5,u=((bx-px)*(cy-py)-(by-py)*(cx-px))/area,vv=((cx-px)*(ay-py)-(cy-py)*(ax-px))/area,w=1-u-vv;
        if(u<0||vv<0||w<0)continue;const z=v[a+2]*u+v[b+2]*vv+v[c+2]*w,off=y*width+x;if(z>=depth[off]||z< -1||z>1)continue;
        let nx=v[a+3]*u+v[b+3]*vv+v[c+3]*w,ny=v[a+4]*u+v[b+4]*vv+v[c+4]*w,nz=v[a+5]*u+v[b+5]*vv+v[c+5]*w;const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;
        const diffuse=Math.max(0,nx*key.x+ny*key.y+nz*key.z),ndv=nx*view.x+ny*view.y+nz*view.z;
        const spec=Math.max(0,nx*half.x+ny*half.y+nz*half.z)**Math.max(8,2/(rough*rough+.007));
        const reflectY=2*ndv*ny-view.y,reflectX=2*ndv*nx-view.x;
        const env=.24+Math.max(0,reflectY)*.55+Math.exp(-((reflectX-.28)**2)/(.015+rough*.08))*.52;
        let texColour=[1,1,1],texAlpha=1;
        if(!clay&&mat.map?.isDataTexture){const tex=mat.map,uu=v[a+9]*u+v[b+9]*vv+v[c+9]*w,vtex=v[a+10]*u+v[b+10]*vv+v[c+10]*w;const chart=(v,repeat,offset,wrap)=>{let q=v*repeat+offset;return wrap===T.RepeatWrapping?((q%1+1)%1):Math.min(1,Math.max(0,q));};const tx=Math.floor(chart(uu,tex.repeat.x,tex.offset.x,tex.wrapS)*(tex.image.width-1)),ty=Math.floor(chart(vtex,tex.repeat.y,tex.offset.y,tex.wrapT)*(tex.image.height-1));const ti=(ty*tex.image.width+tx)*4;texColour=[0,1,2].map(k=>{const s=tex.image.data[ti+k]/255;return tex.colorSpace===T.SRGBColorSpace?(s<=.04045?s/12.92:((s+.055)/1.055)**2.4):s;});texAlpha=tex.image.data[ti+3]/255;}
        for(let ch=0;ch<3;ch++){const tint=clay||!mat.vertexColors?1:v[a+6+ch]*u+v[b+6+ch]*vv+v[c+6+ch]*w;
          const base=rgb[ch]*tint*texColour[ch];const ambient=[.25,.29,.40][ch]+Math.max(0,ny)*.15;
          const result=basic?base:base*((1-metal)*(ambient+diffuse*[1.34,1.18,1.00][ch])+metal*env)+spec*(metal?.70:.12);
          const value=srgb(basic?Math.min(1,result):aces(result*.94));const alpha=clay?1:mat.transparent?mat.opacity*texAlpha:1;rgba[off*4+ch]=Math.round(Math.min(255,mat.blending===T.AdditiveBlending&&!clay?rgba[off*4+ch]+value*alpha:rgba[off*4+ch]*(1-alpha)+value*alpha));
        }
        if(!mat.transparent||clay)depth[off]=z;
      }
    }
  }
  const buffer=await sharp(rgba,{raw:{width,height,channels:4}}).png().toBuffer();await sharp(buffer).toFile(new URL(name+'.png',out).pathname);console.log(name);return buffer;
}
function assetCamera(group,angle,width=1000,height=680){
  const b=new T.Box3().setFromObject(group),c=b.getCenter(new T.Vector3());
  const camera=new T.OrthographicCamera(-1,1,1,-1,0.1,140);
  camera.position.copy(c).add(new T.Vector3(...({front:[-30,2,0],side:[0,2,30],rear:[30,2,0],'three-quarter':[-20,10,24]}[angle]??[-20,10,24])));camera.lookAt(c);camera.updateMatrixWorld(true);
  const points=[];for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])points.push(new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
  const bb=new T.Box2();for(const p of points)bb.expandByPoint(new T.Vector2(p.x,p.y));const s=bb.getSize(new T.Vector2()),center=bb.getCenter(new T.Vector2()),units=Math.max(s.x/width,s.y/height)*1.18;
  camera.left=center.x-width*units/2;camera.right=center.x+width*units/2;camera.top=center.y+height*units/2;camera.bottom=center.y-height*units/2;camera.updateProjectionMatrix();return camera;
}
const mode=process.argv[2]??'all',onlyPlace=process.argv[3];
const allUpgrades={spareTires:2,biggerPatio:true,neonSign:true,jukebox:true,heatLampPass:true,coffeeUrn:true,twinGrill:true,rollerSkates:true,chromeTray:true,gasCan:true,luckyDice:true,roadAtlas:true};
if(mode==='rig'||mode==='all'){
  const car=buildDinerCar(mats,{detail:'stage'}),truck=buildTruck(mats,{detail:'stage'}),rig=new T.Group();
  car.group.position.x=5.5;const tow=car.hitch.clone().add(car.group.position);truck.group.position.set(tow.x-truck.hitch.x,-.22,tow.z-truck.hitch.z);rig.add(car.group,truck.group);
  const cues={time:3,dt:0,reduced:false,power:true,rush:false,gate:0,jukebox:false};car.update(cues);truck.update(cues);
  await render(rig,assetCamera(rig,'three-quarter'),1000,680,'source-hitched-rig-clay',true,true);
  await render(rig,assetCamera(rig,'three-quarter'),1000,680,'source-hitched-rig-colour',false,true);
  car.dispose();truck.dispose();
}
function frame44(camera,frame,extra){
  const elevation=44*Math.PI/180,target=new T.Vector3(5.5,0,5.5);
  camera.position.copy(target).add(new T.Vector3(0,Math.sin(elevation)*30,Math.cos(elevation)*30));camera.lookAt(target);camera.updateMatrixWorld(true);
  const bounds=new T.Box2();for(const p of [...DINER_LANDMARKS.map(p=>new T.Vector3(...p)),...extra]){const v=p.clone().applyMatrix4(camera.matrixWorldInverse);bounds.expandByPoint(new T.Vector2(v.x,v.y));}
  const size=bounds.getSize(new T.Vector2()),c=bounds.getCenter(new T.Vector2()),aw=frame.width-frame.left-frame.right,ah=frame.height-frame.top-frame.bottom;
  const units=Math.max(size.x/aw,size.y/ah)*1.012;
  camera.left=c.x-(frame.left+aw/2)*units;camera.right=camera.left+frame.width*units;
  camera.top=c.y+(frame.top+ah/2)*units;camera.bottom=camera.top-frame.height*units;camera.updateProjectionMatrix();
}
if(mode==='assets'||mode==='all')for(const detail of ['stage','map'])for(const[name,build]of [['car',buildDinerCar],['truck',buildTruck]]){
  const asset=build(mats,{detail});asset.update({time:3,dt:0,reduced:false,power:true,rush:false,gate:0,jukebox:true});for(const angle of ['front','side','rear','three-quarter'])await render(asset.group,assetCamera(asset.group,angle),1000,680,`source-${name}-${detail}-clay-${angle}`,true,true);
  await render(asset.group,assetCamera(asset.group,'three-quarter'),1000,680,`source-${name}-${detail}-colour`,false,true);asset.dispose();
}
if(['stages','low','fixed44','all'].includes(mode))for(const place of ['truckstop','drivein','fairground','harbour','oldtown','moonmile']){
  if(onlyPlace&&onlyPlace!==place)continue;
  const quality=mode==='low'?'low':'high';
  const stage=buildStage(mats,{place,quality,tables:[0,1,2,3,4],upgrades:{}});stage.update({time:3,dt:0,reduced:false,power:true,rush:false,gate:0,jukebox:true});
  for(const[width,height]of [[1280,720],[390,844]]){const camera=new T.OrthographicCamera(-1,1,1,-1,1,140),frame={width,height,top:width<=600?150:96,bottom:width<=600?170:24,left:16,right:16};(mode==='fixed44'?frame44:fitDinerCamera)(camera,frame,stage.landmarks);await render(stage.group,camera,width,height,`source-${place}-${mode==='fixed44'?'44deg-':quality==='low'?'low-':''}${width}x${height}`);}
  stage.dispose();
}
if(mode==='maps'||mode==='all'){
  const images=[];for(const place of ['truckstop','drivein','fairground','harbour','oldtown','moonmile','garage','motel']){const m=['garage','motel'].includes(place)?buildMapStop(mats,place):buildPlace(mats,place,{detail:'map'});m.update({time:3,dt:0,reduced:false,power:true,rush:false,gate:0,jukebox:true});images.push(await render(m.group,assetCamera(m.group,'three-quarter',480,360),480,360,`source-map-${place}`,false,true));m.dispose();}
  await sharp({create:{width:1920,height:720,channels:4,background:'#d4d8d9'}}).composite(images.map((input,i)=>({input,left:i%4*480,top:Math.floor(i/4)*360}))).png().toFile(new URL('source-map-contact.png',out).pathname);
}
if(mode==='motion'||mode==='all'){
  for(const place of ['truckstop','drivein','fairground','harbour','oldtown','moonmile']){if(onlyPlace&&onlyPlace!==place)continue;const s=buildStage(mats,{place,quality:'high',tables:[0,1,2,3,4],upgrades:{}}),camera=new T.OrthographicCamera(-1,1,1,-1,1,140);fitDinerCamera(camera,{width:640,height:360,top:48,bottom:12,left:8,right:8},s.landmarks);const frames=[];
    for(let i=0;i<4;i++){s.update({time:i*2.5,dt:0,reduced:false,power:true,rush:true,gate:i%2,jukebox:true});frames.push(await render(s.group,camera,640,360,`source-motion-${place}-${i}`));}
    await sharp({create:{width:1280,height:720,channels:4,background:'#101424'}}).composite(frames.map((input,i)=>({input,left:i%2*640,top:Math.floor(i/2)*360}))).png().toFile(new URL(`source-motion-${place}-sheet.png`,out).pathname);s.dispose();
  }
}
if(mode==='upgrades'){
  for(const detail of ['stage','map'])for(const[name,build]of [['car',buildDinerCar],['truck',buildTruck]]){
    const asset=build(mats,{detail,upgrades:allUpgrades});asset.update({time:3,dt:0,reduced:false,power:true,rush:false,gate:0,jukebox:true});await render(asset.group,assetCamera(asset.group,'three-quarter'),1000,680,`source-upgraded-${name}-${detail}-colour`,false,true);asset.dispose();
  }
  const s=buildStage(mats,{place:'fairground',quality:'low',tables:[0,1,2,3,4],upgrades:allUpgrades});s.update({time:3,dt:0,reduced:false,power:true,rush:true,gate:1,jukebox:true});
  for(const[width,height]of [[1280,720],[390,844]]){const camera=new T.OrthographicCamera(-1,1,1,-1,1,140);fitDinerCamera(camera,{width,height,top:width<=600?150:96,bottom:width<=600?170:24,left:16,right:16},s.landmarks);await render(s.group,camera,width,height,`source-upgraded-fairground-low-${width}x${height}`);}s.dispose();
}
disposeSurfaceMaterials(mats);
