import fs from 'node:fs';
import {paperWorldFrame} from '../../../lib/games/mora-world.ts';
import {coverReport,phoneStage} from '../../../scripts/check-board-cover.mjs';
const old = JSON.parse(fs.readFileSync('lib/games/floodline-portrait-art.json','utf8'));
const groups = [
 {zone:0,slots:[[175,979],[260,979],[345,979],[204,1052],[309,1052]],label:[260,1130]},
 {zone:1,slots:[[162,607],[249,607],[336,608],[201,679],[291,680]],label:[249,757]},
 {zone:2,slots:[[619,651],[698,651],[777,651]],label:[698,742]},
 {zone:3,slots:[[240,316],[320,316],[399,316],[479,316]],label:[360,404]},
 {zone:4,slots:[[675,1004],[758,1004],[675,1067],[759,1067]],label:[717,1145]},
 {zone:6,slots:[[709,340],[788,341]],label:[749,422]},
];
const art = {
 source:'/art/mora-phone-floodline-v5-a.png',image:'/art/optimized/mora-phone-floodline-v5-a.webp',boardImage:'/art/optimized/mora-phone-floodline-v5-a-board.webp',
 width:946,height:1663,crop:{left:112,top:274,width:715,height:900},
 landmarks:{roofTop:79,protectedBounds:[
 {name:'pier',bounds:[88,181,566,248]},
 {name:'lighthouse',bounds:[610,79,284,365]},
 {name:'nesting beach',bounds:[5,438,461,342]},
 {name:'mangrove roots',bounds:[464,421,473,342]},
 {name:'rock pools',bounds:[0,774,474,423]},
 {name:'sea cave',bounds:[487,757,459,452]},
 ]},
 habitats:groups.map(g=>{const xs=g.slots.map(p=>p[0]),ys=g.slots.map(p=>p[1]),w=56;return {...g,bounds:[Math.min(...xs)-w*.62,Math.min(...ys)-w*.72,Math.max(...xs)-Math.min(...xs)+w*1.24,Math.max(...ys)-Math.min(...ys)+w*1.32],tokenWidth:w,summary:old.habitats.find(h=>h.zone===g.zone).summary};}),
 release:[477,760],animation:{water:{polygon:[[386,1265],[570,1240],[612,1325],[585,1430],[394,1425]]},foliage:[]},
 overview:{left:0,top:70,width:946,height:1150},overviewImage:'/art/optimized/mora-phone-floodline-v5-a-overview.webp'
};
fs.writeFileSync('docs/concepts/2026-09-28-mora-clean-boards/floodline-v5-a-draft.json',JSON.stringify(art,null,2)+'\n');
for(const [name,a] of [['current',old],['candidate',art]]) {
 console.log(name,JSON.stringify(coverReport(a).map(r=>({w:r.w,h:r.h,covers:r.covers,informational:r.informational}))));
 for(const [w,h] of [[390,844],[390,664],[768,1024],[1024,1366]]) {
 const f=paperWorldFrame(a,{width:w,height:h},phoneStage(w,h));
 console.log(name,w,h,JSON.stringify(f),'tokenCss',f.scale*a.habitats[0].tokenWidth);
 }
}
