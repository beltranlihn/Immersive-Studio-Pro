// [R226·V1] estrés de abrir/cerrar la ventana solo-visor (carrera del documento about:blank)
import { run, runIn, shot, list } from './cdp2.mjs';
import { errsHook, domeScene } from './setup.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await errsHook();
console.log('escena', JSON.stringify(await domeScene()));
for(let i=1;i<=4;i++){
  await run(`openViewerWindow(); return 1;`);
  await wait(900);
  const st = await runIn('Viewer', `const cv=document.getElementById('vwcv'); const cx=cv&&cv.getContext('2d');
    let nz=0; if(cx){ const d=cx.getImageData(0,0,cv.width,cv.height).data; for(let i=0;i<d.length;i+=97) if(d[i]>8||d[i+1]>8||d[i+2]>8) nz++; }
    return {bar:!!document.getElementById('vwbar'), cv:!!cv, title:document.title, pixelesVivos:nz};`).catch(e=>({err:e.message}));
  console.log('ciclo',i,JSON.stringify(st));
  if(i===4) console.log(await shot('v-reopen-final','Viewer'));
  await run(`if(viewerOpen())_viewerWin.close(); return 1;`);
  await wait(700);
  console.log('   tras cerrar', JSON.stringify(await run(`render(); return {open:viewerOpen(), raf:_vRaf, ed:[glc.width,glc.height]};`)));
}
console.log('__errs', await run(`return (window.__errs||[]).slice(0,6);`));
