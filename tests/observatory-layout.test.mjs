import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { paperWorldFor, paperWorldFrame, paperWorldPlayBox, paperWorldTarget } from '../lib/games/mora-world.ts';
import { moraMapFor, observatoryMap } from '../lib/games/trio/mora-map.ts';
import { habitatsFor } from '../lib/games/trio/engine.ts';
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`);
const devices = [[320,568],[375,667],[390,844],[430,932],[768,1024],[568,320],[667,375],[844,390],[932,430],[1133,744],[1194,834],[1280,720],[1440,900],[1912,952],[3440,1440], ...[1.1,1.25,1.5].map(z=>[1512/z,850/z])];
for (const tall of [false,true]) {
  const art=paperWorldFor(tall);
  await test(`${tall?'portrait':'landscape'} source and crop match actual native files`, async()=>{
    const full=await sharp(`public${art.image}`).metadata();
    const crop=await sharp(`public${art.boardImage}`).metadata();
    assert.equal(full.width,art.width);assert.equal(full.height,art.height);
    assert.equal(crop.width,art.crop.width);assert.equal(crop.height,art.crop.height);
    assert.equal(tall,full.height>full.width);
    const mini=await sharp(`public${art.overviewImage}`).metadata();
    assert.equal(mini.width,art.overview.width);assert.equal(mini.height,art.overview.height);
  });
  await test(`${tall?'portrait':'landscape'} pads retain every rule capacity and source alignment`,()=>{
    const map=moraMapFor('beginner',tall);
    assert.equal(map.habitats.reduce((n,h)=>n+h.slots.length,0),17);
    for(const h of map.habitats){
      assert.equal(h.slots.length,habitatsFor('beginner')[h.zone].cap);
      const original=art.habitats.find(a=>a.zone===h.zone);
      h.slots.forEach(([x,y],i)=>{
        close(art.crop.left+x/100*art.crop.width,original.slots[i][0]);
        close(art.crop.top+y/100*art.crop.height,original.slots[i][1]);
      });
    }
    const mini=observatoryMap(tall,true);
    for(const h of mini.habitats) for(const [x,y] of [...h.slots,h.label]) assert.ok(x>=0&&x<=100&&y>=0&&y<=100);
  });
}
await test('the crop stays inside the stage while scenery covers the surface wherever it can',()=>{
  for(const [w,h] of devices){
    const tall=h>w,phone=!tall&&h<=500;
    const art=paperWorldFor(tall);
    // Same fixed stage reserves as CSS, independent of extensions and hand count.
    const stage=tall?{x:8,y:100,width:w-16,height:h-292}:phone?{x:110,y:12,width:w-220,height:h-24}:{x:0,y:Math.min(h*.16,180),width:w,height:h-Math.min(h*.16,180)-118};
    const f=paperWorldFrame(art,{width:w,height:h},stage), target=paperWorldTarget(art,f);
    close(target.width/art.width,target.height/art.height);
    close(target.x,f.image.x);close(target.y,f.image.y);
    // The play box may lean 6% of the stage height into each vertical reserve.
    const lean=tall?0:stage.height*0.06;
    const inside=(x,y)=>{
      const px=target.x+x*f.scale,py=target.y+y*f.scale;
      assert.ok(px>=stage.x-1e-7&&px<=stage.x+stage.width+1e-7&&py>=stage.y-lean-1e-7&&py<=stage.y+stage.height+lean+1e-7,`${w}×${h}: ${x},${y} mapped ${px},${py}`);
    };
    // Every pad centre, label and Release lies inside the reserved stage.
    for(const habitat of art.habitats){inside(...habitat.label);for(const s of habitat.slots)inside(...s);}
    inside(...art.release);
    // The scene never exceeds the scale at which the crop fits the stage, and never
    // leaves uncovered surface when a smaller-or-equal scale could cover it.
    const box=paperWorldPlayBox(art);const air=tall?box.width*0.03:0;const play={width:box.width+2*air,height:box.height};
    const fit=Math.min(stage.width/play.width,(stage.height+2*lean)/play.height);
    const cover=Math.max(w/art.width,h/art.height);
    assert.ok(f.scale<=fit+1e-9);
    if(cover<=fit) assert.ok(Math.abs(f.scale-cover)<1e-9,`${w}×${h} should use the cover scale`);
    else assert.ok(Math.abs(f.scale-fit)<1e-9,`${w}×${h} should fill the stage`);
    assert.equal(f.covers, target.x<=1e-6&&target.y<=1e-6&&target.x+target.width>=w-1e-6&&target.y+target.height>=h-1e-6);
  }
});
await test('desktop and tablet screens are fully covered by the woodland',()=>{
  for(const [w,h] of [[1440,900],[1512,982],[1194,834],[1133,744]]){
    const y=Math.min(h*.16,180);
    const f=paperWorldFrame(paperWorldFor(false),{width:w,height:h},{x:0,y,width:w,height:h-y-118});
    assert.ok(f.covers,`${w}×${h}`);
  }
});
await test('orientation selects genuinely different geography and static empty geometry stays finite',()=>{
  assert.notDeepEqual(paperWorldFor(false).habitats,paperWorldFor(true).habitats);
  for(const art of [paperWorldFor(false),paperWorldFor(true)]){
    const f=paperWorldFrame(art,{width:0,height:0});
    assert.ok(Number.isFinite(f.width)&&f.width>0);
    for(const layer of [art.animation.water,...art.animation.foliage]){
      assert.ok(layer.polygon.length>=3);
      for(const [x,y] of layer.polygon) assert.ok(x>=0&&y>=0&&x<=art.width&&y<=art.height);
    }
  }
});
