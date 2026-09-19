import { paperWorldFor, paperWorldFrame } from '../lib/games/mora-world.ts';
for (const [width,height] of [[390,844],[768,1024],[568,320],[844,390],[1133,744],[1280,720],[1912,952],[3440,1440],[1209.6,680]]) {
 const tall=height>width,phone=!tall&&height<=500,art=paperWorldFor(tall);
 const top=tall?100:phone?12:Math.min(height*.16,180);
 const left=tall?8:phone?110:0;
 const stage={x:left,y:top,width:width-2*left,height:height-top-(tall?192:phone?12:118)};
 const frame=paperWorldFrame(art,{width,height},stage);
 const boxes=art.landmarks.protectedBounds.map(l=>l.bounds);
 const unionWidth=Math.max(...boxes.map(b=>b[0]+b[2]))-Math.min(...boxes.map(b=>b[0]));
 const unionHeight=Math.max(...boxes.map(b=>b[1]+b[3]))-Math.min(...boxes.map(b=>b[1]));
 console.log(JSON.stringify({viewport:[width,height],composition:tall?'portrait':'landscape',native:[art.width,art.height],landmarkRatio:[unionWidth/art.width,unionHeight/art.height],board:[frame.width,frame.height],sourcePixelsPerDisplayPixelAtDPR2:1/(frame.scale*2),coversSurface:frame.covers}));
}
