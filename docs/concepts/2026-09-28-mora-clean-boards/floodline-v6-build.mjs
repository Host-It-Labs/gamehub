import fs from 'node:fs';
import sharp from 'sharp';
import {paperWorldFrame} from '../../../lib/games/mora-world.ts';
import {coverReport,phoneStage,phoneWindows} from '../../../scripts/check-board-cover.mjs';
const old=JSON.parse(fs.readFileSync('lib/games/floodline-portrait-art.json','utf8'));
const groups=[
 {zone:0,slots:[[228,925],[301,925],[376,925],[260,996],[341,996]],label:[300,1080]},
 {zone:1,slots:[[225,620],[295,620],[366,621],[255,688],[334,688]],label:[292,762]},
 {zone:2,slots:[[579,674],[649,674],[720,675]],label:[651,753]},
 {zone:3,slots:[[203,347],[288,347],[372,347],[455,347]],label:[331,442]},
 {zone:4,slots:[[613,947],[691,947],[613,1011],[691,1011]],label:[656,1090]},
 {zone:6,slots:[[628,388],[692,388]],label:[690,465]},
];
const a={
 source:'/art/mora-phone-floodline-v6-c.png',image:'/art/optimized/mora-phone-floodline-v6-c.webp',boardImage:'/art/optimized/mora-phone-floodline-v6-c-board.webp',width:946,height:1663,
 crop:{left:140,top:273,width:690,height:949},
 landmarks:{roofTop:281,protectedBounds:[
 {name:'pier',bounds:[118,293,397,174]},
 {name:'lighthouse',bounds:[564,281,249,188]},
 {name:'nesting beach',bounds:[126,485,334,268]},
 {name:'mangrove roots',bounds:[465,450,371,305]},
 {name:'rock pools',bounds:[94,782,385,335]},
 {name:'sea cave',bounds:[485,772,329,352]},
 ]},
 habitats:groups.map(g=>{const xs=g.slots.map(p=>p[0]),ys=g.slots.map(p=>p[1]),w=56;return {...g,bounds:[Math.min(...xs)-w*.62,Math.min(...ys)-w*.72,Math.max(...xs)-Math.min(...xs)+w*1.24,Math.max(...ys)-Math.min(...ys)+w*1.32].map(Math.round),tokenWidth:w,summary:old.habitats.find(h=>h.zone===g.zone).summary};}),
 release:[480,835],
 animation:{water:{polygon:[[386,1265],[570,1240],[612,1325],[585,1430],[394,1425]]},foliage:[]},
 overview:{left:84,top:271,width:762,height:863},overviewImage:'/art/optimized/mora-phone-floodline-v6-c-overview.webp',
};
fs.writeFileSync('docs/concepts/2026-09-28-mora-clean-boards/floodline-v6-c-draft.json',JSON.stringify(a,null,2)+'\n');
console.log('coverage',coverReport(a).map(r=>({w:r.w,h:r.h,covers:r.covers,informational:r.informational})));
let failed=false;
for(const[w,h]of [...phoneWindows,[768,1024],[820,1180],[1024,1366]]){
 const f=paperWorldFrame(a,{width:w,height:h},phoneStage(w,h));
 const bad=a.landmarks.protectedBounds.map(l=>({name:l.name,left:f.image.x+l.bounds[0]*f.scale,right:f.image.x+(l.bounds[0]+l.bounds[2])*f.scale,top:f.image.y+l.bounds[1]*f.scale,bottom:f.image.y+(l.bounds[1]+l.bounds[3])*f.scale})).filter(l=>l.left<-.01||l.right>w+.01||l.top<100-.01||l.bottom>h+.01);
 console.log(w,h,'covers',f.covers,'tokenCss',f.scale*56,'bad',bad);
 failed ||= !f.covers||bad.length>0;
}
if(failed)process.exitCode=1;
if(process.argv.includes('--write')&&!failed){
 fs.writeFileSync('lib/games/floodline-portrait-art.json',JSON.stringify(a,null,2)+'\n');
 await sharp('public'+a.source).webp({quality:94,effort:6}).toFile('public'+a.image);
 await sharp('public'+a.source).extract(a.crop).webp({quality:94,effort:6}).toFile('public'+a.boardImage);
 await sharp('public'+a.source).extract(a.overview).webp({quality:94,effort:6}).toFile('public'+a.overviewImage);
}
