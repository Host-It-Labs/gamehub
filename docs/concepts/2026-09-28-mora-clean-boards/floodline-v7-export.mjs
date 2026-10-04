import fs from 'node:fs';
import sharp from 'sharp';
import {paperWorldFrame} from '../../../lib/games/mora-world.ts';
import {phoneStage,phoneWindows,coverReport} from '../../../scripts/check-board-cover.mjs';

const a=JSON.parse(fs.readFileSync('docs/concepts/2026-09-28-mora-clean-boards/floodline-v7-a-draft.json','utf8'));
a.crop={left:140,top:253,width:690,height:975};
for(const[w,h]of phoneWindows){
 const f=paperWorldFrame(a,{width:w,height:h},phoneStage(w,h));
 const bad=a.landmarks.protectedBounds.map(l=>({name:l.name,left:f.image.x+l.bounds[0]*f.scale,right:f.image.x+(l.bounds[0]+l.bounds[2])*f.scale,top:f.image.y+l.bounds[1]*f.scale,bottom:f.image.y+(l.bounds[1]+l.bounds[3])*f.scale})).filter(l=>l.left<-.01||l.right>w+.01||l.top<100-.01||l.bottom>h+.01);
 if(!f.covers||bad.length)throw new Error(JSON.stringify({w,h,covers:f.covers,bad}));
 console.log(w,h,'covers',f.covers,'tokenCss',f.scale*56,'bottomLabel',f.image.y+1200*f.scale);
}
console.log('shortPhoneCoverage',coverReport(a).filter(r=>r.informational).map(r=>[r.w,r.h,r.covers]));
if(process.argv.includes('--write')){
 fs.writeFileSync('lib/games/floodline-phone-art.json',JSON.stringify(a,null,2)+'\n');
 await sharp('public'+a.source).webp({quality:94,effort:6}).toFile('public'+a.image);
 await sharp('public'+a.source).extract(a.crop).webp({quality:94,effort:6}).toFile('public'+a.boardImage);
 await sharp('public'+a.source).extract(a.overview).webp({quality:94,effort:6}).toFile('public'+a.overviewImage);
}
