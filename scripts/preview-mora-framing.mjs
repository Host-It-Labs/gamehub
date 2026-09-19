// Static artwork/target QA; these previews do not claim browser or touch acceptance.
import sharp from 'sharp';
import { paperWorldFor, paperWorldFrame, paperWorldTarget } from '../lib/games/mora-world.ts';
const out='docs/concepts/mora-paper-world-v1';
for(const [w,h] of [[390,844],[1440,900],[320,568]]) {
 const tall=h>w,art=paperWorldFor(tall);
 const top=tall?100:Math.min(h*.16,180);
 const stage={x:tall?8:0,y:top,width:w-(tall?16:0),height:h-top-(tall?192:118)};
 const f=paperWorldFrame(art,{width:w,height:h},stage);
 const target=paperWorldTarget(art,f);
 const encoded=(await sharp(`public${art.image}`).png().toBuffer()).toString('base64');
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#2f3a2a"/><image href="data:image/png;base64,${encoded}" x="${target.x}" y="${target.y}" width="${target.width}" height="${target.height}"/>`;
 const names=['Courtyard','Roof garden','Root hollows','Glasshouse trail','Dry channel','','Watchpost'];
 for(const habitat of art.habitats) {
  const x=target.x+habitat.label[0]*f.scale,y=target.y+habitat.label[1]*f.scale;
  const font=tall?Math.max(9,Math.min(13,f.width*.03)):Math.max(11,Math.min(18,f.width*.0165));
  const text=`${names[habitat.zone]} 0/${[17,14,8,12,12,0,10][habitat.zone]}`;
  svg+=`<rect x="${x-text.length*font*.25}" y="${y-font*.65}" width="${text.length*font*.5}" height="${font*1.3}" rx="2" fill="#f6ecd2"/><text x="${x}" y="${y+font*.35}" font-size="${font}" text-anchor="middle" fill="#31462e" font-family="Georgia">${text}</text>`;
  let i=0;
  for(const [sx,sy] of habitat.slots){
   const px=target.x+sx*f.scale,py=target.y+sy*f.scale,tw=habitat.tokenWidth*f.scale;
   const token=(await sharp(`public/art/optimized/mora-paper-inland-${(habitat.zone+i++)%6}-v2.webp`).png().toBuffer()).toString('base64');
   svg+=`<image href="data:image/png;base64,${token}" x="${px-tw/2}" y="${py-tw*.62}" width="${tw}" height="${tw}"/>`;
  }
 }
 svg+=`<rect width="${w}" height="${top}" fill="#fff6dd88"/><rect y="${h-(tall?174:160)}" width="${w}" height="${tall?174:160}" fill="#fff6dd88"/><text x="12" y="22" font-size="12" fill="#263e35">Static art/target check · ${w} × ${h} · reserved UI shaded</text></svg>`;
 await sharp(Buffer.from(svg)).png().toFile(`${out}/framing-${w}x${h}.png`);
}
