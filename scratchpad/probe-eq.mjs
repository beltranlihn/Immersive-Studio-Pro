// El ecualizador de 32 bandas (R144) alimentado por el archivo REAL, montado como lo haría un usuario:
// el clip de audio se elige como FUENTE reactiva, se añade un FX reactivo a un clip visual, y se mira el medidor.
import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const errs=[]; await send('Runtime.enable',{});
ws.addEventListener('message',ev=>{const x=JSON.parse(ev.data); if(x.method==='Runtime.consoleAPICalled'&&x.params.type==='error')errs.push((x.params.args||[]).map(a=>a.value||a.description||'').join(' ').slice(0,200));});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,400)};return r.result.value};

console.log('montaje  ', JSON.stringify(await evl(`(async()=>{
  const am=state.media.find(x=>x.name==='Umbral.wav'); if(!am)return {sinAudio:true};
  let ac=state.clips.find(c=>c.mediaId===am.id);
  if(!ac){ const ai=state.lanes.findIndex(l=>l.kind==='audio');
    ac={id:uid(),name:am.name,mediaId:am.id,lane:ai,start:0,dur:Math.min(20,am.dur),inP:0,props:{},kf:{},color:am.color,fadeIn:0,fadeOut:0};
    state.clips.push(ac); }
  ensureReactive().srcClipId=ac.id;                       // la fuente reactiva = el WAV real
  const vc=state.clips.find(c=>{const m=mediaById(c.mediaId);return m&&m.kind==='shape';});
  if(vc && !(vc.fx||[]).length) addFxToClip(vc,'blur',true);
  if(vc){ state.selIds=[vc.id]; state.selId=vc.id; }
  arRecompute();
  for(let i=0;i<200;i++){ if(_arCache&&_arCache.clip) break; await new Promise(r=>setTimeout(r,120)); }
  return { fuente:_arCache&&_arCache.clip?mediaById(_arCache.clip.mediaId).name:'sin armar',
    bpm:_arCache&&+(_arCache.bpm||0).toFixed(1), golpes:_arCache&&_arCache.beats?_arCache.beats.length:0 }; })()`)));

console.log('espectro ', JSON.stringify(await evl(`(()=>{
  const muestras=[0.5,3,7,12,18].map(t=>{ const c=specColAt(t); return c?{t, bandas:c.length, max:+Math.max(...c).toFixed(3), prom:+(c.reduce((a,b)=>a+b,0)/c.length).toFixed(3)}:{t,nulo:true}; });
  const a=specColAt(3), b=specColAt(12);
  const distintas=(a&&b)? a.some((v,i)=>Math.abs(v-b[i])>0.02) : null;
  return { muestras, columnasDistintasEnElTiempo:distintas }; })()`),null,1));

await wait(1200);
console.log('medidor  ', JSON.stringify(await evl(`(()=>{
  const t=document.querySelector('#inspTabs .instab[data-tab=react]'); if(t)t.click(); else { state.inspTab='react'; renderInspector(); arMeterStart(); }
  const cv=document.getElementById('arMeter'); if(!cv)return {sinMedidor:true, pestana:state.inspTab};
  const x=cv.getContext('2d'); const d=x.getImageData(0,0,cv.width,cv.height).data;
  let tinta=0; for(let i=3;i<d.length;i+=4*11) if(d[i]>10) tinta++;
  return { pestana:state.inspTab, lienzo:[cv.width,cv.height], proporcionConTinta:+(tinta/(d.length/(4*11))).toFixed(3) }; })()`)));
await wait(400);
console.log('errores :', errs.length?errs:'ninguno');
ws.close();
