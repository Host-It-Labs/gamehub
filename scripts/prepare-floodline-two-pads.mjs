import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const base='public/art/floodline-two-pad-edit';
await mkdir(base,{recursive:true});
const tasks=[
 {kind:'landscape',json:'floodline-art',input:'mora-floodline-landscape-v2-a',output:'mora-floodline-landscape-v3-a-two-pads',generated:'/Users/williamguinaudie/.codex/generated_images/01a0bef8-905b-7bf1-91bd-f15c06d24d42/exec-cd386ec5-e06d-46ec-abf9-75fb67f1900e.png',left:370,top:455,cx:43,cy:40,rx:30,ry:25},
 {kind:'portrait',json:'floodline-portrait-art',input:'mora-floodline-portrait-v3-b',output:'mora-floodline-portrait-v4-b-two-pads',generated:'/Users/williamguinaudie/.codex/generated_images/01a0bef8-905b-7bf1-91bd-f15c06d24d42/exec-803d634f-81fc-4ae4-87ce-9f6f6cf086a9.png',left:771,top:945,cx:34,cy:39,rx:34,ry:30}
];
const tiles=[];
const report=[];
for(const t of tasks){
 const src=`public/art/${t.input}.png`,dest=`public/art/${t.output}.png`;
 const art=JSON.parse(await readFile(`lib/games/${t.json}.json`,'utf8'));
 const {data:original,info}=await sharp(src).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const output=Buffer.from(original);
 const patch=await sharp(`${base}/${t.kind}-generated-patch.png`).resize(100,90,{fit:'fill'}).removeAlpha().raw().toBuffer();
 // Generated patches retained locally; original provenance path remains in task metadata above.
 let changed=0;
 for(let y=0;y<90;y++)for(let x=0;x<100;x++){
  const d=Math.sqrt(((x-t.cx)/t.rx)**2+((y-t.cy)/t.ry)**2);
  const a=Math.max(0,Math.min(1,(1-d)/0.14));
  if(!a)continue;
  const i=((y+t.top)*info.width+x+t.left)*3,j=(y*100+x)*3;
  for(let c=0;c<3;c++)output[i+c]=Math.round(original[i+c]*(1-a)+patch[j+c]*a);
  changed++;
 }
 await sharp(output,{raw:info}).png().toFile(dest);
 await sharp(dest).webp({quality:90}).toFile(`public/art/optimized/${t.output}.webp`);
 await sharp(dest).extract(art.crop).webp({quality:94}).toFile(`public/art/optimized/${t.output}-board.webp`);
 await sharp(dest).extract(art.overview).webp({quality:94}).toFile(`public/art/optimized/${t.output}-overview.webp`);
 const crop=t.kind==='landscape'?{left:235,top:440,width:250,height:125}:{left:625,top:920,width:260,height:145};
 for(const path of [src,dest])tiles.push({input:await sharp(path).extract(crop).resize(520,290,{fit:'contain',background:'#eee'}).png().toBuffer(),left:(tiles.length%2)*520,top:Math.floor(tiles.length/2)*290});
 report.push({source:src,output:dest,width:info.width,height:info.height,modifiedPixelSupport:{left:t.left+t.cx-t.rx,top:t.top+t.cy-t.ry,width:2*t.rx,height:2*t.ry},changedPixelCandidates:changed,allPixelsOutsideSupport:'identical by construction',crop:art.crop,overview:art.overview});
}
await sharp({create:{width:1040,height:580,channels:3,background:'#eee'}}).composite(tiles).png().toFile(`${base}/contact-sheet.png`);
await writeFile(`${base}/verification.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
