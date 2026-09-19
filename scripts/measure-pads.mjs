import sharp from 'sharp';
const [,, src, out] = process.argv;
const img = sharp(src);
const meta = await img.metadata();
await img.png().toFile(out);
const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
const loose = process.env.LOOSE === "1";
const isPad = (i) => { const r=data[i], g=data[i+1], b=data[i+2]; return loose ? (r>195 && g>185 && b>150 && r-b>10 && r-b<80 && Math.abs(r-g)<30) : (r>205 && g>195 && b>165 && r-b>15 && r-b<70 && Math.abs(r-g)<25); };
const seen = new Uint8Array(W*H); const comps=[];
for (let y=0;y<H;y++) for (let x=0;x<W;x++){ const p=y*W+x; if(seen[p]||!isPad(p*C)) continue;
  const stack=[p]; seen[p]=1; let n=0,sx=0,sy=0,minx=x,maxx=x,miny=y,maxy=y;
  while(stack.length){ const q=stack.pop(); const qx=q%W, qy=(q-qx)/W; n++; sx+=qx; sy+=qy; if(qx<minx)minx=qx; if(qx>maxx)maxx=qx; if(qy<miny)miny=qy; if(qy>maxy)maxy=qy;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=qx+dx, ny=qy+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue; const np=ny*W+nx; if(seen[np]||!isPad(np*C)) continue; seen[np]=1; stack.push(np);} }
  const bw=maxx-minx+1, bh=maxy-miny+1; const fill=n/(bw*bh);
  if(n>1500 && bw<260 && bh<260 && fill>0.55) comps.push({cx:Math.round(sx/n),cy:Math.round(sy/n),w:bw,h:bh,n,fill:+fill.toFixed(2)}); }
comps.sort((a,b)=>a.cy-b.cy||a.cx-b.cx);
console.log(meta.width, meta.height, comps.length); for(const c of comps) console.log(JSON.stringify(c));
