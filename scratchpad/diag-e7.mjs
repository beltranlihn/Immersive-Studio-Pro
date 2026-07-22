import { evalInApp } from './cdp.mjs';
const ISP = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\360\\\\Rito360.isp';
const expr = `(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelectorAll('.overlay').forEach(o=>o.remove());
  const txt=await DSP.readText(${JSON.stringify(ISP)}); loadProject(JSON.parse(txt));
  for(let i=0;i<50;i++){ if(state.media.find(m=>m.kind==='video'&&m.srcUrl))break; await w(400);}
  state.view.wcDecode=true; state.view.mode='3d'; state.playhead=Math.min(500,duration()-15);
  if(!state.playing)play();
  const snaps=[];
  for(let k=0;k<6;k++){ await w(1000); const vi=[..._vinst.values()][0]; snaps.push(vi&&vi.cd?vi.cd.stats():null); }
  pause();
  return JSON.stringify(snaps,null,1);
})()`;
console.log(await evalInApp(expr, { timeout: 30000 }));
