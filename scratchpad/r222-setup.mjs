import { evalInApp } from './cdp.mjs';
const cfg = {
  fps:30,
  walls:[
    {role:'Front',order:1,wcm:500,hcm:280,pxW:1920,pxH:1080},
    {role:'Right',order:2,wcm:400,hcm:280,pxW:1536,pxH:1080},
    {role:'Back', order:3,wcm:500,hcm:280,pxW:1920,pxH:1080},
    {role:'Left', order:4,wcm:400,hcm:280,pxW:1536,pxH:1080},
  ],
  floor:{wcm:500,dcm:400,pxW:1920,pxH:1536}
};
const r = await evalInApp(`(async function(){
  await newRoomProject(${JSON.stringify(cfg)});
  const seq = activeSeq();
  return { seqW:seq.w, seqH:seq.h, wallsH:seq.room.stripH, walls: seq.room.walls.map(w=>({role:w.role,x0:w.x0,x1:w.x1,pxW:w.pxW,pxH:w.pxH})), floor: seq.room.floor, errs:(window.__errs||[]).length };
})()`);
console.log(JSON.stringify(r,null,2));
